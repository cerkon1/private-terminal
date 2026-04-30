//! Chicago Fed National Financial Conditions Index (NFCI) — single line
//! chart with a zero-line baseline. Positive = tighter than average,
//! negative = looser than average. NBER recession bars overlay via the
//! existing useRecessionBars hook on the frontend.
//!
//! Source: FRED `NFCI` (weekly, dimensionless index). The historical mean
//! is anchored at 0 by construction, so the zero crossing is the meaningful
//! reference — no computed thresholds beyond that.
//!
//! Optional companion series ANFCI (adjusted) is mentioned in the design
//! sketch but not implemented in v1 — add when there's a clear use case.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::analysis::MacroPoint;
use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";
const SERIES_ID: &str = "NFCI";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialConditionsRequest {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialConditionsResponse {
    pub points: Vec<MacroPoint>,
    pub current: Option<MacroPoint>,
    /// Min/max across the full series — useful for a footer readout that
    /// contextualizes the current reading.
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub units: String,
    pub series_id: String,
    pub latest_date: Option<NaiveDate>,
    pub observation_count: u32,
}

pub fn compute_financial_conditions(
    db: &Db,
    _request: FinancialConditionsRequest,
) -> Result<FinancialConditionsResponse, String> {
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

    let (min_value, max_value) = if points.is_empty() {
        (None, None)
    } else {
        let min = points.iter().map(|p| p.value).fold(f64::INFINITY, f64::min);
        let max = points
            .iter()
            .map(|p| p.value)
            .fold(f64::NEG_INFINITY, f64::max);
        (Some(min), Some(max))
    };

    Ok(FinancialConditionsResponse {
        points,
        current,
        min_value,
        max_value,
        units: "Index".to_string(),
        series_id: SERIES_ID.to_string(),
        latest_date,
        observation_count,
    })
}
