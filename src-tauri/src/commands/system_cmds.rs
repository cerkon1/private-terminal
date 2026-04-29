use std::path::{Path, PathBuf};
use std::time::Instant;

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::config;
use crate::db;
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    /// Total disk footprint = main file + WAL sidecar + SHM sidecar.
    /// Matches what `db_maintenance` reports as before/after, so callers
    /// don't see two different "size" numbers.
    pub size_bytes: u64,
    pub main_bytes: u64,
    pub wal_bytes: u64,
    pub series_count: i64,
    pub observation_count: i64,
}

#[tauri::command]
pub fn get_db_info(state: State<'_, AppState>) -> Result<DbInfo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let path = db.path().to_path_buf();
    let main_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let mut wal_path = path.as_os_str().to_owned();
    wal_path.push("-wal");
    let mut shm_path = path.as_os_str().to_owned();
    shm_path.push("-shm");
    let wal_bytes = std::fs::metadata(&wal_path).map(|m| m.len()).unwrap_or(0);
    let shm_bytes = std::fs::metadata(&shm_path).map(|m| m.len()).unwrap_or(0);
    let series_count = db.count("fred_series")?;
    let observation_count = db.count("fred_observations")?;
    Ok(DbInfo {
        path: path.to_string_lossy().to_string(),
        size_bytes: main_bytes + wal_bytes + shm_bytes,
        main_bytes,
        wal_bytes,
        series_count,
        observation_count,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub price_history_rows: i64,
    pub quote_cache_rows: i64,
    pub indicator_settings_rows: i64,
    pub news_items_rows: i64,
    pub watchlist_visible: i64,
    pub watchlist_hidden: i64,
}

#[tauri::command]
pub fn get_storage_stats(state: State<'_, AppState>) -> Result<StorageStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();
    let count = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |r| r.get(0)).map_err(|e| e.to_string())
    };
    Ok(StorageStats {
        price_history_rows: count("SELECT COUNT(*) FROM price_history")?,
        quote_cache_rows: count("SELECT COUNT(*) FROM quote_cache")?,
        indicator_settings_rows: count("SELECT COUNT(*) FROM indicator_settings")?,
        news_items_rows: count("SELECT COUNT(*) FROM news_items")?,
        watchlist_visible: count(
            "SELECT COUNT(*) FROM watchlist_tickers WHERE user_hidden = 0",
        )?,
        watchlist_hidden: count(
            "SELECT COUNT(*) FROM watchlist_tickers WHERE user_hidden = 1",
        )?,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceResult {
    pub before_bytes: u64,
    pub after_bytes: u64,
    pub integrity_ok: bool,
    pub integrity_message: String,
    pub wal_frames_checkpointed: i64,
    /// True when either checkpoint pass returned `busy=1` — the WAL file
    /// couldn't be fully truncated because another reader was holding a
    /// snapshot. Result is still valid, just less complete.
    pub wal_checkpoint_blocked: bool,
    pub duration_ms: u64,
}

/// Combined SQLite housekeeping. Runs four operations sequentially:
///
/// 1. `PRAGMA integrity_check` — fast, readonly, one-row-per-issue (or
///    `"ok"` when clean). Doesn't change data.
/// 2. `PRAGMA wal_checkpoint(TRUNCATE)` — flushes any old WAL frames into
///    the main DB file and truncates `db-wal` to zero.
/// 3. `VACUUM` — rebuilds the main DB file in place, reclaiming space from
///    deleted rows. Holds an exclusive lock for the duration; small DBs
///    finish in ms, larger DBs in seconds.
/// 4. **Second** `wal_checkpoint(TRUNCATE)` — VACUUM in WAL mode writes
///    the rebuild as new WAL frames (often as large as the DB itself).
///    Without this final pass, on-disk size doubles temporarily until the
///    next auto-checkpoint. Always run it.
///
/// `PRAGMA wal_checkpoint` returns `(busy, log, checkpointed)`:
///   busy        — 1 if blocked by a concurrent reader, 0 otherwise
///   log         — total frames currently in the WAL
///   checkpointed — frames moved into the main DB by this call
///
/// Reports total on-disk footprint (`db` + `db-wal` + `db-shm`) before
/// and after.
#[tauri::command]
pub fn db_maintenance(state: State<'_, AppState>) -> Result<MaintenanceResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();
    let path = db.path().to_path_buf();

    let started = Instant::now();
    let before_bytes = total_db_footprint(&path);

    let mut integrity_messages: Vec<String> = conn
        .prepare("PRAGMA integrity_check")
        .map_err(|e| e.to_string())?
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let integrity_ok = integrity_messages
        .first()
        .map(|s| s == "ok")
        .unwrap_or(false);
    let integrity_message = if integrity_messages.is_empty() {
        "no result".to_string()
    } else if integrity_ok {
        integrity_messages.remove(0)
    } else {
        integrity_messages.join("; ")
    };

    let checkpoint = |conn: &rusqlite::Connection| -> (i64, bool) {
        // Returns (checkpointed_frames, was_busy).
        conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |r| {
            let busy: i64 = r.get(0)?;
            let checkpointed: i64 = r.get(2)?;
            Ok((checkpointed, busy != 0))
        })
        .unwrap_or((0, false))
    };

    let (pre_frames, pre_busy) = checkpoint(conn);
    conn.execute_batch("VACUUM").map_err(|e| e.to_string())?;
    let (post_frames, post_busy) = checkpoint(conn);

    let after_bytes = total_db_footprint(&path);
    let duration_ms = started.elapsed().as_millis() as u64;

    Ok(MaintenanceResult {
        before_bytes,
        after_bytes,
        integrity_ok,
        integrity_message,
        wal_frames_checkpointed: pre_frames + post_frames,
        wal_checkpoint_blocked: pre_busy || post_busy,
        duration_ms,
    })
}

fn total_db_footprint(path: &Path) -> u64 {
    // SQLite WAL/SHM sidecars are literally `<dbfile>-wal` / `<dbfile>-shm`.
    // Any missing file counts as zero (WAL may not exist mid-checkpoint).
    let main = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let mut wal = path.as_os_str().to_owned();
    wal.push("-wal");
    let mut shm = path.as_os_str().to_owned();
    shm.push("-shm");
    let wal_bytes = std::fs::metadata(&wal).map(|m| m.len()).unwrap_or(0);
    let shm_bytes = std::fs::metadata(&shm).map(|m| m.len()).unwrap_or(0);
    main + wal_bytes + shm_bytes
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeOrphansResult {
    pub price_history_rows: usize,
    pub quote_cache_rows: usize,
    pub indicator_settings_rows: usize,
    pub news_items_rows: usize,
}

/// Sweep cached data for tickers that no longer have a visible watchlist row.
///
/// Useful after a chain of soft-deletes / group renames where the M8.5 (a)
/// `purge_ticker` command was bypassed (e.g. user did `remove_ticker`,
/// which is hide-only). Walks four tables:
///
/// - `price_history` + `quote_cache` — keyed on `(ticker, data_source)`,
///   orphaned when no visible watchlist row matches both.
/// - `indicator_settings` — keyed on `ticker` only, orphaned when no
///   visible watchlist row references the ticker under any data source.
/// - `news_items` (only `source='finnhub_ticker'`) — same ticker-only scope
///   as indicator_settings. General/category news isn't keyed on ticker so
///   it's left alone (the 30-day retention sweep covers it).
#[tauri::command]
pub fn purge_orphaned_data(state: State<'_, AppState>) -> Result<PurgeOrphansResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.connection();

    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    let result: Result<PurgeOrphansResult, String> = (|| {
        let price_history_rows = conn
            .execute(
                "DELETE FROM price_history \
                 WHERE NOT EXISTS ( \
                   SELECT 1 FROM watchlist_tickers wt \
                   WHERE wt.ticker = price_history.ticker \
                     AND wt.data_source = price_history.data_source \
                     AND wt.user_hidden = 0 \
                 )",
                params![],
            )
            .map_err(|e| e.to_string())?;
        let quote_cache_rows = conn
            .execute(
                "DELETE FROM quote_cache \
                 WHERE NOT EXISTS ( \
                   SELECT 1 FROM watchlist_tickers wt \
                   WHERE wt.ticker = quote_cache.ticker \
                     AND wt.data_source = quote_cache.data_source \
                     AND wt.user_hidden = 0 \
                 )",
                params![],
            )
            .map_err(|e| e.to_string())?;
        let indicator_settings_rows = conn
            .execute(
                "DELETE FROM indicator_settings \
                 WHERE NOT EXISTS ( \
                   SELECT 1 FROM watchlist_tickers wt \
                   WHERE wt.ticker = indicator_settings.ticker \
                     AND wt.user_hidden = 0 \
                 )",
                params![],
            )
            .map_err(|e| e.to_string())?;
        let news_items_rows = conn
            .execute(
                "DELETE FROM news_items \
                 WHERE source = 'finnhub_ticker' \
                   AND NOT EXISTS ( \
                     SELECT 1 FROM watchlist_tickers wt \
                     WHERE wt.ticker = news_items.ticker \
                       AND wt.user_hidden = 0 \
                   )",
                params![],
            )
            .map_err(|e| e.to_string())?;
        Ok(PurgeOrphansResult {
            price_history_rows,
            quote_cache_rows,
            indicator_settings_rows,
            news_items_rows,
        })
    })();
    match result {
        Ok(r) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(r)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub destination_path: String,
    pub bytes: u64,
}

/// Make a self-contained copy of the database at `<destination>/<filename>`.
/// Filename is timestamped (`personal-terminal.backup-YYYYMMDD-HHMMSS.db`)
/// so repeat backups don't overwrite each other.
///
/// Step 1 runs `wal_checkpoint(TRUNCATE)` so every uncommitted-but-stored
/// frame in the WAL is folded into the main file. After that the `.db`
/// alone holds everything; we only copy the main file to the destination.
/// The current database is unchanged — `AppState.db` keeps pointing at it.
#[tauri::command]
pub fn backup_database(
    destination: String,
    state: State<'_, AppState>,
) -> Result<BackupResult, String> {
    let dest_dir = PathBuf::from(destination);
    if !dest_dir.is_dir() {
        return Err(format!("destination is not a directory: {:?}", dest_dir));
    }

    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let source = db_guard.path().to_path_buf();

    // Consolidate WAL into main first so the copied .db is self-contained.
    db_guard
        .connection()
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .map_err(|e| format!("checkpoint failed: {}", e))?;

    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let filename = format!("personal-terminal.backup-{}.db", stamp);
    let dest_path = dest_dir.join(filename);
    if dest_path.exists() {
        return Err(format!(
            "backup file already exists: {}",
            dest_path.display()
        ));
    }

    let bytes = std::fs::copy(&source, &dest_path)
        .map_err(|e| format!("copy failed: {}", e))?;

    Ok(BackupResult {
        destination_path: dest_path.to_string_lossy().to_string(),
        bytes,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveResult {
    pub new_path: String,
    pub old_path: String,
    pub bytes: u64,
}

/// Move the live database to a new directory. The app keeps running on the
/// new location once this returns; the pointer file `db_location.txt` in
/// the default data dir is updated so subsequent boots find it.
///
/// Old files are **left in place** at the source location — easy reversal
/// if the user wants to undo (delete the new copy + clear the pointer file).
/// Tell the user this in the UI; we don't delete on their behalf.
///
/// Steps (each must succeed before the next):
/// 1. Validate destination — must be a directory, must not already contain
///    `personal-terminal.db`, must not be the current location.
/// 2. Checkpoint+truncate the WAL so the source `.db` is self-contained.
/// 3. Copy `.db` to destination.
/// 4. Open a fresh `Db` against the destination.
/// 5. Replace `AppState.db` with the new connection (drops old).
/// 6. Write the pointer file.
///
/// If any step fails, we bail with an error and `AppState.db` keeps
/// pointing at the original — no partial state.
#[tauri::command]
pub fn move_database(
    destination: String,
    state: State<'_, AppState>,
) -> Result<MoveResult, String> {
    let dest_dir = PathBuf::from(destination);
    if !dest_dir.is_dir() {
        return Err(format!("destination is not a directory: {:?}", dest_dir));
    }

    let mut guard = state.db.lock().map_err(|e| e.to_string())?;
    let source = guard.path().to_path_buf();

    let dest_path = dest_dir.join(config::DB_FILENAME);
    if dest_path == source {
        return Err("destination is the current database location".into());
    }
    if dest_path.exists() {
        return Err(format!(
            "destination already has a database: {}",
            dest_path.display()
        ));
    }

    // Consolidate WAL → main so the copied .db is self-contained.
    guard
        .connection()
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .map_err(|e| format!("checkpoint failed: {}", e))?;

    let bytes = std::fs::copy(&source, &dest_path)
        .map_err(|e| format!("copy failed: {}", e))?;

    // Open the new DB. If this fails (corrupted copy, permissions), back
    // out by deleting the partial copy and reporting the error.
    let new_db = match db::Db::open(&dest_path) {
        Ok(d) => d,
        Err(e) => {
            let _ = std::fs::remove_file(&dest_path);
            return Err(format!("failed to open new database: {}", e));
        }
    };

    // Replace the live connection. Old Db is dropped on assignment.
    *guard = new_db;

    // Write the pointer last — if this fails we've still got the new DB
    // open and working, but next boot would resolve to the default
    // location. Surface the error so the user knows.
    if let Err(e) = config::write_db_pointer(Some(&dest_path)) {
        return Err(format!(
            "database moved to {}, but failed to persist location pointer ({}). \
             Next launch will use the default location unless you manually \
             create db_location.txt.",
            dest_path.display(),
            e
        ));
    }

    Ok(MoveResult {
        new_path: dest_path.to_string_lossy().to_string(),
        old_path: source.to_string_lossy().to_string(),
        bytes,
    })
}

/// Reverts the location pointer so the next launch opens the default
/// `<data_dir>/personal-terminal.db`. Does NOT move data back — the user
/// is responsible for ensuring the default location has a usable database.
/// Surfaced for completeness; not currently wired to UI.
#[tauri::command]
pub fn reset_database_location() -> Result<(), String> {
    config::write_db_pointer(None)
}
