//! IPC wrappers for the v1.1 Analysis section.
//!
//! Five commands per the S15 plan:
//! - `list_analysis_tools` — registry + DB-stored enabled/config_json merge
//! - `compute_correlations` — pearson matrix on log returns
//! - `compute_yield_curve` — 3 snapshots × 5 tenors + spread series
//! - `list_recession_segments` — USREC ranges for chart overlay
//! - `list_tickers_with_coverage` — chip-picker bar-coverage info

use std::collections::HashMap;

use rusqlite::params;
use tauri::State;

use crate::analysis::{
    correlations::{self, CorrelationsRequest, CorrelationsResponse},
    coverage::{self, TickerCoverage},
    macro_overlays::{self, RecessionSegment},
    pairs::{self, PairsRequest, PairsResponse},
    registry::{AnalysisToolInfo, ANALYSIS_TOOLS},
    rrg::{self, RrgRequest, RrgResponse},
    yield_curve::{self, YieldCurveRequest, YieldCurveResponse},
};
use crate::AppState;

/// Merge the const registry with DB-stored `enabled` + `config_json` overrides.
/// Const registry is the source of truth for *which* tools exist; the DB row
/// is just user-settable state (enabled toggle, per-user config). Tools in
/// the const registry that have no DB row default to enabled=true and use
/// the registry's `default_config_json` (None for both Phase 1 tools).
#[tauri::command]
pub fn list_analysis_tools(state: State<'_, AppState>) -> Result<Vec<AnalysisToolInfo>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .connection()
        .prepare("SELECT id, enabled, config_json FROM analysis_tools")
        .map_err(|e| e.to_string())?;
    let rows: HashMap<String, (bool, Option<String>)> = stmt
        .query_map(params![], |row| {
            let id: String = row.get(0)?;
            let enabled: i64 = row.get(1)?;
            let config_json: Option<String> = row.get(2)?;
            Ok((id, (enabled != 0, config_json)))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| e.to_string())?;

    let result: Vec<AnalysisToolInfo> = ANALYSIS_TOOLS
        .iter()
        .map(|meta| {
            let (enabled, config_json) = rows.get(meta.id).cloned().unwrap_or_else(|| {
                (true, meta.default_config_json.map(|s| s.to_string()))
            });
            AnalysisToolInfo {
                id: meta.id.to_string(),
                display_name: meta.display_name.to_string(),
                scope: meta.scope.to_string(),
                display_order: meta.display_order,
                enabled,
                config_json,
            }
        })
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn compute_correlations(
    request: CorrelationsRequest,
    state: State<'_, AppState>,
) -> Result<CorrelationsResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    correlations::compute_correlations(&db, request)
}

#[tauri::command]
pub fn compute_yield_curve(
    request: YieldCurveRequest,
    state: State<'_, AppState>,
) -> Result<YieldCurveResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    yield_curve::compute_yield_curve(&db, request)
}

#[tauri::command]
pub fn list_recession_segments(
    state: State<'_, AppState>,
) -> Result<Vec<RecessionSegment>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    macro_overlays::list_recession_segments(&db)
}

#[tauri::command]
pub fn list_tickers_with_coverage(
    state: State<'_, AppState>,
) -> Result<Vec<TickerCoverage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    coverage::list_tickers_with_coverage(&db)
}

#[tauri::command]
pub fn compute_pair_ratio(
    request: PairsRequest,
    state: State<'_, AppState>,
) -> Result<PairsResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    pairs::compute_pair_ratio(&db, request)
}

#[tauri::command]
pub fn compute_rrg(
    request: RrgRequest,
    state: State<'_, AppState>,
) -> Result<RrgResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    rrg::compute_rrg(&db, request)
}
