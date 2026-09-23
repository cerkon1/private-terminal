//! Cross-section compute. Iterates every leaf sector_group + every ticker +
//! every FRED series; computes percentiles + regime + drawdown per row.
//!
//! Percentile baseline: trailing `lookback_years` calendar window ending at
//! each series' most recent observation. Date-based, so the window means the
//! same thing for every frequency — daily equities (~1260 bars), 7-day crypto
//! (~1825 bars), weekly and monthly FRED series. (Until v1.0.3 it was a fixed
//! 1260-observation count: ~3.5y for crypto, ~24y for weekly FRED, the whole
//! history for monthly.)

use std::collections::{HashMap, HashSet};

use chrono::{NaiveDate, Utc};
use serde_json::json;

use crate::cross_section::percentile::percentile_rank;
use crate::cross_section::{
    CrossSectionRequest, CrossSectionResponse, CrossSectionRow, CrossSectionSection, RegimeState,
};
use crate::db::{Db, FredSeriesRow, SectorGroupRow, WatchlistTickerRow};
use crate::indicators::{find_indicator, Bar, IndicatorRegion};

const ISO_DATE: &str = "%Y-%m-%d";
const NO_BARS_THRESHOLD: usize = 30;
const PARTIAL_HISTORY_THRESHOLD: usize = 252;
const VOLUME_AVG_WINDOW: usize = 5;
const MACRO_PARTIAL_OBS_THRESHOLD: usize = 60;

pub fn compute_cross_section(
    db: &Db,
    request: CrossSectionRequest,
) -> Result<CrossSectionResponse, String> {
    let lookback_years = request.lookback_years.max(1);

    let groups = db.list_sector_groups()?;
    let groups_by_id: HashMap<String, &SectorGroupRow> =
        groups.iter().map(|g| (g.id.clone(), g)).collect();
    let parent_ids: HashSet<String> = groups
        .iter()
        .filter_map(|g| g.parent_id.clone())
        .collect();

    // Leaf groups in display order. Pinned virtuals (pulse / scanner /
    // analysis / macro / news) carry no tickers and are skipped via
    // data_source == "virtual". Parent groups (those that have children)
    // are skipped — only leaves hold tickers.
    let mut leaves: Vec<&SectorGroupRow> = groups
        .iter()
        .filter(|g| g.data_source != "virtual")
        .filter(|g| !parent_ids.contains(&g.id))
        .filter(|g| g.enabled)
        .collect();
    // Sort key: top-level position then sub-position. For a top-level leaf
    // (no parent), use its own display_order as the top-level position and 0
    // as the sub-position. For a sub-sector, use the parent's display_order
    // as the top-level position and the child's display_order as the sub.
    // This keeps INDICES sub-sectors next to each other AND interleaved with
    // top-level leaves like CRYPTO / FX / BONDS in the right place.
    leaves.sort_by_key(|g| match g.parent_id.as_ref().and_then(|pid| groups_by_id.get(pid)) {
        Some(parent) => (parent.display_order.unwrap_or(0), g.display_order.unwrap_or(0)),
        None => (g.display_order.unwrap_or(0), 0),
    });

    let mut sections: Vec<CrossSectionSection> = Vec::new();
    for group in leaves {
        let label = make_section_label(group, &groups_by_id);
        let tickers = db.list_tickers_in_sector(&group.id)?;
        let mut rows = Vec::new();
        for t in tickers.iter().filter(|t| t.enabled) {
            rows.push(compute_ticker_row(db, t, lookback_years)?);
        }
        if rows.is_empty() {
            continue;
        }
        sections.push(CrossSectionSection {
            id: group.id.clone(),
            display_name: label,
            rows,
        });
    }

    // Macro section — every FRED series, regardless of `tile_visible`.
    // Pulse aggregates the full macro picture; the MACRO dashboard's tile
    // visibility flag is a different (display-layer) concern.
    let series = db.list_fred_series()?;
    if !series.is_empty() {
        let mut rows = Vec::new();
        for s in &series {
            rows.push(compute_macro_row(db, s, lookback_years)?);
        }
        sections.push(CrossSectionSection {
            id: "macro".to_string(),
            display_name: "MACRO · FRED".to_string(),
            rows,
        });
    }

    Ok(CrossSectionResponse {
        sections,
        computed_at: Utc::now().to_rfc3339(),
    })
}

fn make_section_label(g: &SectorGroupRow, by_id: &HashMap<String, &SectorGroupRow>) -> String {
    match g.parent_id.as_ref().and_then(|p| by_id.get(p)) {
        Some(parent) => format!("{} · {}", parent.display_name.to_uppercase(), g.display_name),
        None => g.display_name.to_uppercase(),
    }
}

