//! NBER recession segments derived from the USREC FRED series.
//!
//! USREC is a monthly 0/1 indicator. The overlay path wants ranges, not raw
//! observations — collapse runs of `1` into `(start, end)` segments at month
//! granularity. Frontend hook caches once per session and feeds into ECharts
//! `markArea` config.

use chrono::NaiveDate;
use serde::Serialize;

use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecessionSegment {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

pub fn list_recession_segments(db: &Db) -> Result<Vec<RecessionSegment>, String> {
    let obs = db.all_fred_observations("USREC")?;

    // USREC values are 0.0 or 1.0; treat anything > 0.5 as "in recession" so
    // floating quirks don't matter.
    let mut segments = Vec::new();
    let mut run_start: Option<NaiveDate> = None;
    let mut last_in: Option<NaiveDate> = None;

    for (d_str, v) in obs {
        let date = match NaiveDate::parse_from_str(&d_str, ISO_DATE) {
            Ok(d) => d,
            Err(_) => continue,
        };
        if v > 0.5 {
            if run_start.is_none() {
                run_start = Some(date);
            }
            last_in = Some(date);
        } else if let (Some(start), Some(end)) = (run_start.take(), last_in.take()) {
            segments.push(RecessionSegment { start, end });
        }
    }
    if let (Some(start), Some(end)) = (run_start, last_in) {
        segments.push(RecessionSegment { start, end });
    }

    Ok(segments)
}
