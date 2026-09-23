//! Private per-ticker notes (v1.1). Plain text in the local SQLite file —
//! never sent anywhere. Keyed by (ticker, data_source) like every other
//! per-ticker cache.

use serde::Serialize;
use tauri::State;

use crate::commands::edit_cmds::validate_ticker;
use crate::AppState;

/// Generous cap: a long-running journal fits; a runaway paste doesn't bloat
/// every backup.
const MAX_NOTE_CHARS: usize = 100_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerNote {
    pub body: String,
    pub updated_at: String,
}

fn validate_source(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() || s.len() > 32 {
        return Err("invalid data_source".into());
    }
    Ok(s.to_string())
}

/// Trailing whitespace is dropped (a note that is only whitespace is
/// deleted); leading indentation is kept.
fn normalize_body(body: &str) -> Result<&str, String> {
    let body = body.trim_end();
    if body.trim_start().is_empty() {
        return Ok("");
    }
    if body.chars().count() > MAX_NOTE_CHARS {
        return Err(format!("note too long (max {MAX_NOTE_CHARS} characters)"));
    }
    Ok(body)
}

#[tauri::command]
pub fn get_ticker_note(
    ticker: String,
    data_source: String,
    state: State<'_, AppState>,
) -> Result<Option<TickerNote>, String> {
    let ticker = validate_ticker(&ticker)?;
    let data_source = validate_source(&data_source)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .get_ticker_note(&ticker, &data_source)?
        .map(|(body, updated_at)| TickerNote { body, updated_at }))
}

/// Save a note; an empty body deletes it. Returns the saved note (None when
/// deleted) so the UI can show "Saved 14:32".
#[tauri::command]
pub fn set_ticker_note(
    ticker: String,
    data_source: String,
    body: String,
    state: State<'_, AppState>,
) -> Result<Option<TickerNote>, String> {
    let ticker = validate_ticker(&ticker)?;
    let data_source = validate_source(&data_source)?;
    let body = normalize_body(&body)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .set_ticker_note(&ticker, &data_source, body)?
        .map(|updated_at| TickerNote { body: body.to_string(), updated_at }))
}

#[cfg(test)]
mod tests {
    use super::{normalize_body, MAX_NOTE_CHARS};
    use crate::db::Db;

    #[test]
    fn body_normalization() {
        assert_eq!(normalize_body("  \n\t ").unwrap(), "");
        assert_eq!(normalize_body("  - thesis\n\n").unwrap(), "  - thesis");
        assert!(normalize_body(&"x".repeat(MAX_NOTE_CHARS + 1)).is_err());
        assert!(normalize_body(&"é".repeat(MAX_NOTE_CHARS)).is_ok()); // chars, not bytes
    }

    #[test]
    fn set_get_and_delete_on_empty() {
        let dir = std::env::temp_dir().join(format!("pt-notes-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Db::open(&dir.join("t.db")).unwrap();
        db.initialize_schema().unwrap();

        assert!(db.get_ticker_note("SPY", "yahoo").unwrap().is_none());
        assert!(db.set_ticker_note("SPY", "yahoo", "long thesis").unwrap().is_some());
        assert_eq!(db.get_ticker_note("SPY", "yahoo").unwrap().unwrap().0, "long thesis");
        assert!(db.tickers_with_notes().unwrap().contains(&("SPY".into(), "yahoo".into())));
        assert!(db.get_ticker_note("SPY", "coingecko").unwrap().is_none(), "keyed by data_source");

        assert!(db.set_ticker_note("SPY", "yahoo", "").unwrap().is_none());
        assert!(db.get_ticker_note("SPY", "yahoo").unwrap().is_none());
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
