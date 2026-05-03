use std::sync::Arc;

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use futures::future::join_all;
use serde::Serialize;
use tauri::State;
use tokio::sync::Semaphore;

use crate::sources::yahoo;
use crate::AppState;

/// Quote cache TTL. Adaptive (5min market-hours / 1h off-hours) is deferred
/// per `memory/m3_ticker_decisions.md`; 15 min flat is the M3 default.
const QUOTE_TTL_MINUTES: i64 = 15;

/// History freshness window. If the most recent bar in `price_history` is
/// within this many days, we don't re-fetch the chart on tile open. 4 days
/// covers weekends + one holiday.
const HISTORY_FRESH_DAYS: i64 = 4;

const HISTORY_RANGE: &str = "5y";

/// Max concurrent Yahoo fetches. Mirrors the FRED path. Yahoo's chart
/// endpoint is more stringent than FRED's — keep the cap modest.
const MAX_CONCURRENT_FETCHES: usize = 6;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerTileData {
    pub ticker: String,
    pub sector_group_id: String,
    pub data_source: String,
    pub display_name: Option<String>,
    pub display_currency: Option<String>,
    pub price: Option<f64>,
    pub change_pct_24h: Option<f64>,
    pub change_abs_24h: Option<f64>,
    pub volume_24h: Option<f64>,
    pub market_cap: Option<f64>,
    pub last_fetched: Option<String>,
    /// Percent changes over longer windows, computed from `price_history`
    /// in the DB. `None` means the bar at the lookback date is missing
    /// (typically: user hasn't primed history for this ticker yet).
    /// Use the Scanner's PRIME button or open the feature chart to
    /// populate. 1D sits on `change_pct_24h` (from quote_cache).
    #[serde(default)]
    pub change_pct_1w: Option<f64>,
    #[serde(default)]
    pub change_pct_1m: Option<f64>,
    #[serde(default)]
    pub change_pct_ytd: Option<f64>,
    #[serde(default)]
    pub change_pct_1y: Option<f64>,
    #[serde(default)]
    pub fetch_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerBar {
    pub date: String,
    #[serde(default)]
    pub open: Option<f64>,
    #[serde(default)]
    pub high: Option<f64>,
    #[serde(default)]
    pub low: Option<f64>,
    pub close: f64,
    #[serde(default)]
    pub volume: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerHistory {
    pub ticker: String,
    pub data_source: String,
    pub display_name: Option<String>,
    pub display_currency: Option<String>,
    pub bars: Vec<TickerBar>,
}

#[tauri::command]
pub async fn list_ticker_tiles(
    sector_group_id: String,
    force: bool,
    state: State<'_, AppState>,
) -> Result<Vec<TickerTileData>, String> {
    // Phase 1: snapshot which tickers exist and which are stale (under lock).
    let (tickers, stale_symbols) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let rows = db.list_tickers_in_sector(&sector_group_id)?;
        let mut stale: Vec<String> = Vec::new();
        for r in &rows {
            let quote = db.get_quote(&r.ticker, &r.data_source)?;
            let fresh = quote
                .as_ref()
                .and_then(|q| q.last_fetched.as_deref())
                .and_then(parse_rfc3339)
                .map(|t| Utc::now().signed_duration_since(t) < Duration::minutes(QUOTE_TTL_MINUTES))
                .unwrap_or(false);
            if force || !fresh {
                stale.push(r.ticker.clone());
            }
        }
        (rows, stale)
    };

    // Phase 2: per-symbol fetches against Yahoo's /v8/chart (the /v7/quote
    // batch endpoint returns 401 without crumb auth). Semaphore caps
    // concurrency; each future upserts its own result.
    let errors: std::collections::HashMap<String, String> = if stale_symbols.is_empty() {
        std::collections::HashMap::new()
    } else {
        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
        let state_handle = state.inner();

        let mut handles = Vec::with_capacity(stale_symbols.len());
        for symbol in stale_symbols.iter().cloned() {
            let permit_src = semaphore.clone();
            handles.push(async move {
                let _permit = permit_src.acquire_owned().await.ok();
                let res = fetch_and_upsert_quote(state_handle, &symbol).await;
                (symbol, res)
            });
        }
        join_all(handles)
            .await
            .into_iter()
            .filter_map(|(sym, res)| res.err().map(|e| (sym, e)))
            .collect()
    };

    // Phase 3: build tiles from DB state — always read fresh from quote_cache.
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = Utc::now().date_naive();
    let d_1w = (today - Duration::days(7)).format("%Y-%m-%d").to_string();
    let d_1m = (today - Duration::days(30)).format("%Y-%m-%d").to_string();
    let d_1y = (today - Duration::days(365)).format("%Y-%m-%d").to_string();
    // YTD lookback: the last trading day of the previous calendar year. We
    // target Dec 31 and `close_at_or_before` walks back to the nearest bar.
    let d_ytd = format!("{}-12-31", today.year() - 1);

    let mut tiles = Vec::with_capacity(tickers.len());
    for t in tickers {
        let quote = db.get_quote(&t.ticker, &t.data_source)?;
        // In-memory errors from the current refresh win when present (most
        // recent state); fall back to the persistent column so a previous
        // failure not retried this run still surfaces (S22).
        let fetch_error = errors
            .get(&t.ticker)
            .cloned()
            .or_else(|| quote.as_ref().and_then(|q| q.last_fetch_error.clone()));
        let current_price = quote.as_ref().and_then(|q| q.price);

        // Compute a pct change from a past close to the current live price.
        // Returns None if either side is missing. Done BEFORE the struct
        // literal so we don't borrow `t` after moving its fields.
        let pct_from = |target: &str| -> Option<f64> {
            let past = db.close_at_or_before(&t.ticker, &t.data_source, target).ok().flatten()?;
            let now = current_price?;
            if past == 0.0 {
                return None;
            }
            Some((now - past) / past * 100.0)
        };
        let chg_1w = pct_from(&d_1w);
        let chg_1m = pct_from(&d_1m);
        let chg_ytd = pct_from(&d_ytd);
        let chg_1y = pct_from(&d_1y);

        tiles.push(TickerTileData {
            ticker: t.ticker.clone(),
            sector_group_id: t.sector_group_id,
            data_source: t.data_source,
            display_name: t.display_name,
            display_currency: t.display_currency,
            price: current_price,
            change_pct_24h: quote.as_ref().and_then(|q| q.change_pct_24h),
            change_abs_24h: quote.as_ref().and_then(|q| q.change_abs_24h),
            volume_24h: quote.as_ref().and_then(|q| q.volume_24h),
            market_cap: quote.as_ref().and_then(|q| q.market_cap),
            last_fetched: quote.and_then(|q| q.last_fetched),
            change_pct_1w: chg_1w,
            change_pct_1m: chg_1m,
            change_pct_ytd: chg_ytd,
            change_pct_1y: chg_1y,
            fetch_error,
        });
    }
    Ok(tiles)
}

async fn fetch_and_upsert_quote(state: &AppState, symbol: &str) -> Result<(), String> {
    // Yahoo fetch outside the lock; on failure persist the error so bad
    // symbols stay self-diagnosing across sessions (S22). Success path's
    // upsert_quote clears the error column unconditionally.
    let q = match yahoo::fetch_quote(symbol).await {
        Ok(q) => q,
        Err(e) => {
            let msg = e.to_string();
            if let Ok(db) = state.db.lock() {
                let _ = db.set_quote_fetch_error(symbol, "yahoo", Some(&msg));
            }
            return Err(msg);
        }
    };
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_quote(
        &q.symbol,
        "yahoo",
        q.regular_market_price,
        q.currency.as_deref(),
        q.regular_market_change_percent,
        q.regular_market_change,
        q.market_cap,
        q.regular_market_volume,
    )?;
    Ok(())
}

#[tauri::command]
pub async fn get_ticker_history(
    ticker: String,
    data_source: String,
    state: State<'_, AppState>,
) -> Result<TickerHistory, String> {
    // Freshness check on existing bars: if latest bar is within HISTORY_FRESH_DAYS
    // of today, skip the Yahoo chart fetch.
    let needs_fetch = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        match db.latest_bar_date(&ticker, &data_source)? {
            None => true,
            Some(latest) => {
                let today = Utc::now().date_naive();
                match NaiveDate::parse_from_str(&latest, "%Y-%m-%d") {
                    Ok(d) => (today - d).num_days() > HISTORY_FRESH_DAYS,
                    Err(_) => true,
                }
            }
        }
    };

    if needs_fetch {
        let bars = yahoo::fetch_chart(&ticker, HISTORY_RANGE)
            .await
            .map_err(|e| e.to_string())?;
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.upsert_price_bars(&ticker, &data_source, &bars)?;
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Pick up the display-side metadata from watchlist_tickers. We don't have a
    // direct ticker-lookup helper since watchlist rows are sector-scoped; iterate
    // sector groups and find the row. Cheap (a handful of sectors).
    let mut display_name = None;
    let mut display_currency = None;
    for sg in db.list_sector_groups()? {
        if let Ok(rows) = db.list_tickers_in_sector(&sg.id) {
            if let Some(row) = rows.into_iter().find(|r| r.ticker == ticker) {
                display_name = row.display_name;
                display_currency = row.display_currency;
                break;
            }
        }
    }
    let bars: Vec<TickerBar> = db
        .all_price_bars_ohlcv(&ticker, &data_source)?
        .into_iter()
        .filter_map(|b| {
            b.close.map(|close| TickerBar {
                date: b.date,
                open: b.open,
                high: b.high,
                low: b.low,
                close,
                volume: b.volume,
            })
        })
        .collect();

    Ok(TickerHistory {
        ticker,
        data_source,
        display_name,
        display_currency,
        bars,
    })
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Bloomberg-style market-hours strip needs each tracked exchange's main
/// index quote (since-last-session change) so the chip can outline
/// green/red/gray. Mapping is hardcoded — these are exchange-level
/// indicators, not user-watchlist data, and the choice of "the index that
/// represents this exchange" is editorial. Read-only against `quote_cache`;
/// no fetching here. Quotes get refreshed when the user opens the INDICES
/// dashboard (existing flow).
const EXCHANGE_INDEX_MAPPING: &[(&str, &str)] = &[
    ("NYSE", "^GSPC"),
    ("TSX", "^GSPTSE"),
    ("LSE", "^FTSE"),
    ("TYO", "^N225"),
    ("HKG", "^HSI"),
    ("SSE", "^SSEC"),
    ("ASX", "^AXJO"),
    ("KRX", "^KS11"),
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketIndexQuote {
    pub exchange_code: String,
    pub ticker: String,
    pub change_pct_24h: Option<f64>,
    pub last_fetched: Option<String>,
}

#[tauri::command]
pub fn list_market_index_quotes(
    state: State<'_, AppState>,
) -> Result<Vec<MarketIndexQuote>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(EXCHANGE_INDEX_MAPPING.len());
    for (code, ticker) in EXCHANGE_INDEX_MAPPING {
        let quote = db.get_quote(ticker, "yahoo")?;
        out.push(MarketIndexQuote {
            exchange_code: code.to_string(),
            ticker: ticker.to_string(),
            change_pct_24h: quote.as_ref().and_then(|q| q.change_pct_24h),
            last_fetched: quote.as_ref().and_then(|q| q.last_fetched.clone()),
        });
    }
    Ok(out)
}
