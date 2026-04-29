//! News feed CRUD (M8.5 (d)).
//!
//! Soft-delete via `news_feeds.user_hidden = 1`, mirroring the
//! sectors/tickers pattern. Seed runs on every boot — `INSERT OR IGNORE`
//! stays a no-op for hidden seeded rows because the row exists, so the
//! user-visible state is preserved across restarts.
//!
//! `source_type` accepts `'rss'` and `'finnhub'`. The frontend restricts
//! the Add form to RSS (Finnhub is keyed on `FINNHUB_API_KEY`; the seeded
//! `finnhub_general` row covers it). Edit allows both — display name,
//! category, refresh cadence, enabled toggle work for either.

use rusqlite::params;
use serde::Deserialize;
use tauri::State;

use crate::AppState;

const ALLOWED_SOURCE_TYPES: &[&str] = &["rss", "finnhub"];
const MIN_REFRESH_MINUTES: i64 = 5;
const MAX_REFRESH_MINUTES: i64 = 1440;

fn validate_id(raw: &str) -> Result<String, String> {
    let id = raw.trim().to_lowercase();
    if id.is_empty() {
        return Err("feed id cannot be empty".into());
    }
    if id.len() > 40 {
        return Err("feed id too long (max 40 chars)".into());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("feed id must be lowercase letters / digits / underscore".into());
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

fn validate_category(raw: &str) -> Result<String, String> {
    let c = raw.trim().to_lowercase();
    if c.is_empty() {
        return Err("category cannot be empty".into());
    }
    if c.len() > 40 {
        return Err("category too long (max 40 chars)".into());
    }
    if !c.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_') {
        return Err("category must be lowercase letters / digits / underscore".into());
    }
    Ok(c)
}

fn validate_refresh(raw: i64) -> Result<i64, String> {
    if !(MIN_REFRESH_MINUTES..=MAX_REFRESH_MINUTES).contains(&raw) {
        return Err(format!(
            "refresh_minutes must be between {} and {}",
            MIN_REFRESH_MINUTES, MAX_REFRESH_MINUTES
        ));
    }
    Ok(raw)
}

fn validate_url(raw: &str) -> Result<String, String> {
    let u = raw.trim().to_string();
    if u.is_empty() {
        return Err("url cannot be empty".into());
    }
    if u.len() > 500 {
        return Err("url too long (max 500 chars)".into());
    }
    if !(u.starts_with("http://") || u.starts_with("https://")) {
        return Err("url must start with http:// or https://".into());
    }
    Ok(u)
}

fn validate_source_type(raw: &str) -> Result<String, String> {
    let s = raw.trim().to_lowercase();
    if !ALLOWED_SOURCE_TYPES.iter().any(|t| *t == s) {
        return Err(format!(
            "source_type must be one of: {}",
            ALLOWED_SOURCE_TYPES.join(", ")
        ));
    }
    Ok(s)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddNewsFeedInput {
    pub id: String,
    pub source_type: String,
    pub url: String,
    pub display_name: String,
    pub category: String,
    pub refresh_minutes: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNewsFeedInput {
    pub id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub refresh_minutes: Option<i64>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[tauri::command]
pub async fn add_news_feed(
    input: AddNewsFeedInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_id(&input.id)?;
    let source_type = validate_source_type(&input.source_type)?;
    let url = validate_url(&input.url)?;
    let display_name = validate_display_name(&input.display_name)?;
    let category = validate_category(&input.category)?;
    let refresh_minutes = validate_refresh(input.refresh_minutes)?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.connection()
        .execute(
            "INSERT INTO news_feeds \
               (id, source_type, url, display_name, category, refresh_minutes, enabled, user_hidden) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 0) \
             ON CONFLICT(id) DO UPDATE SET \
               source_type=excluded.source_type, \
               url=excluded.url, \
               display_name=excluded.display_name, \
               category=excluded.category, \
               refresh_minutes=excluded.refresh_minutes, \
               enabled=1, \
               user_hidden=0",
            params![
                id,
                source_type,
                url,
                display_name,
                category,
                refresh_minutes,
            ],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_news_feed(
    input: UpdateNewsFeedInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_id(&input.id)?;
    let display_name = input
        .display_name
        .as_deref()
        .map(validate_display_name)
        .transpose()?;
    let url = input.url.as_deref().map(validate_url).transpose()?;
    let category = input
        .category
        .as_deref()
        .map(validate_category)
        .transpose()?;
    let refresh_minutes = input.refresh_minutes.map(validate_refresh).transpose()?;
    let enabled_int: Option<i64> = input.enabled.map(|b| if b { 1 } else { 0 });

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = db
        .connection()
        .execute(
            "UPDATE news_feeds SET \
               display_name = COALESCE(?2, display_name), \
               url = COALESCE(?3, url), \
               category = COALESCE(?4, category), \
               refresh_minutes = COALESCE(?5, refresh_minutes), \
               enabled = COALESCE(?6, enabled) \
             WHERE id = ?1 AND user_hidden = 0",
            params![id, display_name, url, category, refresh_minutes, enabled_int],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("feed '{}' not found", id));
    }
    Ok(())
}

/// Soft-delete: flips `user_hidden=1` so seed `INSERT OR IGNORE` stays a
/// no-op on next boot. Historical news_items rows from this feed are left
/// alone — the 30-day retention sweep on boot reaps them naturally.
#[tauri::command]
pub async fn delete_news_feed(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = validate_id(&id)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = db
        .connection()
        .execute(
            "UPDATE news_feeds SET user_hidden = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("feed '{}' not found", id));
    }
    Ok(())
}
