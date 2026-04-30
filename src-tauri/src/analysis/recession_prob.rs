//! NY Fed recession probability — single line chart with 30%/50% threshold
//! reference lines and NBER recession-bar overlay (consumed by the frontend
//! via the existing useRecessionBars hook).
//!
//! Source: FRED `RECPROUSM156N` (monthly, percent). Modeled probability
//! of a US recession in the next 12 months from the term spread. The
//! 30% / 50% thresholds are conventional "warning" / "imminent" lines used
//! by NY Fed analysts and most macro reporting; they're metadata, not
//! computed.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::analysis::MacroPoint;
use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";
const SERIES_ID: &str = "RECPROUSM156N";
const WARN_THRESHOLD_PCT: f64 = 30.0;
const IMMINENT_THRESHOLD_PCT: f64 = 50.0;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecessionProbRequest {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecessionThresholds {
    pub warn_pct: f64,
    pub imminent_pct: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecessionProbResponse {
    pub points: Vec<MacroPoint>,
    pub current: Option<MacroPoint>,
    pub thresholds: RecessionThresholds,
    pub units: String,
    pub series_id: String,
    /// Latest observation date as plain ISO; None when the series has no data.
    pub latest_date: Option<NaiveDate>,
    pub observation_count: u32,
}

pub fn compute_recession_prob(
    db: &Db,
    _request: RecessionProbRequest,
) -> Result<RecessionProbResponse, String> {
    let raw = db.all_fred_observations(SERIES_ID)?;
    let points: Vec<MacroPoint> = raw
        .into_iter()
        .filter_map(|(d_str, v)| {
            NaiveDate::parse_from_str(&d_str, ISO_DATE)
                .ok()
                .map(|date| MacroPoint { date, value: v })
        })
        .collect();

    let current = points.last().cloned();
    let latest_date = current.as_ref().map(|p| p.date);
    let observation_count = points.len() as u32;

    Ok(RecessionProbResponse {
        points,
        current,
        thresholds: RecessionThresholds {
            warn_pct: WARN_THRESHOLD_PCT,
            imminent_pct: IMMINENT_THRESHOLD_PCT,
        },
        units: "Percent".to_string(),
        series_id: SERIES_ID.to_string(),
        latest_date,
        observation_count,
    })
}
