//! Finnhub news fetcher. Free-tier supports:
//! - `/news?category=general` — broad US market news
//! - `/company-news?symbol=X&from=&to=` — per-ticker news (deferred past M7)
//!
//! Free plan is 60 calls/min — comfortable for the current one-feed scope.

use serde::Deserialize;

use super::{NewsError, NewsItem};

const NEWS_ROOT: &str = "https://finnhub.io/api/v1/news";

#[derive(Debug, Deserialize)]
struct FinnhubArticle {
    id: i64,
    #[serde(default)]
    headline: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    datetime: Option<i64>,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("personal-terminal/0.1")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("reqwest client")
}

pub async fn fetch_category(
    api_key: &str,
    category: &str,
) -> Result<Vec<NewsItem>, NewsError> {
    let resp = client()
        .get(NEWS_ROOT)
        .query(&[("category", category), ("token", api_key)])
        .send()
        .await?;
    parse_response(resp).await
}

/// Per-ticker news via `/api/v1/company-news`. `from`/`to` are `YYYY-MM-DD`.
/// Free tier supports US-listed tickers only — pass TSX/FX/crypto symbols at
/// your own risk (empty list at best, error at worst).
pub async fn fetch_company_news(
    api_key: &str,
    symbol: &str,
    from: &str,
    to: &str,
) -> Result<Vec<NewsItem>, NewsError> {
    let url = "https://finnhub.io/api/v1/company-news";
    let resp = client()
        .get(url)
        .query(&[
            ("symbol", symbol),
            ("from", from),
            ("to", to),
            ("token", api_key),
        ])
        .send()
        .await?;
    parse_response(resp).await
}

async fn parse_response(resp: reqwest::Response) -> Result<Vec<NewsItem>, NewsError> {
    if !resp.status().is_success() {
        return Err(NewsError::Api(format!(
            "Finnhub HTTP {}",
            resp.status()
        )));
    }
    let articles: Vec<FinnhubArticle> = resp
        .json()
        .await
        .map_err(|e| NewsError::Parse(e.to_string()))?;
    let items = articles
        .into_iter()
        .filter_map(|a| {
            let headline = a.headline?;
            let published_at = a.datetime.and_then(|ts| {
                chrono::DateTime::<chrono::Utc>::from_timestamp(ts, 0)
                    .map(|dt| dt.to_rfc3339())
            });
            Some(NewsItem {
                external_id: a.id.to_string(),
                headline,
                url: a.url,
                summary: a.summary,
                published_at,
            })
        })
        .collect();
    Ok(items)
}
