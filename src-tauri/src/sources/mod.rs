pub mod fred;
pub mod news;
pub mod yahoo;

use std::time::Duration;

/// Whole-request timeout for every outbound HTTP call. Without one, a stalled
/// connection holds a semaphore permit forever and REFRESH never resolves.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Shared client builder so every source gets the same timeouts. Callers
/// cache the result in a `OnceLock` — building a client per request redoes
/// TLS setup and connection pooling every time.
pub(crate) fn build_client(user_agent: &str) -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(user_agent)
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .expect("reqwest client")
}

/// reqwest's error `Display` includes the full request URL — query string and
/// all. FRED and Finnhub carry the API key in the query string, and these
/// errors surface in the UI (tile hover, news error list). Every source error
/// type converts through this so a key can't leak into a screenshot.
pub(crate) fn redact(e: reqwest::Error) -> reqwest::Error {
    e.without_url()
}
