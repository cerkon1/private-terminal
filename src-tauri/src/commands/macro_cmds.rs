use std::sync::Arc;

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use futures::future::join_all;
use serde::Serialize;
use tauri::State;
use tokio::sync::Semaphore;

use crate::config;
use crate::sources::fred;
use crate::AppState;

/// Cache freshness window. FRED publishes daily for most series; 12h is a
/// comfortable margin that avoids hammering the API during rapid reloads.
const CACHE_TTL_HOURS: i64 = 12;

/// Maximum concurrent FRED fetches on first-boot cold-cache storms.
/// FRED has no documented rate limit, but bounded concurrency keeps us polite.
const MAX_CONCURRENT_FETCHES: usize = 6;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroTileData {
    pub series_id: String,
    pub title: String,
    pub units: String,
    pub frequency: String,
    pub category: Option<String>,
    pub latest_value: Option<f64>,
    pub latest_obs_date: Option<String>,
    /// Value approximately one year before the latest observation. Used by
    /// the heatmap to compute YoY color; frontend picks absolute-vs-percent
    /// based on units.
    pub year_ago_value: Option<f64>,
    pub year_ago_obs_date: Option<String>,
    pub last_fetched: Option<String>,
    /// Present when the latest fetch failed — tile still renders from cached
    /// values. Frontend shows a soft-error indicator.
    #[serde(default)]
    pub fetch_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FredObservation {
    pub date: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FredHistory {
    pub series_id: String,
    pub title: String,
    pub units: String,
    pub observations: Vec<FredObservation>,
}

/// Single-tile command used by the original M1 smoke test. Retained because
/// the frontend falls back to this when a tile needs a forced refresh.
#[tauri::command]
pub async fn get_fred_tile(
    series_id: String,
    state: State<'_, AppState>,
) -> Result<MacroTileData, String> {
    let (api_key, meta_row, needs_refresh) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let key = config::fred_api_key(&db)
            .ok_or_else(|| fred::FredError::MissingApiKey.to_string())?;
        let row = db.get_fred_series(&series_id)?;
        let fresh = is_fresh(row.as_ref().and_then(|r| r.last_fetched.as_deref()));
        (key, row, !fresh)
    };

    let mut fetch_error: Option<String> = None;
    if needs_refresh {
        match fetch_and_upsert(&api_key, &series_id, meta_row.as_ref().and_then(|r| r.category.clone()), &state).await {
            Ok(()) => {}
            Err(e) => fetch_error = Some(e),
        }
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let row = db
        .get_fred_series(&series_id)?
        .ok_or_else(|| format!("Series {} not registered after fetch", series_id))?;
    let tile = build_tile(&db, row, fetch_error)?;
    Ok(tile)
}

/// Batch command: returns every registered FRED tile, fetching stale ones in
/// parallel with a concurrency cap. Individual fetch failures degrade to
/// cached values + an error marker on that tile — one slow/flaky series
/// doesn't block the whole dashboard.
///
/// `force = true` bypasses the cache-freshness check and re-fetches every
/// series. Used by the Refresh button.
#[tauri::command]
pub async fn list_macro_tiles(
    force: bool,
    state: State<'_, AppState>,
) -> Result<Vec<MacroTileData>, String> {
    // Phase 1: snapshot which series exist and which are stale.
    let (api_key, all_rows, stale) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let key = config::fred_api_key(&db)
            .ok_or_else(|| fred::FredError::MissingApiKey.to_string())?;
        let rows = db.list_fred_series()?;
        let stale: Vec<(String, Option<String>)> = rows
            .iter()
            .filter(|r| force || !is_fresh(r.last_fetched.as_deref()))
            .map(|r| (r.series_id.clone(), r.category.clone()))
            .collect();
        (key, rows, stale)
    };

    // Phase 2: fetch stale series in parallel under a concurrency cap.
    let errors: std::collections::HashMap<String, String> = if stale.is_empty() {
        std::collections::HashMap::new()
    } else {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
        let api_key = Arc::new(api_key);
        let state_handle = state.inner();

        let mut handles = Vec::with_capacity(stale.len());
        for (series_id, existing_category) in stale {
            let permit_src = semaphore.clone();
            let key = api_key.clone();
            let sid = series_id.clone();
            handles.push(async move {
                let _permit = permit_src.acquire_owned().await.ok();
                let res = fetch_and_upsert(&key, &sid, existing_category, state_handle).await;
                (sid, res)
            });
        }
        join_all(handles)
            .await
            .into_iter()
            .filter_map(|(sid, res)| res.err().map(|e| (sid, e)))
            .collect()
    };

    // Phase 3: build tiles from current DB state (includes any fresh upserts).
    // Hidden series (`tile_visible = 0`, e.g. v1.1 Analysis-only USREC + extra
    // treasury tenors) are still fetched in Phase 2 so analysis tools have
    // observations, but excluded from the dashboard tile list here.
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut tiles = Vec::with_capacity(all_rows.len());
    for row in all_rows {
        if !row.tile_visible {
            continue;
        }
        let sid = row.series_id.clone();
        let tile = build_tile(&db, row, errors.get(&sid).cloned())?;
        tiles.push(tile);
    }
    Ok(tiles)
}

/// Full observation history for the feature chart. Reads from DB — history is
/// always upserted alongside the latest value via fetch_observations.
#[tauri::command]
pub async fn get_fred_history(
    series_id: String,
    state: State<'_, AppState>,
) -> Result<FredHistory, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let row = db
        .get_fred_series(&series_id)?
        .ok_or_else(|| format!("Series {} not registered", series_id))?;
    let observations: Vec<FredObservation> = db
        .all_fred_observations(&series_id)?
        .into_iter()
        .map(|(date, value)| FredObservation { date, value })
        .collect();
    Ok(FredHistory {
        series_id: row.series_id,
        title: row.title.unwrap_or_default(),
        units: row.units.unwrap_or_default(),
        observations,
    })
}

