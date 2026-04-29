//! Treasury yield curve snapshot + spread series.
//!
//! Snapshots: today + 6 months ago + 5 years ago, at 3M / 2Y / 5Y / 10Y / 30Y
//! tenors. Missing data → `Option<f64>` per tenor (Q3.B partial response).
//!
//! Spread: configurable; Phase 1 supports `2s10s` (DGS10 - DGS2) and `3m10y`
//! (DGS10 - DGS3MO). Returned as a daily series for the recent window so the
//! frontend can render with NBER recession bars overlaid.

use chrono::{Duration, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";
const TENORS: &[(&str, &str)] = &[
    ("3M", "DGS3MO"),
    ("2Y", "DGS2"),
    ("5Y", "DGS5"),
    ("10Y", "DGS10"),
    ("30Y", "DGS30"),
];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YieldCurveRequest {
    /// Anchor date for snapshots. None = use latest available DGS10 obs.
    pub snapshot_date: Option<NaiveDate>,
    /// Spread variant. Currently `"2s10s"` or `"3m10y"`.
    pub spread: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TenorPoint {
    pub tenor: String,
    pub yield_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurveSnapshot {
    /// Display label: "Today" / "6 months ago" / "5 years ago".
    pub label: String,
    pub date: NaiveDate,
    pub points: Vec<TenorPoint>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpreadPoint {
    pub date: NaiveDate,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YieldCurveResponse {
    pub term_structure: Vec<CurveSnapshot>,
    pub spread_label: String,
    pub spread_series: Vec<SpreadPoint>,
}

/// Latest non-sentinel observation across the curve. Defaults the snapshot
/// anchor when the request leaves it unset.
fn latest_available_date(db: &Db) -> Result<Option<NaiveDate>, String> {
    let mut latest: Option<NaiveDate> = None;
    for (_, sid) in TENORS {
        let obs = db.all_fred_observations(sid)?;
        if let Some((d, _)) = obs.last() {
            if let Ok(d) = NaiveDate::parse_from_str(d, ISO_DATE) {
                latest = Some(latest.map_or(d, |cur| cur.max(d)));
            }
        }
    }
    Ok(latest)
}

fn snapshot_at(db: &Db, anchor: NaiveDate, label: &str) -> Result<CurveSnapshot, String> {
    let anchor_str = anchor.format(ISO_DATE).to_string();
    let mut points = Vec::with_capacity(TENORS.len());
    for (tenor, sid) in TENORS {
        // Use the existing at-or-before helper for nearest-prior business day.
        let obs = db.fred_value_at_or_before(sid, &anchor_str)?;
        points.push(TenorPoint {
            tenor: (*tenor).to_string(),
            yield_pct: obs.map(|(_, v)| v),
        });
    }
    Ok(CurveSnapshot {
        label: label.to_string(),
        date: anchor,
        points,
    })
}

pub fn compute_yield_curve(
    db: &Db,
    request: YieldCurveRequest,
) -> Result<YieldCurveResponse, String> {
    let anchor = match request.snapshot_date {
        Some(d) => d,
        None => latest_available_date(db)?
            .ok_or_else(|| "no FRED observations for any treasury tenor".to_string())?,
    };

    let snapshots = vec![
        snapshot_at(db, anchor, "Today")?,
        snapshot_at(db, anchor - Duration::days(180), "6 months ago")?,
        snapshot_at(db, anchor - Duration::days(365 * 5), "5 years ago")?,
    ];

    let (spread_label, long_id, short_id) = match request.spread.as_str() {
        "3m10y" => ("DGS10 − DGS3MO", "DGS10", "DGS3MO"),
        // Default to 2s10s, including unknown variants — UI is the gate.
        _ => ("DGS10 − DGS2", "DGS10", "DGS2"),
    };

    let long_series = db.all_fred_observations(long_id)?;
    let short_series = db.all_fred_observations(short_id)?;
    let spread_series = compute_spread_series(&long_series, &short_series);

    Ok(YieldCurveResponse {
        term_structure: snapshots,
        spread_label: spread_label.to_string(),
        spread_series,
    })
}

/// Inner-join two FRED series on date and return `long - short` per common
/// date. Inputs are pre-sorted ascending; output preserves order.
fn compute_spread_series(
    long: &[(String, f64)],
    short: &[(String, f64)],
) -> Vec<SpreadPoint> {
    use std::collections::BTreeMap;
    let short_map: BTreeMap<&str, f64> = short.iter().map(|(d, v)| (d.as_str(), *v)).collect();

    long.iter()
        .filter_map(|(d, lv)| {
            let sv = short_map.get(d.as_str())?;
            let date = NaiveDate::parse_from_str(d, ISO_DATE).ok()?;
            Some(SpreadPoint {
                date,
                value: *lv - *sv,
            })
        })
        .collect()
}
