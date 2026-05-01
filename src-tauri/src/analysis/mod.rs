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
pub mod regime_quadrant;
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

/// Two-axis macro reading at a single observation date — used by the
/// Regime Quadrant tool (Phase 3). Both axes are YoY % change.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegimePoint {
    pub date: chrono::NaiveDate,
    pub growth_yoy: f64,
    pub inflation_yoy: f64,
}

/// Compute year-over-year % change on a chronologically-sorted monthly level
/// series. For each point i, looks back exactly `months` rows and emits
/// `(level[i] / level[i-months] - 1) * 100`. Output length matches input;
/// the first `months` entries' values are NaN (insufficient history).
///
/// Operates on row offsets, not calendar dates — assumes the input is a
/// regular monthly series (FRED INDPRO / CPIAUCSL / PCEPILFE all are).
/// Skips emitting when the prior reference is non-positive (would invert
/// the sign of the %-change).
pub fn yoy_pct_change(points: &[MacroPoint], months: usize) -> Vec<MacroPoint> {
    points
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let value = if i < months {
                f64::NAN
            } else {
                let prev = points[i - months].value;
                if prev > 0.0 && prev.is_finite() && p.value.is_finite() {
                    (p.value / prev - 1.0) * 100.0
                } else {
                    f64::NAN
                }
            };
            MacroPoint {
                date: p.date,
                value,
            }
        })
        .collect()
}
