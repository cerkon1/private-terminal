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
    for i in (seed_end + 1)..n {
        let prev = match out[i - 1] {
            Some(v) => v,
            None => {
                // Bar i-1 was invalid; can't continue recursion. Leave None.
                continue;
            }
        };
        match src[i] {
            Some(v) => out[i] = Some(prev * factor + v * inv),
            None => {} // gap; leave None and the next valid bar resumes
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
