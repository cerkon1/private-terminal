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
    AnalysisToolMeta {
        id: "pairs_ratio",
        display_name: "Pairs",
        scope: "cross_asset",
        display_order: 3,
        // Quick-pick pairs for the toolbar. User-editable through the
        // analysis_tools.config_json column once a UI for it lands.
        default_config_json: Some(
            r#"{"quickPicks":[["BTC-USD","ETH-USD"],["GC=F","SI=F"],["HG=F","GC=F"],["^IXIC","^GSPC"]]}"#,
        ),
    },
    AnalysisToolMeta {
        id: "rrg",
        display_name: "RRG",
        scope: "cross_asset",
        display_order: 4,
        // Default benchmark + RS/momentum periods + tail length. Benchmark
        // is per-session (S15 Q3) so this is just the bootstrap default.
        default_config_json: Some(
            r#"{"benchmark":"^GSPC","rsPeriod":14,"momentumPeriod":5,"tailLength":8}"#,
        ),
    },
    AnalysisToolMeta {
        id: "recession_prob",
        display_name: "Recession Prob",
        scope: "macro",
        display_order: 5,
        default_config_json: None,
    },
    AnalysisToolMeta {
        id: "financial_conditions",
        display_name: "Financial Conditions",
        scope: "macro",
        display_order: 6,
        default_config_json: None,
    },
    AnalysisToolMeta {
        id: "regime_quadrant",
        display_name: "Regime Quadrant",
        scope: "macro",
        display_order: 7,
        default_config_json: Some(r#"{"inflationProxy":"cpi","trailMonths":24}"#),
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
