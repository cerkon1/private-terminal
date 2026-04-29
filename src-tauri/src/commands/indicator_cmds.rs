use std::sync::Arc;

use futures::future::join_all;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Semaphore;

use crate::indicators;
use crate::sources::yahoo;
use crate::AppState;

const HISTORY_RANGE: &str = "5y";
const MAX_CONCURRENT_FETCHES: usize = 6;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorRegistration {
    pub id: String,
    pub display_name: String,
    pub pane: indicators::PaneKind,
    pub default_params: serde_json::Value,
}

#[tauri::command]
pub fn list_indicators() -> Vec<IndicatorRegistration> {
    indicators::all_indicators()
        .iter()
        .map(|ind| IndicatorRegistration {
            id: ind.id().to_string(),
            display_name: ind.display_name().to_string(),
            pane: ind.pane_hint(),
            default_params: ind.default_params(),
        })
        .collect()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorSettingOut {
    pub ticker: String,
    pub indicator_id: String,
    pub enabled: bool,
    #[serde(default)]
    pub params_json: Option<String>,
}

#[tauri::command]
pub fn get_indicator_settings(
    ticker: String,
    state: State<'_, AppState>,
) -> Result<Vec<IndicatorSettingOut>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db
        .get_indicator_settings(&ticker)?
        .into_iter()
        .map(|r| IndicatorSettingOut {
            ticker: r.ticker,
            indicator_id: r.indicator_id,
            enabled: r.enabled,
            params_json: r.params_json,
        })
        .collect())
}

