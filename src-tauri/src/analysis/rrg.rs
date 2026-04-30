//! Relative Rotation Graph — JdK RS-Ratio + RS-Momentum on weekly closes.
//!
//! Convention (S15 Q3 + Phase 2 lock-in):
//! - Weekly sampling — last close per ISO week, joined across ticker and
//!   benchmark. Bloomberg's RRG is conventionally weekly; daily makes the
//!   tail noisier without adding signal.
//! - 14-period RS-Ratio lookback (Bloomberg default).
//! - 5-period RS-Momentum lookback (kept short so the tail meaningfully bends
//!   week-to-week — Bloomberg's exact momentum window varies by reference).
//! - Anchor: 100. Values above 100 = outperformance / accelerating;
//!   below = underperformance / decelerating. Quadrants:
//!     - TR (RS>100, M>100) Leading
//!     - BR (RS>100, M<100) Weakening
//!     - BL (RS<100, M<100) Lagging
//!     - TL (RS<100, M>100) Improving
//!
//! Math (the simple, well-cited community formulation):
//!   RS[t]      = ticker_close[t] / benchmark_close[t]
//!   RS_Ratio[t]    = 100 * RS[t] / SMA(RS, rs_period)[t]
//!   RS_Momentum[t] = 100 * RS_Ratio[t] / SMA(RS_Ratio, momentum_period)[t]
//!
//! Both are dimensionless ratios anchored at 100 — "indexed deviation from
//! the trailing mean." This is intentionally simpler than JdK's proprietary
//! z-score-of-z-score; it preserves the four-quadrant interpretation while
//! staying explainable. Math drift vs Bloomberg's exact RRG is acceptable for
//! a research dashboard (decision support, not advice — same liability rule
//! as v1 indicators).

