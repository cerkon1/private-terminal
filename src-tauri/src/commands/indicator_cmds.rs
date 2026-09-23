use std::sync::Arc;

use futures::future::join_all;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Semaphore;

use crate::indicators;
use crate::sources::yahoo;
use crate::AppState;

const HISTORY_RANGE: &str = "5y";
const MAX_CONCURRENT_FETCHES: usize = 6;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorRegistration {
    pub id: String,
    pub display_name: String,
    pub pane: indicators::PaneKind,
    pub default_params: serde_json::Value,
}

#[tauri::command]
pub fn list_indicators() -> Vec<IndicatorRegistration> {
    indicators::all_indicators()
        .iter()
        .map(|ind| IndicatorRegistration {
            id: ind.id().to_string(),
            display_name: ind.display_name().to_string(),
            pane: ind.pane_hint(),
            default_params: ind.default_params(),
        })
        .collect()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSettingOut {
    pub ticker: String,
    pub indicator_id: String,
    pub enabled: bool,
    #[serde(default)]
    pub params_json: Option<String>,
}

#[tauri::command]
pub fn get_indicator_settings(
    ticker: String,
    state: State<'_, AppState>,
) -> Result<Vec<IndicatorSettingOut>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .get_indicator_settings(&ticker)?
        .into_iter()
        .map(|r| IndicatorSettingOut {
            ticker: r.ticker,
            indicator_id: r.indicator_id,
            enabled: r.enabled,
            params_json: r.params_json,
        })
        .collect())
}

