use serde::Deserialize;

const API_ROOT: &str = "https://api.stlouisfed.org/fred";

#[derive(Debug, thiserror::Error)]
pub enum FredError {
    #[error("FRED API key not set — add it in Settings → API Keys")]
    MissingApiKey,
    #[error("HTTP error: {0}")]
    Http(reqwest::Error),
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

impl From<reqwest::Error> for FredError {
    fn from(e: reqwest::Error) -> Self {
        // The API key rides in the query string — strip the URL (see `redact`).
        FredError::Http(super::redact(e))
    }
}

fn client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| super::build_client("personal-terminal/0.1 (+personal-use)"))
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

// ──────── Release calendar (v1.1) ────────
//
// /fred/series/release maps a series to the statistical release that
// publishes it (CPI, Employment Situation, GDP…). /fred/release/dates lists
// that release's dates; include_release_dates_with_no_data=true is what
// makes FRED return *scheduled* future dates.

#[derive(Debug, Clone, PartialEq)]
pub struct FredRelease {
    pub id: i64,
    pub name: String,
    pub link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReleasesEnvelope {
    releases: Vec<ReleaseRaw>,
}

#[derive(Debug, Deserialize)]
struct ReleaseRaw {
    id: i64,
    name: String,
    #[serde(default)]
    link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReleaseDatesEnvelope {
    release_dates: Vec<ReleaseDateRaw>,
}

#[derive(Debug, Deserialize)]
struct ReleaseDateRaw {
    date: String,
}

pub(crate) fn parse_series_release(json: &str) -> Result<Option<FredRelease>, FredError> {
    let env: ReleasesEnvelope =
        serde_json::from_str(json).map_err(|e| FredError::Api(format!("bad release JSON: {e}")))?;
    Ok(env.releases.into_iter().next().map(|r| FredRelease {
        id: r.id,
        name: r.name,
        link: r.link.filter(|l| !l.is_empty()),
    }))
}

pub(crate) fn parse_release_dates(json: &str) -> Result<Vec<String>, FredError> {
    let env: ReleaseDatesEnvelope = serde_json::from_str(json)
        .map_err(|e| FredError::Api(format!("bad release-dates JSON: {e}")))?;
    Ok(env.release_dates.into_iter().map(|d| d.date).collect())
}

async fn get_text(url: &str, query: &[(&str, &str)]) -> Result<String, FredError> {
    let resp = client().get(url).query(query).send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(FredError::Api(format!("HTTP {}: {}", status, body)));
    }
    Ok(resp.text().await?)
}

/// The release that publishes `series_id`, if FRED lists one.
pub async fn fetch_series_release(
    api_key: &str,
    series_id: &str,
) -> Result<Option<FredRelease>, FredError> {
    let url = format!("{}/series/release", API_ROOT);
    let body = get_text(
        &url,
        &[("series_id", series_id), ("api_key", api_key), ("file_type", "json")],
    )
    .await?;
    parse_series_release(&body)
}

/// The latest ~100 dates of a release, newest first, including scheduled
/// future dates. Newest-first + a generous limit keeps near-term dates of a
/// weekly release from being crowded out by far-future ones; the caller
/// filters to its window.
pub async fn fetch_release_dates(api_key: &str, release_id: i64) -> Result<Vec<String>, FredError> {
    let url = format!("{}/release/dates", API_ROOT);
    let id = release_id.to_string();
    let body = get_text(
        &url,
        &[
            ("release_id", id.as_str()),
            ("api_key", api_key),
            ("file_type", "json"),
            ("include_release_dates_with_no_data", "true"),
            ("sort_order", "desc"),
            ("limit", "100"),
        ],
    )
    .await?;
    parse_release_dates(&body)
}

#[cfg(test)]
mod tests {
    use super::{parse_release_dates, parse_series_release, FredRelease};

    // Shapes as documented at fred.stlouisfed.org/docs/api/fred/.
    #[test]
    fn parses_series_release() {
        let json = r#"{"realtime_start":"2026-09-23","realtime_end":"2026-09-23","releases":[
            {"id":10,"realtime_start":"2026-09-23","realtime_end":"2026-09-23",
             "name":"Consumer Price Index","press_release":true,"link":"http://www.bls.gov/cpi/"}]}"#;
        assert_eq!(
            parse_series_release(json).unwrap(),
            Some(FredRelease { id: 10, name: "Consumer Price Index".into(), link: Some("http://www.bls.gov/cpi/".into()) })
        );
        assert_eq!(parse_series_release(r#"{"releases":[]}"#).unwrap(), None);
        assert!(parse_series_release("<html>").is_err());
    }

    #[test]
    fn parses_release_dates() {
        let json = r#"{"realtime_start":"1776-07-04","realtime_end":"9999-12-31","order_by":"release_date",
            "sort_order":"desc","count":3,"offset":0,"limit":100,
            "release_dates":[{"release_id":10,"date":"2026-11-12"},{"release_id":10,"date":"2026-10-15"}]}"#;
        assert_eq!(parse_release_dates(json).unwrap(), vec!["2026-11-12", "2026-10-15"]);
    }
}