use std::collections::BTreeMap;

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::analysis::{ExcludedTicker, TickerKey};
use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RrgRequest {
    pub benchmark: TickerKey,
    pub tickers: Vec<TickerKey>,
    /// Rolling window for RS-Ratio (weeks). Default 14.
    pub rs_period: u32,
    /// Rolling window for RS-Momentum (weeks). Default 5.
    pub momentum_period: u32,
    /// Number of trailing weeks to surface per ticker as the tail.
    pub tail_length: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RrgPoint {
    pub date: NaiveDate,
    pub rs_ratio: f64,
    pub rs_momentum: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RrgTail {
    pub ticker: TickerKey,
    /// Chronological; last entry is the "current" head dot.
    pub points: Vec<RrgPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RrgResponse {
    pub benchmark: TickerKey,
    pub rs_period: u32,
    pub momentum_period: u32,
    pub tail_length: u32,
    pub tails: Vec<RrgTail>,
    pub excluded: Vec<ExcludedTicker>,
    /// Common weekly bar count after benchmark↔ticker join, BEFORE the
    /// `rs_period + momentum_period` warm-up trim. Surfaced for the footer.
    pub weekly_bars: u32,
}

pub fn compute_rrg(db: &Db, request: RrgRequest) -> Result<RrgResponse, String> {
    let rs_period = request.rs_period.max(2) as usize;
    let momentum_period = request.momentum_period.max(2) as usize;
    let tail_length = request.tail_length.max(1) as usize;

    // Minimum joined weeks required to produce ≥1 valid (rs_ratio, rs_momentum)
    // pair: `rs_period + momentum_period - 1`. We need additionally `tail_length
    // - 1` more weeks to have a full tail. Keep tickers that meet at least one
    // valid point; render tails as long as data allows up to tail_length.
    let min_required_weeks = rs_period + momentum_period;

    // Benchmark must succeed — without it nothing else is comparable.
    let bench_daily = db.close_history(
        &request.benchmark.ticker,
        &request.benchmark.data_source,
    )?;
    let bench_weekly = weekly_close_resample(&bench_daily);
    if bench_weekly.len() < min_required_weeks {
        return Err(format!(
            "benchmark {} has only {} weekly bars; need at least {}",
            request.benchmark.ticker,
            bench_weekly.len(),
            min_required_weeks
        ));
    }

    // Build a (year, week) → benchmark close map for fast inner-joining.
    let bench_map: BTreeMap<(i32, u32), (NaiveDate, f64)> = bench_weekly
        .iter()
        .map(|(d, v)| ((d.iso_week().year(), d.iso_week().week()), (*d, *v)))
        .collect();

    let mut tails: Vec<RrgTail> = Vec::with_capacity(request.tickers.len());
    let mut excluded: Vec<ExcludedTicker> = Vec::new();

    for key in &request.tickers {
        if *key == request.benchmark {
            // Self-vs-self: RS = 1 → RS_Ratio = 100 → RS_Momentum = 100. The
            // tail collapses to a single point at the centerline. Useful as a
            // sanity reference, so we emit it rather than excluding.
        }
        let daily = db.close_history(&key.ticker, &key.data_source)?;
        let weekly = weekly_close_resample(&daily);

        // Inner-join on ISO week.
        let mut joined: Vec<(NaiveDate, f64, f64)> = Vec::new();
        for (d, t_close) in &weekly {
            let k = (d.iso_week().year(), d.iso_week().week());
            if let Some((_, b_close)) = bench_map.get(&k) {
                if *b_close > 0.0 {
                    joined.push((*d, *t_close, *b_close));
                }
            }
        }
        joined.sort_by_key(|r| r.0);

        if joined.len() < min_required_weeks {
            excluded.push(ExcludedTicker {
                ticker: key.ticker.clone(),
                data_source: key.data_source.clone(),
                bar_count: joined.len() as u32,
                reason: format!(
                    "only {} joined weekly bars; need {}",
                    joined.len(),
                    min_required_weeks
                ),
            });
            continue;
        }

        // Step 1: RS = ticker / benchmark.
        let rs: Vec<f64> = joined.iter().map(|(_, t, b)| t / b).collect();

        // Step 2: RS_Ratio = 100 * RS / SMA(RS, rs_period). Indexes above 100
        // mean RS is above its trailing mean (outperformance vs benchmark
        // when benchmark itself is the ratio's denominator).
        let rs_sma = rolling_sma(&rs, rs_period);
        let rs_ratio: Vec<Option<f64>> = rs
            .iter()
            .zip(rs_sma.iter())
            .map(|(r, s)| match s {
                Some(sma) if *sma > 0.0 => Some(100.0 * (r / sma)),
                _ => None,
            })
            .collect();

        // Step 3: RS_Momentum = 100 * RS_Ratio / SMA(RS_Ratio, momentum_period).
        // Use only Some-values for the rolling SMA; collapse to None where
        // RS_Ratio is None.
        let rs_ratio_filled: Vec<f64> = rs_ratio
            .iter()
            .map(|v| v.unwrap_or(f64::NAN))
            .collect();
        let mom_sma = rolling_sma_skip_nan(&rs_ratio_filled, momentum_period);
        let rs_momentum: Vec<Option<f64>> = rs_ratio
            .iter()
            .zip(mom_sma.iter())
            .map(|(r, s)| match (r, s) {
                (Some(rr), Some(ss)) if *ss > 0.0 => Some(100.0 * (rr / ss)),
                _ => None,
            })
            .collect();

        // Combine into RrgPoints; drop entries where either stat is None.
        let mut points: Vec<RrgPoint> = joined
            .iter()
            .zip(rs_ratio.iter().zip(rs_momentum.iter()))
            .filter_map(|((d, _, _), (r, m))| match (r, m) {
                (Some(rr), Some(mm)) => Some(RrgPoint {
                    date: *d,
                    rs_ratio: *rr,
                    rs_momentum: *mm,
                }),
                _ => None,
            })
            .collect();

        if points.is_empty() {
            excluded.push(ExcludedTicker {
                ticker: key.ticker.clone(),
                data_source: key.data_source.clone(),
                bar_count: joined.len() as u32,
                reason: "no valid (RS-Ratio, RS-Momentum) pair after warm-up".to_string(),
            });
            continue;
        }

        // Trim to the trailing `tail_length` points.
        let start = points.len().saturating_sub(tail_length);
        points = points.split_off(start);

        tails.push(RrgTail {
            ticker: key.clone(),
            points,
        });
    }

    let weekly_bars = bench_weekly.len() as u32;

    Ok(RrgResponse {
        benchmark: request.benchmark,
        rs_period: rs_period as u32,
        momentum_period: momentum_period as u32,
        tail_length: tail_length as u32,
        tails,
        excluded,
        weekly_bars,
    })
}

/// Resample daily (date, close) pairs to weekly by taking the last close
/// per ISO week. Returns ascending by date. Drops unparseable dates.
pub fn weekly_close_resample(daily: &[(String, f64)]) -> Vec<(NaiveDate, f64)> {
    let mut by_week: BTreeMap<(i32, u32), (NaiveDate, f64)> = BTreeMap::new();
    for (d_str, v) in daily {
        let date = match NaiveDate::parse_from_str(d_str, ISO_DATE) {
            Ok(d) => d,
            Err(_) => continue,
        };
        let key = (date.iso_week().year(), date.iso_week().week());
        by_week
            .entry(key)
            .and_modify(|cur| {
                if date > cur.0 {
                    *cur = (date, *v);
                }
            })
            .or_insert((date, *v));
    }
    by_week.into_values().collect()
}

/// Rolling SMA. Returns None for indices where fewer than `n` samples are
/// available behind the cursor. NaN inputs poison the window — preferred for
/// strict propagation; use `rolling_sma_skip_nan` when chaining over output
/// that may contain warm-up NaNs.
pub fn rolling_sma(xs: &[f64], n: usize) -> Vec<Option<f64>> {
    let mut out = vec![None; xs.len()];
    if n < 1 || xs.len() < n {
        return out;
    }
    for i in (n - 1)..xs.len() {
        let sum: f64 = xs[(i + 1 - n)..=i].iter().sum();
        out[i] = if sum.is_finite() {
            Some(sum / n as f64)
        } else {
            None
        };
    }
    out
}

/// Rolling SMA that skips NaN values, but still requires `n` non-NaN samples
/// in the window before emitting. Used for the second pass (RS_Momentum from
/// RS_Ratio) where the input has warm-up NaNs from the first pass.
pub fn rolling_sma_skip_nan(xs: &[f64], n: usize) -> Vec<Option<f64>> {
    let mut out = vec![None; xs.len()];
    if n < 1 {
        return out;
    }
    for i in 0..xs.len() {
        if i + 1 < n {
            continue;
        }
        let slice = &xs[(i + 1 - n)..=i];
        let valid: Vec<f64> = slice.iter().copied().filter(|v| v.is_finite()).collect();
        if valid.len() == n {
            out[i] = Some(valid.iter().sum::<f64>() / n as f64);
        }
    }
    out
}
