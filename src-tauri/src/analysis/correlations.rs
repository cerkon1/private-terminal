//! Pearson correlation matrix on log returns over a calendar-day window.
//!
//! Per the design doc smoke-test: SPY×SPY=1.0 (diagonal sanity), BTC×ETH ≈
//! 0.7-0.9 over 90d, GLD×SPY mildly negative.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::analysis::align::{align_close_prices, log_returns, pearson};
use crate::analysis::{ExcludedTicker, TickerKey};
use crate::db::Db;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationsRequest {
    pub tickers: Vec<TickerKey>,
    pub lookback_days: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationsResponse {
    /// Tickers that participated, in the same order as `matrix` rows/cols.
    pub tickers: Vec<TickerKey>,
    /// Square matrix; `matrix[i][j]` is corr(tickers[i], tickers[j]).
    pub matrix: Vec<Vec<f64>>,
    pub lookback_days_requested: u32,
    pub bar_count: u32,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub excluded: Vec<ExcludedTicker>,
}

pub fn compute_correlations(
    db: &Db,
    request: CorrelationsRequest,
) -> Result<CorrelationsResponse, String> {
    let lookback = request.lookback_days.max(1);
    let min_bars = (lookback / 2).max(2);

    let mut inputs: Vec<(TickerKey, Vec<(String, f64)>)> = Vec::with_capacity(request.tickers.len());
    for key in &request.tickers {
        let hist = db.close_history(&key.ticker, &key.data_source)?;
        inputs.push((key.clone(), hist));
    }

    let aligned = align_close_prices(inputs, lookback, min_bars);

    let bar_count = aligned.dates.len() as u32;
    let start_date = aligned.dates.first().copied();
    let end_date = aligned.dates.last().copied();

    // log returns per series. Empty closes → empty returns; pearson handles
    // that gracefully and returns 0.0.
    let returns: Vec<(TickerKey, Vec<f64>)> = aligned
        .series
        .iter()
        .map(|(key, closes)| (key.clone(), log_returns(closes)))
        .collect();

    let n = returns.len();
    let mut matrix = vec![vec![0.0_f64; n]; n];
    for i in 0..n {
        for j in i..n {
            let r = if i == j {
                // Tiny floating drift between own-correlation and 1.0 is
                // possible with limited precision. Pin the diagonal to 1.0
                // to match the smoke-test expectation.
                if returns[i].1.is_empty() { 0.0 } else { 1.0 }
            } else {
                pearson(&returns[i].1, &returns[j].1)
            };
            matrix[i][j] = r;
            matrix[j][i] = r;
        }
    }

    let tickers: Vec<TickerKey> = returns.into_iter().map(|(k, _)| k).collect();

    Ok(CorrelationsResponse {
        tickers,
        matrix,
        lookback_days_requested: lookback,
        bar_count,
        start_date,
        end_date,
        excluded: aligned.excluded,
    })
}
