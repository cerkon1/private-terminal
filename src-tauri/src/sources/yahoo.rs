use serde::Deserialize;

const CHART_ROOT: &str = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo's unofficial API rejects default reqwest UAs with 429. A browser-like
// UA string is the typical workaround for personal-use scripts.
//
// Note on endpoint choice: as of late 2025 Yahoo's /v7/finance/quote batch
// endpoint returns HTTP 401 "Unauthorized" without their cookie+crumb auth
// flow. /v8/finance/chart remains open, so we use that for both live quotes
// (range=1d&interval=1d → read meta.regularMarketPrice/previousClose) and
// historical bars (range=5y). One HTTP call per symbol; batched concurrency
// is handled in ticker_cmds via semaphore.
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/124.0.0.0 Safari/537.36";

#[derive(Debug, thiserror::Error)]
pub enum YahooError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Yahoo API error: {0}")]
    Api(String),
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

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .expect("reqwest client")
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
pub async fn fetch_snapshot(symbol: &str) -> Result<YahooSnapshot, YahooError> {
    let result = get_chart(symbol, "5d").await?;
    let timestamps = result.timestamp.unwrap_or_default();
    let chart_quote = result
        .indicators
        .quote
        .and_then(|mut q| q.pop())
        .unwrap_or_default();
    Ok(YahooSnapshot {
        bars: bars_from_chart(timestamps, chart_quote),
        quote: quote_from_meta(symbol, result.meta),
    })
}

fn quote_from_meta(symbol: &str, meta: ChartMeta) -> YahooQuote {
    let price = meta.regular_market_price;
    let prev_close = meta.previous_close.or(meta.chart_previous_close);
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
    previous_close: Option<f64>,
    #[serde(default)]
    chart_previous_close: Option<f64>,
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
    let len = timestamps.len();
    let mut bars = Vec::with_capacity(len);
    for i in 0..len {
        let ts = timestamps[i];
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
