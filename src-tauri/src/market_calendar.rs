//! US-market trading-day helpers shared by the chart staleness check and
//! Pulse's daily snapshot key.

use chrono::{DateTime, Datelike, NaiveDate, Timelike, Utc, Weekday};
use chrono_tz::America::New_York;

/// Most recent calendar date that should have a settled US-equity daily
/// close, in NY local time.
///
/// Rules:
///   - Weekday in NY at or after 16:00 ET → today.
///   - Weekday in NY before 16:00 ET → previous trading day (today's bar
///     hasn't settled yet).
///   - Saturday / Sunday → most recent Friday.
///
/// Does NOT account for US market holidays. On a holiday Monday this
/// returns the holiday date; the chart check makes one needless Yahoo call
/// and Pulse files that day's snapshot under the holiday. Both harmless.
pub(crate) fn expected_latest_us_close() -> NaiveDate {
    expected_latest_us_close_at(Utc::now())
}

pub(crate) fn expected_latest_us_close_at(now: DateTime<Utc>) -> NaiveDate {
    let ny = now.with_timezone(&New_York);
    let mut date = ny.date_naive();
    let post_close = ny.hour() >= 16;

    let is_weekday = !matches!(date.weekday(), Weekday::Sat | Weekday::Sun);
    if is_weekday && !post_close {
        date = date.pred_opt().unwrap_or(date);
    }
    while matches!(date.weekday(), Weekday::Sat | Weekday::Sun) {
        date = date.pred_opt().unwrap_or(date);
    }
    date
}

#[cfg(test)]
mod tests {
    use super::expected_latest_us_close_at;
    use chrono::{NaiveDate, TimeZone, Utc};

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn weekday_after_close_is_today() {
        // Wed 2026-09-23 17:00 ET (EDT, UTC-4) = 21:00 UTC.
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 23, 21, 0, 0).unwrap()), d(2026, 9, 23));
    }

    #[test]
    fn weekday_before_close_is_previous_day() {
        // Wed 10:00 ET → Tuesday.
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 23, 14, 0, 0).unwrap()), d(2026, 9, 22));
    }

    #[test]
    fn monday_morning_and_weekend_are_friday() {
        // Mon 2026-09-21 09:00 ET → Fri 09-18; Sat and Sun → Fri.
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 21, 13, 0, 0).unwrap()), d(2026, 9, 18));
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 19, 18, 0, 0).unwrap()), d(2026, 9, 18));
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 20, 23, 0, 0).unwrap()), d(2026, 9, 18));
    }

    #[test]
    fn hong_kong_morning_maps_to_the_right_ny_session() {
        // Thu 2026-09-24 08:00 HKT = Wed 20:00 ET (after close) → Wednesday.
        assert_eq!(expected_latest_us_close_at(Utc.with_ymd_and_hms(2026, 9, 24, 0, 0, 0).unwrap()), d(2026, 9, 23));
    }
}
