//! Pulse "since the previous trading day" (v1.1).
//!
//! Each compute is filed under a trading-day key (the latest settled US
//! close — see `market_calendar`). The latest compute on a key overwrites
//! that key's snapshot; rows are then annotated with the values from the
//! most recent *earlier* key. Deltas are derived in the frontend.

use std::collections::HashMap;

use crate::cross_section::{CrossSectionResponse, PulsePrev, RegimeState};
use crate::db::{Db, PulseSnapshotRow};

/// Persist `response` as the snapshot for `snap_date`, then fill each row's
/// `prev` from the most recent earlier snapshot. Rows without bars are not
/// stored (they have nothing to compare).
pub fn record_and_compare(
    db: &Db,
    response: &mut CrossSectionResponse,
    snap_date: &str,
) -> Result<(), String> {
    let rows: Vec<PulseSnapshotRow> = response
        .sections
        .iter()
        .flat_map(|s| s.rows.iter())
        .filter(|r| !r.no_bars)
        .map(|r| PulseSnapshotRow {
            ticker: r.ticker.clone(),
            data_source: r.data_source.clone(),
            level: r.level,
            rsi: r.rsi,
            atr: r.atr,
            vol: r.vol,
            dd_pct: r.dd_pct,
            regime: r.regime.map(|g| g.as_str().to_string()),
        })
        .collect();
    db.upsert_pulse_snapshot(snap_date, &rows)?;
    response.snapshot_date = Some(snap_date.to_string());

    let Some((prev_date, prev_rows)) = db.pulse_snapshot_before(snap_date)? else {
        return Ok(());
    };
    let by_key: HashMap<(&str, &str), &PulseSnapshotRow> = prev_rows
        .iter()
        .map(|r| ((r.ticker.as_str(), r.data_source.as_str()), r))
        .collect();
    for row in response.sections.iter_mut().flat_map(|s| s.rows.iter_mut()) {
        if let Some(p) = by_key.get(&(row.ticker.as_str(), row.data_source.as_str())) {
            row.prev = Some(PulsePrev {
                level: p.level,
                rsi: p.rsi,
                atr: p.atr,
                vol: p.vol,
                dd_pct: p.dd_pct,
                regime: p.regime.as_deref().and_then(RegimeState::parse),
            });
        }
    }
    response.compared_to = Some(prev_date);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::record_and_compare;
    use crate::cross_section::{
        CrossSectionResponse, CrossSectionRow, CrossSectionSection, RegimeState,
    };
    use crate::db::Db;

    fn db(name: &str) -> (Db, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("pt-pulse-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Db::open(&dir.join("t.db")).unwrap();
        db.initialize_schema().unwrap();
        (db, dir)
    }

    fn response(level: f64, regime: RegimeState) -> CrossSectionResponse {
        let row = CrossSectionRow {
            ticker: "SPY".into(),
            data_source: "yahoo".into(),
            level: Some(level),
            regime: Some(regime),
            ..Default::default()
        };
        // Same ticker listed in a second group: must not break the upsert.
        let dup = row.clone();
        let greyed = CrossSectionRow { ticker: "NEW".into(), data_source: "yahoo".into(), no_bars: true, ..Default::default() };
        CrossSectionResponse {
            sections: vec![
                CrossSectionSection { id: "a".into(), display_name: "A".into(), rows: vec![row, greyed] },
                CrossSectionSection { id: "b".into(), display_name: "B".into(), rows: vec![dup] },
            ],
            computed_at: String::new(),
            snapshot_date: None,
            compared_to: None,
        }
    }

    #[test]
    fn first_day_has_no_comparison_then_next_day_compares() {
        let (db, dir) = db("days");
        let mut day1 = response(40.0, RegimeState::Bear);
        record_and_compare(&db, &mut day1, "2026-09-22").unwrap();
        assert_eq!(day1.compared_to, None);
        assert!(day1.sections[0].rows[0].prev.is_none());

        let mut day2 = response(75.0, RegimeState::Bull);
        record_and_compare(&db, &mut day2, "2026-09-23").unwrap();
        assert_eq!(day2.compared_to.as_deref(), Some("2026-09-22"));
        for s in &day2.sections {
            let spy = s.rows.iter().find(|r| r.ticker == "SPY").unwrap();
            let prev = spy.prev.as_ref().unwrap();
            assert_eq!(prev.level, Some(40.0));
            assert_eq!(prev.regime, Some(RegimeState::Bear));
        }
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn same_day_recompute_overwrites_and_still_compares_to_yesterday() {
        let (db, dir) = db("sameday");
        record_and_compare(&db, &mut response(10.0, RegimeState::Bear), "2026-09-22").unwrap();
        record_and_compare(&db, &mut response(50.0, RegimeState::Neutral), "2026-09-23").unwrap();
        let mut again = response(60.0, RegimeState::Bull);
        record_and_compare(&db, &mut again, "2026-09-23").unwrap();
        assert_eq!(again.compared_to.as_deref(), Some("2026-09-22"));
        assert_eq!(again.sections[0].rows[0].prev.as_ref().unwrap().level, Some(10.0));
        // Tomorrow compares against today's LATEST compute (60), not the first (50).
        let mut next = response(70.0, RegimeState::Bull);
        record_and_compare(&db, &mut next, "2026-09-24").unwrap();
        assert_eq!(next.sections[0].rows[0].prev.as_ref().unwrap().level, Some(60.0));
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cleanup_drops_old_snapshots() {
        let (db, dir) = db("cleanup");
        record_and_compare(&db, &mut response(10.0, RegimeState::Bear), "2020-01-02").unwrap();
        assert_eq!(db.cleanup_old_pulse_snapshots(90).unwrap(), 1);
        assert!(db.pulse_snapshot_before("2030-01-01").unwrap().is_none());
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
