//! Indicator framework.
//!
//! Trait-based, f64 precision (display-only, not tax-grade). Registry is built
//! once at module load and queried by id. Chart component is indicator-agnostic:
//! it reads the generic `IndicatorOutput` shape (series + markers + regions)
//! and renders via ECharts without per-indicator knowledge.
//!
//! Math is ported verbatim from `E:/Users/PBL/Documents/Dev/trendscope/src/trendscope/indicators.py`.
//! Do NOT re-tune `confirm_bars` or SMMA lengths without calibration data —
//! trendscope's CLAUDE.md "Tuning journey" explicitly says v1 + confirm=3 is
//! "good enough"; changing defaults has been measured to produce marginal shifts.

pub mod atr;
pub mod rsi;
pub mod smma;
pub mod smma_ribbon;

use std::sync::OnceLock;

use serde::Serialize;

/// OHLCV bar input to every indicator. `date` is the ISO-8601 bar date string;
/// other fields are `Option<f64>` so Yahoo holiday-padding NULLs round-trip cleanly.
#[derive(Debug, Clone)]
pub struct Bar {
    pub date: String,
    pub open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub close: Option<f64>,
    pub volume: Option<f64>,
}

/// Rendering hint — overlay on the price pane, or a dedicated subpane below.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PaneKind {
    Overlay,
    Subpane,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeriesPoint {
    pub date: String,
    pub value: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SeriesKind {
    Line,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSeries {
    pub name: String,
    pub kind: SeriesKind,
    pub color: String,
    pub data: Vec<SeriesPoint>,
    /// Series stacked on the same `stack_group` pile up — the frontend
    /// renders each as an area, producing filled polygon regions between
    /// curves. Used by SMMA Ribbon's state-coloured envelope between v1 and v2.
    #[serde(default)]
    pub stack_group: Option<String>,
    /// Hide the stroke/markers (stack-base series contribute position but no
    /// ink). Does not hide the `areaStyle` fill when `stack_group` is set.
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorMarker {
    pub date: String,
    pub value: f64,
    pub label: String,
    pub color: String,
    pub symbol: String, // "arrow-up", "arrow-down", "circle"
}

/// Date-ranged background band — used by SMMA Ribbon regime shading (feature #4).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorRegion {
    pub start_date: String,
    pub end_date: String,
    pub color: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorOutput {
    pub id: String,
    pub display_name: String,
    pub pane: PaneKind,
    pub series: Vec<IndicatorSeries>,
    #[serde(default)]
    pub markers: Vec<IndicatorMarker>,
    #[serde(default)]
    pub regions: Vec<IndicatorRegion>,
}

pub trait Indicator: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn pane_hint(&self) -> PaneKind;
    fn default_params(&self) -> serde_json::Value;
    fn compute(
        &self,
        bars: &[Bar],
        params: &serde_json::Value,
    ) -> Result<IndicatorOutput, String>;
}

/// Static registry built once on first access. Adding a new indicator is one
/// module + one line in `build_registry`.
static REGISTRY: OnceLock<Vec<Box<dyn Indicator>>> = OnceLock::new();

fn build_registry() -> Vec<Box<dyn Indicator>> {
    vec![
        Box::new(smma_ribbon::SmmaRibbonIndicator),
        Box::new(rsi::RsiIndicator),
        Box::new(atr::AtrIndicator),
    ]
}

pub fn all_indicators() -> &'static [Box<dyn Indicator>] {
    REGISTRY.get_or_init(build_registry).as_slice()
}

pub fn find_indicator(id: &str) -> Option<&'static dyn Indicator> {
    all_indicators()
        .iter()
        .find(|i| i.id() == id)
        .map(|b| b.as_ref())
}

// Helpers used by multiple indicators.

/// Extract `close` series as a dense Vec<Option<f64>> aligned to bars.
pub(crate) fn close_series(bars: &[Bar]) -> Vec<Option<f64>> {
    bars.iter().map(|b| b.close).collect()
}

pub(crate) fn high_low_mid(bars: &[Bar]) -> Vec<Option<f64>> {
    bars.iter()
        .map(|b| match (b.high, b.low) {
            (Some(h), Some(l)) => Some((h + l) / 2.0),
            _ => None,
        })
        .collect()
}
