use serde::Serialize;
use tauri::State;

use crate::config::{self, KeySource, FINNHUB_CONFIG_KEY, FRED_CONFIG_KEY};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub service: String,
    pub source: String, // "stored" | "env" | "none"
    pub masked: Option<String>,
}

fn mask(key: &str) -> String {
    let len = key.chars().count();
    if len <= 4 {
        "••••".to_string()
    } else {
        let last4: String = key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
        format!("••••{}", last4)
    }
}

fn source_label(s: KeySource) -> &'static str {
    match s {
        KeySource::Stored => "stored",
        KeySource::Env => "env",
        KeySource::None => "none",
    }
}

fn config_key_for(service: &str) -> Result<&'static str, String> {
    match service {
        "fred" => Ok(FRED_CONFIG_KEY),
        "finnhub" => Ok(FINNHUB_CONFIG_KEY),
        other => Err(format!("unknown service '{}'", other)),
    }
}

#[tauri::command]
pub fn get_api_key_status(
    service: String,
    state: State<'_, AppState>,
) -> Result<ApiKeyStatus, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (value, source) = match service.as_str() {
        "fred" => config::fred_api_key_source(&db),
        "finnhub" => config::finnhub_api_key_source(&db),
        other => return Err(format!("unknown service '{}'", other)),
    };
    log::info!(
        "get_api_key_status({}): source={} has_value={}",
        service,
        source_label(source),
        value.is_some()
    );
    Ok(ApiKeyStatus {
        service,
        source: source_label(source).to_string(),
        masked: value.map(|v| mask(&v)),
    })
}

#[tauri::command]
pub fn set_api_key(
    service: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let key = config_key_for(&service)?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty — use clear_api_key to remove".into());
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config(key, trimmed)?;
    log::info!("set_api_key({}): wrote {} chars to config KV", service, trimmed.len());
    Ok(())
}

#[tauri::command]
pub fn clear_api_key(service: String, state: State<'_, AppState>) -> Result<(), String> {
    let key = config_key_for(&service)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Overwrite with empty string — fred_api_key_source() filters these out
    // and falls through to env/none, same as if the row didn't exist.
    db.set_config(key, "")?;
    log::info!("clear_api_key({}): cleared config KV entry", service);
    Ok(())
}
