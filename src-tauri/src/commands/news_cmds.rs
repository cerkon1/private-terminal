//! News commands (M7). Two IPC entry points:
//! - `list_news`   — read items from DB (filter + limit), cache-first
//! - `refresh_news` — walk enabled feeds, dispatch per source_type, upsert
//!
//! Each feed has its own `refresh_minutes`; `force=true` bypasses.
//! Concurrency capped at 6 — matches the macro/ticker pattern. Per-feed
//! errors degrade to a message list; one bad feed doesn't kill the refresh.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::Duration;
use futures::future::join_all;
use serde::Serialize;
use tauri::State;
use tokio::sync::Semaphore;

use crate::config;
use crate::db::NewsFeedRow;
use crate::sources::news;
use crate::AppState;

const MAX_CONCURRENT_FETCHES: usize = 6;
const DEFAULT_LIMIT: i64 = 200;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsItemDto {
    pub source: String,
    pub external_id: String,
    pub feed_id: Option<String>,
    pub feed_name: Option<String>,
    pub ticker: Option<String>,
    pub category: Option<String>,
    pub headline: String,
    pub url: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<String>,
    pub fetched_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsFeedDto {
    pub id: String,
    pub source_type: String,
    pub url: Option<String>,
    pub display_name: String,
    pub category: Option<String>,
    pub refresh_minutes: i64,
    pub last_fetched: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedError {
    pub feed_id: String,
    pub feed_name: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResult {
    pub feeds_attempted: usize,
    pub items_inserted: usize,
    pub errors: Vec<FeedError>,
}

#[tauri::command]
pub async fn list_news(
    category: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<NewsItemDto>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let feed_names: HashMap<String, String> = db
        .list_news_feeds(false)?
        .into_iter()
        .map(|f| (f.id, f.display_name))
        .collect();
    let rows = db.list_news_items(category.as_deref(), limit.unwrap_or(DEFAULT_LIMIT))?;
    let dtos = rows
        .into_iter()
        .map(|r| {
            let feed_name = r.feed_id.as_ref().and_then(|id| feed_names.get(id).cloned());
            NewsItemDto {
                source: r.source,
                external_id: r.external_id,
                feed_id: r.feed_id,
                feed_name,
                ticker: r.ticker,
                category: r.category,
                headline: r.headline,
                url: r.url,
                summary: r.summary,
                published_at: r.published_at,
                fetched_at: r.fetched_at,
            }
        })
        .collect();
    Ok(dtos)
}

#[tauri::command]
pub async fn list_news_feeds(
    state: State<'_, AppState>,
) -> Result<Vec<NewsFeedDto>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rows = db.list_news_feeds(false)?;
    let dtos = rows
        .into_iter()
        .map(|r| NewsFeedDto {
            id: r.id,
            source_type: r.source_type,
            url: r.url,
            display_name: r.display_name,
            category: r.category,
            refresh_minutes: r.refresh_minutes,
            last_fetched: r.last_fetched,
            enabled: r.enabled,
        })
        .collect();
    Ok(dtos)
}

#[tauri::command]
pub async fn refresh_news(
    force: bool,
    state: State<'_, AppState>,
) -> Result<RefreshResult, String> {
    // Phase 1: snapshot enabled feeds + filter by freshness. Guard drops
    // before awaits (MutexGuard is !Send).
    let (stale_feeds, eligible_tickers, finnhub_key_raw): (
        Vec<NewsFeedRow>,
        Vec<String>,
        Option<String>,
    ) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let feeds = db
            .list_news_feeds(true)?
            .into_iter()
            .filter(|f| force || !is_fresh(f))
            .collect();
        let tickers = db.list_finnhub_eligible_tickers()?;
        let key = config::finnhub_api_key(&db);
        (feeds, tickers, key)
    };

    let finnhub_key = Arc::new(finnhub_key_raw);
    // Per-ticker news only runs when a key is present; otherwise the list is
    // empty and the ticker branch is a no-op. Also skip on non-force refreshes
    // if no feeds are stale — avoids hammering Finnhub when nothing else
    // needs attention.
    let run_ticker_news =
        finnhub_key.is_some() && (force || !stale_feeds.is_empty());

    if stale_feeds.is_empty() && !run_ticker_news {
        return Ok(RefreshResult {
            feeds_attempted: 0,
            items_inserted: 0,
            errors: vec![],
        });
    }

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES));
    let state_handle = state.inner();

    // Feed fetches
    let mut feed_handles = Vec::with_capacity(stale_feeds.len());
    for feed in stale_feeds {
        let sem = semaphore.clone();
        let key = finnhub_key.clone();
        feed_handles.push(async move {
            let _permit = sem.acquire_owned().await.ok();
            let display_name = feed.display_name.clone();
            let id = feed.id.clone();
            let res = fetch_one(&feed, key.as_deref(), state_handle).await;
            (id, display_name, res)
        });
    }

    let feed_results = join_all(feed_handles).await;
    let mut feeds_attempted = 0usize;
    let mut items_inserted = 0usize;
    let mut errors: Vec<FeedError> = Vec::new();
    for (id, name, res) in feed_results {
        feeds_attempted += 1;
        match res {
            Ok(n) => items_inserted += n,
            Err(e) => errors.push(FeedError {
                feed_id: id,
                feed_name: name,
                message: e,
            }),
        }
    }

    // Per-ticker Finnhub news. Same semaphore pool — budget-safe under the
    // 60/min free-tier rate limit given our ~12-ticker US watchlist.
    if run_ticker_news {
        let key = finnhub_key.as_deref().map(String::from).unwrap_or_default();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let week_ago = (chrono::Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string();

        let mut ticker_handles = Vec::with_capacity(eligible_tickers.len());
        for ticker in eligible_tickers {
            let sem = semaphore.clone();
            let key = key.clone();
            let today = today.clone();
            let week_ago = week_ago.clone();
            ticker_handles.push(async move {
                let _permit = sem.acquire_owned().await.ok();
                let res = crate::sources::news::finnhub::fetch_company_news(
                    &key, &ticker, &week_ago, &today,
                )
                .await;
                (ticker, res)
            });
        }
        let ticker_results = join_all(ticker_handles).await;
        for (ticker, res) in ticker_results {
            feeds_attempted += 1;
            match res {
                Ok(items) => {
                    let db = state.db.lock().map_err(|e| e.to_string())?;
                    match db.upsert_news_items(
                        "finnhub_ticker",
                        None,
                        Some(&ticker),
                        Some("ticker"),
                        &items,
                    ) {
                        Ok(n) => items_inserted += n,
                        Err(e) => errors.push(FeedError {
                            feed_id: format!("finnhub_ticker:{}", ticker),
                            feed_name: format!("Finnhub ticker: {}", ticker),
                            message: e,
                        }),
                    }
                }
                Err(e) => errors.push(FeedError {
                    feed_id: format!("finnhub_ticker:{}", ticker),
                    feed_name: format!("Finnhub ticker: {}", ticker),
                    message: e.to_string(),
                }),
            }
        }
    }

    Ok(RefreshResult {
        feeds_attempted,
        items_inserted,
        errors,
    })
}

