//! Smoothed Moving Average (a.k.a. Wilder's smoothing / RMA).
//!
//! Pine Script recursion, verbatim port of trendscope's smma():
//!   smma[0..length-2] = NaN (not enough data)
//!   smma[length-1]    = SMA(src, length)
//!   smma[i]           = (smma[i-1] * (length - 1) + src[i]) / length   (i >= length)

/// Compute SMMA over `src` (with Option<f64> for NaN-equivalent gaps).
/// Returns a Vec<Option<f64>> aligned to the input. `NaN` values in `src`
/// propagate as `None` and participate as `None` (skipped) in the seed SMA.
/// For the strict trendscope match (no NaN holes in daily bars), the input
/// should already have dense f64s.
pub fn smma(src: &[Option<f64>], length: usize) -> Vec<Option<f64>> {
    assert!(length >= 1, "length must be >= 1");
    let n = src.len();
    let mut out = vec![None; n];

    if n < length {
        return out;
    }

    // Seed: simple mean of the first `length` values. If any are None, we
    // back off the seed one bar at a time until we have a clean window.
    // Daily OHLCV from Yahoo is dense enough that this is typically a no-op.
    let seed_end = match find_seed_window(src, length) {
        Some(end) => end,
        None => return out, // never enough contiguous non-null data
    };

    let seed: f64 = src[seed_end + 1 - length..=seed_end]
        .iter()
        .map(|v| v.expect("seed window must be all Some by construction"))
        .sum::<f64>()
        / length as f64;
    out[seed_end] = Some(seed);

    let inv = 1.0 / length as f64;
    let factor = (length - 1) as f64 * inv;
    // Recursion state lives here, not in `out[i - 1]`: a gap bar emits None
    // but must not end the recursion — the next valid bar resumes from the
    // last valid SMMA. (Reading state back from `out` meant one partial Yahoo
    // row blanked the Ribbon / ATR / RSI for the rest of the history.)
    let mut prev = seed;
    for i in (seed_end + 1)..n {
        if let Some(v) = src[i] {
            prev = prev * factor + v * inv;
            out[i] = Some(prev);
        }
    }

    out
}

fn find_seed_window(src: &[Option<f64>], length: usize) -> Option<usize> {
    // Smallest index `end` such that src[end+1-length..=end] are all Some.
    if length == 0 || src.len() < length {
        return None;
    }
    // Sliding window count of contiguous Some values.
    let mut contiguous = 0usize;
    for (i, v) in src.iter().enumerate() {
        if v.is_some() {
            contiguous += 1;
            if contiguous >= length {
                return Some(i);
            }
        } else {
            contiguous = 0;
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::smma;

    fn approx(a: Option<f64>, b: f64) -> bool {
        a.is_some_and(|a| (a - b).abs() < 1e-9)
    }

    #[test]
    fn seeds_with_sma_then_recurses() {
        let src: Vec<Option<f64>> = [1.0, 2.0, 3.0, 4.0, 5.0].iter().map(|&v| Some(v)).collect();
        let out = smma(&src, 3);
        assert_eq!(out[0], None);
        assert_eq!(out[1], None);
        assert!(approx(out[2], 2.0));
        assert!(approx(out[3], 8.0 / 3.0)); // (2*2 + 4) / 3
        assert!(approx(out[4], 31.0 / 9.0)); // (8/3*2 + 5) / 3
    }

    #[test]
    fn gap_emits_none_and_recursion_resumes() {
        let src = vec![Some(1.0), Some(2.0), Some(3.0), None, Some(5.0), Some(6.0)];
        let out = smma(&src, 3);
        assert!(approx(out[2], 2.0));
        assert_eq!(out[3], None);
        assert!(approx(out[4], 3.0)); // (2*2 + 5) / 3
        assert!(approx(out[5], 4.0)); // (3*2 + 6) / 3
    }

    #[test]
    fn seed_backs_off_past_leading_gap() {
        let src = vec![Some(9.0), None, Some(1.0), Some(2.0), Some(3.0)];
        let out = smma(&src, 3);
        assert_eq!(&out[..4], &[None, None, None, None]);
        assert!(approx(out[4], 2.0));
    }
}
