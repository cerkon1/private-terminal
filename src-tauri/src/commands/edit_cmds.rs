//! Ticker + sector_group CRUD commands (M8 Phase 1).
//!
//! Deletes are soft (`user_hidden=1`) so the seed's `INSERT OR IGNORE` on
//! every boot doesn't revive them. Creates are upserts that clear
//! `user_hidden` — so re-adding a previously-hidden row restores it cleanly.
//!
//! `data_source` on tickers is inherited from the parent sector_group at
//! insert time (no UI exposure) — matches CLAUDE.md "extensibility-first"
//! by keeping the fetcher-dispatch column consistent across a group.

use rusqlite::params;
use serde::{de::Deserializer, Deserialize, Serialize};
use tauri::State;

use crate::AppState;

/// Distinguishes "absent" from "null" when used with `#[serde(default)]` on
/// an `Option<Option<T>>` field — absent → `None`, null → `Some(None)`,
/// value → `Some(Some(v))`. Used by `UpdateSectorGroupInput.new_parent_id`
/// to express "leave alone" vs. "move to top level" in one IPC payload.
fn deserialize_some<'de, T, D>(deserializer: D) -> Result<Option<T>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    T::deserialize(deserializer).map(Some)
}

// ──────────── validation ────────────

fn validate_ticker(raw: &str) -> Result<String, String> {
    let t = raw.trim().to_uppercase();
    if t.is_empty() {
        return Err("ticker cannot be empty".into());
    }
    if t.len() > 15 {
        return Err("ticker too long (max 15 chars)".into());
    }
    Ok(t)
}

fn validate_group_id(raw: &str) -> Result<String, String> {
    let id = raw.trim().to_lowercase();
    if id.is_empty() {
        return Err("group id cannot be empty".into());
    }
    if id.len() > 40 {
        return Err("group id too long (max 40 chars)".into());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("group id must be lowercase letters / digits / underscore".into());
    }
    Ok(id)
}

fn validate_display_name(raw: &str) -> Result<String, String> {
    let n = raw.trim().to_string();
    if n.is_empty() {
        return Err("display name cannot be empty".into());
    }
    if n.chars().count() > 80 {
        return Err("display name too long (max 80 chars)".into());
    }
    Ok(n)
}

