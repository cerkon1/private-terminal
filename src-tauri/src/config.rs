use std::path::PathBuf;

use crate::db::Db;

/// Resolve the per-user data directory for Personal Terminal.
/// Uses platform conventions via `dirs`:
///   Windows: %APPDATA%\personal-terminal
///   macOS:   ~/Library/Application Support/personal-terminal
///   Linux:   ~/.local/share/personal-terminal
pub fn data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("personal-terminal")
}

/// Default DB filename used both for the in-place location and for the
/// destination filename when the user moves/backs up the database.
pub const DB_FILENAME: &str = "personal-terminal.db";

/// Pointer file living in the *default* data dir even when the database
/// has been moved elsewhere. One line of UTF-8: the absolute path of the
/// active DB file. Absent or unreadable → fall back to the default.
pub fn db_pointer_path() -> PathBuf {
    data_dir().join("db_location.txt")
}

/// Compute the DB path used at boot. Reads the pointer file if present,
/// validates that the target file exists, falls back to the default
/// `<data_dir>/personal-terminal.db` otherwise. Pure — does not create
/// anything.
pub fn resolve_db_path() -> PathBuf {
    let default_path = data_dir().join(DB_FILENAME);
    let pointer = db_pointer_path();
    let Ok(content) = std::fs::read_to_string(&pointer) else {
        return default_path;
    };
    let target = PathBuf::from(content.trim());
    if target.as_os_str().is_empty() {
        return default_path;
    }
    if !target.exists() {
        log::warn!(
            "db_location.txt points to {:?} which doesn't exist; falling back to default",
            target
        );
        return default_path;
    }
    target
}

/// Persist (or clear) the pointer file. Pass `None` to delete it (revert
/// to the default location on next boot); pass `Some(path)` to write it.
pub fn write_db_pointer(target: Option<&std::path::Path>) -> Result<(), String> {
    let pointer = db_pointer_path();
    if let Some(parent) = pointer.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    match target {
        Some(p) => std::fs::write(&pointer, p.to_string_lossy().as_bytes())
            .map_err(|e| e.to_string()),
        None => match std::fs::remove_file(&pointer) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        },
    }
}

/// Source of a resolved API key — surfaced in the settings UI so users
/// can tell whether a key is stored in the local DB config table (saved
/// from the settings UI) or coming from a .env (dev fallback).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    /// Stored in the SQLite `config` KV (via the settings UI).
    Stored,
    /// From a process env var (typically loaded via dotenvy from .env).
    Env,
    None,
}

pub const FRED_CONFIG_KEY: &str = "api_key.fred";
pub const FINNHUB_CONFIG_KEY: &str = "api_key.finnhub";

fn read_from_db(db: &Db, key: &str) -> Option<String> {
    match db.get_config(key) {
        Ok(Some(v)) if !v.is_empty() => Some(v),
        Ok(_) => None,
        Err(e) => {
            log::warn!("config read({}) failed: {}", key, e);
            None
        }
    }
}

fn read_from_env(var: &str) -> Option<String> {
    std::env::var(var).ok().filter(|s| !s.is_empty())
}

pub fn fred_api_key(db: &Db) -> Option<String> {
    read_from_db(db, FRED_CONFIG_KEY).or_else(|| read_from_env("FRED_API_KEY"))
}

pub fn finnhub_api_key(db: &Db) -> Option<String> {
    read_from_db(db, FINNHUB_CONFIG_KEY).or_else(|| read_from_env("FINNHUB_API_KEY"))
}

/// Same resolvers, but also report where the value came from — used by the
/// settings UI so each key-row can show "stored locally" vs ".env fallback"
/// vs "not set".
pub fn fred_api_key_source(db: &Db) -> (Option<String>, KeySource) {
    if let Some(v) = read_from_db(db, FRED_CONFIG_KEY) {
        return (Some(v), KeySource::Stored);
    }
    match read_from_env("FRED_API_KEY") {
        Some(v) => (Some(v), KeySource::Env),
        None => (None, KeySource::None),
    }
}

pub fn finnhub_api_key_source(db: &Db) -> (Option<String>, KeySource) {
    if let Some(v) = read_from_db(db, FINNHUB_CONFIG_KEY) {
        return (Some(v), KeySource::Stored);
    }
    match read_from_env("FINNHUB_API_KEY") {
        Some(v) => (Some(v), KeySource::Env),
        None => (None, KeySource::None),
    }
}
