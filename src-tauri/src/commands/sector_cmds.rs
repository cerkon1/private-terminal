use serde::Serialize;
use tauri::State;

use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectorGroup {
    pub id: String,
    pub parent_id: Option<String>,
    pub display_name: String,
    pub data_source: String,
    pub display_order: Option<i64>,
    pub enabled: bool,
}

#[tauri::command]
pub fn list_sector_groups(state: State<'_, AppState>) -> Result<Vec<SectorGroup>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = db.list_sector_groups()?;
    Ok(rows
        .into_iter()
        .map(|r| SectorGroup {
            id: r.id,
            parent_id: r.parent_id,
            display_name: r.display_name,
            data_source: r.data_source,
            display_order: r.display_order,
            enabled: r.enabled,
        })
        .collect())
}
