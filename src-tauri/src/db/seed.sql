-- v1.2 reformulated seed (S20). Symmetric US/CA sub-sectors, expanded
-- coverage, WATCHLIST top-level for personal additions, COMMODITIES + FX
-- + BONDS & RATES + VIX & RISK as new top-level groups.
--
-- Design rationale + decision log: see
-- `.projects/03_cross_section_heatmap/database_expansion.md`.
--
-- This seed is written for fresh-DB use. Upgrading from a pre-v1.2 DB via
-- INSERT OR IGNORE leaves orphan rows (the old `futures_fx` group with its
-- 6 tickers, USDT/USDC/BRK-B that have been dropped, GLXY/WULF still under
-- ca_crypto_miners). Recommended path: full DB reset per the workflow in
-- the design doc.
--
-- Title/units/frequency on FRED rows are discovery placeholders overwritten
-- on first fetch from the FRED API.
--
-- Category values drive the MACRO dashboard's tab grouping. They are the
-- source of truth — UI tabs are derived from the distinct categories here.

-- ──────────────────────────────────────────────────────────────────────
-- Idempotent cleanup (Larsson rename S7, BNN Bloomberg dead-feed S8)
-- ──────────────────────────────────────────────────────────────────────

DELETE FROM indicator_settings WHERE indicator_id = 'larsson';
DELETE FROM indicators WHERE id = 'larsson';

DELETE FROM news_items WHERE feed_id = 'bnn_bloomberg';
DELETE FROM news_feeds WHERE id = 'bnn_bloomberg';
UPDATE news_feeds SET enabled = 1 WHERE id = 'finnhub_general';

-- ──────────────────────────────────────────────────────────────────────
-- Sector groups — sidebar tree
-- ──────────────────────────────────────────────────────────────────────

-- Pinned top-level (display_order 0-4). Order is array-driven by the
-- frontend PINNED_IDS but display_order is set here for Manage Watchlist
-- consistency.
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('pulse',    NULL, 'PULSE',    'virtual', 0, 1),
  ('analysis', NULL, 'ANALYSIS', 'virtual', 2, 1),
  ('macro',    NULL, 'MACRO',    'fred',    3, 1),
  ('news',     NULL, 'NEWS',     'mixed',   4, 1);

-- SCANNER deprecated S21 — Pulse subsumes its analytical content; PRIME
-- moved into the Pulse banner. Soft-delete on existing DBs that still
-- carry the row from prior installs (and from the S20 INSERT above that
-- we just removed). user_hidden=1 hides it from list_sector_groups
-- queries so it disappears from the sidebar without dropping data.
UPDATE sector_groups SET user_hidden = 1 WHERE id = 'scanner';

-- User-managed top-level (display_order 5+). WATCHLIST sits at the top
-- of the user-managed section as the personal-additions slot — seeded
-- with no tickers so users see the affordance immediately.
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('watchlist',   NULL, 'WATCHLIST',     'mixed',   5,  1),
  ('indices',     NULL, 'INDICES',       'yahoo',   6,  1),
  ('us_equities', NULL, 'US EQUITIES',   'yahoo',   7,  1),
  ('ca_equities', NULL, 'CA EQUITIES',   'yahoo',   8,  1),
  ('crypto',      NULL, 'CRYPTO',        'yahoo',   9,  1),
  ('commodities', NULL, 'COMMODITIES',   'yahoo',   10, 1),
  ('fx',          NULL, 'FX',            'yahoo',   11, 1),
  ('bonds_rates', NULL, 'BONDS & RATES', 'yahoo',   12, 1),
  ('vix_risk',    NULL, 'VIX & RISK',    'yahoo',   13, 1);

-- INDICES sub-sectors (3 regions)
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('indices_americas', 'indices', 'Americas',     'yahoo', 0, 1),
  ('indices_europe',   'indices', 'Europe',       'yahoo', 1, 1),
  ('indices_apac',     'indices', 'Asia-Pacific', 'yahoo', 2, 1);

