//! v1.2 Pulse — percentile cross-section heatmap compute.
//!
//! Single IPC entry point `compute_cross_section` returns every ticker in
//! every leaf sector_group + every FRED series, expressed as percentile
//! ranks vs trailing 5y of own-history across REGIME / AGE / LEVEL / RSI /
//! ATR / VOL / DD columns.
//!
//! Universal indicator compute: SMMA Ribbon / RSI / ATR run with default
//! params for every ticker, ignoring per-ticker `indicator_settings.enabled`
//! and params overrides — Pulse needs every column for every row, so user
//! customization is explicitly bypassed (S20 design lock).

use serde::{Deserialize, Serialize};

pub mod compute;
pub mod percentile;

#[cfg(test)]
mod tests;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RegimeState {
    Bull,
    Bear,
    Neutral,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossSectionRequest {
    #[serde(default = "default_lookback_years")]
    pub lookback_years: u32,
}

fn default_lookback_years() -> u32 {
    5
}

impl Default for CrossSectionRequest {
    fn default() -> Self {
        Self { lookback_years: 5 }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossSectionRow {
    pub ticker: String,
    pub display_name: Option<String>,
    pub sector_group_id: String,
    /// Data source ('yahoo' / 'coingecko' / 'fred'). Frontend uses this with
    /// `ticker` as the exact key when handing off to TickerDashboard.
    pub data_source: String,
    pub is_macro: bool,
    /// True when bars/observations are <30 — row is greyed out, all cells em-dash.
    pub no_bars: bool,
    /// True when bars are <252 (1y) — percentile cells get an asterisk marker.
    pub partial_history: bool,
    /// SMMA Ribbon committed state at the latest bar. None for macro rows or
    /// when warm-up hasn't cleared. Serialized as "BULL" / "BEAR" / "NEUTRAL".
    pub regime: Option<RegimeState>,
    /// Calendar days since the most recent confirmed regime flip.
    pub age_days: Option<u32>,
    /// Percentile (0-100) of current close (or macro observation) vs trailing 5y.
    pub level: Option<f64>,
    pub rsi: Option<f64>,
    pub atr: Option<f64>,
    pub vol: Option<f64>,
    /// Signed % drawdown from trailing-5y running peak. 0 = at peak. Macro = None.
    pub dd_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossSectionSection {
    pub id: String,
    pub display_name: String,
    pub rows: Vec<CrossSectionRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossSectionResponse {
    pub sections: Vec<CrossSectionSection>,
    /// RFC 3339 UTC timestamp at the moment compute finished.
    pub computed_at: String,
}

pub use compute::compute_cross_section;
