-- M2 seed: MACRO sector_group + all 18 FRED series with categories.
-- Title/units/frequency are overwritten on first fetch from the FRED API;
-- the stubs here are discovery placeholders so the dashboard renders on
-- first boot before any fetch completes.
--
-- Category values drive the dashboard's tab grouping. They are the source
-- of truth — UI tabs are derived from the distinct categories in this table.

-- Sidebar sections. enabled=0 = placeholder (rendered greyed out).
-- Flip enabled=1 when the section's milestone lands.
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('scanner',      NULL, 'SCANNER',      'virtual',   0, 1),
  ('macro',        NULL, 'MACRO',        'fred',      1, 1),
  ('indices',      NULL, 'INDICES',      'yahoo',     2, 1),
  ('crypto',       NULL, 'CRYPTO',       'coingecko', 3, 0),
  ('us_equities',  NULL, 'US EQUITIES',  'yahoo',     4, 1),
  ('ca_equities',  NULL, 'CA EQUITIES',  'yahoo',     5, 1),
  ('futures_fx',   NULL, 'FUTURES & FX', 'yahoo',     6, 0),
  ('news',         NULL, 'NEWS',         'mixed',     7, 0);

-- Flip sector_groups to enabled=1 when a milestone lands. INSERT OR IGNORE
-- above leaves existing rows' `enabled` unchanged, so we UPDATE explicitly.
UPDATE sector_groups SET enabled = 1 WHERE id IN ('ca_equities', 'crypto', 'futures_fx', 'news');