async fn fetch_one(
    feed: &NewsFeedRow,
    finnhub_key: Option<&str>,
    state: &AppState,
) -> Result<usize, String> {
    let items = match feed.source_type.as_str() {
        "rss" => {
            let url = feed
                .url
                .as_deref()
                .ok_or_else(|| "RSS feed missing url".to_string())?;
            news::rss::fetch(url).await.map_err(|e| e.to_string())?
        }
        "finnhub" => {
            let key = finnhub_key.ok_or_else(|| {
                "Finnhub feed skipped: FINNHUB_API_KEY not set".to_string()
            })?;
            let category = feed.url.as_deref().unwrap_or("general");
            news::finnhub::fetch_category(key, category)
                .await
                .map_err(|e| e.to_string())?
        }
        other => return Err(format!("unknown source_type: {}", other)),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let n = db.upsert_news_items(
        &feed.id,
        Some(&feed.id),
        None,
        feed.category.as_deref(),
        &items,
    )?;
    db.mark_feed_fetched(&feed.id)?;
    Ok(n)
}

fn is_fresh(feed: &NewsFeedRow) -> bool {
    let Some(last) = feed.last_fetched.as_deref() else {
        return false;
    };
    let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(last) else {
        return false;
    };
    let age = chrono::Utc::now().signed_duration_since(parsed.with_timezone(&chrono::Utc));
    age < Duration::minutes(feed.refresh_minutes)
}
