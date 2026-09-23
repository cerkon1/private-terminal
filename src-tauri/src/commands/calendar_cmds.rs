//! Economic calendar (v1.1): upcoming FRED release dates for the MACRO
//! series. Same host and key as the MACRO tiles (api.stlouisfed.org) — no new
//! outbound destination. Fetch-on-view with a 24 h cache, like every other
//! source; nothing runs in the background.

use std::collections::{BTreeMap, HashSet};
use std::sync::Arc;

use chrono::{DateTime, Duration, NaiveDate, Utc};
use chrono_tz::America::New_York;
use futures::future::join_all;
use serde::Serialize;
use tauri::State;
use tokio::sync::Semaphore;

use crate::config;
use crate::sources::fred;
use crate::AppState;

/// Release schedules change rarely; one refresh a day is plenty.
const CALENDAR_TTL_HOURS: i64 = 24;
/// How far ahead the calendar looks.
const HORIZON_DAYS: i64 = 45;
const MAX_CONCURRENT_FETCHES: usize = 6;
/// Rust-side config key (not reachable through the session-key IPC).
const LAST_FETCHED_KEY: &str = "calendar.last_fetched";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEntry {
    pub date: String,
    pub release_id: i64,
    pub release_name: String,
    pub series_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarResponse {
    pub entries: Vec<CalendarEntry>,
    /// Today in New York (YYYY-MM-DD). Release dates are US dates, so the UI
    /// labels "Today" / "Tomorrow" against this, not the local clock (a
    /// Hong Kong afternoon is already tomorrow).
    pub today: String,
    /// No FRED key — the UI shows a hint instead of an empty calendar.
    pub missing_key: bool,
    /// First fetch error of this refresh, if any (entries still show cache).
    #[serde(default)]
    pub error: Option<String>,
}

/// Group `(date, release_id, release_name, series_id)` rows (date-ordered)
/// into one entry per (date, release).
pub(crate) fn assemble_calendar(rows: Vec<(String, i64, String, String)>) -> Vec<CalendarEntry> {
    let mut grouped: BTreeMap<(String, String, i64), Vec<String>> = BTreeMap::new();
    for (date, release_id, name, series_id) in rows {
        grouped.entry((date, name, release_id)).or_default().push(series_id);
    }
    grouped
        .into_iter()
        .map(|((date, release_name, release_id), series_ids)| CalendarEntry {
            date,
            release_id,
            release_name,
            series_ids,
        })
        .collect()
}

pub(crate) fn is_stale(last_fetched: Option<&str>, now: DateTime<Utc>) -> bool {
    match last_fetched.and_then(|s| DateTime::parse_from_rfc3339(s).ok()) {
        Some(t) => now.signed_duration_since(t.with_timezone(&Utc)) >= Duration::hours(CALENDAR_TTL_HOURS),
        None => true,
    }
}

/// Today's date in New York — release dates are US calendar dates.
fn us_today() -> NaiveDate {
    Utc::now().with_timezone(&New_York).date_naive()
}

#[tauri::command]
pub async fn list_release_calendar(
    force: bool,
    state: State<'_, AppState>,
) -> Result<CalendarResponse, String> {
    // Phase 1 (lock): key, series → release mapping, staleness.
    let (api_key, series, stale) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let key = config::fred_api_key(&db);
        let series = db.calendar_series()?;
        let last = db.get_config(LAST_FETCHED_KEY)?;
        (key, series, force || is_stale(last.as_deref(), Utc::now()))
    };
    let Some(api_key) = api_key else {
        return Ok(CalendarResponse {
            entries: vec![],
            today: us_today().format("%Y-%m-%d").to_string(),
            missing_key: true,
            error: None,
        });
    };

    let unmapped: Vec<String> = series
        .iter()
        .filter(|(_, rid)| rid.is_none())
        .map(|(sid, _)| sid.clone())
        .collect();
    let mut first_error: Option<String> = None;

    if stale || !unmapped.is_empty() {
        // Phase 2 (no lock): map any unmapped series, then refresh dates.
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
        let key = Arc::new(api_key);

        let mapped = join_all(unmapped.iter().cloned().map(|sid| {
            let (sem, key) = (semaphore.clone(), key.clone());
            async move {
                let _permit = sem.acquire_owned().await.ok();
                let res = fred::fetch_series_release(&key, &sid).await;
                (sid, res)
            }
        }))
        .await;

        let mut release_ids: HashSet<i64> = series.iter().filter_map(|(_, rid)| *rid).collect();
        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            for (sid, res) in &mapped {
                match res {
                    Ok(Some(r)) => {
                        db.set_series_release(sid, r.id, &r.name, r.link.as_deref())?;
                        release_ids.insert(r.id);
                    }
                    Ok(None) => {}
                    Err(e) => {
                        first_error.get_or_insert_with(|| format!("{sid}: {e}"));
                    }
                }
            }
        }

        if stale {
            let dated = join_all(release_ids.into_iter().map(|rid| {
                let (sem, key) = (semaphore.clone(), key.clone());
                async move {
                    let _permit = sem.acquire_owned().await.ok();
                    let res = fred::fetch_release_dates(&key, rid).await;
                    (rid, res)
                }
            }))
            .await;
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let mut all_ok = true;
            for (rid, res) in dated {
                match res {
                    Ok(dates) => db.replace_release_dates(rid, &dates)?,
                    Err(e) => {
                        all_ok = false;
                        first_error.get_or_insert_with(|| format!("release {rid}: {e}"));
                    }
                }
            }
            // Only a clean refresh resets the clock; a partial one retries
            // on the next MACRO visit.
            if all_ok {
                db.set_config(LAST_FETCHED_KEY, &Utc::now().to_rfc3339())?;
            }
        }
    }

    // Phase 3 (lock): read the window from the cache.
    let today = us_today();
    let from = today.format("%Y-%m-%d").to_string();
    let to = (today + Duration::days(HORIZON_DAYS)).format("%Y-%m-%d").to_string();
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let entries = assemble_calendar(db.release_calendar_rows(&from, &to)?);
    Ok(CalendarResponse { entries, today: from, missing_key: false, error: first_error })
}

