//! Per-ticker coverage info for the Analysis chip-picker greyed-chip path.
//!
//! Returned for every visible watchlist row regardless of bar count — the
//! UI greys chips that fall below the current tool's lookback × 0.5
//! threshold and shows "X of Y needed days" in the tooltip.

use chrono::NaiveDate;
use serde::Serialize;

use crate::db::Db;

const ISO_DATE: &str = "%Y-%m-%d";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerCoverage {
    pub ticker: String,
    pub data_source: String,
    pub display_name: Option<String>,
    pub bar_count: u32,
    pub earliest_date: Option<NaiveDate>,
    pub latest_date: Option<NaiveDate>,
}

/// All visible watchlist rows joined with their bar coverage. Tickers without
/// any bars yet still appear (with bar_count = 0) so the picker can show them
/// as greyed.
pub fn list_tickers_with_coverage(db: &Db) -> Result<Vec<TickerCoverage>, String> {
    // Not adding a new helper for "list all visible (ticker, data_source,
    // display_name)" — the existing list_sector_groups + per-group iteration
    // pattern from list_ticker_tiles is already there, but we need a flat
    // list. Inline a query here; no SQL is hidden in app code.
    use rusqlite::params;
    let mut stmt = db
        .connection()
        .prepare(
            "SELECT DISTINCT t.ticker, t.data_source, t.display_name \
             FROM watchlist_tickers t \
             JOIN sector_groups g ON g.id = t.sector_group_id \
             WHERE t.user_hidden = 0 AND g.user_hidden = 0 \
               AND t.enabled = 1 AND g.enabled = 1 \
             ORDER BY t.ticker ASC, t.data_source ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![], |row| {
            let t: String = row.get(0)?;
            let ds: String = row.get(1)?;
            let dn: Option<String> = row.get(2)?;
            Ok((t, ds, dn))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for (ticker, data_source, display_name) in rows {
        let cov = db.ticker_coverage(&ticker, &data_source)?;
        let (bar_count, earliest, latest) = match cov {
            Some((n, e, l)) => (
                n,
                NaiveDate::parse_from_str(&e, ISO_DATE).ok(),
                NaiveDate::parse_from_str(&l, ISO_DATE).ok(),
            ),
            None => (0, None, None),
        };
        out.push(TickerCoverage {
            ticker,
            data_source,
            display_name,
            bar_count,
            earliest_date: earliest,
            latest_date: latest,
        });
    }
    Ok(out)
}
