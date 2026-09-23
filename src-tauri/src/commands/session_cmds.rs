use tauri::State;

use crate::AppState;

/// UI persistence (`usePersistedState`) shares the `config` KV table with
/// the API keys (`api_key.*`). Without this guard the generic accessors
/// would hand the webview a raw key (bypassing the masking in
/// settings_cmds) or let it overwrite one.
const SESSION_PREFIX: &str = "session.";

fn check_key(key: &str) -> Result<(), String> {
    if key.starts_with(SESSION_PREFIX) {
        Ok(())
    } else {
        Err(format!("session keys must start with '{SESSION_PREFIX}': {key}"))
    }
}

#[tauri::command]
pub fn get_session_key(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    check_key(&key)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_config(&key)
}

#[tauri::command]
pub fn set_session_key(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    check_key(&key)?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config(&key, &value)
}

#[cfg(test)]
mod tests {
    use super::check_key;

    #[test]
    fn only_session_keys_pass() {
        assert!(check_key("session.palette").is_ok());
        assert!(check_key("api_key.fred").is_err());
        assert!(check_key("sessionX").is_err());
        assert!(check_key("").is_err());
    }
}