#[tauri::command]
pub fn set_indicator_setting(
    ticker: String,
    indicator_id: String,
    enabled: bool,
    params_json: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_indicator_setting(&ticker, &indicator_id, enabled, params_json.as_deref())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeRequest {
    pub ticker: String,
    pub data_source: String,
    pub indicator_ids: Vec<String>,
}

#[tauri::command]
pub fn compute_indicators(
    request: ComputeRequest,
    state: State<'_, AppState>,
) -> Result<Vec<indicators::IndicatorOutput>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let bars = db.all_price_bars_ohlcv(&request.ticker, &request.data_source)?;
    let settings = db.get_indicator_settings(&request.ticker)?;
    drop(db); // release lock before compute (no further DB I/O)

    let mut outputs = Vec::with_capacity(request.indicator_ids.len());
    for id in &request.indicator_ids {
        let Some(ind) = indicators::find_indicator(id) else { continue };
        // Use stored params when present, else fall back to the indicator's defaults.
        let params = settings
            .iter()
            .find(|s| &s.indicator_id == id)
            .and_then(|s| s.params_json.as_ref())
            .and_then(|j| serde_json::from_str::<serde_json::Value>(j).ok())
            .unwrap_or_else(|| ind.default_params());
        let out = ind.compute(&bars, &params)?;
        outputs.push(out);
    }
    Ok(outputs)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannerRow {
    pub ticker: String,
    pub sector_group_id: String,
    pub display_name: Option<String>,
    pub display_currency: Option<String>,
    /// Latest close price — for sort/context.
    pub price: Option<f64>,
    /// Committed SMMA Ribbon state on the most recent bar: "bullish" / "bearish" / "neutral".
    pub state: Option<String>,
    /// Bars since the most recent state flip (0 = flipped this bar).
    pub bars_since_flip: Option<i64>,
    /// Latest RSI(14).
    pub rsi: Option<f64>,
    /// Latest ATR(14) as percent of price.
    pub atr_pct: Option<f64>,
    #[serde(default)]
    pub compute_error: Option<String>,
}

/// Scanner snapshot — current SMMA Ribbon state + RSI + ATR for every enabled ticker
/// across every enabled sector. Reads `price_history` only; does NOT fetch new
/// bars. Users should click through to a ticker's feature chart to trigger a
/// history fetch if the scanner shows empty rows.
#[tauri::command]
pub fn scanner_snapshot(state: State<'_, AppState>) -> Result<Vec<ScannerRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Collect all enabled tickers across all enabled leaf sector_groups.
    // Skip parents (which never own tickers directly).
    let mut targets: Vec<(String, String, String, Option<String>, Option<String>)> = Vec::new();
    let sectors = db.list_sector_groups()?;
    for sg in sectors.iter().filter(|s| s.enabled) {
        let children = sectors
            .iter()
            .any(|s| s.parent_id.as_deref() == Some(sg.id.as_str()));
        if children {
            continue; // parent — skip
        }
        for t in db.list_tickers_in_sector(&sg.id)? {
            targets.push((
                t.ticker,
                t.sector_group_id,
                t.data_source,
                t.display_name,
                t.display_currency,
            ));
        }
    }

    let smma_ribbon = indicators::find_indicator("smma_ribbon");
    let rsi = indicators::find_indicator("rsi_14");
    let atr = indicators::find_indicator("atr_14");

    let mut rows = Vec::with_capacity(targets.len());
    for (ticker, sector_group_id, data_source, display_name, display_currency) in targets {
        let bars = db.all_price_bars_ohlcv(&ticker, &data_source)?;
        if bars.is_empty() {
            rows.push(ScannerRow {
                ticker,
                sector_group_id,
                display_name,
                display_currency,
                price: None,
                state: None,
                bars_since_flip: None,
                rsi: None,
                atr_pct: None,
                compute_error: Some("no bars — open feature chart to fetch history".into()),
            });
            continue;
        }

        let price = bars.last().and_then(|b| b.close);

        let (state, bars_since_flip) = match smma_ribbon
            .and_then(|ind| ind.compute(&bars, &ind.default_params()).ok())
        {
            Some(out) => {
                let state_name = out.regions.last().map(|r| r.label.clone());
                let bsf = out.regions.last().and_then(|r| {
                    // Find the index of the bar where this region started.
                    bars.iter().position(|b| b.date == r.start_date).map(|i| {
                        (bars.len() - 1 - i) as i64
                    })
                });
                (state_name, bsf)
            }
            None => (None, None),
        };

        let rsi_val = rsi
            .and_then(|ind| ind.compute(&bars, &ind.default_params()).ok())
            .and_then(|out| {
                out.series.into_iter().next().and_then(|s| {
                    s.data.into_iter().rev().find_map(|p| p.value)
                })
            });

        let atr_pct = atr
            .and_then(|ind| ind.compute(&bars, &ind.default_params()).ok())
            .and_then(|out| {
                out.series.into_iter().next().and_then(|s| {
                    s.data.into_iter().rev().find_map(|p| p.value)
                })
            })
            .and_then(|atr_abs| price.map(|p| if p != 0.0 { atr_abs / p * 100.0 } else { 0.0 }));

        rows.push(ScannerRow {
            ticker,
            sector_group_id,
            display_name,
            display_currency,
            price,
            state,
            bars_since_flip,
            rsi: rsi_val,
            atr_pct,
            compute_error: None,
        });
    }
    Ok(rows)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeFailure {
    pub ticker: String,
    pub error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimeResult {
    pub primed: usize,
    pub failures: Vec<PrimeFailure>,
}

/// Fetch + upsert history for every enabled watchlist ticker that currently
/// has zero bars in `price_history`. Complement to the on-demand fetch path
/// in `get_ticker_history` — this one batch-primes so the scanner sees a
/// full snapshot without the user opening each feature chart by hand.
/// Yahoo-only (Finnhub-eligible filter isn't relevant here; every watchlist
/// row with `data_source='yahoo'` is in scope).
#[tauri::command]
pub async fn prime_scanner_histories(
    state: State<'_, AppState>,
) -> Result<PrimeResult, String> {
    // Step 1: under lock, build the target list of tickers with no bars yet.
    // Drop the MutexGuard before any await (it's std::sync::Mutex — not Send).
    let targets: Vec<(String, String)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let sectors = db.list_sector_groups()?;
        let mut out = Vec::new();
        for sg in sectors.iter().filter(|s| s.enabled) {
            let has_children = sectors
                .iter()
                .any(|s| s.parent_id.as_deref() == Some(sg.id.as_str()));
            if has_children {
                continue;
            }
            for t in db.list_tickers_in_sector(&sg.id)? {
                if t.data_source != "yahoo" {
                    continue;
                }
                if db.latest_bar_date(&t.ticker, &t.data_source)?.is_none() {
                    out.push((t.ticker, t.data_source));
                }
            }
        }
        out
    };

    if targets.is_empty() {
        return Ok(PrimeResult {
            primed: 0,
            failures: vec![],
        });
    }

    // Step 2: parallel fetch. Semaphore-capped; no DB lock held across awaits.
    let sem = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
    let fetches = targets.into_iter().map(|(ticker, data_source)| {
        let sem = sem.clone();
        async move {
            let _permit = sem.acquire_owned().await.ok();
            let result = yahoo::fetch_chart(&ticker, HISTORY_RANGE).await;
            (ticker, data_source, result)
        }
    });
    let results = join_all(fetches).await;

    // Step 3: re-lock DB, upsert successes, collect failures.
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut primed = 0;
    let mut failures = Vec::new();
    for (ticker, data_source, result) in results {
        match result {
            Ok(bars) if !bars.is_empty() => {
                if let Err(e) = db.upsert_price_bars(&ticker, &data_source, &bars) {
                    failures.push(PrimeFailure { ticker, error: e });
                } else {
                    primed += 1;
                }
            }
            Ok(_) => failures.push(PrimeFailure {
                ticker,
                error: "Yahoo returned empty bar set".into(),
            }),
            Err(e) => failures.push(PrimeFailure {
                ticker,
                error: e.to_string(),
            }),
        }
    }
    Ok(PrimeResult { primed, failures })
}
