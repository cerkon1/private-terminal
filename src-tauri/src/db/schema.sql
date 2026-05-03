-- Personal Terminal — v1 schema
-- Extensibility-first: sectors / tickers / news feeds / indicators are data rows.
-- Values stored as TEXT for cache uniformity; parsed on read.

CREATE TABLE IF NOT EXISTS sector_groups (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT,
  display_name    TEXT NOT NULL,
  data_source     TEXT NOT NULL,
  display_order   INTEGER,
  enabled         INTEGER NOT NULL DEFAULT 1,
  -- M8: soft-delete flag. Seed runs on every boot and `INSERT OR IGNORE` would
  -- revive any row the user hard-deleted; we flip `user_hidden=1` instead and
  -- filter it out of list queries. Edited-in-place rows stay editable since
  -- seed `INSERT OR IGNORE` is a no-op when the row exists.
  user_hidden     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS watchlist_tickers (
  ticker            TEXT NOT NULL,
  sector_group_id   TEXT NOT NULL,
  data_source       TEXT NOT NULL,
  display_name      TEXT,
  display_currency  TEXT,
  display_order     INTEGER,
  enabled           INTEGER NOT NULL DEFAULT 1,
  user_hidden       INTEGER NOT NULL DEFAULT 0, -- M8 soft-delete, see above
  PRIMARY KEY (ticker, sector_group_id),
  FOREIGN KEY (sector_group_id) REFERENCES sector_groups(id)
);

-- FRED macro series metadata + observations
CREATE TABLE IF NOT EXISTS fred_series (
  series_id      TEXT PRIMARY KEY,
  title          TEXT,
  units          TEXT,
  frequency      TEXT,
  category       TEXT,
  last_fetched   TEXT,
  tile_visible   INTEGER NOT NULL DEFAULT 1   -- 0 = used by Analysis only (e.g. USREC for recession bars), hidden from MACRO dashboard
);

CREATE TABLE IF NOT EXISTS fred_observations (
  series_id      TEXT NOT NULL,
  obs_date       TEXT NOT NULL,
  value          TEXT NOT NULL,
  PRIMARY KEY (series_id, obs_date),
  FOREIGN KEY (series_id) REFERENCES fred_series(series_id)
);

CREATE INDEX IF NOT EXISTS idx_fred_obs_series_date
  ON fred_observations (series_id, obs_date DESC);

-- Unified quote cache for equity-like sources (Yahoo, CoinGecko, etc.)
-- keyed by (ticker, data_source). Numeric fields stored as TEXT for cache
-- uniformity; parsed on read. rust_decimal precision is reserved for the
-- quote-display path; indicator math uses f64.
CREATE TABLE IF NOT EXISTS quote_cache (
  ticker            TEXT NOT NULL,
  data_source       TEXT NOT NULL,
  price             TEXT,
  currency          TEXT,
  change_pct_24h    TEXT,
  change_abs_24h    TEXT,
  market_cap        TEXT,
  volume_24h        TEXT,
  sparkline_7d      TEXT,
  last_fetched      TEXT,
  -- Last fetch error for this (ticker, data_source). Persisted across
  -- sessions so bad symbols (HIVE.TO listed on TSXV not TSX, delisted
  -- equities, etc.) stay self-diagnosing without re-PRIMEing. Cleared
  -- on any successful fetch; written on corresponding failures (S22).
  last_fetch_error  TEXT,
  PRIMARY KEY (ticker, data_source)
);

-- OHLCV bars for the feature chart. Fetched on-demand (tile click) per series
-- with its own TTL; bars live here to avoid re-fetching history on every view.
CREATE TABLE IF NOT EXISTS price_history (
  ticker        TEXT NOT NULL,
  data_source   TEXT NOT NULL,
  bar_date      TEXT NOT NULL,
  open          TEXT,
  high          TEXT,
  low           TEXT,
  close         TEXT,
  volume        TEXT,
  PRIMARY KEY (ticker, data_source, bar_date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker_date
  ON price_history (ticker, data_source, bar_date DESC);

-- Indicator registry — one row per Rust Indicator impl. Adding a new
-- indicator = one Rust module + one seed row here.
CREATE TABLE IF NOT EXISTS indicators (
  id              TEXT PRIMARY KEY,
  display_name    TEXT,
  pane_hint       TEXT,              -- 'overlay' | 'subpane'
  default_params  TEXT,              -- JSON of defaults
  enabled         INTEGER NOT NULL DEFAULT 1
);

-- Per-ticker indicator toggle state. Default: absent = off.
CREATE TABLE IF NOT EXISTS indicator_settings (
  ticker          TEXT NOT NULL,
  indicator_id    TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 0,
  params_json     TEXT,
  PRIMARY KEY (ticker, indicator_id),
  FOREIGN KEY (indicator_id) REFERENCES indicators(id)
);

-- News feeds registry (M7). One row per pluggable source. Ticker-specific
-- news (Finnhub company-news) isn't represented here — it's computed from
-- watchlist_tickers at fetch time, so the edit-script changing the watchlist
-- automatically changes news coverage.
CREATE TABLE IF NOT EXISTS news_feeds (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,              -- 'rss' | 'finnhub'
  url             TEXT,                       -- RSS URL or Finnhub category keyword
  display_name    TEXT NOT NULL,
  category        TEXT,                       -- chip filter: 'world' | 'us' | 'canada' | 'central_bank'
  refresh_minutes INTEGER NOT NULL DEFAULT 15,
  last_fetched    TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  -- M8.5: soft-delete flag, mirrors sector_groups/watchlist_tickers. Seed
  -- runs on every boot and `INSERT OR IGNORE` would revive a row the user
  -- deleted; flipping `user_hidden=1` filters it from list queries instead.
  user_hidden     INTEGER NOT NULL DEFAULT 0
);

-- Unified news store (M7). Dedupe is keyed on (source, external_id) — RSS
-- items use <guid> (or sha256(link+pubDate) fallback), Finnhub uses its
-- numeric id. Repeat fetches INSERT OR IGNORE → duplicates no-op, new items
-- land. Retention cleanup on boot deletes items older than 30 days.
CREATE TABLE IF NOT EXISTS news_items (
  source          TEXT NOT NULL,              -- feed_id for general feeds; 'finnhub_ticker' for per-ticker
  external_id     TEXT NOT NULL,              -- stable id within the source
  feed_id         TEXT,                       -- FK into news_feeds (nullable for ticker news)
  ticker          TEXT,                       -- set for per-ticker news; NULL for general feeds
  category        TEXT,                       -- denormalised from feed.category for fast filter queries
  headline        TEXT NOT NULL,
  url             TEXT,
  summary         TEXT,
  published_at    TEXT,                       -- ISO 8601; may be NULL if feed omits
  fetched_at      TEXT NOT NULL,
  PRIMARY KEY (source, external_id),
  FOREIGN KEY (feed_id) REFERENCES news_feeds(id)
);

CREATE INDEX IF NOT EXISTS idx_news_items_published
  ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_category_published
  ON news_items (category, published_at DESC);

-- Key-value config (session persistence, prefs, last-run timestamps)
CREATE TABLE IF NOT EXISTS config (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- v1.1 Analysis tool registry. Mirrors the `indicators` table pattern: each
-- analysis tool ships as a Rust compute module + React component pair both
-- referencing the same `id`. The registry controls visibility / order /
-- default config — never code-loading.
CREATE TABLE IF NOT EXISTS analysis_tools (
  id              TEXT PRIMARY KEY,             -- 'correlation_matrix', 'yield_curve', ...
  display_name    TEXT NOT NULL,                -- 'Correlations', 'Yield Curve'
  scope           TEXT NOT NULL,                -- 'cross_asset' | 'macro' | 'sentiment'
  display_order   INTEGER NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  config_json     TEXT                          -- per-tool defaults (lookback days, benchmark ticker, quick-pick pairs, etc.)
);
