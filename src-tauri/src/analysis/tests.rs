//! Math-only unit tests per S15 Q9.A. No DB / IPC fixtures here; that's
//! covered by the smoke-test checklist when Phase 1 ships end-to-end.

use crate::analysis::align::{align_close_prices, log_returns, pearson};
use crate::analysis::TickerKey;

fn k(ticker: &str) -> TickerKey {
    TickerKey {
        ticker: ticker.to_string(),
        data_source: "yahoo".to_string(),
    }
}

#[test]
fn pearson_perfect_positive() {
    let xs = [1.0, 2.0, 3.0, 4.0, 5.0];
    let ys = [2.0, 4.0, 6.0, 8.0, 10.0];
    let r = pearson(&xs, &ys);
    assert!((r - 1.0).abs() < 1e-12, "r={}", r);
}

#[test]
fn pearson_perfect_negative() {
    let xs = [1.0, 2.0, 3.0, 4.0, 5.0];
    let ys = [10.0, 8.0, 6.0, 4.0, 2.0];
    let r = pearson(&xs, &ys);
    assert!((r + 1.0).abs() < 1e-12, "r={}", r);
}

#[test]
fn pearson_uncorrelated_constant() {
    // y is constant → variance 0 → defined-as-0 by our convention.
    let xs = [1.0, 2.0, 3.0, 4.0, 5.0];
    let ys = [3.0, 3.0, 3.0, 3.0, 3.0];
    assert_eq!(pearson(&xs, &ys), 0.0);
}

#[test]
fn pearson_short_input() {
    assert_eq!(pearson(&[], &[]), 0.0);
    assert_eq!(pearson(&[1.0], &[2.0]), 0.0);
}

#[test]
fn log_returns_basic() {
    // 100 → 110 → 99: ln(110/100)=0.0953, ln(99/110)=-0.1054
    let r = log_returns(&[100.0, 110.0, 99.0]);
    assert_eq!(r.len(), 2);
    assert!((r[0] - 0.0953101798).abs() < 1e-6);
    assert!((r[1] - (-0.1053605157)).abs() < 1e-6);
}

#[test]
fn log_returns_empty_and_single() {
    assert!(log_returns(&[]).is_empty());
    assert!(log_returns(&[42.0]).is_empty());
}

#[test]
fn align_inner_join_only_common_dates() {
    let a = vec![
        ("2026-01-01".to_string(), 100.0),
        ("2026-01-02".to_string(), 101.0),
        ("2026-01-03".to_string(), 102.0),
    ];
    let b = vec![
        ("2026-01-02".to_string(), 200.0),
        ("2026-01-03".to_string(), 201.0),
        ("2026-01-04".to_string(), 202.0),
    ];
    let aligned = align_close_prices(
        vec![(k("A"), a), (k("B"), b)],
        365, // wide window — don't trim
        1,   // min bars
    );
    assert_eq!(aligned.dates.len(), 2);
    assert_eq!(aligned.dates[0].to_string(), "2026-01-02");
    assert_eq!(aligned.dates[1].to_string(), "2026-01-03");
    assert_eq!(aligned.series.len(), 2);
    assert_eq!(aligned.series[0].1, vec![101.0, 102.0]);
    assert_eq!(aligned.series[1].1, vec![200.0, 201.0]);
    assert!(aligned.excluded.is_empty());
}

#[test]
fn align_excludes_below_min_bars() {
    let a = vec![
        ("2026-01-01".to_string(), 100.0),
        ("2026-01-02".to_string(), 101.0),
        ("2026-01-03".to_string(), 102.0),
    ];
    let b = vec![("2026-01-02".to_string(), 200.0)]; // 1 bar
    let aligned = align_close_prices(
        vec![(k("A"), a), (k("SHORT"), b)],
        365,
        3, // need at least 3 bars
    );
    assert_eq!(aligned.excluded.len(), 1);
    assert_eq!(aligned.excluded[0].ticker, "SHORT");
    assert_eq!(aligned.excluded[0].bar_count, 1);
    // Only A survived → "common" = all of A's dates.
    assert_eq!(aligned.dates.len(), 3);
}

#[test]
fn align_calendar_day_trim_keeps_recent_window() {
    // 10 daily bars; lookback=3 should keep last 3.
    let make_series = || {
        (1..=10)
            .map(|i| (format!("2026-01-{:02}", i), i as f64))
            .collect::<Vec<_>>()
    };
    let aligned = align_close_prices(
        vec![(k("A"), make_series()), (k("B"), make_series())],
        3,
        1,
    );
    assert_eq!(aligned.dates.len(), 3);
    assert_eq!(aligned.dates[0].to_string(), "2026-01-08");
    assert_eq!(aligned.dates[2].to_string(), "2026-01-10");
}

#[test]
fn align_empty_input_returns_empty() {
    let aligned: crate::analysis::align::AlignedSeries =
        align_close_prices(vec![], 90, 30);
    assert!(aligned.dates.is_empty());
    assert!(aligned.series.is_empty());
    assert!(aligned.excluded.is_empty());
}