-- Keep sidebar display_order current when rows are inserted (previous seeds
-- stored these values; INSERT OR IGNORE won't refresh them).
UPDATE sector_groups SET display_order = 0 WHERE id = 'scanner';
UPDATE sector_groups SET display_order = 1 WHERE id = 'macro';
UPDATE sector_groups SET display_order = 2 WHERE id = 'indices';
UPDATE sector_groups SET display_order = 3 WHERE id = 'crypto';
UPDATE sector_groups SET display_order = 4 WHERE id = 'us_equities';
UPDATE sector_groups SET display_order = 5 WHERE id = 'ca_equities';
UPDATE sector_groups SET display_order = 6 WHERE id = 'futures_fx';
UPDATE sector_groups SET display_order = 7 WHERE id = 'news';

-- Indicator registry — each row mirrors a Rust Indicator impl. Adding a new
-- indicator = one Rust module + one row here.
--
-- Rename (S7): the quad-SMMA regime indicator was originally seeded as
-- 'larsson' / 'Larsson Line' but the math is derivative of public community
-- work (basnijholt gist), so we renamed to 'smma_ribbon'. These statements
-- cascade-clear the old rows on existing DBs before inserting the new one.
DELETE FROM indicator_settings WHERE indicator_id = 'larsson';
DELETE FROM indicators WHERE id = 'larsson';

INSERT OR IGNORE INTO indicators (id, display_name, pane_hint, default_params, enabled) VALUES
  ('smma_ribbon', 'SMMA Ribbon', 'overlay', '{"lengths":[15,19,25,29],"confirm_bars":3}', 1),
  ('rsi_14',      'RSI (14)',    'subpane', '{"length":14}',                               1),
  ('atr_14',      'ATR (14)',    'subpane', '{"length":14}',                               1);

-- CA EQUITIES sub-sectors (parent_id='ca_equities'). display_order within the
-- parent drives their rendering order in the sidebar tree.
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('ca_energy',        'ca_equities', 'Energy',        'yahoo', 0, 1),
  ('ca_banking',       'ca_equities', 'Banking',       'yahoo', 1, 1),
  ('ca_telecom',       'ca_equities', 'Telecom',       'yahoo', 2, 1),
  ('ca_crypto_miners', 'ca_equities', 'Crypto Miners', 'yahoo', 3, 1),
  ('ca_metal_miners',  'ca_equities', 'Metal Miners',  'yahoo', 4, 1);

-- INDICES — 15 world majors, local currency (no FX conversion).
INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('^GSPC',     'indices', 'yahoo', 'S&P 500',        'USD',  0, 1),
  ('^DJI',      'indices', 'yahoo', 'Dow Jones',      'USD',  1, 1),
  ('^IXIC',     'indices', 'yahoo', 'Nasdaq Composite','USD', 2, 1),
  ('^RUT',      'indices', 'yahoo', 'Russell 2000',   'USD',  3, 1),
  ('^GSPTSE',   'indices', 'yahoo', 'TSX Composite',  'CAD',  4, 1),
  ('^BVSP',     'indices', 'yahoo', 'Bovespa',        'BRL',  5, 1),
  ('^FTSE',     'indices', 'yahoo', 'FTSE 100',       'GBP',  6, 1),
  ('^GDAXI',    'indices', 'yahoo', 'DAX',            'EUR',  7, 1),
  ('^FCHI',     'indices', 'yahoo', 'CAC 40',         'EUR',  8, 1),
  ('^STOXX50E', 'indices', 'yahoo', 'Euro Stoxx 50',  'EUR',  9, 1),
  ('^N225',     'indices', 'yahoo', 'Nikkei 225',     'JPY', 10, 1),
  ('^HSI',      'indices', 'yahoo', 'Hang Seng',      'HKD', 11, 1),
  ('000001.SS', 'indices', 'yahoo', 'Shanghai Comp.', 'CNY', 12, 1),
  ('^AXJO',     'indices', 'yahoo', 'ASX 200',        'AUD', 13, 1),
  ('^KS11',     'indices', 'yahoo', 'KOSPI',          'KRW', 14, 1);

-- US EQUITIES — top 10 mega-caps.
INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('AAPL',  'us_equities', 'yahoo', 'Apple',            'USD', 0, 1),
  ('MSFT',  'us_equities', 'yahoo', 'Microsoft',        'USD', 1, 1),
  ('NVDA',  'us_equities', 'yahoo', 'NVIDIA',           'USD', 2, 1),
  ('GOOGL', 'us_equities', 'yahoo', 'Alphabet',         'USD', 3, 1),
  ('AMZN',  'us_equities', 'yahoo', 'Amazon',           'USD', 4, 1),
  ('META',  'us_equities', 'yahoo', 'Meta Platforms',   'USD', 5, 1),
  ('BRK-B', 'us_equities', 'yahoo', 'Berkshire B',      'USD', 6, 1),
  ('TSLA',  'us_equities', 'yahoo', 'Tesla',            'USD', 7, 1),
  ('AVGO',  'us_equities', 'yahoo', 'Broadcom',         'USD', 8, 1),
  ('JPM',   'us_equities', 'yahoo', 'JPMorgan Chase',   'USD', 9, 1);

-- CA EQUITIES — per DESIGN.md. TSX tickers use .TO suffix; GLXY/WULF are
-- listed on NASDAQ (US) and priced in USD per the original ticker decisions.
INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  -- Energy
  ('CNQ.TO', 'ca_energy', 'yahoo', 'Canadian Natural Resources', 'CAD', 0, 1),
  ('SU.TO',  'ca_energy', 'yahoo', 'Suncor Energy',              'CAD', 1, 1),
  ('ENB.TO', 'ca_energy', 'yahoo', 'Enbridge',                   'CAD', 2, 1),
  ('TRP.TO', 'ca_energy', 'yahoo', 'TC Energy',                  'CAD', 3, 1),
  ('CVE.TO', 'ca_energy', 'yahoo', 'Cenovus Energy',             'CAD', 4, 1),
  ('IMO.TO', 'ca_energy', 'yahoo', 'Imperial Oil',               'CAD', 5, 1),
  ('TOU.TO', 'ca_energy', 'yahoo', 'Tourmaline Oil',             'CAD', 6, 1),

  -- Banking (Big 6)
  ('RY.TO',  'ca_banking', 'yahoo', 'Royal Bank of Canada',      'CAD', 0, 1),
  ('TD.TO',  'ca_banking', 'yahoo', 'TD Bank',                   'CAD', 1, 1),
  ('BNS.TO', 'ca_banking', 'yahoo', 'Bank of Nova Scotia',       'CAD', 2, 1),
  ('BMO.TO', 'ca_banking', 'yahoo', 'Bank of Montreal',          'CAD', 3, 1),
  ('CM.TO',  'ca_banking', 'yahoo', 'CIBC',                      'CAD', 4, 1),
  ('NA.TO',  'ca_banking', 'yahoo', 'National Bank',             'CAD', 5, 1),

  -- Telecom (Big 4)
  ('BCE.TO',    'ca_telecom', 'yahoo', 'BCE',            'CAD', 0, 1),
  ('T.TO',      'ca_telecom', 'yahoo', 'Telus',          'CAD', 1, 1),
  ('RCI-B.TO',  'ca_telecom', 'yahoo', 'Rogers',         'CAD', 2, 1),
  ('QBR-B.TO',  'ca_telecom', 'yahoo', 'Quebecor',       'CAD', 3, 1),

  -- Crypto Miners (mixed CA + US listings)
  ('HUT.TO',  'ca_crypto_miners', 'yahoo', 'Hut 8 Mining',    'CAD', 0, 1),
  ('BITF.TO', 'ca_crypto_miners', 'yahoo', 'Bitfarms',        'CAD', 1, 1),
  ('HIVE.TO', 'ca_crypto_miners', 'yahoo', 'HIVE Digital',    'CAD', 2, 1),
  ('GLXY',    'ca_crypto_miners', 'yahoo', 'Galaxy Digital',  'USD', 3, 1),
  ('WULF',    'ca_crypto_miners', 'yahoo', 'TeraWulf',        'USD', 4, 1),

  -- Metal Miners
  ('ABX.TO',   'ca_metal_miners', 'yahoo', 'Barrick Gold',    'CAD', 0, 1),
  ('AEM.TO',   'ca_metal_miners', 'yahoo', 'Agnico Eagle',    'CAD', 1, 1),
  ('FNV.TO',   'ca_metal_miners', 'yahoo', 'Franco-Nevada',   'CAD', 2, 1),
  ('K.TO',     'ca_metal_miners', 'yahoo', 'Kinross Gold',    'CAD', 3, 1),
  ('WPM.TO',   'ca_metal_miners', 'yahoo', 'Wheaton Precious','CAD', 4, 1),
  ('TECK-B.TO','ca_metal_miners', 'yahoo', 'Teck Resources',  'CAD', 5, 1),
  ('FM.TO',    'ca_metal_miners', 'yahoo', 'First Quantum',   'CAD', 6, 1),
  ('IVN.TO',   'ca_metal_miners', 'yahoo', 'Ivanhoe Mines',   'CAD', 7, 1),
  ('HBM.TO',   'ca_metal_miners', 'yahoo', 'Hudbay Minerals', 'CAD', 8, 1);

-- CRYPTO — top 10 by market cap (fixed list; dynamic discovery deferred per
-- memory/m5_crypto_futures_decisions.md). Yahoo crypto pairs (BTC-USD etc.)
-- for both quote and history — CoinGecko integration deferred.
INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('BTC-USD',  'crypto', 'yahoo', 'Bitcoin',    'USD', 0, 1),
  ('ETH-USD',  'crypto', 'yahoo', 'Ethereum',   'USD', 1, 1),
  ('USDT-USD', 'crypto', 'yahoo', 'Tether',     'USD', 2, 1),
  ('BNB-USD',  'crypto', 'yahoo', 'BNB',        'USD', 3, 1),
  ('SOL-USD',  'crypto', 'yahoo', 'Solana',     'USD', 4, 1),
  ('XRP-USD',  'crypto', 'yahoo', 'XRP',        'USD', 5, 1),
  ('USDC-USD', 'crypto', 'yahoo', 'USD Coin',   'USD', 6, 1),
  ('ADA-USD',  'crypto', 'yahoo', 'Cardano',    'USD', 7, 1),
  ('DOGE-USD', 'crypto', 'yahoo', 'Dogecoin',   'USD', 8, 1),
  ('TRX-USD',  'crypto', 'yahoo', 'TRON',       'USD', 9, 1);

-- FUTURES & FX — 5 commodity front-month futures + US Dollar Index.
INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('CL=F',      'futures_fx', 'yahoo', 'Crude Oil (WTI)',     'USD', 0, 1),
  ('GC=F',      'futures_fx', 'yahoo', 'Gold',                'USD', 1, 1),
  ('SI=F',      'futures_fx', 'yahoo', 'Silver',              'USD', 2, 1),
  ('NG=F',      'futures_fx', 'yahoo', 'Natural Gas',         'USD', 3, 1),
  ('HG=F',      'futures_fx', 'yahoo', 'Copper',              'USD', 4, 1),
  ('DX-Y.NYB',  'futures_fx', 'yahoo', 'US Dollar Index',     'USD', 5, 1);

-- NEWS feeds (M7). Mix of world wire + US + Canadian + central-bank primary
-- sources. `category` drives the filter chips in NewsDashboard. Finnhub feed
-- is included but skipped at fetch time when FINNHUB_API_KEY is absent.
--
-- Feed migrations:
-- - `bnnbloomberg.ca/feed` returned 404 on first smoke test (site rebranded);
--   swapped to CBC Business. Cascade-clear dead rows + orphan items.
-- - `finnhub_general` — enabled now that FINNHUB_API_KEY is set in .env (S8 end).
--   If a future user runs without a key, the fetcher emits a friendly error
--   message but doesn't crash — UX acceptable.
DELETE FROM news_items WHERE feed_id = 'bnn_bloomberg';
DELETE FROM news_feeds WHERE id = 'bnn_bloomberg';
UPDATE news_feeds SET enabled = 1 WHERE id = 'finnhub_general';

INSERT OR IGNORE INTO news_feeds (id, source_type, url, display_name, category, refresh_minutes, enabled) VALUES
  ('bbc_business',     'rss',     'https://feeds.bbci.co.uk/news/business/rss.xml',                       'BBC Business',        'world',        30, 1),
  ('bbc_middleeast',   'rss',     'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',              'BBC Middle East',     'world',        30, 1),
  ('aljazeera',        'rss',     'https://www.aljazeera.com/xml/rss/all.xml',                             'Al Jazeera',          'world',        30, 1),
  ('cnbc_top',         'rss',     'https://www.cnbc.com/id/100003114/device/rss/rss.html',                 'CNBC Top News',       'us',           15, 1),
  ('financial_post',   'rss',     'https://financialpost.com/feed/',                                        'Financial Post',      'canada',       30, 1),
  ('cbc_business',     'rss',     'https://www.cbc.ca/webfeed/rss/rss-business',                            'CBC Business',        'canada',       30, 1),
  ('fed_press',        'rss',     'https://www.federalreserve.gov/feeds/press_all.xml',                     'Fed Press Releases',  'central_bank', 60, 1),
  ('boc_press',        'rss',     'https://www.bankofcanada.ca/content_type/press-releases/feed/',          'Bank of Canada',      'central_bank', 60, 1),
  ('finnhub_general',  'finnhub', 'general',                                                                'Finnhub Market News', 'us',           15, 0);

INSERT OR IGNORE INTO fred_series (series_id, title, units, frequency, category) VALUES
  -- Rates
  ('FEDFUNDS',            'Federal Funds Effective Rate',                                 'Percent',  'Monthly',   'Rates'),
  ('DGS10',               '10-Year Treasury Constant Maturity Rate',                      'Percent',  'Daily',     'Rates'),
  ('T10Y2Y',              '10Y–2Y Treasury Spread',                                       'Percent',  'Daily',     'Rates'),
  ('T10YIE',              '10Y Breakeven Inflation Rate',                                 'Percent',  'Daily',     'Rates'),
  ('DFII10',              '10Y Real Yield (TIPS)',                                        'Percent',  'Daily',     'Rates'),

  -- Inflation
  ('CPIAUCSL',            'CPI for All Urban Consumers',                                  'Index',    'Monthly',   'Inflation'),
  ('PCEPILFE',            'Core PCE Price Index',                                         'Index',    'Monthly',   'Inflation'),
  ('PPIACO',              'Producer Price Index — All Commodities',                       'Index',    'Monthly',   'Inflation'),

  -- Labor
  ('UNRATE',              'Unemployment Rate',                                            'Percent',  'Monthly',   'Labor'),
  ('PAYEMS',              'Nonfarm Payrolls',                                             'Thousands','Monthly',   'Labor'),
  ('ICSA',                'Initial Jobless Claims',                                       'Number',   'Weekly',    'Labor'),
  ('JTSJOL',              'Job Openings (JOLTS)',                                         'Thousands','Monthly',   'Labor'),

  -- Growth
  ('A191RL1Q225SBEA',     'Real GDP QoQ Annualized',                                      'Percent',  'Quarterly', 'Growth'),
  ('INDPRO',              'Industrial Production Index',                                  'Index',    'Monthly',   'Growth'),

  -- Consumer
  ('RSXFS',               'Retail Sales (Ex. Food Services)',                             'Millions', 'Monthly',   'Consumer'),
  ('UMCSENT',             'UMich Consumer Sentiment',                                     'Index',    'Monthly',   'Consumer'),

  -- Housing
  ('HOUST',               'Housing Starts',                                               'Thousands','Monthly',   'Housing'),
  ('EXHOSLUSM495S',       'Existing Home Sales',                                          'Number',   'Monthly',   'Housing'),

  -- Analysis-only (v1.1) — not shown on MACRO dashboard
  ('USREC',               'NBER-based Recession Indicator',                               'Binary',   'Monthly',   'Recession'),
  -- Yield-curve tenors (v1.1) — DGS10 already a MACRO tile; the rest are Analysis-only
  ('DGS3MO',              '3-Month Treasury Constant Maturity Rate',                      'Percent',  'Daily',     'Rates'),
  ('DGS2',                '2-Year Treasury Constant Maturity Rate',                       'Percent',  'Daily',     'Rates'),
  ('DGS5',                '5-Year Treasury Constant Maturity Rate',                       'Percent',  'Daily',     'Rates'),
  ('DGS30',               '30-Year Treasury Constant Maturity Rate',                      'Percent',  'Daily',     'Rates');

-- v1.1 Analysis-only series. Idempotent on every boot — covers fresh installs
-- (seeded with DEFAULT 1, then flipped here) and pre-v1.1 DB upgrades.
UPDATE fred_series SET tile_visible = 0 WHERE series_id IN ('USREC', 'DGS3MO', 'DGS2', 'DGS5', 'DGS30');

-- v1.1 Analysis tool registry — Phase 1 ships Correlations + Yield Curve.
-- Phase 2/3/4 tools land via additional INSERT OR IGNORE rows; never re-key existing ids.
INSERT OR IGNORE INTO analysis_tools (id, display_name, scope, display_order, enabled, config_json) VALUES
  ('correlation_matrix', 'Correlations', 'cross_asset', 1, 1, NULL),
  ('yield_curve',        'Yield Curve',  'macro',       2, 1, NULL);
