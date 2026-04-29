//! RSS/Atom fetcher. feed-rs handles both formats uniformly and resolves
//! `<guid>` / `<id>` into `entry.id` — that's the dedup key. If a feed
//! omits the id, we synthesise `sha256(link + pubDate)` which is stable
//! across re-fetches of the same item.

use std::io::Cursor;

use feed_rs::parser;
use sha2::{Digest, Sha256};

use super::{NewsError, NewsItem};

// Some feeds (Fed press, BBC) reject default reqwest UAs or return partial
// content. A recognisable UA is the usual workaround for personal-use scripts.
const USER_AGENT: &str =
    "Mozilla/5.0 (Personal Terminal RSS Reader; personal research dashboard)";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("reqwest client")
}

pub async fn fetch(url: &str) -> Result<Vec<NewsItem>, NewsError> {
    let resp = client().get(url).send().await?;
    if !resp.status().is_success() {
        return Err(NewsError::Api(format!(
            "HTTP {} for {}",
            resp.status(),
            url
        )));
    }
    let body = resp.bytes().await?;
    let feed = parser::parse(Cursor::new(&body))
        .map_err(|e| NewsError::Parse(e.to_string()))?;

    let items = feed
        .entries
        .into_iter()
        .map(|entry| {
            let url = entry.links.first().map(|l| l.href.clone());
            let headline = entry
                .title
                .map(|t| t.content)
                .unwrap_or_else(|| "(untitled)".to_string());
            let summary = entry.summary.map(|s| strip_html(&s.content));
            let published_at = entry
                .published
                .or(entry.updated)
                .map(|dt| dt.to_rfc3339());

            let external_id = if !entry.id.is_empty() {
                entry.id
            } else {
                let basis = format!(
                    "{}|{}",
                    url.as_deref().unwrap_or(""),
                    published_at.as_deref().unwrap_or(""),
                );
                let digest = Sha256::digest(basis.as_bytes());
                format!("sha256:{:x}", digest)
            };

            NewsItem {
                external_id,
                headline,
                url,
                summary,
                published_at,
            }
        })
        .collect();
    Ok(items)
}

/// Cheap HTML tag stripper. Feeds embed `<p>` / `<a>` / `<img>` in summaries;
/// we show summaries as plain text in a terminal-style list. A full parser
/// is overkill here — a character-level tag toggle plus a handful of
/// entity replacements is enough for the ~200-char preview we render.
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    decode_entities(out.trim()).chars().take(400).collect()
}

fn decode_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
}
