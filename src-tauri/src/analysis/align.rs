//! Cross-asset date alignment.
//!
//! Crypto bars are 7-day; equity bars are 5-day; FRED series are weekday-only
//! with publish lag. Inner-join on date is the only safe primitive — anything
//! more clever leaks calendar bias into downstream stats.
//!
//! Coverage rule (Q4.A): a series participates only if its bar count is at
//! least `lookback_days × 0.5`. Below that threshold the series is excluded
//! and surfaced via `ExcludedTicker` with the actual count.

use std::collections::BTreeMap;

use chrono::{Duration, NaiveDate};

use crate::analysis::{ExcludedTicker, TickerKey};

/// Result of aligning N close-price series on common dates.
pub struct AlignedSeries {
    /// Dates that survived the inner join + lookback trim, ascending.
    pub dates: Vec<NaiveDate>,
    /// One vector per included ticker, same length as `dates`.
    pub series: Vec<(TickerKey, Vec<f64>)>,
    pub excluded: Vec<ExcludedTicker>,
}

const ISO_DATE: &str = "%Y-%m-%d";

/// Inner-join close-price series on common dates, with a min-coverage gate.
///
/// `inputs`: (key, [(date_str, close), ...]) pairs, each pre-sorted ascending
///   by date. Date strings are ISO 8601 (`YYYY-MM-DD`).
/// `lookback_days`: calendar-day window. Dates older than `latest - lookback`
///   are trimmed.
/// `min_bars_required`: typically `lookback_days / 2`. Series with fewer bars
///   (across their entire history, not just the window) are excluded.
pub fn align_close_prices(
    inputs: Vec<(TickerKey, Vec<(String, f64)>)>,
    lookback_days: u32,
    min_bars_required: u32,
) -> AlignedSeries {
    let mut excluded = Vec::new();
    let mut kept: Vec<(TickerKey, Vec<(String, f64)>)> = Vec::new();

    for (key, hist) in inputs {
        let n = hist.len() as u32;
        if n < min_bars_required {
            excluded.push(ExcludedTicker {
                ticker: key.ticker.clone(),
                data_source: key.data_source.clone(),
                bar_count: n,
                reason: format!("only {} bars; need {}", n, min_bars_required),
            });
        } else {
            kept.push((key, hist));
        }
    }

    if kept.is_empty() {
        return AlignedSeries {
            dates: Vec::new(),
            series: Vec::new(),
            excluded,
        };
    }

    // Per-ticker date→close map. Count occurrences across all maps so we can
    // intersect dates without nested loops.
    let mut occurrences: BTreeMap<String, u32> = BTreeMap::new();
    let mut maps: Vec<(TickerKey, BTreeMap<String, f64>)> = Vec::with_capacity(kept.len());
    for (key, hist) in kept {
        let mut m: BTreeMap<String, f64> = BTreeMap::new();
        for (d, v) in hist {
            // First insert wins on duplicate (date, ticker). The
            // (ticker, data_source, bar_date) PK should prevent dupes; this
            // is a defensive guard so a corrupted input doesn't double-count
            // a date in `occurrences`.
            if !m.contains_key(&d) {
                *occurrences.entry(d.clone()).or_insert(0) += 1;
            }
            m.entry(d).or_insert(v);
        }
        maps.push((key, m));
    }

    let n_series = maps.len() as u32;
    let common_dates_str: Vec<String> = occurrences
        .into_iter()
        .filter_map(|(d, c)| if c == n_series { Some(d) } else { None })
        .collect();

    // Parse + calendar-day trim. If parsing fails for any string we drop it —
    // shouldn't happen with DB-stored ISO dates, but no point crashing.
    let mut common_dates: Vec<NaiveDate> = common_dates_str
        .iter()
        .filter_map(|s| NaiveDate::parse_from_str(s, ISO_DATE).ok())
        .collect();

    if let (true, Some(&latest)) = (lookback_days > 0, common_dates.last()) {
        let cutoff = latest - Duration::days(lookback_days as i64 - 1);
        common_dates.retain(|d| *d >= cutoff);
    }

    // Build series in the same date order. Re-format once per date for the
    // BTreeMap lookup; cheaper than parsing every map key.
    let date_keys: Vec<String> = common_dates
        .iter()
        .map(|d| d.format(ISO_DATE).to_string())
        .collect();

    let series: Vec<(TickerKey, Vec<f64>)> = maps
        .into_iter()
        .map(|(key, m)| {
            let vals: Vec<f64> = date_keys.iter().map(|d| m[d]).collect();
            (key, vals)
        })
        .collect();

    AlignedSeries {
        dates: common_dates,
        series,
        excluded,
    }
}

/// Log returns: ln(p_t / p_{t-1}). Length = input.len() - 1. Empty / single-
/// element input returns empty. Non-positive prices guard to 0.0 (defensive;
/// shouldn't occur on real cash prices).
pub fn log_returns(closes: &[f64]) -> Vec<f64> {
    if closes.len() < 2 {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(closes.len() - 1);
    for w in closes.windows(2) {
        if w[0] > 0.0 && w[1] > 0.0 {
            out.push((w[1] / w[0]).ln());
        } else {
            out.push(0.0);
        }
    }
    out
}

/// Pearson correlation coefficient. Returns 0.0 on degenerate input
/// (length < 2 or zero variance) rather than Option<f64> — every matrix cell
/// would otherwise have to unwrap, and 0.0 is the natural neutral value.
pub fn pearson(xs: &[f64], ys: &[f64]) -> f64 {
    let n = xs.len().min(ys.len());
    if n < 2 {
        return 0.0;
    }
    let nf = n as f64;
    let mean_x = xs.iter().take(n).sum::<f64>() / nf;
    let mean_y = ys.iter().take(n).sum::<f64>() / nf;
    let mut cov = 0.0;
    let mut var_x = 0.0;
    let mut var_y = 0.0;
    for i in 0..n {
        let dx = xs[i] - mean_x;
        let dy = ys[i] - mean_y;
        cov += dx * dy;
        var_x += dx * dx;
        var_y += dy * dy;
    }
    let denom = (var_x * var_y).sqrt();
    if denom == 0.0 {
        0.0
    } else {
        cov / denom
    }
}