// ──────────────────────────── helpers ────────────────────────────

fn is_fresh(last_fetched: Option<&str>) -> bool {
    last_fetched
        .and_then(parse_rfc3339)
        .map(|t| Utc::now().signed_duration_since(t) < Duration::hours(CACHE_TTL_HOURS))
        .unwrap_or(false)
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Fetch metadata + observations from FRED, then upsert under the DB lock.
/// Callable from both single-tile and batch paths.
async fn fetch_and_upsert(
    api_key: &str,
    series_id: &str,
    existing_category: Option<String>,
    state: &AppState,
) -> Result<(), String> {
    let meta = fred::fetch_series_meta(api_key, series_id)
        .await
        .map_err(|e| e.to_string())?;
    let observations = fred::fetch_observations(api_key, series_id)
        .await
        .map_err(|e| e.to_string())?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_fred_series(
        &meta.id,
        &meta.title,
        &meta.units,
        &meta.frequency,
        existing_category.as_deref(),
    )?;
    db.upsert_fred_observations(series_id, &observations)?;
    Ok(())
}

fn build_tile(
    db: &crate::db::Db,
    row: crate::db::FredSeriesRow,
    fetch_error: Option<String>,
) -> Result<MacroTileData, String> {
    let latest = db.latest_fred_observation(&row.series_id)?;
    let (year_ago_value, year_ago_obs_date) = if let Some((ref d, _)) = latest {
        let year_ago_target = date_minus_one_year(d).unwrap_or_else(|| d.clone());
        match db.fred_value_at_or_before(&row.series_id, &year_ago_target)? {
            Some((d, v)) => (Some(v), Some(d)),
            None => (None, None),
        }
    } else {
        (None, None)
    };

    Ok(MacroTileData {
        series_id: row.series_id,
        title: row.title.unwrap_or_default(),
        units: row.units.unwrap_or_default(),
        frequency: row.frequency.unwrap_or_default(),
        category: row.category,
        latest_value: latest.as_ref().map(|(_, v)| *v),
        latest_obs_date: latest.map(|(d, _)| d),
        year_ago_value,
        year_ago_obs_date,
        last_fetched: row.last_fetched,
        fetch_error,
    })
}

/// Subtract one year from an ISO date ("YYYY-MM-DD"). Handles Feb 29 by
/// falling back to Feb 28.
fn date_minus_one_year(date: &str) -> Option<String> {
    let d = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let year_ago = NaiveDate::from_ymd_opt(d.year() - 1, d.month(), d.day())
        .or_else(|| NaiveDate::from_ymd_opt(d.year() - 1, d.month(), 28))?;
    Some(year_ago.format("%Y-%m-%d").to_string())
}