-- US EQUITIES sub-sectors (10) — mirrors CA EQUITIES structure
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('us_tech',          'us_equities', 'Tech',             'yahoo', 0, 1),
  ('us_banking',       'us_equities', 'Banking',          'yahoo', 1, 1),
  ('us_energy',        'us_equities', 'Energy',           'yahoo', 2, 1),
  ('us_telecom',       'us_equities', 'Telecom',          'yahoo', 3, 1),
  ('us_crypto_miners', 'us_equities', 'Crypto Miners',    'yahoo', 4, 1),
  ('us_metal_miners',  'us_equities', 'Metal Miners',     'yahoo', 5, 1),
  ('us_healthcare',    'us_equities', 'Healthcare',       'yahoo', 6, 1),
  ('us_staples',       'us_equities', 'Consumer Staples', 'yahoo', 7, 1),
  ('us_utilities',     'us_equities', 'Utilities',        'yahoo', 8, 1),
  ('us_reits',         'us_equities', 'REITs',            'yahoo', 9, 1);

-- CA EQUITIES sub-sectors (10) — mirrors US EQUITIES structure
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('ca_tech',          'ca_equities', 'Tech',             'yahoo', 0, 1),
  ('ca_banking',       'ca_equities', 'Banking',          'yahoo', 1, 1),
  ('ca_energy',        'ca_equities', 'Energy',           'yahoo', 2, 1),
  ('ca_telecom',       'ca_equities', 'Telecom',          'yahoo', 3, 1),
  ('ca_crypto_miners', 'ca_equities', 'Crypto Miners',    'yahoo', 4, 1),
  ('ca_metal_miners',  'ca_equities', 'Metal Miners',     'yahoo', 5, 1),
  ('ca_healthcare',    'ca_equities', 'Healthcare',       'yahoo', 6, 1),
  ('ca_staples',       'ca_equities', 'Consumer Staples', 'yahoo', 7, 1),
  ('ca_utilities',     'ca_equities', 'Utilities',        'yahoo', 8, 1),
  ('ca_reits',         'ca_equities', 'REITs',            'yahoo', 9, 1);

