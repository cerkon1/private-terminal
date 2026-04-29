use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection};

const SCHEMA_SQL: &str = include_str!("schema.sql");
const SEED_SQL: &str = include_str!("seed.sql");

pub struct Db {
    conn: Connection,
    path: PathBuf,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.busy_timeout(Duration::from_secs(10)).map_err(|e| e.to_string())?;
        // WAL: readers don't block writers — keeps UI responsive during fetch/writes.
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        Ok(Self {
            conn,
            path: path.to_path_buf(),
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Count rows in a table — used by the DB status strip.
    pub fn count(&self, table: &str) -> Result<i64, String> {
        let sql = format!("SELECT COUNT(*) FROM {}", table);
        self.conn
            .query_row(&sql, [], |r| r.get(0))
            .map_err(|e| e.to_string())
    }

    pub fn initialize_schema(&self) -> Result<(), String> {
        self.conn.execute_batch(SCHEMA_SQL).map_err(|e| e.to_string())
    }

    /// Idempotent column migrations for existing DBs. `CREATE TABLE IF NOT
    /// EXISTS` handles new DBs; this handles users who already have the DB
    /// from a prior milestone. Each ALTER is wrapped so "duplicate column"
    /// errors are treated as success — the migration is already applied.
    pub fn migrate(&self) -> Result<(), String> {
        // (table, column, ALTER SQL). Add new rows here for future migrations;
        // never remove — they must stay idempotent across releases.
        let migrations: &[(&str, &str, &str)] = &[
            (
                "sector_groups",
                "user_hidden",
                "ALTER TABLE sector_groups ADD COLUMN user_hidden INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "watchlist_tickers",
                "user_hidden",
                "ALTER TABLE watchlist_tickers ADD COLUMN user_hidden INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "news_feeds",
                "user_hidden",
                "ALTER TABLE news_feeds ADD COLUMN user_hidden INTEGER NOT NULL DEFAULT 0",
            ),
        ];
        for (table, col, sql) in migrations {
            match self.conn.execute(sql, []) {
                Ok(_) => log::info!("migration: added column {}.{}", table, col),
                Err(e) => {
                    let msg = e.to_string();
                    if !msg.contains("duplicate column") {
                        return Err(format!("migrate {}.{}: {}", table, col, msg));
                    }
                }
            }
        }
        Ok(())
    }

    /// Run the seed SQL on every boot. Seed uses `INSERT OR IGNORE` so it's
    /// idempotent — existing rows are untouched; new ones (added in later
    /// milestones) land on the next launch.
    pub fn seed(&self) -> Result<(), String> {
        self.conn.execute_batch(SEED_SQL).map_err(|e| e.to_string())
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    /// Fetch FRED series metadata row. Returns `None` if the series isn't registered.
    pub fn get_fred_series(&self, series_id: &str) -> Result<Option<FredSeriesRow>, String> {
        self.conn
            .query_row(
                "SELECT series_id, title, units, frequency, category, last_fetched \
                 FROM fred_series WHERE series_id = ?1",
                params![series_id],
                |row| {
                    Ok(FredSeriesRow {
                        series_id: row.get(0)?,
                        title: row.get(1)?,
                        units: row.get(2)?,
                        frequency: row.get(3)?,
                        category: row.get(4)?,
                        last_fetched: row.get(5)?,
                    })
                },
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }

    /// Upsert FRED series metadata (title/units/frequency discovered from the API).
    pub fn upsert_fred_series(
        &self,
        series_id: &str,
        title: &str,
        units: &str,
        frequency: &str,
        category: Option<&str>,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO fred_series (series_id, title, units, frequency, category, last_fetched) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
                 ON CONFLICT(series_id) DO UPDATE SET \
                   title=excluded.title, units=excluded.units, frequency=excluded.frequency, \
                   category=COALESCE(excluded.category, fred_series.category), \
                   last_fetched=excluded.last_fetched",
                params![series_id, title, units, frequency, category, now],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Upsert a batch of FRED observations. Values stored as TEXT for consistency
    /// with quote_cache; parsed to f64 on read.
    pub fn upsert_fred_observations(
        &self,
        series_id: &str,
        observations: &[(String, String)],
    ) -> Result<(), String> {
        let tx_conn = &self.conn;
        tx_conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        let result: Result<(), String> = (|| {
            let mut stmt = tx_conn
                .prepare(
                    "INSERT INTO fred_observations (series_id, obs_date, value) \
                     VALUES (?1, ?2, ?3) \
                     ON CONFLICT(series_id, obs_date) DO UPDATE SET value=excluded.value",
                )
                .map_err(|e| e.to_string())?;
            for (obs_date, value) in observations {
                stmt.execute(params![series_id, obs_date, value])
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = tx_conn.execute_batch("ROLLBACK");
            return result;
        }
        tx_conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Latest non-null observation for a series.
    pub fn latest_fred_observation(
        &self,
        series_id: &str,
    ) -> Result<Option<(String, f64)>, String> {
        self.conn
            .query_row(
                "SELECT obs_date, value FROM fred_observations \
                 WHERE series_id = ?1 AND value != '.' AND value != '' \
                 ORDER BY obs_date DESC LIMIT 1",
                params![series_id],
                |row| {
                    let date: String = row.get(0)?;
                    let value_str: String = row.get(1)?;
                    Ok((date, value_str))
                },
            )
            .map(|(date, v_str)| {
                v_str.parse::<f64>().ok().map(|v| (date, v))
            })
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }
}

pub struct SectorGroupRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub display_name: String,
    pub data_source: String,
    pub display_order: Option<i64>,
    pub enabled: bool,
}

pub struct WatchlistTickerRow {
    pub ticker: String,
    pub sector_group_id: String,
    pub data_source: String,
    pub display_name: Option<String>,
    pub display_currency: Option<String>,
    pub display_order: Option<i64>,
    pub enabled: bool,
}

pub struct IndicatorSettingRow {
    pub ticker: String,
    pub indicator_id: String,
    pub enabled: bool,
    pub params_json: Option<String>,
}

pub struct QuoteCacheRow {
    pub ticker: String,
    pub data_source: String,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub change_pct_24h: Option<f64>,
    pub change_abs_24h: Option<f64>,
    pub market_cap: Option<f64>,
    pub volume_24h: Option<f64>,
    pub last_fetched: Option<String>,
}

pub struct FredSeriesRow {
    pub series_id: String,
    pub title: Option<String>,
    pub units: Option<String>,
    pub frequency: Option<String>,
    pub category: Option<String>,
    pub last_fetched: Option<String>,
}

pub struct NewsFeedRow {
    pub id: String,
    pub source_type: String,
    pub url: Option<String>,
    pub display_name: String,
    pub category: Option<String>,
    pub refresh_minutes: i64,
    pub last_fetched: Option<String>,
    pub enabled: bool,
}

pub struct NewsItemRow {
    pub source: String,
    pub external_id: String,
    pub feed_id: Option<String>,
    pub ticker: Option<String>,
    pub category: Option<String>,
    pub headline: String,
    pub url: Option<String>,
    pub summary: Option<String>,
    pub published_at: Option<String>,
    pub fetched_at: String,
}

impl Db {
    /// List all FRED series registered in the DB, ordered by category then id.
    /// Used by the batch dashboard command to enumerate what to show.
    pub fn list_fred_series(&self) -> Result<Vec<FredSeriesRow>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT series_id, title, units, frequency, category, last_fetched \
                 FROM fred_series ORDER BY category, series_id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(FredSeriesRow {
                    series_id: row.get(0)?,
                    title: row.get(1)?,
                    units: row.get(2)?,
                    frequency: row.get(3)?,
                    category: row.get(4)?,
                    last_fetched: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    /// Value at-or-before a given date. Used for YoY lookback — FRED releases
    /// land on business days, so exact-date lookups frequently miss; we take
    /// the nearest earlier observation with a non-sentinel value.
    pub fn fred_value_at_or_before(
        &self,
        series_id: &str,
        target_date: &str,
    ) -> Result<Option<(String, f64)>, String> {
        self.conn
            .query_row(
                "SELECT obs_date, value FROM fred_observations \
                 WHERE series_id = ?1 AND obs_date <= ?2 \
                   AND value != '.' AND value != '' \
                 ORDER BY obs_date DESC LIMIT 1",
                params![series_id, target_date],
                |row| {
                    let d: String = row.get(0)?;
                    let v: String = row.get(1)?;
                    Ok((d, v))
                },
            )
            .map(|(d, v_str)| v_str.parse::<f64>().ok().map(|v| (d, v)))
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }

    // ──────── Sector groups + watchlist tickers ────────

    pub fn list_sector_groups(&self) -> Result<Vec<SectorGroupRow>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, parent_id, display_name, data_source, display_order, enabled \
                 FROM sector_groups WHERE user_hidden = 0 ORDER BY display_order, id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SectorGroupRow {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    display_name: row.get(2)?,
                    data_source: row.get(3)?,
                    display_order: row.get(4)?,
                    enabled: row.get::<_, i64>(5)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn list_tickers_in_sector(
        &self,
        sector_group_id: &str,
    ) -> Result<Vec<WatchlistTickerRow>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT ticker, sector_group_id, data_source, display_name, \
                        display_currency, display_order, enabled \
                 FROM watchlist_tickers \
                 WHERE sector_group_id = ?1 AND enabled = 1 AND user_hidden = 0 \
                 ORDER BY display_order, ticker",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![sector_group_id], |row| {
                Ok(WatchlistTickerRow {
                    ticker: row.get(0)?,
                    sector_group_id: row.get(1)?,
                    data_source: row.get(2)?,
                    display_name: row.get(3)?,
                    display_currency: row.get(4)?,
                    display_order: row.get(5)?,
                    enabled: row.get::<_, i64>(6)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    // ──────── Indicator settings ────────

    pub fn get_indicator_settings(&self, ticker: &str) -> Result<Vec<IndicatorSettingRow>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT ticker, indicator_id, enabled, params_json \
                 FROM indicator_settings WHERE ticker = ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![ticker], |row| {
                Ok(IndicatorSettingRow {
                    ticker: row.get(0)?,
                    indicator_id: row.get(1)?,
                    enabled: row.get::<_, i64>(2)? != 0,
                    params_json: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn upsert_indicator_setting(
        &self,
        ticker: &str,
        indicator_id: &str,
        enabled: bool,
        params_json: Option<&str>,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO indicator_settings (ticker, indicator_id, enabled, params_json) \
                 VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(ticker, indicator_id) DO UPDATE SET \
                   enabled=excluded.enabled, \
                   params_json=COALESCE(excluded.params_json, indicator_settings.params_json)",
                params![ticker, indicator_id, if enabled { 1 } else { 0 }, params_json],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ──────── Quote cache ────────

    pub fn upsert_quote(
        &self,
        ticker: &str,
        data_source: &str,
        price: Option<f64>,
        currency: Option<&str>,
        change_pct_24h: Option<f64>,
        change_abs_24h: Option<f64>,
        market_cap: Option<f64>,
        volume_24h: Option<f64>,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO quote_cache \
                   (ticker, data_source, price, currency, change_pct_24h, change_abs_24h, \
                    market_cap, volume_24h, last_fetched) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) \
                 ON CONFLICT(ticker, data_source) DO UPDATE SET \
                   price=excluded.price, currency=excluded.currency, \
                   change_pct_24h=excluded.change_pct_24h, change_abs_24h=excluded.change_abs_24h, \
                   market_cap=excluded.market_cap, volume_24h=excluded.volume_24h, \
                   last_fetched=excluded.last_fetched",
                params![
                    ticker,
                    data_source,
                    price.map(|v| v.to_string()),
                    currency,
                    change_pct_24h.map(|v| v.to_string()),
                    change_abs_24h.map(|v| v.to_string()),
                    market_cap.map(|v| v.to_string()),
                    volume_24h.map(|v| v.to_string()),
                    now,
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_quote(
        &self,
        ticker: &str,
        data_source: &str,
    ) -> Result<Option<QuoteCacheRow>, String> {
        self.conn
            .query_row(
                "SELECT ticker, data_source, price, currency, change_pct_24h, change_abs_24h, \
                        market_cap, volume_24h, last_fetched \
                 FROM quote_cache WHERE ticker=?1 AND data_source=?2",
                params![ticker, data_source],
                |row| {
                    let parse = |col: usize| -> rusqlite::Result<Option<f64>> {
                        let s: Option<String> = row.get(col)?;
                        Ok(s.and_then(|v| v.parse::<f64>().ok()))
                    };
                    Ok(QuoteCacheRow {
                        ticker: row.get(0)?,
                        data_source: row.get(1)?,
                        price: parse(2)?,
                        currency: row.get(3)?,
                        change_pct_24h: parse(4)?,
                        change_abs_24h: parse(5)?,
                        market_cap: parse(6)?,
                        volume_24h: parse(7)?,
                        last_fetched: row.get(8)?,
                    })
                },
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }

    // ──────── Price history ────────

    pub fn upsert_price_bars(
        &self,
        ticker: &str,
        data_source: &str,
        bars: &[crate::sources::yahoo::Bar],
    ) -> Result<(), String> {
        self.conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        let result: Result<(), String> = (|| {
            let mut stmt = self
                .conn
                .prepare(
                    "INSERT INTO price_history \
                       (ticker, data_source, bar_date, open, high, low, close, volume) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
                     ON CONFLICT(ticker, data_source, bar_date) DO UPDATE SET \
                       open=excluded.open, high=excluded.high, low=excluded.low, \
                       close=excluded.close, volume=excluded.volume",
                )
                .map_err(|e| e.to_string())?;
            for bar in bars {
                stmt.execute(params![
                    ticker,
                    data_source,
                    bar.date,
                    bar.open.map(|v| v.to_string()),
                    bar.high.map(|v| v.to_string()),
                    bar.low.map(|v| v.to_string()),
                    bar.close.map(|v| v.to_string()),
                    bar.volume.map(|v| v.to_string()),
                ])
                .map_err(|e| e.to_string())?;
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = self.conn.execute_batch("ROLLBACK");
            return result;
        }
        self.conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Close price at-or-before `target_date` for (ticker, data_source).
    /// Returns None if no bar on/before that date exists. Used by the tile
    /// range switch to compute 1W/1M/YTD/1Y pct-changes.
    pub fn close_at_or_before(
        &self,
        ticker: &str,
        data_source: &str,
        target_date: &str,
    ) -> Result<Option<f64>, String> {
        self.conn
            .query_row(
                "SELECT close FROM price_history \
                 WHERE ticker = ?1 AND data_source = ?2 AND bar_date <= ?3 \
                   AND close IS NOT NULL \
                 ORDER BY bar_date DESC LIMIT 1",
                params![ticker, data_source, target_date],
                |row| row.get::<_, Option<String>>(0),
            )
            .map(|opt_s| opt_s.and_then(|s| s.parse::<f64>().ok()))
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }

    pub fn latest_bar_date(
        &self,
        ticker: &str,
        data_source: &str,
    ) -> Result<Option<String>, String> {
        self.conn
            .query_row(
                "SELECT MAX(bar_date) FROM price_history WHERE ticker=?1 AND data_source=?2",
                params![ticker, data_source],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|e| e.to_string())
    }

    /// All bars for (ticker, data_source) as full OHLCV, ascending by date.
    /// Used by the candlestick feature chart and the indicator compute path.
    pub fn all_price_bars_ohlcv(
        &self,
        ticker: &str,
        data_source: &str,
    ) -> Result<Vec<crate::indicators::Bar>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT bar_date, open, high, low, close, volume FROM price_history \
                 WHERE ticker=?1 AND data_source=?2 AND close IS NOT NULL \
                 ORDER BY bar_date ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<crate::indicators::Bar> = stmt
            .query_map(params![ticker, data_source], |row| {
                let parse = |col: usize| -> rusqlite::Result<Option<f64>> {
                    let s: Option<String> = row.get(col)?;
                    Ok(s.and_then(|v| v.parse::<f64>().ok()))
                };
                Ok(crate::indicators::Bar {
                    date: row.get(0)?,
                    open: parse(1)?,
                    high: parse(2)?,
                    low: parse(3)?,
                    close: parse(4)?,
                    volume: parse(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    /// Distinct tickers that are candidates for Finnhub per-ticker news
    /// (M8). Filter: US equities only — Finnhub free tier is US-only.
    ///
    /// Negative whitelist: US Yahoo equity tickers never contain a `.`
    /// (class shares use `-`, e.g. `BRK-B`). Any ticker with a `.` is a
    /// foreign exchange suffix (`.TO`, `.SS`, `.HK`, `.DE`, `.L`, `.T`,
    /// `.KS`, `.AX`, `.SA`, `.PA`, etc.) or a futures contract (`=F`) and
    /// returns 403 from Finnhub free tier. We also drop indices (`^*`),
    /// futures (`*=F`), and crypto pairs (`*-USD`).
    ///
    /// A ticker can appear under multiple groups but we fetch news once
    /// per distinct symbol.
    pub fn list_finnhub_eligible_tickers(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT DISTINCT ticker FROM watchlist_tickers \
                 WHERE user_hidden = 0 AND enabled = 1 \
                   AND data_source = 'yahoo' \
                   AND ticker NOT LIKE '^%' \
                   AND ticker NOT LIKE '%=F' \
                   AND ticker NOT LIKE '%.%' \
                   AND ticker NOT LIKE '%-USD' \
                   AND ticker NOT LIKE 'DX-%' \
                 ORDER BY ticker",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    // ──────── News feeds + items (M7) ────────

    /// `enabled_only=true`  → fetcher path: only feeds the user wants polled.
    /// `enabled_only=false` → management/label-lookup path: returns disabled
    /// feeds too so the Settings UI can re-enable them.
    /// Both branches drop soft-deleted feeds (`user_hidden=1`). Items already
    /// stored from a now-hidden feed lose their feed_name in `list_news`'s
    /// label map — they age out within the 30-day retention window.
    pub fn list_news_feeds(&self, enabled_only: bool) -> Result<Vec<NewsFeedRow>, String> {
        let sql = if enabled_only {
            "SELECT id, source_type, url, display_name, category, refresh_minutes, last_fetched, enabled \
             FROM news_feeds WHERE enabled = 1 AND user_hidden = 0 ORDER BY display_name"
        } else {
            "SELECT id, source_type, url, display_name, category, refresh_minutes, last_fetched, enabled \
             FROM news_feeds WHERE user_hidden = 0 ORDER BY display_name"
        };
        let mut stmt = self.conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(NewsFeedRow {
                    id: row.get(0)?,
                    source_type: row.get(1)?,
                    url: row.get(2)?,
                    display_name: row.get(3)?,
                    category: row.get(4)?,
                    refresh_minutes: row.get(5)?,
                    last_fetched: row.get(6)?,
                    enabled: row.get::<_, i64>(7)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    }

    pub fn mark_feed_fetched(&self, feed_id: &str) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "UPDATE news_feeds SET last_fetched = ?1 WHERE id = ?2",
                params![now, feed_id],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Upsert a batch of news items from a single fetch. Returns the count of
    /// rows actually inserted (excludes items that already existed). Uses
    /// `INSERT OR IGNORE` on (source, external_id) — duplicate fetches no-op.
    pub fn upsert_news_items(
        &self,
        source: &str,
        feed_id: Option<&str>,
        ticker: Option<&str>,
        category: Option<&str>,
        items: &[crate::sources::news::NewsItem],
    ) -> Result<usize, String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;
        let result: Result<usize, String> = (|| {
            let mut stmt = self
                .conn
                .prepare(
                    "INSERT OR IGNORE INTO news_items \
                       (source, external_id, feed_id, ticker, category, \
                        headline, url, summary, published_at, fetched_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                )
                .map_err(|e| e.to_string())?;
            let mut inserted = 0usize;
            for item in items {
                let n = stmt
                    .execute(params![
                        source,
                        item.external_id,
                        feed_id,
                        ticker,
                        category,
                        item.headline,
                        item.url,
                        item.summary,
                        item.published_at,
                        now,
                    ])
                    .map_err(|e| e.to_string())?;
                inserted += n;
            }
            Ok(inserted)
        })();
        match result {
            Ok(n) => {
                self.conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
                Ok(n)
            }
            Err(e) => {
                let _ = self.conn.execute_batch("ROLLBACK");
                Err(e)
            }
        }
    }

    /// Read news items, optionally filtered by category chip. Ordered by
    /// published_at DESC (NULLs last), then fetched_at DESC as a fallback
    /// for items missing a publish timestamp.
    pub fn list_news_items(
        &self,
        category_filter: Option<&str>,
        limit: i64,
    ) -> Result<Vec<NewsItemRow>, String> {
        let (sql, filtered) = match category_filter {
            Some(_) => (
                "SELECT source, external_id, feed_id, ticker, category, headline, url, \
                        summary, published_at, fetched_at \
                 FROM news_items WHERE category = ?1 \
                 ORDER BY published_at IS NULL, published_at DESC, fetched_at DESC \
                 LIMIT ?2",
                true,
            ),
            None => (
                "SELECT source, external_id, feed_id, ticker, category, headline, url, \
                        summary, published_at, fetched_at \
                 FROM news_items \
                 ORDER BY published_at IS NULL, published_at DESC, fetched_at DESC \
                 LIMIT ?1",
                false,
            ),
        };
        let mut stmt = self.conn.prepare(sql).map_err(|e| e.to_string())?;
        let mut rows = if filtered {
            stmt.query(params![category_filter.unwrap(), limit])
                .map_err(|e| e.to_string())?
        } else {
            stmt.query(params![limit]).map_err(|e| e.to_string())?
        };
        let mut out = Vec::new();
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            out.push(NewsItemRow {
                source: row.get(0).map_err(|e| e.to_string())?,
                external_id: row.get(1).map_err(|e| e.to_string())?,
                feed_id: row.get(2).map_err(|e| e.to_string())?,
                ticker: row.get(3).map_err(|e| e.to_string())?,
                category: row.get(4).map_err(|e| e.to_string())?,
                headline: row.get(5).map_err(|e| e.to_string())?,
                url: row.get(6).map_err(|e| e.to_string())?,
                summary: row.get(7).map_err(|e| e.to_string())?,
                published_at: row.get(8).map_err(|e| e.to_string())?,
                fetched_at: row.get(9).map_err(|e| e.to_string())?,
            });
        }
        Ok(out)
    }

    /// Delete news items older than `older_than_days` (by `fetched_at`).
    /// Runs once on app boot to keep the table bounded.
    pub fn cleanup_old_news_items(&self, older_than_days: i64) -> Result<usize, String> {
        let cutoff = (chrono::Utc::now() - chrono::Duration::days(older_than_days)).to_rfc3339();
        let n = self
            .conn
            .execute(
                "DELETE FROM news_items WHERE fetched_at < ?1",
                params![cutoff],
            )
            .map_err(|e| e.to_string())?;
        Ok(n)
    }

    // ──────── Key-value config (session persistence) ────────

    pub fn get_config(&self, key: &str) -> Result<Option<String>, String> {
        self.conn
            .query_row(
                "SELECT value FROM config WHERE key = ?1",
                params![key],
                |row| row.get::<_, Option<String>>(0),
            )
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                _ => Err(e.to_string()),
            })
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO config (key, value) VALUES (?1, ?2) \
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                params![key, value],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Return all observations for a series (ascending by date), filtering out
    /// FRED's sentinel "." values. For the feature chart.
    pub fn all_fred_observations(
        &self,
        series_id: &str,
    ) -> Result<Vec<(String, f64)>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT obs_date, value FROM fred_observations \
                 WHERE series_id = ?1 AND value != '.' AND value != '' \
                 ORDER BY obs_date ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![series_id], |row| {
                let d: String = row.get(0)?;
                let v: String = row.get(1)?;
                Ok((d, v))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| {
                r.ok().and_then(|(d, v_str)| v_str.parse::<f64>().ok().map(|v| (d, v)))
            })
            .collect::<Vec<_>>();
        Ok(rows)
    }
}
