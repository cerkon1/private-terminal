//! Ratio + rolling z-score for two close-price series.
//!
//! Phase 2 — Pairs / Ratio. Reuses the alignment helper to inner-join the two
//! series, then divides numerator by denominator per common date. The rolling
//! z-score lets the user see when the current ratio is stretched relative to
//! its trailing window (mean-reversion view).
//!
//! Log/linear toggle deliberately omitted — ECharts default log axis squashes
//! sub-decade ranges (the v1.0 S11 finding), and ratio charts often live in
//! exactly that range. Path (a) manual log10 transform tracked separately.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::analysis::align::align_close_prices;
use crate::analysis::{ExcludedTicker, TickerKey};
use crate::db::Db;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairsRequest {
    pub numerator: TickerKey,
    pub denominator: TickerKey,
    pub lookback_days: u32,
    /// Rolling window for the z-score. Common values: 20, 60, 90.
    pub z_score_window: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairsPoint {
    pub date: NaiveDate,
    pub ratio: f64,
    /// None until the rolling window has filled (first `z_score_window - 1` bars).
    pub z_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairsStats {
    pub current_ratio: Option<f64>,
    pub current_z: Option<f64>,
    /// Mean / stdev of the *full* aligned series (not the trailing window).
    /// Window-mean lives inside the per-bar z_score; surface the global stats
    /// for the footer readout.
    pub mean: Option<f64>,
    pub stdev: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairsResponse {
    pub numerator: TickerKey,
    pub denominator: TickerKey,
    pub lookback_days_requested: u32,
    pub z_score_window: u32,
    pub bar_count: u32,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub points: Vec<PairsPoint>,
    pub stats: PairsStats,
    pub excluded: Vec<ExcludedTicker>,
}

pub fn compute_pair_ratio(db: &Db, request: PairsRequest) -> Result<PairsResponse, String> {
    let lookback = request.lookback_days.max(1);
    let z_window = request.z_score_window.max(2);
    let min_bars = (lookback / 2).max(2);

    // Same align-helper path as correlations. Two series only; the helper
    // treats N=2 as a normal case.
    let inputs = vec![
        (
            request.numerator.clone(),
            db.close_history(&request.numerator.ticker, &request.numerator.data_source)?,
        ),
        (
            request.denominator.clone(),
            db.close_history(&request.denominator.ticker, &request.denominator.data_source)?,
        ),
    ];

    let aligned = align_close_prices(inputs, lookback, min_bars);

    // If either side was excluded the user gets an empty series + the
    // excluded list. Front-end renders the footnote and an empty chart.
    if aligned.series.len() < 2 {
        return Ok(PairsResponse {
            numerator: request.numerator,
            denominator: request.denominator,
            lookback_days_requested: lookback,
            z_score_window: z_window,
            bar_count: 0,
            start_date: None,
            end_date: None,
            points: Vec::new(),
            stats: PairsStats {
                current_ratio: None,
                current_z: None,
                mean: None,
                stdev: None,
                min: None,
                max: None,
            },
            excluded: aligned.excluded,
        });
    }

    // Resolve which aligned series is which side. align_close_prices preserves
    // input order, so series[0] = numerator. Defensive double-check on key match.
    let (num_idx, den_idx) = if aligned.series[0].0 == request.numerator {
        (0, 1)
    } else {
        (1, 0)
    };
    let num = &aligned.series[num_idx].1;
    let den = &aligned.series[den_idx].1;

    // Ratios per aligned date. Guard zero/negative denominator (shouldn't
    // happen on real cash prices but keeps the math from blowing up).
    let ratios: Vec<f64> = num
        .iter()
        .zip(den.iter())
        .map(|(a, b)| if *b > 0.0 { a / b } else { f64::NAN })
        .collect();

    let z_scores = rolling_zscore(&ratios, z_window as usize);

    let points: Vec<PairsPoint> = aligned
        .dates
        .iter()
        .zip(ratios.iter())
        .zip(z_scores.iter())
        .map(|((d, r), z)| PairsPoint {
            date: *d,
            ratio: *r,
            z_score: *z,
        })
        .collect();

    let stats = build_stats(&ratios, z_scores.last().and_then(|z| *z));

    Ok(PairsResponse {
        numerator: request.numerator,
        denominator: request.denominator,
        lookback_days_requested: lookback,
        z_score_window: z_window,
        bar_count: aligned.dates.len() as u32,
        start_date: aligned.dates.first().copied(),
        end_date: aligned.dates.last().copied(),
        points,
        stats,
        excluded: aligned.excluded,
    })
}

/// Rolling z-score over `window` samples. Returns `None` for indices where
/// fewer than `window` samples are available behind the cursor, OR when the
/// rolling stdev is zero (degenerate constant window). Uses sample stdev
/// (n - 1 denominator) — matches the convention finance shops expect for
/// z-score bands.
pub fn rolling_zscore(xs: &[f64], window: usize) -> Vec<Option<f64>> {
    let mut out = vec![None; xs.len()];
    if window < 2 || xs.len() < window {
        return out;
    }
    for i in (window - 1)..xs.len() {
        let slice = &xs[(i + 1 - window)..=i];
        let mean = slice.iter().sum::<f64>() / window as f64;
        let var = slice.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (window - 1) as f64;
        let stdev = var.sqrt();
        if stdev.is_finite() && stdev > 0.0 && xs[i].is_finite() {
            out[i] = Some((xs[i] - mean) / stdev);
        }
    }
    out
}

fn build_stats(ratios: &[f64], current_z: Option<f64>) -> PairsStats {
    let finite: Vec<f64> = ratios.iter().copied().filter(|v| v.is_finite()).collect();
    if finite.is_empty() {
        return PairsStats {
            current_ratio: None,
            current_z: None,
            mean: None,
            stdev: None,
            min: None,
            max: None,
        };
    }
    let n = finite.len() as f64;
    let mean = finite.iter().sum::<f64>() / n;
    let var = if finite.len() > 1 {
        finite.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0)
    } else {
        0.0
    };
    let stdev = var.sqrt();
    let min = finite.iter().copied().fold(f64::INFINITY, f64::min);
    let max = finite.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    PairsStats {
        current_ratio: ratios.last().copied().filter(|v| v.is_finite()),
        current_z,
        mean: Some(mean),
        stdev: Some(stdev),
        min: Some(min),
        max: Some(max),
    }
}