fn compute_ticker_row(
    db: &Db,
    t: &WatchlistTickerRow,
    lookback_years: u32,
) -> Result<CrossSectionRow, String> {
    let bars = db.all_price_bars_ohlcv(&t.ticker, &t.data_source)?;

    if bars.len() < NO_BARS_THRESHOLD {
        // Greyed row — pull persistent fetch error so the user sees WHY
        // the row is empty (e.g. "Yahoo: 404 — symbol not found"). For
        // tickers that have never been fetched at all, no quote_cache
        // row exists yet → last_fetch_error is None and the row stays
        // generically greyed with no annotation. (S22)
        let last_fetch_error = db
            .get_quote(&t.ticker, &t.data_source)?
            .and_then(|q| q.last_fetch_error);
        return Ok(CrossSectionRow {
            ticker: t.ticker.clone(),
            display_name: t.display_name.clone(),
            sector_group_id: t.sector_group_id.clone(),
            data_source: t.data_source.clone(),
            is_macro: false,
            no_bars: true,
            partial_history: false,
            last_fetch_error,
            ..Default::default()
        });
    }

    let partial = bars.len() < PARTIAL_HISTORY_THRESHOLD;
    let window_start = window_start_by_date(bars.iter().map(|b| b.date.as_str()), lookback_years);
    let window = &bars[window_start..];

    // LEVEL — current close percentile within trailing-5y closes.
    let window_closes: Vec<f64> = window.iter().filter_map(|b| b.close).collect();
    let current_close = bars.last().and_then(|b| b.close);
    let level = current_close.map(|c| percentile_rank(c, &window_closes));

    // DD — current close vs trailing-5y running peak.
    let peak = window_closes
        .iter()
        .copied()
        .fold(f64::NEG_INFINITY, f64::max);
    let dd_pct = current_close.and_then(|c| {
        if peak.is_finite() && peak > 0.0 {
            Some((c / peak - 1.0) * 100.0)
        } else {
            None
        }
    });

    // REGIME + AGE — universal SMMA Ribbon compute with default params.
    let (regime, age_days) = match find_indicator("smma_ribbon") {
        Some(ind) => {
            let params = json!({"lengths": [15, 19, 25, 29], "confirm_bars": 3});
            match ind.compute(&bars, &params) {
                Ok(out) => extract_regime_and_age(&bars, &out.regions),
                Err(_) => (None, None),
            }
        }
        None => (None, None),
    };

    // RSI / ATR percentiles — universal default params.
    let rsi = compute_indicator_percentile(&bars, "rsi_14", &json!({"length": 14}), window_start)?;
    let atr = compute_indicator_percentile(&bars, "atr_14", &json!({"length": 14}), window_start)?;

    // VOL — 5d-avg volume percentile vs trailing 5y of 5d-avg volumes.
    let vol_series = rolling_avg_volume(&bars, VOLUME_AVG_WINDOW);
    let vol = compute_series_percentile(&vol_series, window_start);

    Ok(CrossSectionRow {
        ticker: t.ticker.clone(),
        display_name: t.display_name.clone(),
        sector_group_id: t.sector_group_id.clone(),
        data_source: t.data_source.clone(),
        is_macro: false,
        no_bars: false,
        partial_history: partial,
        regime,
        age_days,
        level,
        rsi,
        atr,
        vol,
        dd_pct,
        // Bars exist → fetch is healthy enough; no error annotation needed.
        last_fetch_error: None,
    })
}

fn compute_macro_row(
    db: &Db,
    s: &FredSeriesRow,
    lookback_years: u32,
) -> Result<CrossSectionRow, String> {
    let obs = db.all_fred_observations(&s.series_id)?;

    if obs.is_empty() {
        return Ok(CrossSectionRow {
            ticker: s.series_id.clone(),
            display_name: s.title.clone(),
            sector_group_id: "macro".to_string(),
            data_source: "fred".to_string(),
            is_macro: true,
            no_bars: true,
            partial_history: false,
            ..Default::default()
        });
    }

    // Sparse-frequency series (weekly, monthly) hit this — daily series have
    // plenty of obs and won't trip it. Keeps the asterisk marker meaningful
    // for "this baseline isn't really 5y of data."
    let partial = obs.len() < MACRO_PARTIAL_OBS_THRESHOLD;

    let window_start = window_start_by_date(obs.iter().map(|(d, _)| d.as_str()), lookback_years);
    let window_values: Vec<f64> = obs[window_start..].iter().map(|(_, v)| *v).collect();
    let current = obs.last().map(|(_, v)| *v);
    let level = current.map(|c| percentile_rank(c, &window_values));

    Ok(CrossSectionRow {
        ticker: s.series_id.clone(),
        display_name: s.title.clone(),
        sector_group_id: "macro".to_string(),
        data_source: "fred".to_string(),
        is_macro: true,
        no_bars: false,
        partial_history: partial,
        regime: None,
        age_days: None,
        level,
        rsi: None,
        atr: None,
        vol: None,
        dd_pct: None,
        // FRED has its own fetch_error path on `fred_series` (surfaced
        // by MacroTile already) — no need to plumb it through Pulse.
        last_fetch_error: None,
    })
}

