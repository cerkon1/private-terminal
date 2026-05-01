//! Math-only unit tests per S15 Q9.A. No DB / IPC fixtures here; that's
//! covered by the smoke-test checklist when Phase 1 ships end-to-end.

use crate::analysis::align::{align_close_prices, log_returns, pearson};
use crate::analysis::pairs::rolling_zscore;
use crate::analysis::rrg::{rolling_sma, rolling_sma_skip_nan, weekly_close_resample};
use crate::analysis::{yoy_pct_change, MacroPoint, TickerKey};
use chrono::NaiveDate;

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

#[test]
fn rolling_zscore_too_short_returns_all_none() {
    let r = rolling_zscore(&[1.0, 2.0, 3.0], 5);
    assert_eq!(r, vec![None, None, None]);
}

#[test]
fn rolling_zscore_constant_window_is_none() {
    // stdev = 0 across the window → undefined; we return None.
    let r = rolling_zscore(&[1.0, 1.0, 1.0, 1.0, 1.0], 3);
    assert!(r.iter().all(|v| v.is_none()));
}

#[test]
fn rolling_zscore_basic_step() {
    // Values 1..5 with window 3. At i=2, slice=[1,2,3] mean=2 stdev=1 → z=1.
    // At i=3, slice=[2,3,4] mean=3 stdev=1 → z=1. At i=4, [3,4,5] → z=1.
    let r = rolling_zscore(&[1.0, 2.0, 3.0, 4.0, 5.0], 3);
    assert_eq!(r.len(), 5);
    assert!(r[0].is_none() && r[1].is_none());
    for i in 2..5 {
        let z = r[i].expect("expected Some at i={i}");
        assert!((z - 1.0).abs() < 1e-9, "i={} z={}", i, z);
    }
}

#[test]
fn rolling_zscore_centered_value_is_zero() {
    // [1, 3, 5] window 3: mean=3, value at i=1 is 3 → z=0 at i=2.
    let r = rolling_zscore(&[1.0, 3.0, 5.0, 3.0], 3);
    // i=2: slice=[1,3,5], mean=3, sample-stdev=2, value=5 → z=1
    assert!((r[2].unwrap() - 1.0).abs() < 1e-9);
    // i=3: slice=[3,5,3], mean=11/3, sample-stdev=...; current=3 (below mean)
    let z3 = r[3].unwrap();
    assert!(z3 < 0.0, "expected negative z at i=3, got {}", z3);
}

#[test]
fn weekly_resample_takes_last_per_iso_week() {
    // 2026-01-05 = Mon, 2026-01-09 = Fri, 2026-01-12 = Mon, etc. ISO weeks
    // 2026-W02 (Mon Jan 5–Sun Jan 11) and 2026-W03 (Mon Jan 12–Sun Jan 18).
    let daily = vec![
        ("2026-01-05".to_string(), 100.0),
        ("2026-01-07".to_string(), 102.0),
        ("2026-01-09".to_string(), 105.0),
        ("2026-01-12".to_string(), 110.0),
        ("2026-01-16".to_string(), 108.0),
    ];
    let weekly = weekly_close_resample(&daily);
    assert_eq!(weekly.len(), 2);
    // Last close of W02 is Jan 9 (105), of W03 is Jan 16 (108).
    assert_eq!(weekly[0].0.to_string(), "2026-01-09");
    assert_eq!(weekly[0].1, 105.0);
    assert_eq!(weekly[1].0.to_string(), "2026-01-16");
    assert_eq!(weekly[1].1, 108.0);
}

#[test]
fn rolling_sma_warmup_then_steady() {
    let r = rolling_sma(&[1.0, 2.0, 3.0, 4.0, 5.0], 3);
    assert!(r[0].is_none() && r[1].is_none());
    assert!((r[2].unwrap() - 2.0).abs() < 1e-12);
    assert!((r[3].unwrap() - 3.0).abs() < 1e-12);
    assert!((r[4].unwrap() - 4.0).abs() < 1e-12);
}

#[test]
fn rolling_sma_skip_nan_requires_n_finite_in_window() {
    // [NaN, 1, 2, 3, 4] window 3: at i=2 slice=[NaN,1,2] only 2 finite → None.
    // At i=3 slice=[1,2,3] all finite → 2.0. At i=4 slice=[2,3,4] → 3.0.
    let r = rolling_sma_skip_nan(&[f64::NAN, 1.0, 2.0, 3.0, 4.0], 3);
    assert!(r[0].is_none() && r[1].is_none() && r[2].is_none());
    assert!((r[3].unwrap() - 2.0).abs() < 1e-12);
    assert!((r[4].unwrap() - 3.0).abs() < 1e-12);
}

fn mp(year: i32, month: u32, value: f64) -> MacroPoint {
    MacroPoint {
        date: NaiveDate::from_ymd_opt(year, month, 1).unwrap(),
        value,
    }
}

#[test]
fn yoy_basic_12_month_pct_change() {
    // Month 0..23 with level rising 100 → 110 → 121 → ... (10% YoY).
    // Specifically: levels [100, 100, ..., 100] for 12 months, then
    // [110, 110, ..., 110] for 12 → YoY at indices 12..23 = 10.0.
    let mut levels = Vec::new();
    for m in 0..12 {
        levels.push(mp(2024, (m % 12) + 1, 100.0));
    }
    for m in 0..12 {
        levels.push(mp(2025, (m % 12) + 1, 110.0));
    }
    let yoy = yoy_pct_change(&levels, 12);
    assert_eq!(yoy.len(), 24);
    for i in 0..12 {
        assert!(yoy[i].value.is_nan(), "i={i} expected NaN warm-up");
    }
    for i in 12..24 {
        assert!(
            (yoy[i].value - 10.0).abs() < 1e-9,
            "i={i} expected 10.0, got {}",
            yoy[i].value,
        );
    }
}

#[test]
fn yoy_warmup_first_n_are_nan() {
    let levels: Vec<MacroPoint> = (0..6).map(|i| mp(2025, i + 1, 100.0 + i as f64)).collect();
    let yoy = yoy_pct_change(&levels, 12);
    assert_eq!(yoy.len(), 6);
    assert!(yoy.iter().all(|p| p.value.is_nan()));
}

#[test]
fn yoy_skips_nonpositive_prior() {
    // First entry 0.0, second 100.0 — months=1, so YoY at i=1 references the 0
    // and must emit NaN (avoid div-by-zero / sign-flip).
    let levels = vec![mp(2025, 1, 0.0), mp(2025, 2, 100.0), mp(2025, 3, 110.0)];
    let yoy = yoy_pct_change(&levels, 1);
    assert!(yoy[0].value.is_nan());
    assert!(yoy[1].value.is_nan(), "prior was 0.0 — expected NaN");
    assert!((yoy[2].value - 10.0).abs() < 1e-9);
}