// ──────────── DTOs ────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTickerInput {
    pub ticker: String,
    pub sector_group_id: String,
    pub display_name: Option<String>,
    pub display_currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTickerInput {
    pub ticker: String,
    pub sector_group_id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub display_currency: Option<String>,
    /// If Some, move the ticker to this sector group (preserving ticker symbol
    /// + price history + indicator settings). Validated to exist.
    #[serde(default)]
    pub new_sector_group_id: Option<String>,
    #[serde(default)]
    pub display_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSectorGroupInput {
    pub id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub display_name: String,
    pub data_source: String,
    #[serde(default)]
    pub display_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSectorGroupInput {
    pub id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub display_order: Option<i64>,
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Tri-state — see `deserialize_some`:
    ///   absent          → leave parent_id unchanged
    ///   Some(None)      → move to top-level (parent_id = NULL)
    ///   Some(Some(pid)) → move under `pid` (must be top-level itself)
    #[serde(default, deserialize_with = "deserialize_some")]
    pub new_parent_id: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerOrderEntry {
    pub ticker: String,
    pub sector_group_id: String,
    pub display_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupOrderEntry {
    pub id: String,
    pub display_order: i64,
}

/// Outcome of `purge_ticker`. Distinguishes a "hide-only" purge (ticker still
/// has visible occurrences in other groups, so cached data was kept) from a
/// full cascade purge (last visible occurrence — bars/quotes/indicator
/// settings/per-ticker news all dropped).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeResult {
    pub cascaded: bool,
    pub bars_deleted: usize,
    pub quote_deleted: bool,
    pub indicator_settings_deleted: usize,
    pub news_items_deleted: usize,
}

// ──────────── ticker commands ────────────

#[tauri::command]
pub async fn add_ticker(
    input: AddTickerInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ticker = validate_ticker(&input.ticker)?;
    let sector_group_id = validate_group_id(&input.sector_group_id)?;
    let display_name = input
        .display_name
        .as_deref()
        .map(validate_display_name)
        .transpose()?;

    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Inherit data_source from the parent group. Also validates group exists.
    let data_source: String = db
        .connection()
        .query_row(
            "SELECT data_source FROM sector_groups WHERE id = ?1 AND user_hidden = 0",
            params![sector_group_id],
            |r| r.get(0),
        )
        .map_err(|_| format!("sector group '{}' not found or hidden", sector_group_id))?;

    // Compute next display_order within the group. Two-query flow avoids
    // subquery-in-VALUES edge cases.
    let next_order: i64 = db
        .connection()
        .query_row(
            "SELECT COALESCE(MAX(display_order), -1) + 1 FROM watchlist_tickers \
             WHERE sector_group_id = ?1",
            params![sector_group_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Upsert: if the row already exists (e.g. previously user-hidden), clear
    // the flag + update display fields. Primary key is (ticker, sector_group_id).
    db.connection()
        .execute(
            "INSERT INTO watchlist_tickers \
               (ticker, sector_group_id, data_source, display_name, display_currency, \
                display_order, enabled, user_hidden) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 0) \
             ON CONFLICT(ticker, sector_group_id) DO UPDATE SET \
               display_name = COALESCE(excluded.display_name, watchlist_tickers.display_name), \
               display_currency = COALESCE(excluded.display_currency, watchlist_tickers.display_currency), \
               user_hidden = 0, \
               enabled = 1",
            params![
                ticker,
                sector_group_id,
                data_source,
                display_name,
                input.display_currency,
                next_order,
            ],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_ticker(
    ticker: String,
    sector_group_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ticker = validate_ticker(&ticker)?;
    let sector_group_id = validate_group_id(&sector_group_id)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = db
        .connection()
        .execute(
            "UPDATE watchlist_tickers SET user_hidden = 1 \
             WHERE ticker = ?1 AND sector_group_id = ?2",
            params![ticker, sector_group_id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("ticker {}/{} not found", ticker, sector_group_id));
    }
    Ok(())
}

/// Hard-delete: permanently remove a ticker and (when this was its last
/// visible occurrence) cascade-delete its cached data — price history,
/// quote cache, indicator settings, and per-ticker Finnhub news.
///
/// Revival policy (option C from the M8.5 design): the watchlist row is
/// **soft-deleted** (`user_hidden = 1`) so seed.sql's `INSERT OR IGNORE`
/// stays a no-op on next boot. The data tables are wiped outright when no
/// other visible group still references the same `(ticker, data_source)`.
/// If another group still references it (same ticker present in two
/// watchlists), only this row is hidden — cached data is preserved for the
/// remaining consumer.
///
/// `indicator_settings` is keyed on `ticker` only (not `data_source`), so
/// it's only safe to drop when *no* visible occurrence under any data
/// source remains. Same check applies via `visible_count`.
#[tauri::command]
pub async fn purge_ticker(
    ticker: String,
    sector_group_id: String,
    data_source: String,
    state: State<'_, AppState>,
) -> Result<PurgeResult, String> {
    let ticker = validate_ticker(&ticker)?;
    let sector_group_id = validate_group_id(&sector_group_id)?;
    let data_source = data_source.trim().to_string();
    if data_source.is_empty() {
        return Err("data_source cannot be empty".into());
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();

    let rows = conn
        .execute(
            "UPDATE watchlist_tickers SET user_hidden = 1 \
             WHERE ticker = ?1 AND sector_group_id = ?2",
            params![ticker, sector_group_id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("ticker {}/{} not found", ticker, sector_group_id));
    }

    // Count *other* visible occurrences of this ticker. Same string can
    // legitimately appear under multiple groups; only cascade when this hide
    // leaves zero visible references.
    let visible_under_source: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM watchlist_tickers \
             WHERE ticker = ?1 AND data_source = ?2 AND user_hidden = 0",
            params![ticker, data_source],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let visible_anywhere: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM watchlist_tickers \
             WHERE ticker = ?1 AND user_hidden = 0",
            params![ticker],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let mut result = PurgeResult {
        cascaded: false,
        bars_deleted: 0,
        quote_deleted: false,
        indicator_settings_deleted: 0,
        news_items_deleted: 0,
    };

    if visible_under_source > 0 {
        // Another group still consumes (ticker, data_source) cached data.
        // Hide-only — leave the cache rows.
        return Ok(result);
    }

    // Wrap the cascade in a single transaction so a mid-cascade failure
    // doesn't leave the cache half-purged.
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    let inner: Result<(), String> = (|| {
        let bars = conn
            .execute(
                "DELETE FROM price_history WHERE ticker = ?1 AND data_source = ?2",
                params![ticker, data_source],
            )
            .map_err(|e| e.to_string())?;
        result.bars_deleted = bars;

        let quote = conn
            .execute(
                "DELETE FROM quote_cache WHERE ticker = ?1 AND data_source = ?2",
                params![ticker, data_source],
            )
            .map_err(|e| e.to_string())?;
        result.quote_deleted = quote > 0;

        // indicator_settings has no data_source column. Drop only when the
        // ticker has no visible references *anywhere* (any group, any source).
        if visible_anywhere == 0 {
            let inds = conn
                .execute(
                    "DELETE FROM indicator_settings WHERE ticker = ?1",
                    params![ticker],
                )
                .map_err(|e| e.to_string())?;
            result.indicator_settings_deleted = inds;

            // Per-ticker Finnhub news: same ticker-only keying, same scope.
            // General/category news isn't keyed on ticker — leave it alone.
            let news = conn
                .execute(
                    "DELETE FROM news_items WHERE ticker = ?1 AND source = 'finnhub_ticker'",
                    params![ticker],
                )
                .map_err(|e| e.to_string())?;
            result.news_items_deleted = news;
        }

        result.cascaded = true;
        Ok(())
    })();
    match inner {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string())?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn update_ticker(
    input: UpdateTickerInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ticker = validate_ticker(&input.ticker)?;
    let sector_group_id = validate_group_id(&input.sector_group_id)?;
    let new_sector_group_id = input
        .new_sector_group_id
        .as_deref()
        .map(validate_group_id)
        .transpose()?;
    let display_name = input
        .display_name
        .as_deref()
        .map(validate_display_name)
        .transpose()?;

    let db = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(new_group) = new_sector_group_id.as_deref() {
        // Validate target group exists + not hidden. Then update the row's
        // sector_group_id. SQLite allows updating part of a composite PK —
        // nothing references watchlist_tickers by FK, so this is safe.
        let target_exists: bool = db
            .connection()
            .query_row(
                "SELECT 1 FROM sector_groups WHERE id = ?1 AND user_hidden = 0",
                params![new_group],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !target_exists {
            return Err(format!("target sector group '{}' not found", new_group));
        }
        // If a hidden row already exists at (ticker, new_group), clear it first
        // to avoid a PK collision on the update.
        db.connection()
            .execute(
                "DELETE FROM watchlist_tickers \
                 WHERE ticker = ?1 AND sector_group_id = ?2 AND user_hidden = 1",
                params![ticker, new_group],
            )
            .map_err(|e| e.to_string())?;
    }

    // Build UPDATE with COALESCE so omitted fields don't wipe current values.
    // display_order is explicit because 0 is a valid value that COALESCE over
    // would preserve — use Option<i64> directly via a branch.
    let target_group = new_sector_group_id.as_deref().unwrap_or(&sector_group_id);
    let rows = db
        .connection()
        .execute(
            "UPDATE watchlist_tickers SET \
               display_name = COALESCE(?3, display_name), \
               display_currency = COALESCE(?4, display_currency), \
               sector_group_id = ?5, \
               display_order = COALESCE(?6, display_order) \
             WHERE ticker = ?1 AND sector_group_id = ?2 AND user_hidden = 0",
            params![
                ticker,
                sector_group_id,
                display_name,
                input.display_currency,
                target_group,
                input.display_order,
            ],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("ticker {}/{} not found", ticker, sector_group_id));
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_tickers(
    entries: Vec<TickerOrderEntry>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    let result: Result<(), String> = (|| {
        let mut stmt = conn
            .prepare(
                "UPDATE watchlist_tickers SET display_order = ?3 \
                 WHERE ticker = ?1 AND sector_group_id = ?2",
            )
            .map_err(|e| e.to_string())?;
        for e in &entries {
            let ticker = validate_ticker(&e.ticker)?;
            let sector_group_id = validate_group_id(&e.sector_group_id)?;
            stmt.execute(params![ticker, sector_group_id, e.display_order])
                .map_err(|err| err.to_string())?;
        }
        Ok(())
    })();
    match result {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string())?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }
    Ok(())
}

// ──────────── sector_group commands ────────────

#[tauri::command]
pub async fn create_sector_group(
    input: CreateSectorGroupInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_group_id(&input.id)?;
    let display_name = validate_display_name(&input.display_name)?;
    let parent_id = input
        .parent_id
        .as_deref()
        .map(validate_group_id)
        .transpose()?;
    let data_source = input.data_source.trim().to_string();
    if data_source.is_empty() {
        return Err("data_source cannot be empty".into());
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();

    if let Some(p) = parent_id.as_deref() {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM sector_groups WHERE id = ?1 AND user_hidden = 0",
                params![p],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !exists {
            return Err(format!("parent sector group '{}' not found", p));
        }
    }

    let display_order: i64 = match input.display_order {
        Some(v) => v,
        None => conn
            .query_row(
                "SELECT COALESCE(MAX(display_order), 0) + 1 FROM sector_groups",
                [],
                |r| r.get(0),
            )
            .unwrap_or(1),
    };

    conn.execute(
        "INSERT INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled, user_hidden) \
         VALUES (?1, ?2, ?3, ?4, ?5, 1, 0) \
         ON CONFLICT(id) DO UPDATE SET \
           parent_id = excluded.parent_id, \
           display_name = excluded.display_name, \
           data_source = excluded.data_source, \
           display_order = excluded.display_order, \
           user_hidden = 0, \
           enabled = 1",
        params![id, parent_id, display_name, data_source, display_order],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_sector_group(
    input: UpdateSectorGroupInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_group_id(&input.id)?;
    let display_name = input
        .display_name
        .as_deref()
        .map(validate_display_name)
        .transpose()?;
    let enabled_int: Option<i64> = input.enabled.map(|b| if b { 1 } else { 0 });

    // Normalise the reparent payload, validating the id-shape early.
    let new_parent: Option<Option<String>> = match input.new_parent_id {
        None => None,
        Some(None) => Some(None),
        Some(Some(raw)) => {
            let pid = validate_group_id(&raw)?;
            if pid == id {
                return Err("a group cannot be its own parent".into());
            }
            Some(Some(pid))
        }
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();

    // 2-level cap: target parent must itself be top-level, and the group
    // being moved must not have its own children (otherwise they'd land at
    // depth 3). Only enforced when moving to a non-null parent.
    if let Some(Some(pid)) = new_parent.as_ref() {
        let target_parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM sector_groups WHERE id = ?1 AND user_hidden = 0",
                params![pid],
                |r| r.get(0),
            )
            .map_err(|_| format!("target sector group '{}' not found", pid))?;
        if target_parent.is_some() {
            return Err(format!(
                "target group '{}' is itself a sub-group; nesting is capped at 2 levels",
                pid
            ));
        }

        let own_children: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sector_groups \
                 WHERE parent_id = ?1 AND user_hidden = 0",
                params![id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if own_children > 0 {
            return Err(format!(
                "group '{}' has {} child group(s); move or delete them before reparenting",
                id, own_children
            ));
        }
    }

    // parent_id needs explicit gating — COALESCE can't tell "leave alone"
    // from "set to NULL". Use a flag column to drive a CASE expression.
    let (apply_parent, parent_value): (i64, Option<String>) = match &new_parent {
        None => (0, None),
        Some(None) => (1, None),
        Some(Some(pid)) => (1, Some(pid.clone())),
    };

    let rows = conn
        .execute(
            "UPDATE sector_groups SET \
               display_name = COALESCE(?2, display_name), \
               display_order = COALESCE(?3, display_order), \
               enabled = COALESCE(?4, enabled), \
               parent_id = CASE WHEN ?5 = 1 THEN ?6 ELSE parent_id END \
             WHERE id = ?1 AND user_hidden = 0",
            params![
                id,
                display_name,
                input.display_order,
                enabled_int,
                apply_parent,
                parent_value
            ],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("sector group '{}' not found", id));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_sector_group(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_group_id(&id)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();

    // Block delete if the group still has visible tickers — avoids surprise
    // cascades. User must empty the group first.
    let visible_tickers: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM watchlist_tickers \
             WHERE sector_group_id = ?1 AND user_hidden = 0",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if visible_tickers > 0 {
        return Err(format!(
            "group '{}' has {} ticker(s) — remove or move them first",
            id, visible_tickers
        ));
    }

    // Block delete if the group has visible child sector_groups (e.g. trying
    // to delete `ca_equities` while its sub-sectors are still present).
    let visible_children: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sector_groups \
             WHERE parent_id = ?1 AND user_hidden = 0",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if visible_children > 0 {
        return Err(format!(
            "group '{}' has {} child group(s) — delete or move them first",
            id, visible_children
        ));
    }

    let rows = conn
        .execute(
            "UPDATE sector_groups SET user_hidden = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("sector group '{}' not found", id));
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_sector_groups(
    entries: Vec<GroupOrderEntry>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    let result: Result<(), String> = (|| {
        let mut stmt = conn
            .prepare("UPDATE sector_groups SET display_order = ?2 WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        for e in &entries {
            let id = validate_group_id(&e.id)?;
            stmt.execute(params![id, e.display_order])
                .map_err(|err| err.to_string())?;
        }
        Ok(())
    })();
    match result {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e| e.to_string())?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }
    Ok(())
}