#[tauri::command]
pub fn set_indicator_setting(
    ticker: String,
    indicator_id: String,
    enabled: bool,
    params_json: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_indicator_setting(&ticker, &indicator_id, enabled, params_json.as_deref())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeRequest {
    pub ticker: String,
    pub data_source: String,
    pub indicator_ids: Vec<String>,
}

#[tauri::command(async)]
pub fn compute_indicators(
    request: ComputeRequest,
    state: State<'_, AppState>,
) -> Result<Vec<indicators::IndicatorOutput>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bars = db.all_price_bars_ohlcv(&request.ticker, &request.data_source)?;
    let settings = db.get_indicator_settings(&request.ticker)?;
    drop(db); // release lock before compute (no further DB I/O)

    let mut outputs = Vec::with_capacity(request.indicator_ids.len());
    for id in &request.indicator_ids {
        let Some(ind) = indicators::find_indicator(id) else { continue };
        // Use stored params when present, else fall back to the indicator's defaults.
        let params = settings
            .iter()
            .find(|s| &s.indicator_id == id)
            .and_then(|s| s.params_json.as_ref())
            .and_then(|j| serde_json::from_str::<serde_json::Value>(j).ok())
            .unwrap_or_else(|| ind.default_params());
        let out = ind.compute(&bars, &params)?;
        outputs.push(out);
    }
    Ok(outputs)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeFailure {
    pub ticker: String,
    pub error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeResult {
    pub primed: usize,
    pub failures: Vec<PrimeFailure>,
}

/// Yahoo tickers in enabled leaf groups that Pulse would grey out — fewer
/// usable bars than `NO_BARS_THRESHOLD`. Not "no bars at all": since v1.0.1
/// REFRESH writes the last ~5 days, and a zero-bars rule left every
/// refreshed-but-never-charted ticker greyed for good.
fn prime_targets(db: &crate::db::Db) -> Result<Vec<(String, String)>, String> {
    let sectors = db.list_sector_groups()?;
    let mut out: Vec<(String, String)> = Vec::new();
    for sg in sectors.iter().filter(|s| s.enabled) {
        let has_children = sectors
            .iter()
            .any(|s| s.parent_id.as_deref() == Some(sg.id.as_str()));
        if has_children {
            continue;
        }
        for t in db.list_tickers_in_sector(&sg.id)? {
            if t.data_source != "yahoo" {
                continue;
            }
            let key = (t.ticker, t.data_source);
            if out.contains(&key) {
                continue; // same ticker listed in two groups
            }
            if db.bar_count(&key.0, &key.1)? < crate::cross_section::compute::NO_BARS_THRESHOLD {
                out.push(key);
            }
        }
    }
    Ok(out)
}

/// Fetch + upsert 5y history for every enabled watchlist ticker Pulse would
/// grey out (see `prime_targets`). Complement to the on-demand fetch path
/// in `get_ticker_history` — this one batch-primes so Pulse sees a full
/// snapshot without the user opening each feature chart by hand. Invoked
/// from the Pulse banner's PRIME chip when greyed (no-bars) rows exist.
/// Yahoo-only (Finnhub-eligible filter isn't relevant here; every watchlist
/// row with `data_source='yahoo'` is in scope). IPC name retained for
/// backwards compat.
#[tauri::command]
pub async fn prime_scanner_histories(
    state: State<'_, AppState>,
) -> Result<PrimeResult, String> {
    // Step 1: under lock, build the target list. Drop the MutexGuard before
    // any await (it's std::sync::Mutex — not Send).
    let targets: Vec<(String, String)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        prime_targets(&db)?
    };

    if targets.is_empty() {
        return Ok(PrimeResult {
            primed: 0,
            failures: vec![],
        });
    }

    // Step 2: parallel fetch. Semaphore-capped; no DB lock held across awaits.
    let sem = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
    let fetches = targets.into_iter().map(|(ticker, data_source)| {
        let sem = sem.clone();
        async move {
            let _permit = sem.acquire_owned().await.ok();
            let result = yahoo::fetch_chart(&ticker, HISTORY_RANGE).await;
            (ticker, data_source, result)
        }
    });
    let results = join_all(fetches).await;

    // Step 3: re-lock DB, upsert successes, collect failures. Persistent
    // fetch-error column is cleared on every success and written on every
    // failure so bad symbols stay diagnosed across sessions without
    // needing the user to re-PRIME (S22).
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut primed = 0;
    let mut failures = Vec::new();
    for (ticker, data_source, result) in results {
        match result {
            Ok(bars) if !bars.is_empty() => {
                if let Err(e) = db.upsert_price_bars(&ticker, &data_source, &bars) {
                    let _ = db.set_quote_fetch_error(&ticker, &data_source, Some(&e));
                    failures.push(PrimeFailure { ticker, error: e });
                } else {
                    let _ = db.set_quote_fetch_error(&ticker, &data_source, None);
                    primed += 1;
                }
            }
            Ok(_) => {
                let msg = "Yahoo returned empty bar set";
                let _ = db.set_quote_fetch_error(&ticker, &data_source, Some(msg));
                failures.push(PrimeFailure {
                    ticker,
                    error: msg.into(),
                });
            }
            Err(e) => {
                let msg = e.to_string();
                let _ = db.set_quote_fetch_error(&ticker, &data_source, Some(&msg));
                failures.push(PrimeFailure {
                    ticker,
                    error: msg,
                });
            }
        }
    }
    Ok(PrimeResult { primed, failures })
}

#[cfg(test)]
mod tests {
    use super::prime_targets;
    use crate::db::Db;
    use crate::sources::yahoo::Bar;

    fn bars(n: usize) -> Vec<Bar> {
        (0..n)
            .map(|i| Bar {
                date: format!("2026-{:02}-{:02}", 1 + i / 28, 1 + i % 28),
                open: Some(1.0),
                high: Some(1.0),
                low: Some(1.0),
                close: Some(1.0),
                volume: None,
            })
            .collect()
    }

    #[test]
    fn prime_targets_include_refresh_only_tickers() {
        let dir = std::env::temp_dir().join(format!("pt-prime-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Db::open(&dir.join("t.db")).unwrap();
        db.initialize_schema().unwrap();
        db.migrate().unwrap();
        db.seed().unwrap();

        // ^GSPC: 5 bars from a dashboard REFRESH — still greyed in Pulse.
        db.upsert_price_bars("^GSPC", "yahoo", &bars(5)).unwrap();
        // ^DJI: enough history — not a target.
        db.upsert_price_bars("^DJI", "yahoo", &bars(40)).unwrap();

        let targets = prime_targets(&db).unwrap();
        let has = |t: &str| targets.iter().any(|(x, _)| x == t);
        assert!(has("^GSPC"), "refresh-only ticker must be primed");
        assert!(!has("^DJI"), "ticker with history must not be refetched");
        let unique: std::collections::HashSet<_> = targets.iter().collect();
        assert_eq!(unique.len(), targets.len(), "no duplicate fetches");
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
