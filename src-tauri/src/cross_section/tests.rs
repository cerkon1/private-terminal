use super::compute::rolling_avg_volume;
use super::percentile::percentile_rank;
use crate::indicators::Bar;

fn bar(date: &str, vol: Option<f64>) -> Bar {
    Bar {
        date: date.to_string(),
        open: None,
        high: None,
        low: None,
        close: None,
        volume: vol,
    }
}

#[test]
fn percentile_empty_baseline_returns_neutral() {
    assert_eq!(percentile_rank(50.0, &[]), 50.0);
}

#[test]
fn percentile_value_above_all() {
    let baseline = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    assert_eq!(percentile_rank(100.0, &baseline), 100.0);
}

#[test]
fn percentile_value_below_all() {
    let baseline = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    assert_eq!(percentile_rank(0.0, &baseline), 0.0);
}

#[test]
fn percentile_value_at_median() {
    let baseline: Vec<f64> = (1..=100).map(|i| i as f64).collect();
    let r = percentile_rank(50.0, &baseline);
    assert!((r - 50.0).abs() < 1e-9, "expected ~50, got {}", r);
}

#[test]
fn percentile_excludes_nans_from_baseline() {
    // 3 finite values [1, 3, 5]. value=3 → count_leq = 2 (1 and 3) → 2/3 ≈ 66.67%.
    let baseline = vec![1.0, f64::NAN, 3.0, 5.0];
    let r = percentile_rank(3.0, &baseline);
    let expected = 2.0_f64 / 3.0_f64 * 100.0;
    assert!((r - expected).abs() < 1e-9);
}

#[test]
fn percentile_all_nan_baseline_returns_neutral() {
    let baseline = vec![f64::NAN, f64::NAN, f64::NAN];
    assert_eq!(percentile_rank(42.0, &baseline), 50.0);
}

#[test]
fn rolling_avg_volume_warmup() {
    let bars = vec![
        bar("2026-01-01", Some(100.0)),
        bar("2026-01-02", Some(200.0)),
        bar("2026-01-03", Some(300.0)),
    ];
    let r = rolling_avg_volume(&bars, 5);
    assert!(r.iter().all(|x| x.is_none()));
}

#[test]
fn rolling_avg_volume_basic() {
    let bars = vec![
        bar("2026-01-01", Some(100.0)),
        bar("2026-01-02", Some(200.0)),
        bar("2026-01-03", Some(300.0)),
        bar("2026-01-04", Some(400.0)),
        bar("2026-01-05", Some(500.0)),
    ];
    let r = rolling_avg_volume(&bars, 5);
    assert_eq!(r[4], Some(300.0));
    assert!(r[3].is_none());
}

#[test]
fn rolling_avg_volume_missing_breaks_window() {
    let bars = vec![
        bar("2026-01-01", Some(100.0)),
        bar("2026-01-02", None),
        bar("2026-01-03", Some(300.0)),
    ];
    let r = rolling_avg_volume(&bars, 3);
    assert_eq!(r[2], None);
}
