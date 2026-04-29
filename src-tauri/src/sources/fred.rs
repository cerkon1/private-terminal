use serde::Deserialize;

const API_ROOT: &str = "https://api.stlouisfed.org/fred";

#[derive(Debug, thiserror::Error)]
pub enum FredError {
    #[error("FRED_API_KEY not set — create .env or export it before launching")]
    MissingApiKey,
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("FRED API error: {0}")]
    Api(String),
}

#[derive(Debug, Deserialize)]
struct SeriesEnvelope {
    seriess: Vec<SeriesMetaRaw>,
}

#[derive(Debug, Deserialize)]
pub struct SeriesMetaRaw {
    pub id: String,
    pub title: String,
    pub units: String,
    pub frequency: String,
}

#[derive(Debug, Deserialize)]
struct ObservationsEnvelope {
    observations: Vec<ObservationRaw>,
}

#[derive(Debug, Deserialize)]
struct ObservationRaw {
    date: String,
    value: String,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("personal-terminal/0.1 (+personal-use)")
        .build()
        .expect("reqwest client")
}

pub async fn fetch_series_meta(
    api_key: &str,
    series_id: &str,
) -> Result<SeriesMetaRaw, FredError> {
    let url = format!("{}/series", API_ROOT);
    let resp = client()
        .get(&url)
        .query(&[
            ("series_id", series_id),
            ("api_key", api_key),
            ("file_type", "json"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(FredError::Api(format!("HTTP {}: {}", status, body)));
    }

    let envelope: SeriesEnvelope = resp.json().await?;
    envelope
        .seriess
        .into_iter()
        .next()
        .ok_or_else(|| FredError::Api(format!("No series returned for {}", series_id)))
}

/// Returns observations as (date, value_string) pairs. Value strings preserve
/// FRED's sentinel "." for missing data — caller (DB layer) stores them verbatim.
pub async fn fetch_observations(
    api_key: &str,
    series_id: &str,
) -> Result<Vec<(String, String)>, FredError> {
    let url = format!("{}/series/observations", API_ROOT);
    let resp = client()
        .get(&url)
        .query(&[
            ("series_id", series_id),
            ("api_key", api_key),
            ("file_type", "json"),
            ("sort_order", "asc"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(FredError::Api(format!("HTTP {}: {}", status, body)));
    }

    let envelope: ObservationsEnvelope = resp.json().await?;
    Ok(envelope
        .observations
        .into_iter()
        .map(|o| (o.date, o.value))
        .collect())
}
