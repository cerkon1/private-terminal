use tauri::State;

use crate::AppState;

#[tauri::command]
pub fn get_session_key(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_config(&key)
}

#[tauri::command]
pub fn set_session_key(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config(&key, &value)
}
