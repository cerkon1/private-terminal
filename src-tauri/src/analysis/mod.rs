//! v1.1 Analysis section — cross-asset and macro tools.
//!
//! Pattern: const registry (no trait) + per-tool typed compute free functions.
//! Heterogeneous output shapes (matrix vs curve vs segment list) make a trait
//! more expensive than valuable; see S15 design decision Q2.
//!
//! Compute is on-demand and not persisted — same rule as the M6 indicator
//! framework. f64 throughout (display-only, not tax-grade).

use serde::{Deserialize, Serialize};

pub mod align;
pub mod correlations;
pub mod coverage;
pub mod financial_conditions;
pub mod macro_overlays;
pub mod pairs;
pub mod recession_prob;
pub mod registry;
pub mod rrg;
pub mod yield_curve;

#[cfg(test)]
mod tests;

/// Identifies a price series. The data_source disambiguates the same ticker
/// across different fetchers (e.g. BTC-USD on Yahoo vs CoinGecko).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerKey {
    pub ticker: String,
    pub data_source: String,
}

/// Ticker dropped from a compute pass for not meeting the coverage threshold.
/// Surfaced to the frontend so the user knows what was excluded and why.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExcludedTicker {
    pub ticker: String,
    pub data_source: String,
    pub bar_count: u32,
    pub reason: String,
}

/// Single (date, value) pair for line-chart macro tools (Recession Prob, FCI).
/// Date is ISO 8601; value is the parsed FRED observation (sentinels filtered
/// upstream).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroPoint {
    pub date: chrono::NaiveDate,
    pub value: f64,
}
