//! SMMA Ribbon backtest (v1.1) — long-only, one ticker.
//!
//! Answers trendscope's open question: "are the flips worth anything?"
//! Rules (honest defaults, stated in the tab):
//!
//! - Signal: the bar where the *confirmed* ribbon state becomes bullish
//!   (a state already bullish on the first post-warm-up bar counts).
//! - Entry: the NEXT bar's open (close if the open is missing) — never the
//!   close that produced the signal.
//! - Exit: the next bar's open after the state leaves bullish.
//! - A position still open on the last bar is marked to the last close and
//!   flagged `open`.
//! - No costs, slippage, dividends or taxes.
//!
//! Buy-and-hold is measured over the same span (first post-warm-up close →
//! last close). Default ribbon params, same as Pulse.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::analysis::{ExcludedTicker, TickerKey};
use crate::db::Db;
use crate::indicators::{find_indicator, Bar};

/// Bars before every SMMA of the default ribbon (longest length 29) exists.
const WARMUP_BARS: usize = 28;
/// Need a year of daily bars for the result to mean anything.
const MIN_BARS: usize = 252;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BacktestRequest {
    pub ticker: TickerKey,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trade {
    pub signal_date: String,
    pub entry_date: String,
    pub entry_price: f64,
    pub exit_date: String,
    pub exit_price: f64,
    pub return_pct: f64,
    pub bars_held: usize,
    /// Still open at the last bar — exit is the last close, not a fill.
    pub open: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfStats {
    pub total_return_pct: f64,
    /// None when the span is under ~1 year of calendar days.
    pub cagr_pct: Option<f64>,
    pub max_drawdown_pct: f64,
    pub time_in_market_pct: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeStats {
    pub trades: usize,
    pub win_rate_pct: Option<f64>,
    pub avg_trade_pct: Option<f64>,
    pub median_trade_pct: Option<f64>,
    pub best_trade_pct: Option<f64>,
    pub worst_trade_pct: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityPoint {
    pub date: String,
    pub strategy: f64,
    pub buy_hold: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Simulation {
    pub trades: Vec<Trade>,
    pub trade_stats: TradeStats,
    pub strategy: PerfStats,
    pub buy_hold: PerfStats,
    pub equity: Vec<EquityPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacktestResponse {
    pub ticker: TickerKey,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub bar_count: usize,
    pub simulation: Option<Simulation>,
    pub excluded: Vec<ExcludedTicker>,
}

pub fn compute_backtest(db: &Db, request: BacktestRequest) -> Result<BacktestResponse, String> {
    let key = request.ticker;
    let bars = db.all_price_bars_ohlcv(&key.ticker, &key.data_source)?;
    let excluded = |reason: &str| ExcludedTicker {
        ticker: key.ticker.clone(),
        data_source: key.data_source.clone(),
        bar_count: bars.len() as u32,
        reason: reason.to_string(),
    };
    if bars.len() < MIN_BARS {
        return Ok(BacktestResponse {
            excluded: vec![excluded(
                "needs at least a year of daily bars — open the ticker's chart or use PRIME on Pulse",
            )],
            ticker: key.clone(),
            start_date: None,
            end_date: None,
            bar_count: bars.len(),
            simulation: None,
        });
    }

    let ribbon = find_indicator("smma_ribbon").ok_or("smma_ribbon indicator missing")?;
    let out = ribbon.compute(&bars, &json!({ "lengths": [15, 19, 25, 29], "confirm_bars": 3 }))?;
    let bullish = bullish_by_bar(&bars, &out.regions);
    let sim = simulate(&bars, &bullish, WARMUP_BARS);

    Ok(BacktestResponse {
        start_date: bars.get(WARMUP_BARS).map(|b| b.date.clone()),
        end_date: bars.last().map(|b| b.date.clone()),
        bar_count: bars.len(),
        simulation: Some(sim),
        excluded: vec![],
        ticker: key,
    })
}

/// Expand the ribbon's contiguous regions into a per-bar "is bullish" flag.
fn bullish_by_bar(bars: &[Bar], regions: &[crate::indicators::IndicatorRegion]) -> Vec<bool> {
    let index: HashMap<&str, usize> = bars.iter().enumerate().map(|(i, b)| (b.date.as_str(), i)).collect();
    let mut out = vec![false; bars.len()];
    for r in regions.iter().filter(|r| r.label == "bullish") {
        if let (Some(&a), Some(&b)) = (index.get(r.start_date.as_str()), index.get(r.end_date.as_str())) {
            for flag in &mut out[a..=b] {
                *flag = true;
            }
        }
    }
    out
}

fn fill_price(bar: &Bar) -> Option<f64> {
    bar.open.filter(|v| v.is_finite() && *v > 0.0).or(bar.close)
}

/// Pure simulation over `bars[start..]` given a per-bar bullish flag.
pub(crate) fn simulate(bars: &[Bar], bullish: &[bool], start: usize) -> Simulation {
    let n = bars.len().min(bullish.len());
    if n == 0 || start >= n {
        return Simulation::default();
    }
    let close = |i: usize| bars[i].close.unwrap_or(f64::NAN);

    let mut trades: Vec<Trade> = Vec::new();
    // (signal index, entry index, entry price) of the open position.
    let mut position: Option<(usize, usize, f64)> = None;
    let mut cash = 100.0_f64;
    let mut equity = Vec::with_capacity(n - start);
    let mut bars_in_market = 0usize;
    let base_close = close(start);

    // Signals/exits decided on bar i take effect at bar i+1's open.
    let mut pending_entry: Option<usize> = None;
    let mut pending_exit = false;

    for i in start..n {
        if let Some(sig) = pending_entry.take() {
            if let Some(px) = fill_price(&bars[i]) {
                position = Some((sig, i, px));
            }
        }
        if pending_exit {
            pending_exit = false;
            if let Some((sig, entry_i, entry_px)) = position.take() {
                let exit_px = fill_price(&bars[i]).unwrap_or(entry_px);
                let ret = exit_px / entry_px - 1.0;
                cash *= 1.0 + ret;
                trades.push(Trade {
                    signal_date: bars[sig].date.clone(),
                    entry_date: bars[entry_i].date.clone(),
                    entry_price: entry_px,
                    exit_date: bars[i].date.clone(),
                    exit_price: exit_px,
                    return_pct: ret * 100.0,
                    bars_held: i - entry_i,
                    open: false,
                });
            }
        }

        let was_bullish = i > start && bullish[i - 1];
        if position.is_none() && pending_entry.is_none() && bullish[i] && !was_bullish {
            pending_entry = Some(i);
        }
        if position.is_some() && !bullish[i] {
            pending_exit = true;
        }

        let mark = match position {
            Some((_, _, entry_px)) => {
                bars_in_market += 1;
                cash * close(i) / entry_px
            }
            None => cash,
        };
        equity.push(EquityPoint {
            date: bars[i].date.clone(),
            strategy: mark,
            buy_hold: 100.0 * close(i) / base_close,
        });
    }

    if let Some((sig, entry_i, entry_px)) = position {
        let last = n - 1;
        let ret = close(last) / entry_px - 1.0;
        trades.push(Trade {
            signal_date: bars[sig].date.clone(),
            entry_date: bars[entry_i].date.clone(),
            entry_price: entry_px,
            exit_date: bars[last].date.clone(),
            exit_price: close(last),
            return_pct: ret * 100.0,
            bars_held: last - entry_i,
            open: true,
        });
    }

    let span_days = calendar_days(&bars[start].date, &bars[n - 1].date);
    let strat_curve: Vec<f64> = equity.iter().map(|p| p.strategy).collect();
    let bh_curve: Vec<f64> = equity.iter().map(|p| p.buy_hold).collect();
    let total_bars = equity.len().max(1) as f64;

    Simulation {
        trade_stats: trade_stats(&trades),
        strategy: perf(&strat_curve, span_days, bars_in_market as f64 / total_bars * 100.0),
        buy_hold: perf(&bh_curve, span_days, 100.0),
        trades,
        equity,
    }
}

fn calendar_days(from: &str, to: &str) -> Option<i64> {
    let a = chrono::NaiveDate::parse_from_str(from, "%Y-%m-%d").ok()?;
    let b = chrono::NaiveDate::parse_from_str(to, "%Y-%m-%d").ok()?;
    Some((b - a).num_days())
}

fn perf(curve: &[f64], span_days: Option<i64>, time_in_market_pct: f64) -> PerfStats {
    let first = curve.first().copied().unwrap_or(100.0);
    let last = curve.last().copied().unwrap_or(first);
    let growth = last / first;
    let cagr_pct = span_days
        .filter(|d| *d >= 365)
        .map(|d| (growth.powf(365.25 / d as f64) - 1.0) * 100.0);
    PerfStats {
        total_return_pct: (growth - 1.0) * 100.0,
        cagr_pct,
        max_drawdown_pct: max_drawdown_pct(curve),
        time_in_market_pct,
    }
}

/// Deepest peak-to-trough fall, as a negative percent (0 = never below peak).
pub(crate) fn max_drawdown_pct(curve: &[f64]) -> f64 {
    let mut peak = f64::NEG_INFINITY;
    let mut worst = 0.0_f64;
    for &v in curve.iter().filter(|v| v.is_finite()) {
        peak = peak.max(v);
        if peak > 0.0 {
            worst = worst.min((v / peak - 1.0) * 100.0);
        }
    }
    worst
}

fn trade_stats(trades: &[Trade]) -> TradeStats {
    if trades.is_empty() {
        return TradeStats::default();
    }
    let mut rets: Vec<f64> = trades.iter().map(|t| t.return_pct).collect();
    let n = rets.len() as f64;
    let wins = rets.iter().filter(|r| **r > 0.0).count() as f64;
    let avg = rets.iter().sum::<f64>() / n;
    rets.sort_by(|a, b| a.total_cmp(b));
    let median = if rets.len() % 2 == 1 {
        rets[rets.len() / 2]
    } else {
        (rets[rets.len() / 2 - 1] + rets[rets.len() / 2]) / 2.0
    };
    TradeStats {
        trades: trades.len(),
        win_rate_pct: Some(wins / n * 100.0),
        avg_trade_pct: Some(avg),
        median_trade_pct: Some(median),
        best_trade_pct: rets.last().copied(),
        worst_trade_pct: rets.first().copied(),
    }
}

#[cfg(test)]
mod tests {
    use super::{max_drawdown_pct, simulate};
    use crate::indicators::Bar;

    /// Bars dated d0000.. with open == close unless overridden.
    fn bars(closes: &[f64]) -> Vec<Bar> {
        closes
            .iter()
            .enumerate()
            .map(|(i, &c)| Bar {
                date: format!("2026-01-{:02}", i + 1),
                open: Some(c),
                high: Some(c),
                low: Some(c),
                close: Some(c),
                volume: None,
            })
            .collect()
    }

    fn flags(s: &str) -> Vec<bool> {
        s.chars().map(|c| c == 'B').collect()
    }

    #[test]
    fn single_round_trip_fills_at_next_open() {
        // Signal on bar 1 → enter bar 2 open (12). Leaves bullish on bar 3 →
        // exit bar 4 open (15). Return = 15/12 − 1 = 25 %.
        let b = bars(&[10.0, 11.0, 12.0, 14.0, 15.0, 13.0]);
        let sim = simulate(&b, &flags("-BB---"), 0);
        assert_eq!(sim.trades.len(), 1);
        let t = &sim.trades[0];
        assert_eq!((t.signal_date.as_str(), t.entry_date.as_str(), t.exit_date.as_str()), ("2026-01-02", "2026-01-03", "2026-01-05"));
        assert!((t.return_pct - 25.0).abs() < 1e-9);
        assert!(!t.open);
        assert!((sim.strategy.total_return_pct - 25.0).abs() < 1e-9);
        // Buy-and-hold from the first close (10) to the last (13).
        assert!((sim.buy_hold.total_return_pct - 30.0).abs() < 1e-9);
    }

    #[test]
    fn position_open_at_the_end_is_marked_to_last_close() {
        let b = bars(&[10.0, 10.0, 20.0, 25.0]);
        let sim = simulate(&b, &flags("-BBB"), 0);
        let t = &sim.trades[0];
        assert!(t.open);
        assert!((t.entry_price - 20.0).abs() < 1e-9);
        assert!((t.return_pct - 25.0).abs() < 1e-9);
        assert!((sim.equity.last().unwrap().strategy - 125.0).abs() < 1e-9);
    }

    #[test]
    fn never_bullish_means_no_trades_and_flat_equity() {
        let b = bars(&[10.0, 12.0, 8.0, 11.0]);
        let sim = simulate(&b, &flags("----"), 0);
        assert!(sim.trades.is_empty());
        assert_eq!(sim.trade_stats.trades, 0);
        assert_eq!(sim.trade_stats.win_rate_pct, None);
        assert!(sim.equity.iter().all(|p| (p.strategy - 100.0).abs() < 1e-9));
        assert_eq!(sim.strategy.time_in_market_pct, 0.0);
    }

    #[test]
    fn gap_entry_uses_the_open_and_missing_open_falls_back_to_close() {
        let mut b = bars(&[10.0, 10.0, 12.0, 12.0]);
        b[2].open = Some(11.0); // gap: entry at 11, not the signal close 10
        let sim = simulate(&b, &flags("-BBB"), 0);
        assert!((sim.trades[0].entry_price - 11.0).abs() < 1e-9);

        let mut b2 = bars(&[10.0, 10.0, 12.0, 12.0]);
        b2[2].open = None;
        let sim2 = simulate(&b2, &flags("-BBB"), 0);
        assert!((sim2.trades[0].entry_price - 12.0).abs() < 1e-9);
    }

    #[test]
    fn already_bullish_at_start_counts_as_a_signal_and_warmup_is_skipped() {
        // start = 2: bars 0..1 are warm-up and ignored even though bullish.
        let b = bars(&[5.0, 6.0, 10.0, 11.0, 12.0]);
        let sim = simulate(&b, &flags("BBBBB"), 2);
        assert_eq!(sim.trades.len(), 1);
        assert_eq!(sim.trades[0].entry_date, "2026-01-04");
        assert_eq!(sim.equity.len(), 3);
        assert!((sim.buy_hold.total_return_pct - 20.0).abs() < 1e-9); // 10 → 12
    }

    #[test]
    fn trade_stats_and_drawdown_known_answers() {
        // Two trades: +25 % and −20 %.
        let b = bars(&[10.0, 10.0, 12.0, 15.0, 15.0, 10.0, 10.0, 8.0, 8.0]);
        let sim = simulate(&b, &flags("-BB--B---"), 0);
        let rets: Vec<f64> = sim.trades.iter().map(|t| t.return_pct.round()).collect();
        assert_eq!(rets, vec![25.0, -20.0]);
        assert_eq!(sim.trade_stats.win_rate_pct, Some(50.0));
        assert!((sim.trade_stats.avg_trade_pct.unwrap() - 2.5).abs() < 1e-9);
        assert!((sim.strategy.total_return_pct - 0.0).abs() < 1e-9); // 1.25 × 0.8
        assert!((max_drawdown_pct(&[100.0, 120.0, 90.0, 130.0, 65.0]) - (-50.0)).abs() < 1e-9);
        assert_eq!(max_drawdown_pct(&[100.0, 110.0]), 0.0);
    }

    #[test]
    fn cagr_needs_a_year_of_calendar_days() {
        let b = bars(&[10.0, 11.0]);
        assert_eq!(simulate(&b, &flags("--"), 0).buy_hold.cagr_pct, None);
    }
}
