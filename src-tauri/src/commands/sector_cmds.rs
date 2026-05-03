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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteTicker {
    pub ticker: String,
    pub sector_group_id: String,
    pub data_source: String,
    pub display_name: Option<String>,
}

/// Flat list of (ticker, sector_group_id, data_source, display_name) for
/// every visible watchlist row under a LEAF sector (sectors with children
/// are skipped — they're navigation nodes, not data containers). Powers
/// the Ctrl+K command palette; duplicates by sector are intentional so a
/// ticker in two sectors becomes two searchable entries with unambiguous
/// per-sector navigation. (S22)
#[tauri::command]
pub fn list_palette_tickers(state: State<'_, AppState>) -> Result<Vec<PaletteTicker>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let groups = db.list_sector_groups()?;
    let mut out = Vec::new();
    for sg in groups.iter().filter(|s| s.enabled) {
        let has_children = groups
            .iter()
            .any(|s| s.parent_id.as_deref() == Some(sg.id.as_str()));
        if has_children {
            continue;
        }
        for t in db.list_tickers_in_sector(&sg.id)? {
            if !t.enabled {
                continue;
            }
            out.push(PaletteTicker {
                ticker: t.ticker,
                sector_group_id: t.sector_group_id,
                data_source: t.data_source,
                display_name: t.display_name,
            });
        }
    }
    Ok(out)
}
