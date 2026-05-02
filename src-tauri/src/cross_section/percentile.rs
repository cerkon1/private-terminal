//! Empirical percentile rank — `(count of values <= x) / total * 100`.
//! No interpolation; standard CDF-style rank used by the Pulse cross-section.

/// Returns the percentile rank of `value` within `baseline` as a 0-100 f64.
/// Empty / fully-NaN baseline → 50.0 (neutral fallback). NaN values in the
/// baseline are excluded from both count and total.
pub fn percentile_rank(value: f64, baseline: &[f64]) -> f64 {
    let mut total = 0_usize;
    let mut count_leq = 0_usize;
    for v in baseline {
        if !v.is_finite() {
            continue;
        }
        total += 1;
        if *v <= value {
            count_leq += 1;
        }
    }
    if total == 0 {
        return 50.0;
    }
    (count_leq as f64 / total as f64) * 100.0
}
