//! IPC wrapper for the v1.2 Pulse cross-section heatmap.

use tauri::State;

use crate::cross_section::{
    compute_cross_section as run_compute, CrossSectionRequest, CrossSectionResponse,
};
use crate::AppState;

#[tauri::command]
pub fn compute_cross_section(
    request: CrossSectionRequest,
    state: State<'_, AppState>,
) -> Result<CrossSectionResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    run_compute(&db, request)
}
