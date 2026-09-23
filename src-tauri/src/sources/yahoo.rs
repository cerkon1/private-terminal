use serde::Deserialize;

const CHART_ROOT: &str = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo's unofficial API rejects default reqwest UAs with 429. A browser-like
// UA string is the typical workaround for personal-use scripts.
//
// Note on endpoint choice: as of late 2025 Yahoo's /v7/finance/quote batch
// endpoint returns HTTP 401 "Unauthorized" without their cookie+crumb auth
// flow. /v8/finance/chart remains open, so we use that for both live quotes
// (range=5d → meta.regularMarketPrice + daily bars) and historical bars
// (range=5y). One HTTP call per symbol; batched concurrency
// is handled in ticker_cmds via semaphore.
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/124.0.0.0 Safari/537.36";

#[derive(Debug, thiserror::Error)]
pub enum YahooError {
    #[error("HTTP error: {0}")]
    Http(reqwest::Error),
    #[error("Yahoo API error: {0}")]
    Api(String),
}

impl From<reqwest::Error> for YahooError {
    fn from(e: reqwest::Error) -> Self {
        // No secrets in Yahoo URLs, but keep every source's errors uniform.
        YahooError::Http(super::redact(e))
    }
}

#[derive(Debug, Clone)]
pub struct YahooQuote {
    pub symbol: String,
    pub regular_market_price: Option<f64>,
    pub regular_market_change: Option<f64>,
    pub regular_market_change_percent: Option<f64>,
    pub regular_market_volume: Option<f64>,
    pub market_cap: Option<f64>,
    pub currency: Option<String>,
}

/// Combined fetch result: latest quote meta + recent daily bars from a single
/// `/v8/chart` call. REFRESH on the dashboards uses this so quote_cache and
/// the recent tail of price_history stay in sync without making two HTTP
/// round trips per ticker.
pub struct YahooSnapshot {
    pub quote: YahooQuote,
    pub bars: Vec<Bar>,
}

fn client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| super::build_client(USER_AGENT))
}

async fn get_chart(symbol: &str, range: &str) -> Result<ChartResult, YahooError> {
    let url = format!("{}/{}", CHART_ROOT, symbol);
    let resp = client()
        .get(&url)
        .query(&[("range", range), ("interval", "1d")])
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(YahooError::Api(format!("HTTP {}: {}", status, body)));
    }

    let parsed: ChartResponse = resp.json().await?;
    if let Some(err) = parsed.chart.error {
        if !err.is_null() {
            return Err(YahooError::Api(format!("Yahoo chart error: {}", err)));
        }
    }
    parsed
        .chart
        .result
        .and_then(|mut r| r.pop())
        .ok_or_else(|| YahooError::Api(format!("No chart data for {}", symbol)))
}

/// Combined fetch: latest quote + recent daily bars from a single
/// `/v8/chart` call (range=5d). Used by the dashboard REFRESH path so a
/// click writes both the live price (quote_cache) and the most recent
/// trading-day closes (price_history). 5d covers a normal weekend gap;
/// after a Monday close the response carries last week's bars including
/// the most recent settled close.
///
/// The 1D change is computed against the previous daily bar, NOT
/// `meta.chartPreviousClose`: for any range wider than 1d, Yahoo omits
/// `previousClose` and `chartPreviousClose` is the close *before the window*
/// (~5 trading days back). Using it made every tile's "1D %" a weekly move
/// from v1.0.1 (S27) until v1.0.3.
pub async fn fetch_snapshot(symbol: &str) -> Result<YahooSnapshot, YahooError> {
    let result = get_chart(symbol, "5d").await?;
    let timestamps = result.timestamp.unwrap_or_default();
    let chart_quote = result
        .indicators
        .quote
        .and_then(|mut q| q.pop())
        .unwrap_or_default();
    let prev_close = previous_session_close(
        &timestamps,
        &chart_quote.close,
        result.meta.regular_market_time,
    )
    .or(result.meta.previous_close);
    Ok(YahooSnapshot {
        bars: bars_from_chart(timestamps, chart_quote),
        quote: quote_from_meta(symbol, result.meta, prev_close),
    })
}

/// Close of the last session before the one `regular_market_time` belongs to.
///
/// The current session is the last bar whose timestamp is at or before
/// `regular_market_time` (Yahoo stamps a daily bar at its session open; the
/// in-progress bar's close is often still null). The previous close is the
/// last non-null close before that bar — skipping Yahoo's occasional
/// null-padded rows rather than treating them as a zero or a gap.
fn previous_session_close(
    timestamps: &[i64],
    closes: &[Option<f64>],
    regular_market_time: Option<i64>,
) -> Option<f64> {
    let n = timestamps.len().min(closes.len());
    let current = match regular_market_time {
        Some(rmt) => timestamps[..n].iter().rposition(|&ts| ts <= rmt)?,
        None => n.checked_sub(1)?,
    };
    closes[..current].iter().rev().find_map(|c| *c)
}

