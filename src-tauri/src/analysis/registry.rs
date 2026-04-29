//! Analysis tool registry. Mirrors M6's indicator registry pattern: the `id`
//! is the join key between this const slice (Rust compute), the
//! `analysis_tools` SQLite row (visibility/order/config), and the React tab
//! component (id → ComponentType map).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy)]
pub struct AnalysisToolMeta {
    pub id: &'static str,
    pub display_name: &'static str,
    pub scope: &'static str, // 'cross_asset' | 'macro' | 'sentiment'
    pub display_order: i32,
    pub default_config_json: Option<&'static str>,
}

/// Static registry. Order here is the source of truth; the DB row's
/// `display_order` mirrors it but is only authoritative for the UI tab strip
/// (so users can reorder without recompiling).
pub const ANALYSIS_TOOLS: &[AnalysisToolMeta] = &[
    AnalysisToolMeta {
        id: "correlation_matrix",
        display_name: "Correlations",
        scope: "cross_asset",
        display_order: 1,
        default_config_json: None,
    },
    AnalysisToolMeta {
        id: "yield_curve",
        display_name: "Yield Curve",
        scope: "macro",
        display_order: 2,
        default_config_json: None,
    },
];

/// IPC shape returned by `list_analysis_tools` — registry meta merged with
/// the DB-stored `enabled` flag and per-user `config_json` override.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisToolInfo {
    pub id: String,
    pub display_name: String,
    pub scope: String,
    pub display_order: i32,
    pub enabled: bool,
    pub config_json: Option<String>,
}
