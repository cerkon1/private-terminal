//! Macro Regime Quadrant — 4-quadrant scatter of growth (x) vs inflation (y),
//! both as YoY % change. Plots the last `trail_months` valid points as a
//! connected trail with the head dot highlighted.
//!
//! Growth proxy: FRED `INDPRO` (Industrial Production Index, monthly).
//! INDPRO chosen over NAPM/PMI for data hygiene — INDPRO has a clean
//! continuous monthly history; NAPM publication has historical gaps. NAPM
//! toggle deferred to v1.2.
//!
//! Inflation proxy: FRED `CPIAUCSL` (CPI All Urban Consumers, monthly,
//! headline) by default, with a per-request toggle to `PCEPILFE` (Core PCE,
//! monthly — what the Fed actually targets). Both are monthly index series
//! so the YoY math is identical.
//!
//! The two series are aligned on (year, month) and trimmed to the last
//! `trail_months` valid (growth_yoy, inflation_yoy) pairs after the YoY
//! warm-up. Long-run baselines for each axis are computed across all
//! finite YoY values and returned so the frontend can place crosshair
//! reference lines without re-deriving them.

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::analysis::{yoy_pct_change, MacroPoint, RegimePoint};
use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";
const GROWTH_SERIES_ID: &str = "INDPRO";
const CPI_SERIES_ID: &str = "CPIAUCSL";
const PCE_SERIES_ID: &str = "PCEPILFE";
const YOY_MONTHS: usize = 12;
const DEFAULT_TRAIL_MONTHS: usize = 24;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegimeQuadrantRequest {
    /// "cpi" → CPIAUCSL (headline, default). "pce" → PCEPILFE (Core PCE).
    #[serde(default)]
    pub inflation_proxy: Option<String>,
    /// 12 / 24 / 36 / 48 months of trail. None → 24.
    #[serde(default)]
    pub trail_months: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegimeQuadrantResponse {
    /// Chronological; last entry is the current head.
    pub trail: Vec<RegimePoint>,
    pub current: Option<RegimePoint>,
    /// Long-run mean across the full available YoY history (all finite
    /// values, not just the trail). For crosshair placement.
    pub growth_baseline: Option<f64>,
    pub inflation_baseline: Option<f64>,
    /// Symmetric axis bounds suitable for chart rendering — max absolute
    /// deviation of trail values from 0, padded.
    pub axis_bounds: AxisBounds,
    /// Series metadata for footer display.
    pub growth_series_id: String,
    pub inflation_series_id: String,
    pub growth_label: String,
    pub inflation_label: String,
    pub trail_months_requested: usize,
    pub observation_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AxisBounds {
    pub x_min: f64,
    pub x_max: f64,
    pub y_min: f64,
    pub y_max: f64,
}

pub fn compute_regime_quadrant(
    db: &Db,
    request: RegimeQuadrantRequest,
) -> Result<RegimeQuadrantResponse, String> {
    let inflation_proxy = request
        .inflation_proxy
        .as_deref()
        .unwrap_or("cpi")
        .to_lowercase();
    let (inflation_series_id, inflation_label) = match inflation_proxy.as_str() {
        "pce" => (PCE_SERIES_ID, "Core PCE YoY"),
        _ => (CPI_SERIES_ID, "CPI YoY"),
    };
    let trail_months = request.trail_months.unwrap_or(DEFAULT_TRAIL_MONTHS);

    let growth_levels = load_monthly(db, GROWTH_SERIES_ID)?;
    let inflation_levels = load_monthly(db, inflation_series_id)?;

    let growth_yoy = yoy_pct_change(&growth_levels, YOY_MONTHS);
    let inflation_yoy = yoy_pct_change(&inflation_levels, YOY_MONTHS);

    // Inner-join on (year, month). Both series are monthly with
    // mid-month-ish observation dates that don't exactly match across
    // sources, so keying on the calendar month avoids false drops.
    let mut growth_by_month: BTreeMap<(i32, u32), MacroPoint> = BTreeMap::new();
    for p in &growth_yoy {
        if p.value.is_finite() {
            growth_by_month.insert((p.date.year(), p.date.month()), p.clone());
        }
    }
    let mut joined: Vec<RegimePoint> = Vec::new();
    for p in &inflation_yoy {
        if !p.value.is_finite() {
            continue;
        }
        if let Some(g) = growth_by_month.get(&(p.date.year(), p.date.month())) {
            // Use the later of the two dates so the point sits on the
            // observation that completes the pair.
            let date = std::cmp::max(p.date, g.date);
            joined.push(RegimePoint {
                date,
                growth_yoy: g.value,
                inflation_yoy: p.value,
            });
        }
    }

    // Long-run baselines from the full joined history (means of finite values).
    let (growth_baseline, inflation_baseline) = if joined.is_empty() {
        (None, None)
    } else {
        let n = joined.len() as f64;
        let g_sum: f64 = joined.iter().map(|p| p.growth_yoy).sum();
        let i_sum: f64 = joined.iter().map(|p| p.inflation_yoy).sum();
        (Some(g_sum / n), Some(i_sum / n))
    };

    // Trail = last `trail_months` of the joined series.
    let trail: Vec<RegimePoint> = if joined.len() > trail_months {
        joined[joined.len() - trail_months..].to_vec()
    } else {
        joined.clone()
    };

    let current = trail.last().cloned();
    let observation_count = joined.len() as u32;

    // Axis bounds: trail min/max plus padding, expanded to include the
    // baselines so the crosshairs always sit inside the plot area.
    let axis_bounds = compute_axis_bounds(&trail, growth_baseline, inflation_baseline);

    Ok(RegimeQuadrantResponse {
        trail,
        current,
        growth_baseline,
        inflation_baseline,
        axis_bounds,
        growth_series_id: GROWTH_SERIES_ID.to_string(),
        inflation_series_id: inflation_series_id.to_string(),
        growth_label: "INDPRO YoY".to_string(),
        inflation_label: inflation_label.to_string(),
        trail_months_requested: trail_months,
        observation_count,
    })
}

fn load_monthly(db: &Db, series_id: &str) -> Result<Vec<MacroPoint>, String> {
    let raw = db.all_fred_observations(series_id)?;
    Ok(raw
        .into_iter()
        .filter_map(|(d_str, v)| {
            NaiveDate::parse_from_str(&d_str, ISO_DATE)
                .ok()
                .map(|date| MacroPoint { date, value: v })
        })
        .collect())
}

fn compute_axis_bounds(
    trail: &[RegimePoint],
    growth_baseline: Option<f64>,
    inflation_baseline: Option<f64>,
) -> AxisBounds {
    const PAD: f64 = 1.5;
    const FALLBACK_HALF: f64 = 5.0;
    if trail.is_empty() {
        let bx = growth_baseline.unwrap_or(0.0);
        let by = inflation_baseline.unwrap_or(0.0);
        return AxisBounds {
            x_min: bx - FALLBACK_HALF,
            x_max: bx + FALLBACK_HALF,
            y_min: by - FALLBACK_HALF,
            y_max: by + FALLBACK_HALF,
        };
    }
    let mut x_min = f64::INFINITY;
    let mut x_max = f64::NEG_INFINITY;
    let mut y_min = f64::INFINITY;
    let mut y_max = f64::NEG_INFINITY;
    for p in trail {
        x_min = x_min.min(p.growth_yoy);
        x_max = x_max.max(p.growth_yoy);
        y_min = y_min.min(p.inflation_yoy);
        y_max = y_max.max(p.inflation_yoy);
    }
    if let Some(b) = growth_baseline {
        x_min = x_min.min(b);
        x_max = x_max.max(b);
    }
    if let Some(b) = inflation_baseline {
        y_min = y_min.min(b);
        y_max = y_max.max(b);
    }
    AxisBounds {
        x_min: x_min - PAD,
        x_max: x_max + PAD,
        y_min: y_min - PAD,
        y_max: y_max + PAD,
    }
}