/// Trailing region in `regions` is the active regime; its `start_date` is the
/// most recent confirmed flip. Region label values are "bullish" / "bearish" /
/// "neutral" per `smma_ribbon::region`. Calendar-day age (not bar count).
fn extract_regime_and_age(
    bars: &[Bar],
    regions: &[IndicatorRegion],
) -> (Option<RegimeState>, Option<u32>) {
    let last_region = match regions.last() {
        Some(r) => r,
        None => return (None, None),
    };
    let regime = match last_region.label.as_str() {
        "bullish" => Some(RegimeState::Bull),
        "bearish" => Some(RegimeState::Bear),
        "neutral" => Some(RegimeState::Neutral),
        _ => None,
    };
    let last_date_str = bars.last().map(|b| b.date.as_str());
    let age_days = match (
        NaiveDate::parse_from_str(&last_region.start_date, ISO_DATE),
        last_date_str.and_then(|d| NaiveDate::parse_from_str(d, ISO_DATE).ok()),
    ) {
        (Ok(start), Some(end)) => {
            let diff = (end - start).num_days();
            if diff >= 0 {
                Some(diff as u32)
            } else {
                None
            }
        }
        _ => None,
    };
    (regime, age_days)
}

fn compute_indicator_percentile(
    bars: &[Bar],
    indicator_id: &str,
    params: &serde_json::Value,
    window_start: usize,
) -> Result<Option<f64>, String> {
    let ind = match find_indicator(indicator_id) {
        Some(i) => i,
        None => return Ok(None),
    };
    let output = match ind.compute(bars, params) {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };
    if output.series.is_empty() {
        return Ok(None);
    }
    let values: Vec<Option<f64>> = output.series[0].data.iter().map(|p| p.value).collect();
    Ok(compute_series_percentile(&values, window_start))
}

/// `series` is aligned to the bars; `window_start` comes from
/// `window_start_by_date` over those same bars.
fn compute_series_percentile(series: &[Option<f64>], window_start: usize) -> Option<f64> {
    let current = series.last().copied().flatten()?;
    let window: Vec<f64> = series[window_start.min(series.len())..]
        .iter()
        .filter_map(|v| *v)
        .collect();
    if window.is_empty() {
        return None;
    }
    Some(percentile_rank(current, &window))
}

/// Index of the first observation inside the trailing `years` calendar window
/// that ends at the last observation. `dates` are ISO `YYYY-MM-DD` in
/// ascending order. Unparseable last date → 0 (whole history).
pub(crate) fn window_start_by_date<'a>(
    dates: impl Iterator<Item = &'a str> + Clone,
    years: u32,
) -> usize {
    let cutoff = dates
        .clone()
        .last()
        .and_then(|d| NaiveDate::parse_from_str(d, ISO_DATE).ok())
        .and_then(|d| d.checked_sub_months(chrono::Months::new(12 * years)));
    match cutoff {
        Some(cutoff) => {
            let cutoff = cutoff.format(ISO_DATE).to_string();
            // ISO dates order lexically, so a string compare is a date compare.
            dates.take_while(|d| *d < cutoff.as_str()).count()
        }
        None => 0,
    }
}

/// Trailing N-bar average volume per bar. None during warmup or when any
/// volume in the window is missing.
pub(crate) fn rolling_avg_volume(bars: &[Bar], window: usize) -> Vec<Option<f64>> {
    let n = bars.len();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        if i + 1 < window {
            out.push(None);
            continue;
        }
        let slice = &bars[i + 1 - window..=i];
        let sum: Option<f64> = slice
            .iter()
            .map(|b| b.volume)
            .try_fold(0.0_f64, |acc, v| v.map(|x| acc + x));
        out.push(sum.map(|s| s / window as f64));
    }
    out
}