-- COMMODITIES sub-sectors (3)
INSERT OR IGNORE INTO sector_groups (id, parent_id, display_name, data_source, display_order, enabled) VALUES
  ('comm_energy',        'commodities', 'Energy',        'yahoo', 0, 1),
  ('comm_metals',        'commodities', 'Metals',        'yahoo', 1, 1),
  ('comm_agriculturals', 'commodities', 'Agriculturals', 'yahoo', 2, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Indicator registry — each row mirrors a Rust Indicator impl.
-- Adding a new indicator = one Rust module + one row here.
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO indicators (id, display_name, pane_hint, default_params, enabled) VALUES
  ('smma_ribbon', 'SMMA Ribbon', 'overlay', '{"lengths":[15,19,25,29],"confirm_bars":3}', 1),
  ('rsi_14',      'RSI (14)',    'subpane', '{"length":14}',                               1),
  ('atr_14',      'ATR (14)',    'subpane', '{"length":14}',                               1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — INDICES (15, regrouped by region)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  -- Americas
  ('^GSPC',     'indices_americas', 'yahoo', 'S&P 500',         'USD', 0, 1),
  ('^DJI',      'indices_americas', 'yahoo', 'Dow Jones',       'USD', 1, 1),
  ('^IXIC',     'indices_americas', 'yahoo', 'Nasdaq Composite','USD', 2, 1),
  ('^RUT',      'indices_americas', 'yahoo', 'Russell 2000',    'USD', 3, 1),
  ('^GSPTSE',   'indices_americas', 'yahoo', 'TSX Composite',   'CAD', 4, 1),
  ('^BVSP',     'indices_americas', 'yahoo', 'Bovespa',         'BRL', 5, 1),
  -- Europe
  ('^FTSE',     'indices_europe', 'yahoo', 'FTSE 100',          'GBP', 0, 1),
  ('^GDAXI',    'indices_europe', 'yahoo', 'DAX',               'EUR', 1, 1),
  ('^FCHI',     'indices_europe', 'yahoo', 'CAC 40',            'EUR', 2, 1),
  ('^STOXX50E', 'indices_europe', 'yahoo', 'Euro Stoxx 50',     'EUR', 3, 1),
  -- Asia-Pacific
  ('^N225',     'indices_apac', 'yahoo', 'Nikkei 225',          'JPY', 0, 1),
  ('^HSI',      'indices_apac', 'yahoo', 'Hang Seng',           'HKD', 1, 1),
  ('000001.SS', 'indices_apac', 'yahoo', 'Shanghai Comp.',      'CNY', 2, 1),
  ('^AXJO',     'indices_apac', 'yahoo', 'ASX 200',             'AUD', 3, 1),
  ('^KS11',     'indices_apac', 'yahoo', 'KOSPI',               'KRW', 4, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — US EQUITIES (66 across 10 sub-sectors)
-- BRK-B dropped per S20 decision (conglomerate doesn't fit any sub-sector).
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  -- Tech
  ('AAPL',  'us_tech', 'yahoo', 'Apple',            'USD', 0, 1),
  ('MSFT',  'us_tech', 'yahoo', 'Microsoft',        'USD', 1, 1),
  ('NVDA',  'us_tech', 'yahoo', 'NVIDIA',           'USD', 2, 1),
  ('GOOGL', 'us_tech', 'yahoo', 'Alphabet',         'USD', 3, 1),
  ('AMZN',  'us_tech', 'yahoo', 'Amazon',           'USD', 4, 1),
  ('META',  'us_tech', 'yahoo', 'Meta Platforms',   'USD', 5, 1),
  ('AVGO',  'us_tech', 'yahoo', 'Broadcom',         'USD', 6, 1),
  ('TSLA',  'us_tech', 'yahoo', 'Tesla',            'USD', 7, 1),
  -- Banking (Big US banks)
  ('JPM', 'us_banking', 'yahoo', 'JPMorgan Chase',  'USD', 0, 1),
  ('BAC', 'us_banking', 'yahoo', 'Bank of America', 'USD', 1, 1),
  ('WFC', 'us_banking', 'yahoo', 'Wells Fargo',     'USD', 2, 1),
  ('C',   'us_banking', 'yahoo', 'Citigroup',       'USD', 3, 1),
  ('GS',  'us_banking', 'yahoo', 'Goldman Sachs',   'USD', 4, 1),
  ('MS',  'us_banking', 'yahoo', 'Morgan Stanley',  'USD', 5, 1),
  ('USB', 'us_banking', 'yahoo', 'U.S. Bancorp',    'USD', 6, 1),
  ('PNC', 'us_banking', 'yahoo', 'PNC Financial',   'USD', 7, 1),
  -- Energy
  ('XOM', 'us_energy', 'yahoo', 'ExxonMobil',           'USD', 0, 1),
  ('CVX', 'us_energy', 'yahoo', 'Chevron',              'USD', 1, 1),
  ('COP', 'us_energy', 'yahoo', 'ConocoPhillips',       'USD', 2, 1),
  ('EOG', 'us_energy', 'yahoo', 'EOG Resources',        'USD', 3, 1),
  ('OXY', 'us_energy', 'yahoo', 'Occidental Petroleum', 'USD', 4, 1),
  ('MPC', 'us_energy', 'yahoo', 'Marathon Petroleum',   'USD', 5, 1),
  ('PSX', 'us_energy', 'yahoo', 'Phillips 66',          'USD', 6, 1),
  -- Telecom (3 majors — accept asymmetry vs CA's 4)
  ('T',    'us_telecom', 'yahoo', 'AT&T',         'USD', 0, 1),
  ('VZ',   'us_telecom', 'yahoo', 'Verizon',      'USD', 1, 1),
  ('TMUS', 'us_telecom', 'yahoo', 'T-Mobile US',  'USD', 2, 1),
  -- Crypto Miners (GLXY + WULF moved here from CA per S20 decision)
  ('MARA', 'us_crypto_miners', 'yahoo', 'Marathon Digital', 'USD', 0, 1),
  ('RIOT', 'us_crypto_miners', 'yahoo', 'Riot Platforms',   'USD', 1, 1),
  ('CLSK', 'us_crypto_miners', 'yahoo', 'CleanSpark',       'USD', 2, 1),
  ('CIFR', 'us_crypto_miners', 'yahoo', 'Cipher Mining',    'USD', 3, 1),
  ('CORZ', 'us_crypto_miners', 'yahoo', 'Core Scientific',  'USD', 4, 1),
  ('GLXY', 'us_crypto_miners', 'yahoo', 'Galaxy Digital',   'USD', 5, 1),
  ('WULF', 'us_crypto_miners', 'yahoo', 'TeraWulf',         'USD', 6, 1),
  -- Metal Miners
  ('NEM',  'us_metal_miners', 'yahoo', 'Newmont',          'USD', 0, 1),
  ('FCX',  'us_metal_miners', 'yahoo', 'Freeport-McMoRan', 'USD', 1, 1),
  ('GOLD', 'us_metal_miners', 'yahoo', 'Barrick Gold',     'USD', 2, 1),
  ('CCJ',  'us_metal_miners', 'yahoo', 'Cameco',           'USD', 3, 1),
  ('SCCO', 'us_metal_miners', 'yahoo', 'Southern Copper',  'USD', 4, 1),
  ('MOS',  'us_metal_miners', 'yahoo', 'Mosaic',           'USD', 5, 1),
  ('AA',   'us_metal_miners', 'yahoo', 'Alcoa',            'USD', 6, 1),
  -- Healthcare
  ('UNH',  'us_healthcare', 'yahoo', 'UnitedHealth',         'USD', 0, 1),
  ('JNJ',  'us_healthcare', 'yahoo', 'Johnson & Johnson',    'USD', 1, 1),
  ('LLY',  'us_healthcare', 'yahoo', 'Eli Lilly',            'USD', 2, 1),
  ('PFE',  'us_healthcare', 'yahoo', 'Pfizer',               'USD', 3, 1),
  ('ABBV', 'us_healthcare', 'yahoo', 'AbbVie',               'USD', 4, 1),
  ('MRK',  'us_healthcare', 'yahoo', 'Merck',                'USD', 5, 1),
  ('TMO',  'us_healthcare', 'yahoo', 'Thermo Fisher',        'USD', 6, 1),
  ('ABT',  'us_healthcare', 'yahoo', 'Abbott Laboratories',  'USD', 7, 1),
  -- Consumer Staples
  ('PG',   'us_staples', 'yahoo', 'Procter & Gamble', 'USD', 0, 1),
  ('WMT',  'us_staples', 'yahoo', 'Walmart',          'USD', 1, 1),
  ('COST', 'us_staples', 'yahoo', 'Costco',           'USD', 2, 1),
  ('KO',   'us_staples', 'yahoo', 'Coca-Cola',        'USD', 3, 1),
  ('PEP',  'us_staples', 'yahoo', 'PepsiCo',          'USD', 4, 1),
  ('MDLZ', 'us_staples', 'yahoo', 'Mondelez',         'USD', 5, 1),
  ('MO',   'us_staples', 'yahoo', 'Altria',           'USD', 6, 1),
  -- Utilities
  ('NEE', 'us_utilities', 'yahoo', 'NextEra Energy',          'USD', 0, 1),
  ('DUK', 'us_utilities', 'yahoo', 'Duke Energy',             'USD', 1, 1),
  ('SO',  'us_utilities', 'yahoo', 'Southern Company',        'USD', 2, 1),
  ('AEP', 'us_utilities', 'yahoo', 'American Electric Power', 'USD', 3, 1),
  ('D',   'us_utilities', 'yahoo', 'Dominion Energy',         'USD', 4, 1),
  ('XEL', 'us_utilities', 'yahoo', 'Xcel Energy',             'USD', 5, 1),
  ('EXC', 'us_utilities', 'yahoo', 'Exelon',                  'USD', 6, 1),
  -- REITs
  ('AMT',  'us_reits', 'yahoo', 'American Tower',  'USD', 0, 1),
  ('PLD',  'us_reits', 'yahoo', 'Prologis',        'USD', 1, 1),
  ('EQIX', 'us_reits', 'yahoo', 'Equinix',         'USD', 2, 1),
  ('CCI',  'us_reits', 'yahoo', 'Crown Castle',    'USD', 3, 1),
  ('O',    'us_reits', 'yahoo', 'Realty Income',   'USD', 4, 1),
  ('SPG',  'us_reits', 'yahoo', 'Simon Property',  'USD', 5, 1),
  ('PSA',  'us_reits', 'yahoo', 'Public Storage',  'USD', 6, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — CA EQUITIES (52 across 10 sub-sectors)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  -- Tech
  ('SHOP.TO', 'ca_tech', 'yahoo', 'Shopify',                'CAD', 0, 1),
  ('CSU.TO',  'ca_tech', 'yahoo', 'Constellation Software', 'CAD', 1, 1),
  ('OTEX.TO', 'ca_tech', 'yahoo', 'Open Text',              'CAD', 2, 1),
  ('KXS.TO',  'ca_tech', 'yahoo', 'Kinaxis',                'CAD', 3, 1),
  ('DSG.TO',  'ca_tech', 'yahoo', 'Descartes Systems',      'CAD', 4, 1),
  -- Banking (Big 6)
  ('RY.TO',  'ca_banking', 'yahoo', 'Royal Bank of Canada', 'CAD', 0, 1),
  ('TD.TO',  'ca_banking', 'yahoo', 'TD Bank',              'CAD', 1, 1),
  ('BNS.TO', 'ca_banking', 'yahoo', 'Bank of Nova Scotia',  'CAD', 2, 1),
  ('BMO.TO', 'ca_banking', 'yahoo', 'Bank of Montreal',     'CAD', 3, 1),
  ('CM.TO',  'ca_banking', 'yahoo', 'CIBC',                 'CAD', 4, 1),
  ('NA.TO',  'ca_banking', 'yahoo', 'National Bank',        'CAD', 5, 1),
  -- Energy
  ('CNQ.TO', 'ca_energy', 'yahoo', 'Canadian Natural Resources', 'CAD', 0, 1),
  ('SU.TO',  'ca_energy', 'yahoo', 'Suncor Energy',              'CAD', 1, 1),
  ('ENB.TO', 'ca_energy', 'yahoo', 'Enbridge',                   'CAD', 2, 1),
  ('TRP.TO', 'ca_energy', 'yahoo', 'TC Energy',                  'CAD', 3, 1),
  ('CVE.TO', 'ca_energy', 'yahoo', 'Cenovus Energy',             'CAD', 4, 1),
  ('IMO.TO', 'ca_energy', 'yahoo', 'Imperial Oil',               'CAD', 5, 1),
  ('TOU.TO', 'ca_energy', 'yahoo', 'Tourmaline Oil',             'CAD', 6, 1),
  -- Telecom (Big 4)
  ('BCE.TO',   'ca_telecom', 'yahoo', 'BCE',      'CAD', 0, 1),
  ('T.TO',     'ca_telecom', 'yahoo', 'Telus',    'CAD', 1, 1),
  ('RCI-B.TO', 'ca_telecom', 'yahoo', 'Rogers',   'CAD', 2, 1),
  ('QBR-B.TO', 'ca_telecom', 'yahoo', 'Quebecor', 'CAD', 3, 1),
  -- Crypto Miners (3 — GLXY + WULF moved to US per S20)
  ('HUT.TO',  'ca_crypto_miners', 'yahoo', 'Hut 8 Mining',  'CAD', 0, 1),
  ('BITF.TO', 'ca_crypto_miners', 'yahoo', 'Bitfarms',      'CAD', 1, 1),
  ('HIVE.TO', 'ca_crypto_miners', 'yahoo', 'HIVE Digital',  'CAD', 2, 1),
  -- Metal Miners
  ('ABX.TO',    'ca_metal_miners', 'yahoo', 'Barrick Gold',     'CAD', 0, 1),
  ('AEM.TO',    'ca_metal_miners', 'yahoo', 'Agnico Eagle',     'CAD', 1, 1),
  ('FNV.TO',    'ca_metal_miners', 'yahoo', 'Franco-Nevada',    'CAD', 2, 1),
  ('K.TO',      'ca_metal_miners', 'yahoo', 'Kinross Gold',     'CAD', 3, 1),
  ('WPM.TO',    'ca_metal_miners', 'yahoo', 'Wheaton Precious', 'CAD', 4, 1),
  ('TECK-B.TO', 'ca_metal_miners', 'yahoo', 'Teck Resources',   'CAD', 5, 1),
  ('FM.TO',     'ca_metal_miners', 'yahoo', 'First Quantum',    'CAD', 6, 1),
  ('IVN.TO',    'ca_metal_miners', 'yahoo', 'Ivanhoe Mines',    'CAD', 7, 1),
  ('HBM.TO',    'ca_metal_miners', 'yahoo', 'Hudbay Minerals',  'CAD', 8, 1),
  -- Healthcare (only 2 — CA healthcare is genuinely thin)
  ('BHC.TO', 'ca_healthcare', 'yahoo', 'Bausch Health',         'CAD', 0, 1),
  ('GUD.TO', 'ca_healthcare', 'yahoo', 'Knight Therapeutics',   'CAD', 1, 1),
  -- Consumer Staples
  ('L.TO',     'ca_staples', 'yahoo', 'Loblaw',         'CAD', 0, 1),
  ('ATD.TO',   'ca_staples', 'yahoo', 'Couche-Tard',    'CAD', 1, 1),
  ('EMP-A.TO', 'ca_staples', 'yahoo', 'Empire Company', 'CAD', 2, 1),
  ('MRU.TO',   'ca_staples', 'yahoo', 'Metro',          'CAD', 3, 1),
  ('WN.TO',    'ca_staples', 'yahoo', 'George Weston',  'CAD', 4, 1),
  ('DOL.TO',   'ca_staples', 'yahoo', 'Dollarama',      'CAD', 5, 1),
  -- Utilities
  ('FTS.TO', 'ca_utilities', 'yahoo', 'Fortis',         'CAD', 0, 1),
  ('EMA.TO', 'ca_utilities', 'yahoo', 'Emera',          'CAD', 1, 1),
  ('H.TO',   'ca_utilities', 'yahoo', 'Hydro One',      'CAD', 2, 1),
  ('AQN.TO', 'ca_utilities', 'yahoo', 'Algonquin Power','CAD', 3, 1),
  ('CPX.TO', 'ca_utilities', 'yahoo', 'Capital Power',  'CAD', 4, 1),
  ('TA.TO',  'ca_utilities', 'yahoo', 'TransAlta',      'CAD', 5, 1),
  -- REITs
  ('REI-UN.TO', 'ca_reits', 'yahoo', 'RioCan REIT',                    'CAD', 0, 1),
  ('CAR-UN.TO', 'ca_reits', 'yahoo', 'Canadian Apartment Properties',  'CAD', 1, 1),
  ('HR-UN.TO',  'ca_reits', 'yahoo', 'H&R REIT',                       'CAD', 2, 1),
  ('AP-UN.TO',  'ca_reits', 'yahoo', 'Allied Properties REIT',         'CAD', 3, 1),
  ('GRT-UN.TO', 'ca_reits', 'yahoo', 'Granite REIT',                   'CAD', 4, 1),
  ('FCR-UN.TO', 'ca_reits', 'yahoo', 'First Capital REIT',             'CAD', 5, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — CRYPTO (14, flat — stablecoins dropped per S20)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('BTC-USD',   'crypto', 'yahoo', 'Bitcoin',   'USD', 0,  1),
  ('ETH-USD',   'crypto', 'yahoo', 'Ethereum',  'USD', 1,  1),
  ('BNB-USD',   'crypto', 'yahoo', 'BNB',       'USD', 2,  1),
  ('SOL-USD',   'crypto', 'yahoo', 'Solana',    'USD', 3,  1),
  ('XRP-USD',   'crypto', 'yahoo', 'XRP',       'USD', 4,  1),
  ('ADA-USD',   'crypto', 'yahoo', 'Cardano',   'USD', 5,  1),
  ('DOGE-USD',  'crypto', 'yahoo', 'Dogecoin',  'USD', 6,  1),
  ('TRX-USD',   'crypto', 'yahoo', 'TRON',      'USD', 7,  1),
  ('LINK-USD',  'crypto', 'yahoo', 'Chainlink', 'USD', 8,  1),
  ('AVAX-USD',  'crypto', 'yahoo', 'Avalanche', 'USD', 9,  1),
  ('MATIC-USD', 'crypto', 'yahoo', 'Polygon',   'USD', 10, 1),
  ('DOT-USD',   'crypto', 'yahoo', 'Polkadot',  'USD', 11, 1),
  ('ATOM-USD',  'crypto', 'yahoo', 'Cosmos',    'USD', 12, 1),
  ('LTC-USD',   'crypto', 'yahoo', 'Litecoin',  'USD', 13, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — COMMODITIES (11 across 3 sub-sectors)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  -- Energy
  ('CL=F', 'comm_energy', 'yahoo', 'Crude Oil (WTI)',   'USD', 0, 1),
  ('NG=F', 'comm_energy', 'yahoo', 'Natural Gas',       'USD', 1, 1),
  ('BZ=F', 'comm_energy', 'yahoo', 'Crude Oil (Brent)', 'USD', 2, 1),
  -- Metals
  ('GC=F', 'comm_metals', 'yahoo', 'Gold',      'USD', 0, 1),
  ('SI=F', 'comm_metals', 'yahoo', 'Silver',    'USD', 1, 1),
  ('HG=F', 'comm_metals', 'yahoo', 'Copper',    'USD', 2, 1),
  ('PA=F', 'comm_metals', 'yahoo', 'Palladium', 'USD', 3, 1),
  ('PL=F', 'comm_metals', 'yahoo', 'Platinum',  'USD', 4, 1),
  -- Agriculturals
  ('ZC=F', 'comm_agriculturals', 'yahoo', 'Corn',     'USD', 0, 1),
  ('ZW=F', 'comm_agriculturals', 'yahoo', 'Wheat',    'USD', 1, 1),
  ('ZS=F', 'comm_agriculturals', 'yahoo', 'Soybeans', 'USD', 2, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — FX (6, flat)
-- Display currency for each pair is the QUOTE currency (the one the price
-- is denominated in — e.g. EURUSD price is X USD per 1 EUR).
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('DX-Y.NYB',  'fx', 'yahoo', 'US Dollar Index', 'USD', 0, 1),
  ('EURUSD=X',  'fx', 'yahoo', 'EUR / USD',       'USD', 1, 1),
  ('GBPUSD=X',  'fx', 'yahoo', 'GBP / USD',       'USD', 2, 1),
  ('USDJPY=X',  'fx', 'yahoo', 'USD / JPY',       'JPY', 3, 1),
  ('USDCAD=X',  'fx', 'yahoo', 'USD / CAD',       'CAD', 4, 1),
  ('AUDUSD=X',  'fx', 'yahoo', 'AUD / USD',       'USD', 5, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — BONDS & RATES (6, flat)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('TLT', 'bonds_rates', 'yahoo', '20+ Year Treasury Bond', 'USD', 0, 1),
  ('IEF', 'bonds_rates', 'yahoo', '7-10Y Treasury Bond',    'USD', 1, 1),
  ('SHY', 'bonds_rates', 'yahoo', '1-3Y Treasury Bond',     'USD', 2, 1),
  ('HYG', 'bonds_rates', 'yahoo', 'High Yield Corporate',   'USD', 3, 1),
  ('LQD', 'bonds_rates', 'yahoo', 'Investment Grade Corp',  'USD', 4, 1),
  ('TIP', 'bonds_rates', 'yahoo', 'TIPS (Inflation Prot.)', 'USD', 5, 1);

-- ──────────────────────────────────────────────────────────────────────
-- Watchlist tickers — VIX & RISK (1, flat)
-- MOVE bond-vol index considered + skipped — Yahoo coverage unreliable.
-- Add later if Yahoo serves it cleanly.
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO watchlist_tickers (ticker, sector_group_id, data_source, display_name, display_currency, display_order, enabled) VALUES
  ('^VIX', 'vix_risk', 'yahoo', 'VIX Volatility Index', 'USD', 0, 1);

-- ──────────────────────────────────────────────────────────────────────
-- News feeds (M7) — unchanged. Pluggable source_type dispatcher routes
-- 'rss' to feed-rs and 'finnhub' to the Finnhub general-news endpoint.
-- ──────────────────────────────────────────────────────────────────────

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

-- ──────────────────────────────────────────────────────────────────────
-- FRED series (29 = 22 visible + 7 analysis-only)
-- ──────────────────────────────────────────────────────────────────────

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

  -- Liquidity & dollar (S20 additions)
  ('M2SL',                'M2 Money Stock',                                               'Billions', 'Monthly',   'Liquidity'),
  ('DTWEXBGS',            'Trade-Weighted U.S. Dollar Index — Broad',                     'Index',    'Daily',     'Liquidity'),

  -- Risk regime (S20 additions)
  ('BAMLH0A0HYM2',        'High-Yield Index Spread',                                      'Percent',  'Daily',     'Risk'),

  -- Energy (S20 addition; companion to CL=F with deeper FRED-sourced history)
  ('DCOILWTICO',          'WTI Crude Oil',                                                'USD/Barrel','Daily',    'Energy'),

  -- Analysis-only (v1.1) — not shown on MACRO dashboard
  ('USREC',               'NBER-based Recession Indicator',                               'Binary',   'Monthly',   'Recession'),
  -- Yield-curve tenors (v1.1) — DGS10 already a MACRO tile; the rest are Analysis-only
  ('DGS3MO',              '3-Month Treasury Constant Maturity Rate',                      'Percent',  'Daily',     'Rates'),
  ('DGS2',                '2-Year Treasury Constant Maturity Rate',                       'Percent',  'Daily',     'Rates'),
  ('DGS5',                '5-Year Treasury Constant Maturity Rate',                       'Percent',  'Daily',     'Rates'),
  ('DGS30',               '30-Year Treasury Constant Maturity Rate',                      'Percent',  'Daily',     'Rates'),
  -- Phase 3 — macro regime (Analysis-only)
  ('RECPROUSM156N',       'NY Fed Recession Probability (12mo ahead)',                    'Percent',  'Monthly',   'Recession'),
  ('NFCI',                'Chicago Fed National Financial Conditions Index',              'Index',    'Weekly',    'Conditions');

-- v1.1 Analysis-only series. Idempotent on every boot — covers fresh installs
-- (seeded with DEFAULT 1, then flipped here) and pre-v1.1 DB upgrades.
UPDATE fred_series SET tile_visible = 0 WHERE series_id IN ('USREC', 'DGS3MO', 'DGS2', 'DGS5', 'DGS30', 'RECPROUSM156N', 'NFCI');

-- ──────────────────────────────────────────────────────────────────────
-- Analysis tool registry (Phase 1-3 tools, unchanged from S18)
-- ──────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO analysis_tools (id, display_name, scope, display_order, enabled, config_json) VALUES
  ('pulse',                 'Pulse',                'cross_asset', 0, 1, '{"lookbackYears":5}'),
  ('correlation_matrix',    'Correlations',         'cross_asset', 1, 1, NULL),
  ('yield_curve',           'Yield Curve',          'macro',       2, 1, NULL),
  ('pairs_ratio',           'Pairs',                'cross_asset', 3, 1, '{"quickPicks":[["BTC-USD","ETH-USD"],["GC=F","SI=F"],["HG=F","GC=F"],["^IXIC","^GSPC"]]}'),
  ('rrg',                   'RRG',                  'cross_asset', 4, 1, '{"benchmark":"^GSPC","rsPeriod":14,"momentumPeriod":5,"tailLength":8}'),
  ('recession_prob',        'Recession Prob',       'macro',       5, 1, NULL),
  ('financial_conditions',  'Financial Conditions', 'macro',       6, 1, NULL),
  ('regime_quadrant',       'Regime Quadrant',      'macro',       7, 1, '{"inflationProxy":"cpi","trailMonths":24}');
