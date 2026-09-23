//! IPC wrapper for the v1.2 Pulse cross-section heatmap.

use tauri::State;

use crate::cross_section::{
    compute_cross_section as run_compute, snapshot, CrossSectionRequest, CrossSectionResponse,
};
use crate::market_calendar;
use crate::AppState;

#[tauri::command(async)]
pub fn compute_cross_section(
    request: CrossSectionRequest,
    state: State<'_, AppState>,
) -> Result<CrossSectionResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut response = run_compute(&db, request)?;
    // Snapshot + previous-day comparison is best-effort: a failure here must
    // not cost the user their Pulse view.
    let key = market_calendar::expected_latest_us_close().format("%Y-%m-%d").to_string();
    if let Err(e) = snapshot::record_and_compare(&db, &mut response, &key) {
        log::warn!("pulse snapshot failed: {e}");
    }
    Ok(response)
}