#[cfg(test)]
mod tests {
    use super::{assemble_calendar, is_stale, CalendarEntry};
    use crate::db::Db;
    use chrono::{TimeZone, Utc};

    #[test]
    fn groups_series_under_their_release_and_date() {
        let rows = vec![
            ("2026-10-02".into(), 50, "Employment Situation".into(), "PAYEMS".into()),
            ("2026-10-02".into(), 50, "Employment Situation".into(), "UNRATE".into()),
            ("2026-10-15".into(), 10, "Consumer Price Index".into(), "CPIAUCSL".into()),
        ];
        assert_eq!(
            assemble_calendar(rows),
            vec![
                CalendarEntry { date: "2026-10-02".into(), release_id: 50, release_name: "Employment Situation".into(), series_ids: vec!["PAYEMS".into(), "UNRATE".into()] },
                CalendarEntry { date: "2026-10-15".into(), release_id: 10, release_name: "Consumer Price Index".into(), series_ids: vec!["CPIAUCSL".into()] },
            ]
        );
    }

    #[test]
    fn ttl() {
        let now = Utc.with_ymd_and_hms(2026, 9, 23, 12, 0, 0).unwrap();
        assert!(is_stale(None, now));
        assert!(is_stale(Some("garbage"), now));
        assert!(!is_stale(Some("2026-09-23T00:00:00+00:00"), now));
        assert!(is_stale(Some("2026-09-22T11:59:00+00:00"), now));
    }

    #[test]
    fn calendar_window_skips_daily_and_hidden_series() {
        let dir = std::env::temp_dir().join(format!("pt-cal-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Db::open(&dir.join("t.db")).unwrap();
        db.initialize_schema().unwrap();
        db.migrate().unwrap();
        let conn = db.connection();
        conn.execute_batch(
            "INSERT INTO fred_series (series_id, frequency, tile_visible) VALUES
               ('CPIAUCSL', 'Monthly', 1), ('DGS10', 'Daily', 1), ('USREC', 'Monthly', 0);",
        )
        .unwrap();
        for sid in ["CPIAUCSL", "DGS10", "USREC"] {
            db.set_series_release(sid, 10, "Consumer Price Index", None).unwrap();
        }
        db.replace_release_dates(10, &["2026-09-01".into(), "2026-10-15".into(), "2027-06-01".into()]).unwrap();

        assert_eq!(db.calendar_series().unwrap(), vec![("CPIAUCSL".to_string(), Some(10))]);
        let rows = db.release_calendar_rows("2026-09-23", "2026-11-07").unwrap();
        assert_eq!(rows, vec![("2026-10-15".into(), 10, "Consumer Price Index".into(), "CPIAUCSL".into())]);

        // A refresh replaces, not appends.
        db.replace_release_dates(10, &["2026-11-12".into()]).unwrap();
        assert!(db.release_calendar_rows("2026-09-23", "2026-11-07").unwrap().is_empty());
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
