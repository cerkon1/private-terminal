//! News fetcher dispatcher (M7).
//!
//! Every fetcher module produces `Vec<NewsItem>`. Callers upsert into
//! `news_items` keyed on `(source, external_id)` — duplicates silently no-op,
//! so re-fetches produce only novel rows without custom dedup logic.

pub mod finnhub;
pub mod rss;

use serde::Serialize;

/// Normalised news item produced by every fetcher. `external_id` must be
/// stable within `source` so repeated fetches dedupe via the PK.
#[derive(Debug, Clone, Serialize)]
pub struct NewsItem {
    pub external_id: String,
    pub headline: String,
    pub url: Option<String>,
    pub summary: Option<String>,
    /// RFC 3339. Optional — feeds occasionally omit this.
    pub published_at: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum NewsError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("API error: {0}")]
    Api(String),
}