fn quote_from_meta(symbol: &str, meta: ChartMeta, prev_close: Option<f64>) -> YahooQuote {
    let price = meta.regular_market_price;
    let (change_abs, change_pct) = match (price, prev_close) {
        (Some(p), Some(pc)) if pc != 0.0 => {
            let diff = p - pc;
            (Some(diff), Some((diff / pc) * 100.0))
        }
        _ => (None, None),
    };
    YahooQuote {
        symbol: meta.symbol.unwrap_or_else(|| symbol.to_string()),
        regular_market_price: price,
        regular_market_change: change_abs,
        regular_market_change_percent: change_pct,
        regular_market_volume: meta.regular_market_volume,
        market_cap: None, // chart endpoint doesn't expose market cap
        currency: meta.currency,
    }
}

#[derive(Debug)]
pub struct Bar {
    pub date: String,
    pub open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub close: Option<f64>,
    pub volume: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ChartResponse {
    chart: ChartInner,
}

#[derive(Debug, Deserialize)]
struct ChartInner {
    result: Option<Vec<ChartResult>>,
    #[serde(default)]
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ChartResult {
    meta: ChartMeta,
    timestamp: Option<Vec<i64>>,
    indicators: ChartIndicators,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ChartMeta {
    #[serde(default)]
    symbol: Option<String>,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    regular_market_price: Option<f64>,
    #[serde(default)]
    regular_market_volume: Option<f64>,
    #[serde(default)]
    regular_market_time: Option<i64>,
    /// Only present on range=1d responses. Deliberately no `chartPreviousClose`
    /// field — see `fetch_snapshot` for why it must not be used.
    #[serde(default)]
    previous_close: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ChartIndicators {
    quote: Option<Vec<ChartQuote>>,
}

#[derive(Debug, Deserialize, Default)]
struct ChartQuote {
    #[serde(default)]
    open: Vec<Option<f64>>,
    #[serde(default)]
    high: Vec<Option<f64>>,
    #[serde(default)]
    low: Vec<Option<f64>>,
    #[serde(default)]
    close: Vec<Option<f64>>,
    #[serde(default)]
    volume: Vec<Option<f64>>,
}

/// Daily OHLCV bars for `symbol`. `range` examples: "1y", "2y", "5y", "max".
pub async fn fetch_chart(symbol: &str, range: &str) -> Result<Vec<Bar>, YahooError> {
    let result = get_chart(symbol, range).await?;
    let timestamps = result.timestamp.unwrap_or_default();
    let quote = result
        .indicators
        .quote
        .and_then(|mut q| q.pop())
        .unwrap_or_default();
    Ok(bars_from_chart(timestamps, quote))
}

fn bars_from_chart(timestamps: Vec<i64>, quote: ChartQuote) -> Vec<Bar> {
    let mut bars = Vec::with_capacity(timestamps.len());
    for (i, &ts) in timestamps.iter().enumerate() {
        let date = chrono::DateTime::<chrono::Utc>::from_timestamp(ts, 0)
            .map(|dt| dt.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        bars.push(Bar {
            date,
            open: quote.open.get(i).copied().flatten(),
            high: quote.high.get(i).copied().flatten(),
            low: quote.low.get(i).copied().flatten(),
            close: quote.close.get(i).copied().flatten(),
            volume: quote.volume.get(i).copied().flatten(),
        });
    }
    // Drop rows where close is missing (Yahoo pads around holidays with nulls).
    bars.retain(|b| b.close.is_some());
    bars
}

#[cfg(test)]
mod tests {
    use super::previous_session_close;

    // Timestamps from live /v8/chart range=5d responses (2026-09-23).

    #[test]
    fn prev_close_skips_in_progress_null_bar() {
        // SPY: today's bar present with null close; price belongs to today.
        let ts = [1789911000, 1789997400, 1790083800];
        let closes = [Some(760.0), Some(773.5), None];
        assert_eq!(previous_session_close(&ts, &closes, Some(1790107200)), Some(773.5));
    }

    #[test]
    fn prev_close_skips_null_padded_row() {
        // ^AXJO: Yahoo returned a null row for the prior day.
        let ts = [1789948800, 1790035200, 1790121600];
        let closes = [Some(8731.9), None, Some(8765.3)];
        assert_eq!(previous_session_close(&ts, &closes, Some(1790147355)), Some(8731.9));
    }

    #[test]
    fn prev_close_uses_bar_before_current_session_not_window_start() {
        // Five settled bars; price is the last one. Must NOT return closes[0]
        // (what chartPreviousClose would give).
        let ts = [100, 200, 300, 400, 500];
        let closes = [Some(1.0), Some(2.0), Some(3.0), Some(4.0), Some(5.0)];
        assert_eq!(previous_session_close(&ts, &closes, Some(550)), Some(4.0));
    }

    #[test]
    fn prev_close_without_market_time_uses_last_bar_as_current() {
        let ts = [100, 200, 300];
        let closes = [Some(1.0), Some(2.0), Some(3.0)];
        assert_eq!(previous_session_close(&ts, &closes, None), Some(2.0));
    }

    #[test]
    fn prev_close_none_when_no_prior_session() {
        assert_eq!(previous_session_close(&[100], &[Some(1.0)], Some(150)), None);
        assert_eq!(previous_session_close(&[], &[], Some(150)), None);
        // Market time before every bar — no current session identifiable.
        assert_eq!(previous_session_close(&[100, 200], &[Some(1.0), Some(2.0)], Some(50)), None);
    }
}
