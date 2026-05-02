# Design Sketch — Private Terminal

v0.13 sketch (2026-05-02). M1–M7 shipped, M8 code-complete, M8.5 Maintenance complete, M8.6 Polish complete, S12 release-blocker pass complete, S13 Manage Watchlist refactor complete, **v1.0.0-rc.1 shipped to first cold-eye tester**, v1.1 Analysis section Phase 1-3 shipped, v1.2 Pulse killer-feature shipped (S20 design + S20 database reformulation + S21 implementation), Scanner deprecated (S21).

**v0.13 changes (S21):**
- **v1.2 Pulse implementation shipped.** New top-level Rust module `src-tauri/src/cross_section/` (mod / compute / percentile / tests + `commands/cross_section_cmds.rs`) iterating every leaf sector_group ticker + every FRED series, computing REGIME / AGE / LEVEL / RSI / ATR / VOL / DD via percentile rank vs trailing-5y baseline. Universal indicator compute path bypasses per-ticker `indicator_settings` (cross-section reads break with mixed params). 9/9 cross_section unit tests green.
- **Frontend `src/components/pulse/PulseDashboard.tsx`** (~430 LOC) — single-file view with TabIntro per S17 pattern, sticky column header, section-grouped body, filter chips ALL/BULL/BEAR/EXTREMES, sort indicators with desc → asc → off cycle. Style C saturated-block cells (96px × 26px, no internal border, 1px column-gap separator) + Palette 1 R→Y→G + neutral-hold saturation curve (40-60 muted, ramps at tails) + heavy section header + cyan PULSE banner with row counts.
- **REGIME chips + heatmap = two distinct color axes intentionally.** REGIME chip = categorical state via SMMA Ribbon palette tokens (user-customizable via Settings → Appearance per S9). Heatmap cells = continuous percentile via fixed Palette 1. Don't have to match — different semantic roles. Mitigation: chip min-width 84px, alpha 0.28 background, border alpha 0.7 so it self-anchors against the heatmap.
- **Ticker-column click → feature chart.** localStorage handoff `session.pulse_feature_chart_target = { ticker, dataSource }` matches S17 Correlations→Pairs pattern. TickerDashboard reads + clears (always-clear-on-mount) + auto-`setSelected(matchingTile)`. Bloomberg HRH / TradingView convention — ticker is hyperlink, cells are read-only data preserving their hover tooltips.
- **Scanner deprecated** — Pulse subsumes its analytical content. PRIME button moved into Pulse banner contextually (renders only when `noBarsCount > 0`). RECOMPUTE killed (dead weight — both already recompute on mount). Scanner unrouted from sidebar + App.tsx; soft-deleted via `UPDATE sector_groups SET user_hidden = 1 WHERE id = 'scanner'`. Files preserved one release for revert; delete in v1.3 cleanup. Feature #10 (Multi-ticker scanner) superseded by Pulse — same rationale that killed feature #5 in S10.
- **PRIME failures surfaced inline** — `result.failures` rendered under prime-status strip with per-ticker error + exchange-suffix hint. Tooltip rewritten to set honest expectations about bad symbols not recovering. Persisted `last_fetch_error` per-ticker (option 3) deferred to v1.3.
- **App.tsx stale-section fallback** — invalid persisted `active_section` (legacy 'scanner', user-deleted custom group) redirects to `'pulse'` once `groups` loads.
- **Section ordering pattern** — for hierarchical group enumeration, sort key = `(parent.display_order, g.display_order)` for sub-sectors and `(g.display_order, 0)` for top-level leaves. Naive `(parent.display_order ?? 0, ...)` collapses top-level leaves to `(0, ...)`, sorting them BEFORE sub-sectors. Caught at smoke-test (CRYPTO appearing above INDICES_AMERICAS); captured as LESSONS DB-11.
- **Sidebar PINNED_IDS** = `['pulse', 'analysis', 'macro', 'news']`. Pulse pinned at position 0 as the "open this first" landing surface.

**v0.12 changes (S13):**
- **Manage Watchlist consolidation.** Sidebar `Manage Groups` + dashboard inline `EDIT` toggle → single `Manage Watchlist` modal with 3 tabs (`Tickers / Groups / News Feeds`). Default tab Tickers; last-selected ticker group persisted at `session.manage_watchlist_group`. New `src/components/ManageWatchlistModal.tsx`; `GroupsManagerModal.tsx` deleted. Inline EDIT toggle removed from `TickerDashboard.tsx` — range / refresh / heatmap controls always visible now.
- **Group reparenting (extensibility extension).** New tri-state `new_parent_id: Option<Option<String>>` field on `UpdateSectorGroupInput` (custom `deserialize_some` distinguishes absent / null / value). Frontend `Move Under` dropdown per row + reparenting reachable through the same path the user adds new groups. **Hard 2-level cap**: target parent must itself be top-level (`parent_id IS NULL`); group with children rejected from non-null reparent. Schema unchanged — `parent_id` column existed since M1.
- **Stacked-buttons table layout fix.** Old `GroupsManagerModal` rendered each action button (↑↓×) in a separate `<td>` with `display: flex` — Chromium broke the table-row layout, vertically stacking the cells (~3x row height). Fix: single `<td>` containing all three buttons, matching `TickerEditPanel` pattern. Captured as **EC-13** rationale (table-cell `display: flex` only safe on a single-cell row).
- **Sidebar layout — pinned + user-managed.** SCANNER, MACRO, NEWS pinned at top via `PINNED_IDS = ['scanner', 'macro', 'news']` in `Sidebar.tsx`; rendered in array order regardless of `display_order`. New `<hr className="sidebar__separator">` between pinned and user-managed roots. User-managed sorted by `displayOrder` per existing convention. Manage button label flipped `Manage Groups` → `Manage Watchlist`.
- **Settings 6 → 5 tabs.** News Feeds removed from Settings (now lives in Manage Watchlist as a tab). New order: `API Keys / Appearance / Storage / Features / About`. `TabId` union and `TABS` array in `SettingsModal.tsx` trimmed; `FeedsTab` import dropped.
- **CoinGecko split.** Add-form source dropdown vs visibility split: `NEW_GROUP_SOURCES = ['yahoo']` (offered for new groups) vs `EDITABLE_SOURCE_SET = new Set(['yahoo', 'coingecko'])` (visibility for existing rows). Existing CRYPTO group still appears in Tickers picker + Groups table though no fetcher routes through CoinGecko today (M5 routed via Yahoo). Append `'coingecko'` to `NEW_GROUP_SOURCES` when fetcher lands in v1.1.
- **About-tab PrivateACB copy rewrite (last v1 release blocker).** Old copy described PrivateACB as an Adjusted Cost Base calculator for Canadian investors with equity terminology ("splits, transfers, corporate actions"). New copy: "desktop crypto tax calculator for Canada, the US, Australia, and the UK" — sourced from PrivateACB's own `CLAUDE.md` (web fetch returned 403). Avoids specific exchange names + cost-base methods (decay risk) and pricing (not Private Terminal's job). Same Tauri stack framing tied back via "same privacy-first, single-machine philosophy."
- **Version 0.1.0 → 1.0.0-rc.1.** Bumped in **four** locations: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/version.ts`. Comment in `version.ts` corrected — previously listed only 3 files, missing `tauri.conf.json` (which wins over Cargo.toml for Tauri v2 bundle metadata).
- **RC.1 ship.** Production exe (19.8 MB) + new project-root `README.md` (tester-targeted: SmartScreen workaround, FRED key walkthrough, first-run expectation table, feedback framing) staged into `release/private-terminal-v1.0.0-rc.1/` and zipped to `release/private-terminal-v1.0.0-rc.1.zip` (8.1 MB). Uploaded to first cold-eye tester via Google Drive.

**v0.11 changes (S12):**
- **VRVP overlay shipped** as Approach B (translucent right-side overlay inside the price pane, not the originally spec'd side-grid). Single `custom` series with `renderItem` using `params.coordSys` for pixel positioning, anchored on a dedicated hidden value-axis (range `[0,1]`) decoupled from the time-axis dataZoom — this is the only way to defeat ECharts' off-screen culling of custom-series data points. 180 close-bucketed bins; POC bin in translucent yellow, others in translucent gray; `tooltip: { show: false }` to keep VRVP out of the chart-wide axis tooltip; `clip: false` + `silent: true` + `z: 15` (above candles). Persisted via `usePersistedState('session.feature_chart_show_vrvp', true)`, default ON. Auto-suppresses when visible window has zero volume (DXY/FX).
- **Header redesigned to Layout D.** Two-row header: top row `PRIVATE TERMINAL` + `⚙` settings; subtitle row `<full-path> · <size> · <N> series · <N> bars` with click-to-copy on the path. New `AppHeader.tsx` component fetches `DbInfo` via the existing `dbRefreshCounter` mechanism. Bottom `StatusBar` repurposed as a centered cross-promo footer: `v{APP_VERSION} · Provided for free by the folks at PrivateACB.com` with the URL portion fired through `tauri-plugin-opener`. New `src/version.ts` constant centralizes the version string (kept in sync with `package.json` + `Cargo.toml`).
- **Settings tabs grew 5 → 6.** New **Features** tab (`FeaturesTab.tsx`) sits between Storage and About, holding 7 cards: VRVP, SMMA Ribbon, RSI(14)/ATR(14), Scanner, Market-hours strip, Tile range switch, Indicator framework — plus the Tips & hidden shortcuts list (moved out of About). SMMA Ribbon attribution: Bill Williams' Alligator (1995) + Wilder's RMA (1978); no mention of "Larsson Line" or trendscope per user direction. Liability framing kept ("Decision support, not investment advice"). Caveat block kept (best on tech/crypto, 4h–monthly timeframes). About tab simplified to product/maker info + PrivateACB cross-promo card. ApiKeysTab help paragraph dropped its hardcoded `%APPDATA%\...` path (which could drift after M8.5 `move_database`); now references the header for the live path.
- **Tier 1 ECharts polish.** PNG save button on the feature-chart toolbar (works in both line and candle modes; `chart.getDataURL` with pixelRatio 2 + dark bg, downloads as `<safeTitle>-<YYYY-MM-DD>.png`); transient "✓ saved to Downloads" flash. Faint centered watermark via `graphic` component using the chart's `title` prop (fontSize 96 candle, 56 line; `silent: true`, `z: 0`).
- **Icon swap.** New octagonal candlestick `.ico` generated from `.corel_draw/private_terminal4.png` via `npx tauri icon`. Full platform set written to `src-tauri/icons/`.
- **Two of three v1 release blockers cleared this session** (icon, VRVP). One remains: About-tab PrivateACB copy rewrite (user authoring, not code).

**v0.10 changes (S11):**
- **App renamed Personal Terminal → Private Terminal** (user-visible only — internal binary, lib, identifier, AppData folder, DB filename all retain `personal-terminal` for backwards compat with existing user data). Brand pulls into the PrivateACB family.
- **Market-hours strip ties to index quotes.** Each tracked exchange has a hardcoded mapping to its main index ticker (`NYSE→^GSPC`, `TSX→^GSPTSE`, etc.). New `list_market_index_quotes` IPC reads `quote_cache` only — no fetching. Strip outline color = direction since last close (independent of open/closed status, which is a separate cyan dot).
- **FeatureChart viewer state.** Two persistent toggles under `session.feature_chart_*`: `autofit` (default on, recomputes Y bounds with 3% padding from visible-window bars on each `datazoom` event) and `show_volume` (default on, drops the volume pane when off — `layoutGrids` redistributes the freed space to price). Tighter pane sizing across the board (price absorbs whatever non-price panes don't claim at fixed 12% slim).
- **Log Y-axis attempted and dropped** (S11 experimentation). ECharts' default log axis ticks at `base^k` only, which compresses sub-decade ranges to invisibility (e.g. BTC's $30k–$70k window squashes between $10k and $100k boundaries). SMMA Ribbon stacked-area envelope amplifies the issue: band components value 0 on most bars, `log(0)` = -Infinity poisons range computation. Three implementation attempts failed; chart-library swap rejected (loses ~2 weeks of M6+M8.6 ECharts investment for one feature gap). True TradingView-style log requires manual `log10()` transform on a linear axis — tracked for v1.1 (Path (a) in PROGRESS.md → Discovered).
- **Volume Profile (VRVP) tracked for v1.1.** Right-margin horizontal histogram of volume-by-price (HVN/LVN/POC zones). Feasible in ECharts via side-grid `bar` series or `custom` series; ~1 weekend feature. Not in v1 scope.

**v0.9 changes (S10):**
- **M8.5 "Maintenance" milestone inserted** between M8 and M9. Four shipped items: hard-delete-with-cascade purge of cache rows, RSS feed CRUD, SQLite VACUUM/checkpoint/integrity-check pipeline + orphan-row sweep, move-database with pointer file + Backup-copy sibling action.
- **`news_feeds.user_hidden` column** — soft-delete pattern matched to `sector_groups`/`watchlist_tickers`. Seed `INSERT OR IGNORE` stays a no-op for hidden seeded rows; user-deleted feeds don't revive on next boot. `Db::list_news_feeds` filters `user_hidden=0` in both branches.
- **DB location pointer file.** `<data_dir>/db_location.txt` (single-line UTF-8 path). `config::resolve_db_path()` reads it on boot, validates target exists, falls back to default. `move_database` writes it; `reset_database_location` clears it. Pointer lives in the *default* data dir even when the DB has moved — avoids the chicken-and-egg of "where's the database that tells me where the database is."
- **Settings tab grew Storage and News Feeds tabs** — total tabs now 5 (API Keys / Appearance / News Feeds / Storage / About).
- **`get_db_info.size_bytes` semantics changed** to return total footprint (`db` + `db-wal` + `db-shm`) — matches the maintenance result. `mainBytes` + `walBytes` exposed for breakdown displays.
- **Watchlist Performance summary (feature #5) confirmed redundant** with the M6 Scanner. Scanner already covers sortable ticker × state/price/RSI/ATR; adding 1D/1W/1M/YTD/1Y % change columns is a single-tab enhancement on Scanner if desired, not a separate M9 item. M9 scope shrinks to features #1 (overlay) + #3 (Ctrl+K).
- **`tauri-plugin-dialog`** added for the move/backup folder picker. First time we've used a native dialog. Capability adds `dialog:default` + `dialog:allow-open`.
- **Finnhub eligibility filter widened** from per-suffix blacklist (`NOT LIKE '%.TO'` etc.) to negative whitelist (`NOT LIKE '%.%'`). US Yahoo equity tickers never contain `.` (class-share separator is `-`); all foreign exchange suffixes now correctly excluded.

**v0.8 changes (S9):**
- **Session persistence (feature #7) shipped.** Two keys on `config` KV (`session.active_section`, `session.sidebar_expanded`). Generic `usePersistedState<T>` hook with debounced writes + `{loaded, hadStoredValue}` status. Feature charts always start closed (explicit scope decision).
- **Keyboard shortcuts (feature #8) DROPPED.** Positional `Ctrl+1..9` conflicts with user-editable groups (M8 Phase 1); hardcoded section slugs violate extensibility-first. Ctrl+K command palette in M9 (feature #3) is the correct extensible navigation shortcut. Non-conflicting shortcuts (`` ` `` sidebar toggle, `?` help, `Esc` close-modal) deferred to M9/post-v1.
- **Settings modal shipped.** Three tabs: API Keys, Appearance, About & Tips. Trigger: ⚙ button in header.
- **API keys: SQLite `config` KV, not OS keyring.** Keyring crate v3 silently no-ops on Windows (writes don't persist to Credential Manager despite returning Ok). Pivot to plaintext KV at `api_key.<service>`, with `.env` fallback. User-dir perms are adequate for free-tier API keys. See LESSONS SEC-1 and `memory/m8_polish_decisions.md`.
- **SMMA Ribbon palette is user-customizable.** Resolves 5-iteration palette indecision from S8. 5 presets + per-color `<input type="color">` pickers + live preview. Persisted at `session.palette`. Runtime CSS var application + ECharts color override via `applyThemeToIndicators()`. Rust constants in `smma_ribbon.rs` are defaults only.
- **Tile range switch (1D/1W/1M/YTD/1Y) shipped.** Closes M3 S4 deferred item. Server-side lookback via new `Db::close_at_or_before()` helper; frontend `RangeSwitch` pill row; heatmap thresholds scale per range (1D=1%…1Y=20%). Selection persisted at `session.tile_range`.
- **Scanner prime-histories shipped (M6 gap).** `prime_scanner_histories` command batch-fetches Yahoo history for scanner-eligible tickers with no bars; PRIME button beside RECOMPUTE.
- **TS cleanup: FeatureChart.tsx passes strict checks.** `npm run build` now succeeds end-to-end (`tauri:build` unblocked). One chunk-size warning (1.3 MB / 430 KB gzipped) — accepted as future polish.

**v0.7 changes (S8):**
- M7 NEWS shipped. Pluggable feed dispatcher keyed on `source_type` ('rss' | 'finnhub'); fetchers under `src-tauri/src/sources/news/`. `news_feeds` + `news_items` tables created in `schema.sql` (spec'd since v0.5, missing until now — pattern matches M6 indicator-table gap).
- Seeded 8 RSS feeds covering World (BBC Business, BBC Middle East, Al Jazeera), US (CNBC), Canada (Financial Post, CBC Business), Central Banks (Fed, BoC). Finnhub general seeded but `enabled=0` by default — flips to 1 once FINNHUB_API_KEY lands.
- Dedup: `INSERT OR IGNORE` on `(source, external_id)` PK — RSS `<guid>`/`<id>` via feed-rs, SHA-256 of link+pubDate fallback; Finnhub numeric id. Re-fetches silently no-op.
- Retention: 30-day TTL on `fetched_at`, cleanup runs once on app boot.
- External links: `tauri-plugin-opener` with scoped `opener:allow-open-url` (default permission alone insufficient).
- Per-ticker news not implemented in M7 — routed through `watchlist_tickers` instead of a second `news_feeds` row per ticker. Lands in M8 with ticker-editing script so watchlist-change = news-coverage-change.

**v0.6 changes (S7):**
- Indicator renamed: **Larsson Line → SMMA Ribbon** after confirming the math is derivative of public community work (see `memory/m6_indicator_rename.md`).
- Feature #4 (Regime shading) delivered via the SMMA Ribbon state-coloured envelope fill rather than full-chart background shading. Envelope width carries more signal than a flat tint; spec intent is satisfied by a different mechanism.
- `indicators` + `indicator_settings` tables are now actually created in `schema.sql` (were spec'd but omitted in M1).

---

## Vision

A personal desktop Bloomberg-lite focused on the user's asset universe: top crypto, top US equities, Canadian sector watchlists (energy / banking / telecom / crypto miners / metal miners), commodity futures, FX/rates, major world indices, a macroeconomic KPI panel, pluggable technical indicators (SMMA Ribbon + RSI + ATR), and a curated set of productivity features (multi-ticker overlay, scanner, command palette). Not a trading tool. Not real-time. Not shared.

**Blueprints** (`docs/images/`):
- `bloomberg_killers_data_sources.png` — 25-provider data-source inventory
- `urbankaoberg_reference_layout.png` — IA + tile-density aesthetic

**Reference implementation** (indicator math):
- `E:\Users\PBL\Documents\Dev\trendscope` — Python quad-SMMA-state clone (legacy name "Larsson Line"). `src/trendscope/indicators.py` is the porting target; we call it **SMMA Ribbon** in this repo (rename S7 — see PROGRESS.md).

---

## Extensibility-First Principle (HARD CONSTRAINT)

Adding a new sector group, ticker, news feed, **or technical indicator** must be a data insert + (for indicators) one Rust module. Sectors/tickers/feeds are SQLite rows; indicators are Rust registry entries backed by SQLite toggles. Frontend renders what it finds.

---

## v1 Scope — Seven Sections + Indicator Framework + Feature Layer

Navigable via a left sidebar tree.

| Section | Data Source | Tiles |
|---------|-------------|-------|
| **MACRO** | FRED | ~18 KPI tiles + feature chart + heatmap view |
| **INDICES** | Yahoo Finance | 15 majors (local currency) |
| **CRYPTO** | CoinGecko (live) + Yahoo (history) | Top 10 |
| **US EQUITIES** | Yahoo Finance | Top 10 |
| **CA EQUITIES** | Yahoo Finance | 5 collapsible sectors (~31 tiles) |
| **FUTURES & FX** | Yahoo Finance | CL, GC, SI, NG, HG, DXY |
| **NEWS** | Finnhub + RSS | Pluggable feeds |

**Indicator framework:** SMMA Ribbon + RSI + ATR, universally toggleable, trait-based Rust registry.

**Feature layer:** 10 curated features atop the core (see "Features" section below).

Totals: ~100 tiles, 7 sections, 3 indicators in v1, 10 features.

**Out of scope for v1:**
- Portfolio tracking (PrivateACB's territory)
- Real-time tick data
- Options chains, fundamentals deep-dives
- Alerts / push notifications
- Mobile / cloud
- Backtesting (future — deferred)

---

## Data Sources (v1)

| Source | Tier | Rate Limit | Coverage |
|--------|------|------------|----------|
| **FRED** | Free (API key) | Effectively none | US macro series |
| **CoinGecko** | Free (no key) | ~30/min | Crypto discovery + live (1Y historical — deep history via Yahoo) |
| **Yahoo Finance** | Free (unofficial) | Be polite — batch endpoint | US+TSX equities, futures, DXY/FX, world indices, crypto history |
| **Finnhub** | Free (API key) | 60/min | US ticker news + general news |
| **RSS** | Free | Per-feed ToS | Canadian sources |

API keys in Tauri keyring / local encrypted config. Never committed.

---

## Charting & Indicators

### Chart library: Apache ECharts

MIT, ~1 MB gzipped. Chosen for:
- **Native fill-between-two-lines** (SMMA Ribbon state-fill) — not a Custom Series plugin fight.
- **Grid subpane system** — price + volume + RSI + ATR in one figure with shared xAxis.
- **Custom-series API** — clean path for future indicators with unusual rendering.
- **Themeable to terminal aesthetic.**
- **Linked-cursor `connect()`** — free multi-chart sync for feature #6.

Don't swap without real evidence ECharts is insufficient.

### Indicator system — Rust-side, trait-based

Port trendscope's math. `src-tauri/src/indicators/` hosts the registry; each indicator is a module implementing:

```rust
pub trait Indicator {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    fn default_params(&self) -> IndicatorParams;
    fn pane_hint(&self) -> PaneHint;     // Overlay | Subpane
    fn compute(&self, bars: &[Bar], params: &IndicatorParams) -> IndicatorOutput;
}
```

Compute on-demand when feature chart opens (not persisted). `f64` precision (display-only). Universally available on every feature chart; toggled per-ticker via `indicator_settings`. Default OFF per ticker.

**First three indicators (M6):** SMMA Ribbon (quad-SMMA state + confirm_3), RSI(14), ATR(14), flip markers — all ported from trendscope.

**Liability framing:** decision support, not investment advice.

---

## Features (beyond core sections)

10 features selected and distributed across milestones. All leverage ECharts or existing tech stack without new dependencies.

| # | Feature | Description | Milestone |
|---|---------|-------------|-----------|
| **1** | **Multi-ticker overlay** | Compare N tickers as % change from baseline on one chart (BTC/ETH/SPY YTD) | M9 |
| **2** | **Market-hours indicator** | App-shell strip showing which exchanges are open (NYSE/TSX/LSE/TYO/HKG/SSE/ASX/KRX). Pure timezone math | M3 |
| **3** | **Command palette (Ctrl+K)** | Fuzzy search across sectors, tickers, FRED series — jump anywhere | M9 |
| **4** | **Regime shading** | State-coloured envelope between SMMA Ribbon's v1 and v2 lines (gold/navy/gray). Envelope width = signal strength. Delivered in M6. | M6 |
| **5** | **Watchlist performance summary** | Sortable table: ticker × 1D/1W/1M/YTD/1Y % change. SQL aggregate on `price_history` | M9 |
| **6** | **Linked cursor across charts** | Sync crosshair across open feature charts. ECharts `connect()` — one line | M2 |
| **7** | **Session persistence** | Restore active section + sidebar expand state. `config` KV via `usePersistedState`. Feature charts always start closed. Indicator toggles already persisted per-ticker via `indicator_settings` (M6). Shipped S9. | M8 |
| **8** | ~~Keyboard shortcuts~~ | ~~Ctrl+1..9 section switch, `/` focus search, `` ` `` toggle sidebar~~ | **DROPPED S9** — positional bindings conflict with user-editable groups. Ctrl+K palette (feature #3, M9) is the correct extensible nav shortcut. |
| **9** | **Macro heatmap view** | Color-code FRED tiles green/red by YoY delta for at-a-glance macro health | M2 |
| **10** | ~~Multi-ticker scanner~~ | ~~"Show all tickers currently in SMMA Ribbon bull state" — sortable summary view across watchlist~~ | **SUPERSEDED S21** — Pulse cross-section heatmap covers the same scan-the-universe use case with richer columns (percentile-LEVEL/RSI/ATR/VOL + DD). Scanner soft-deleted; PRIME moved into Pulse banner contextually. Files preserved one release for revert (Scanner.tsx + IndicatorScanner + scanner_snapshot IPC). |

---

## Ticker Inventory (v1 seed — user-editable)

### MACRO — FRED series IDs

| Category | Tiles |
|----------|-------|
| **Rates** | Fed Funds (`FEDFUNDS`), 10Y Treasury (`DGS10`), 10Y-2Y Spread (`T10Y2Y`), 10Y Breakeven (`T10YIE`), 10Y Real Yield (`DFII10`) |
| **Inflation** | CPI YoY (`CPIAUCSL`), Core PCE YoY (`PCEPILFE`), PPI YoY (`PPIACO`) |
| **Labor** | Unemployment (`UNRATE`), Nonfarm Payrolls (`PAYEMS`), Initial Claims (`ICSA`), JOLTS Openings (`JTSJOL`) |
| **Growth** | GDP QoQ Ann. (`A191RL1Q225SBEA`), Industrial Production (`INDPRO`) |
| **Consumer** | Retail Sales (`RSXFS`), UMich Sentiment (`UMCSENT`) |
| **Housing** | Housing Starts (`HOUST`), Existing Home Sales (`EXHOSLUSM495S`) |

### INDICES — Yahoo tickers (local currency)

| Region | Tickers |
|--------|---------|
| **Americas** | `^GSPC`, `^DJI`, `^IXIC`, `^RUT`, `^GSPTSE`, `^BVSP` |
| **Europe** | `^FTSE` (GBP), `^GDAXI` (EUR), `^FCHI` (EUR), `^STOXX50E` (EUR) |
| **Asia-Pacific** | `^N225` (JPY), `^HSI` (HKD), `^SSEC` (CNY), `^AXJO` (AUD), `^KS11` (KRW) |

### CRYPTO
CoinGecko `/coins/markets` top-10 auto. Yahoo for history.

### US EQUITIES
AAPL, MSFT, NVDA, GOOGL, AMZN, META, BRK.B, TSLA, AVGO, JPM

### CA EQUITIES
- **Energy:** CNQ.TO, SU.TO, ENB.TO, TRP.TO, CVE.TO, IMO.TO, TOU.TO
- **Banking (Big 6):** RY.TO, TD.TO, BNS.TO, BMO.TO, CM.TO, NA.TO
- **Telecom (Big 4):** BCE.TO, T.TO, RCI-B.TO, QBR-B.TO
- **Crypto Miners:** HUT.TO, BITF.TO, HIVE.TO, GLXY (US), WULF (US)
- **Metal Miners:** ABX.TO, AEM.TO, FNV.TO, K.TO, WPM.TO, TECK-B.TO, FM.TO, IVN.TO, HBM.TO

### FUTURES & FX
CL=F, GC=F, SI=F, NG=F, HG=F, DX-Y.NYB

---

## Navigation — Left Sidebar Tree

```
PINNED (S21):
┌─ PULSE
├─ ANALYSIS
├─ MACRO
└─ NEWS
─── separator ───
USER-MANAGED:
┌─ WATCHLIST              (empty by default — personal-additions slot)
├─ INDICES ▼
│  ├─ Americas
│  ├─ Europe
│  └─ Asia-Pacific
├─ US EQUITIES ▼          (Tech / Banking / Energy / Telecom / Crypto Miners / Metal Miners / Healthcare / Staples / Utilities / REITs)
├─ CA EQUITIES ▼          (mirror of US sub-sectors)
├─ CRYPTO
├─ COMMODITIES ▼
│  ├─ Energy
│  ├─ Metals
│  └─ Agriculturals
├─ FX
├─ BONDS & RATES
└─ VIX & RISK
```

Click PULSE → percentile cross-section heatmap (every ticker × every FRED series). Click ANALYSIS → tabbed analysis tools. Click any sector node → tile grid. Click tile → feature chart with timeframe toggles + indicator panel. Market-hours strip persists in app shell (top or bottom). Scanner removed S21 (subsumed by Pulse).

---

## Extensibility Model

### Sectors are data

```sql
CREATE TABLE sector_groups (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT,
  display_name    TEXT NOT NULL,
  data_source     TEXT NOT NULL,
  display_order   INTEGER,
  enabled         INTEGER DEFAULT 1
);

CREATE TABLE watchlist_tickers (
  ticker            TEXT,
  sector_group_id   TEXT,
  data_source       TEXT,
  display_name      TEXT,
  display_currency  TEXT,
  display_order     INTEGER,
  enabled           INTEGER DEFAULT 1,
  PRIMARY KEY (ticker, sector_group_id),
  FOREIGN KEY (sector_group_id) REFERENCES sector_groups(id)
);
```

### Indicators are Rust registry + SQLite settings

```sql
CREATE TABLE indicators (
  id              TEXT PRIMARY KEY,
  display_name    TEXT,
  pane_hint       TEXT,             -- 'overlay' | 'subpane'
  default_params  TEXT,             -- JSON
  enabled         INTEGER DEFAULT 1
);

CREATE TABLE indicator_settings (
  ticker          TEXT,
  indicator_id    TEXT,
  enabled         INTEGER DEFAULT 0,
  params_json     TEXT,
  PRIMARY KEY (ticker, indicator_id)
);
```

Adding a new indicator: new Rust module implementing `Indicator` trait + INSERT into `indicators`. Chart component is indicator-agnostic.

### News feeds pluggable

```sql
CREATE TABLE news_feeds (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  url             TEXT,
  display_name    TEXT,
  refresh_minutes INTEGER DEFAULT 15,
  enabled         INTEGER DEFAULT 1,
  user_hidden     INTEGER DEFAULT 0   -- M8.5 soft-delete; seed INSERT OR IGNORE no-ops on hidden rows
);
```

Dispatcher routes by `source_type`. One fetcher module per type. Settings → News Feeds tab CRUDs this table; soft-delete via `user_hidden=1` so seed rows stay user-removable across boots.

---

## File Structure

```
personal-terminal/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── macro_cmds.rs
│   │   │   ├── quotes.rs
│   │   │   ├── news.rs
│   │   │   ├── sectors.rs
│   │   │   ├── indicators.rs
│   │   │   └── market_hours.rs     # feature #2
│   │   ├── sources/
│   │   │   ├── fred.rs
│   │   │   ├── coingecko.rs
│   │   │   ├── yahoo.rs
│   │   │   └── news/
│   │   │       ├── mod.rs
│   │   │       ├── finnhub.rs
│   │   │       └── rss.rs
│   │   ├── indicators/
│   │   │   ├── mod.rs              # trait + registry
│   │   │   ├── smma.rs             # shared primitive
│   │   │   ├── smma_ribbon.rs
│   │   │   ├── rsi.rs
│   │   │   └── atr.rs
│   │   ├── db/
│   │   ├── scheduler.rs
│   │   └── config.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── SidebarNav.tsx
│   │   │   ├── MarketHoursStrip.tsx  # feature #2
│   │   │   └── CommandPalette.tsx    # feature #3
│   │   ├── charts/
│   │   │   ├── Sparkline.tsx
│   │   │   ├── FeatureChart.tsx      # features #4, #6
│   │   │   ├── OverlayChart.tsx      # feature #1
│   │   │   └── IndicatorPanel.tsx
│   │   ├── macro/
│   │   │   ├── MacroDashboard.tsx    # feature #9 heatmap view
│   │   │   └── MacroHeatmap.tsx
│   │   ├── indices/
│   │   ├── equities/
│   │   ├── crypto/
│   │   ├── futures/
│   │   ├── news/
│   │   ├── scanner/                   # feature #10
│   │   │   └── IndicatorScanner.tsx
│   │   └── summary/
│   │       └── WatchlistPerformance.tsx  # feature #5
│   ├── hooks/
│   │   ├── useCache.ts
│   │   ├── useSectors.ts
│   │   ├── useSessionState.ts        # feature #7
│   │   └── useKeyboardShortcuts.ts   # feature #8
│   ├── styles/
│   ├── utils/
│   └── App.tsx
├── docs/
├── memory/
├── CLAUDE.md
├── PROGRESS.md
├── package.json
└── vite.config.ts
```

---

## Data Flow

```
┌──────────────┐  scheduled   ┌──────────┐  writes   ┌────────┐
│  Fetchers    │─────────────>│ Pipelines│──────────>│ SQLite │
│  FRED /      │              │  + cache │           │  cache │
│  Yahoo /     │              └──────────┘           └────┬───┘
│  CoinGecko / │                                          │
│  Finnhub /   │                                          │ Tauri IPC, cache-first
│  RSS         │                                          v
└──────────────┘                                     ┌──────────┐
                                                     │  Rust    │
                                                     │ indicator│
                                                     │ compute  │
                                                     └────┬─────┘
                                                          │ IndicatorOutput + bars
                                                          v
                                                     ┌──────────┐
                                                     │  React   │
                                                     │ +ECharts │
                                                     └──────────┘
```

**Fetch cadence:**
- FRED: daily
- Yahoo quotes: 5 min (market hours) / 1 hour (off-hours)
- Yahoo historical bars: on-demand, cached in `price_history`
- CoinGecko: 5 min
- Finnhub news: 15 min
- RSS: 30 min

---

## SQLite Schema (v1)

```sql
-- Sector / watchlist (extensibility core)
CREATE TABLE sector_groups (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT,
  display_name    TEXT NOT NULL,
  data_source     TEXT NOT NULL,
  display_order   INTEGER,
  enabled         INTEGER DEFAULT 1
);

CREATE TABLE watchlist_tickers (
  ticker            TEXT,
  sector_group_id   TEXT,
  data_source       TEXT,
  display_name      TEXT,
  display_currency  TEXT,
  display_order     INTEGER,
  enabled           INTEGER DEFAULT 1,
  PRIMARY KEY (ticker, sector_group_id),
  FOREIGN KEY (sector_group_id) REFERENCES sector_groups(id)
);

-- Quote cache (live) + price history (bars for feature chart)
CREATE TABLE quote_cache (
  ticker            TEXT,
  data_source       TEXT,
  price             TEXT,
  currency          TEXT,
  change_pct_24h    TEXT,
  change_abs_24h    TEXT,
  market_cap        TEXT,
  volume_24h        TEXT,
  sparkline_7d      TEXT,
  last_fetched      TEXT,
  PRIMARY KEY (ticker, data_source)
);

CREATE TABLE price_history (
  ticker        TEXT,
  data_source   TEXT,
  bar_date      TEXT,
  open          TEXT,
  high          TEXT,
  low           TEXT,
  close         TEXT,
  volume        TEXT,
  PRIMARY KEY (ticker, data_source, bar_date)
);

-- Indicator registry + per-ticker settings
CREATE TABLE indicators (
  id              TEXT PRIMARY KEY,
  display_name    TEXT,
  pane_hint       TEXT,
  default_params  TEXT,
  enabled         INTEGER DEFAULT 1
);

CREATE TABLE indicator_settings (
  ticker          TEXT,
  indicator_id    TEXT,
  enabled         INTEGER DEFAULT 0,
  params_json     TEXT,
  PRIMARY KEY (ticker, indicator_id)
);

-- FRED
CREATE TABLE fred_series (
  series_id      TEXT PRIMARY KEY,
  title          TEXT,
  units          TEXT,
  frequency      TEXT,
  category       TEXT,
  last_fetched   TEXT,
  tile_visible   INTEGER NOT NULL DEFAULT 1   -- 0 = Analysis-only series (USREC, treasury tenors below DGS10); MACRO dashboard hides at tile-build time
);

CREATE TABLE fred_observations (
  series_id      TEXT,
  obs_date       TEXT,
  value          TEXT,
  PRIMARY KEY (series_id, obs_date)
);

-- News
CREATE TABLE news_feeds (
  id              TEXT PRIMARY KEY,
  source_type     TEXT NOT NULL,
  url             TEXT,
  display_name    TEXT,
  refresh_minutes INTEGER DEFAULT 15,
  enabled         INTEGER DEFAULT 1,
  user_hidden     INTEGER DEFAULT 0
);

CREATE TABLE news_items (
  id             TEXT PRIMARY KEY,
  feed_id        TEXT,
  source         TEXT,
  headline       TEXT,
  url            TEXT,
  published_at   TEXT,
  category       TEXT,
  fetched_at     TEXT,
  FOREIGN KEY (feed_id) REFERENCES news_feeds(id)
);

-- App config (KV for session persistence + user prefs)
CREATE TABLE config (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- v1.1 Analysis tool registry (S16). Mirrors `indicators` registry shape;
-- each tool is a Rust compute module + React tab component pair sharing `id`.
-- Full spec in `.projects/02_v1_1_analysis/v11_analysis_design.md`.
CREATE TABLE analysis_tools (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  scope           TEXT NOT NULL,             -- 'cross_asset' | 'macro' | 'sentiment'
  display_order   INTEGER NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  config_json     TEXT
);
```

WAL mode. Seed data on first run populates `sector_groups`, `watchlist_tickers`, `fred_series`, `news_feeds`, `indicators`, `analysis_tools`.

---

## Milestones

| M | Deliverable | Effort |
|---|-------------|--------|
| **M1** | Tauri scaffold + SQLite init + `sector_groups`/`watchlist_tickers` schema + seed data + one FRED tile end-to-end | weekend |
| **M2** | MACRO/DASH — all ~18 FRED tiles + category tabs + ECharts feature chart + **linked cursor** (feature #6) + **macro heatmap view** (feature #9) | weekend |
| **M3** | Yahoo Finance fetcher + US EQUITIES (10) + INDICES (15) + sidebar nav skeleton + **market-hours strip** (feature #2) | weekend |
| **M4** | CA EQUITIES — all 5 sector groups, collapsible sidebar | weekend |
| **M5** | CRYPTO + FUTURES & FX (CoinGecko live + Yahoo history, Yahoo futures/FX) | weekend |
| **M6** | Indicator framework — Rust trait + registry + ECharts wiring + SMMA Ribbon + RSI + ATR + flip markers + **regime shading** (feature #4) + **multi-ticker scanner** (feature #10) | weekend |
| **M7** | NEWS — Finnhub + RSS, pluggable feed dispatcher | weekend |
| **M8** | Polish — refresh indicators (LIVE/CACHED), settings modal, API-key UI, "add sector" UI, indicator toggle UI + **session persistence** (feature #7) + ~~keyboard shortcuts (feature #8)~~ DROPPED | weekend |
| **M8.5** | Maintenance — hard-delete-with-cascade (`purge_ticker`) + RSS feed CRUD + SQLite VACUUM/checkpoint/integrity-check + orphan-row sweep + move-DB with pointer file + Backup-copy. Inserted post-M8 as giveaway-readiness work | weekend |
| **M9** | Feature layer — **multi-ticker overlay chart** (feature #1) + **command palette Ctrl+K** (feature #3). Feature #5 (Watchlist Performance) confirmed redundant with Scanner; not shipped separately | weekend |
| **M10** | **Indicator parameter tuning UI** (post-v1) — per-ticker popover for SMMA Ribbon lengths + confirm_bars, RSI length, ATR length. Reset-to-defaults, hard-coded range validation, inline community-defaults warning. Full spec below. | weekend |

Each milestone self-contained. M1 establishes extensibility model; M6 slots indicators; M9 layers cross-cutting productivity features atop the complete core. M10 is post-v1 — landing only after M1–M9 ship clean.

---

## M10 detailed spec — Indicator parameter tuning UI (post-v1)

**Purpose.** Let users adjust per-ticker indicator parameters through UI without editing SQLite manually. All plumbing already exists (built in M6); M10 is frontend-only.

### Indicator lineage (captured here to avoid re-research)

The SMMA Ribbon is a 4-line extension of **Bill Williams' Alligator indicator** (1995, *Trading Chaos*). Infrastructure facts that shape the tuning UI:

- **Williams' original Alligator** — 3 SMMAs on hl2, lengths 5/8/13, forward-shifted, states "sleeping / awakening / feeding / sated". Published, well-documented, canonical on every charting platform.
- **SMMA Ribbon (our build)** — 4 SMMAs on hl2, lengths 15/19/25/29, no forward shift, states bullish / bearish / neutral. Reverse-engineered from the public basnijholt gist via trendscope.
- **SMMA primitive** — Wilder's RMA, 1978 (*New Concepts in Technical Trading Systems*). The recursion `smma[i] = (smma[i-1] * (length - 1) + src[i]) / length` is canonical; no tuning lever inside the primitive.
- **Ordering-based trend classifier** — the idea of "MA line ordering = trend state" predates Williams; no single inventor.
- **No published parameter-sweep optimization exists** for the 4-length quartet. 15/19/25/29 is convention, not optimum. Pineify's SMMA reference explicitly calls these values "arbitrary."
- **Only measured tuning lever is `confirm_bars`.** trendscope's "Tuning journey" (S1 of that project) tested confirm=1/3/5 and found <1% shift in state distribution + 5-15% change in flip count — marginal. confirm=3 is the "good enough" default.
- **Untried lever**: pre-smooth hl2 with a 3-5 period EMA before the SMMA pipeline (trendscope's "B2" hypothesis). Attacks noise at input rather than output. Not implemented anywhere; would require adding a `pre_smooth_ema: Option<usize>` field to `SmmaRibbonParams`.
- **Author scope caveats** (from CTO Larsson + community confirmation):
  - Works on **4h to monthly timeframes**. Not hourly, not HFT.
  - Works on **tech stocks and cryptocurrencies**. Not commodities — the FUTURES & FX section's tickers are essentially out-of-scope for the indicator's design intent.

### Existing infrastructure (verify before implementing)

Already in place from M6 — the UI plugs into these without backend changes:

- **DB schema:** `indicator_settings (ticker, indicator_id, enabled, params_json)` — `params_json` is TEXT, nullable, storing a JSON object of indicator-specific params.
- **Rust deserialisation:** `SmmaRibbonParams`, `RsiParams`, `AtrParams` all derive `Deserialize` with `#[serde(default)]`. Malformed or missing JSON falls back via `Default` to the indicator's `default_params()`. NaN, negative, or out-of-range values deserialise but may misbehave at compute time → frontend must validate.
- **Compute path:** `compute_indicators(request)` reads `indicator_settings.params_json` for the `(ticker, indicator_id)` pair. Parses to `serde_json::Value`. If parse fails OR the row is absent → uses `ind.default_params()` from the registry.
- **Persistence:** `set_indicator_setting(ticker, indicatorId, enabled, paramsJson)` command. Passing `paramsJson: null` upserts the column to NULL → compute falls back to defaults (this is the Reset-to-defaults mechanism).
- **Registry metadata:** `list_indicators` returns `IndicatorRegistration { id, displayName, pane, defaultParams }`. `defaultParams` is the full JSON used as the UI's reset target AND as the initial form value when no override exists yet.

### UI design

- **Trigger:** small gear icon (⚙) on each enabled `IndicatorChip` in the feature-chart header. Disabled indicators don't show the gear (you can't tune something that's off).
- **Popover anchored to the chip.** Click outside to dismiss.
- **Content:**
  - Numeric inputs per indicator, with labels:
    - SMMA Ribbon: four `lengths[]` inputs labelled `v1 / m1 / m2 / v2`, one `confirm_bars` input
    - RSI: one `length` input
    - ATR: one `length` input
  - Inline italicised warning (always visible, never collapsed):
    *"Defaults are community-validated. Changes have marginal measured effect per trendscope's confirm_bars calibration (1/3/5 tested, <1% state shift). See LESSONS.md IND-1."*
  - Reset-to-defaults button (bottom-right, secondary style). Writes `paramsJson: null` → backend upserts NULL → next compute uses defaults.
  - Optional compact "ⓘ Lineage" link opening a brief modal with the lineage note above.
- **Interaction:**
  - Inputs debounce 500ms after last keystroke, then commit:
    `invoke('set_indicator_setting', { ticker, indicatorId, enabled: true, paramsJson: JSON.stringify(params) })`
  - On successful commit: parent `TickerDashboard` re-invokes `compute_indicators` → chart redraws.
  - Invalid inputs (outside ranges below) show a red border and skip commit. The last-valid value stays in `indicator_settings`.

### Parameter validation ranges (hard-coded in UI)

| Indicator | Param | Range | Note |
|---|---|---|---|
| SMMA Ribbon | each `lengths[i]` | integer, `[2, 200]` | Below 2 degenerate; above 200 exceeds tested timeframes + produces extreme lag. Four lengths need NOT be strictly ordered — state classifier handles any ordering. |
| SMMA Ribbon | `confirm_bars` | integer, `[1, 20]` | 1 = raw state (no confirmation). 20 = extreme whipsaw filter; beyond that, transitions become meaningless. |
| RSI | `length` | integer, `[2, 100]` | Wilder's original is 14. Community variants 2-30. |
| ATR | `length` | integer, `[2, 100]` | Same range/reasoning as RSI. |

### Explicit non-goals (keep M10 tight)

1. **No "preset" dropdown.** No "Crypto Preset / Tech Preset / Custom". Until empirical validation exists, presets imply legitimacy they don't have.
2. **No per-sector or global defaults via UI.** Schema is per-ticker only. If the need arises later, add a `config.indicator_default.<indicator_id>` KV — do NOT retrofit it onto `indicator_settings`.
3. **No A/B comparison overlay** (render current params vs defaults as ghost lines). Nice-to-have but adds chart-rendering complexity; split into a separate ticket.
4. **No backtest integration.** Measuring whether param changes improve flip profitability is a separate future feature tracked under PROGRESS.md → Discovered → "Backtesting module" (inherited from trendscope's own gap).
5. **No param-change history / undo stack.** SQLite is the record. User can inspect `indicator_settings.params_json` manually if needed.
6. **No "Lock defaults" toggle.** If the user wants to be protected from themselves, they can just not click the gear.

### Files touched (estimate, all frontend)

- `src/components/IndicatorPanel.tsx` — add gear icon on each enabled chip + popover host
- `src/components/IndicatorSettingsPopover.tsx` — new, ~150 LOC (form + validation + save/reset)
- `src/styles/app.css` — popover, form input, reset-button styles
- No Rust changes. No schema changes. No new commands.

### Acceptance criteria

1. Gear icon appears on each enabled indicator chip; clicking opens popover anchored to the chip.
2. Popover shows all that indicator's params as numeric inputs with current values (override if present, else defaults).
3. Debounced save (500ms) triggers backend upsert + chart recompute.
4. Invalid inputs show red border; no commit happens; last-valid value persists.
5. Reset-to-defaults button writes NULL to `params_json` and chart reverts to defaults within 1s.
6. Inline community-defaults warning is visible by default (not collapsed).
7. Param changes persist across app restart (close + reopen, same ticker shows custom values).
8. Switching to a different ticker shows that ticker's own params (no bleed).
9. Toggling an indicator off then on preserves the custom params.

### When M10 ships, also update

- `memory/MEMORY.md` — add `m10_tuning_ui.md` pointer, strike "Indicator confirm_bars UI" from Open Questions.
- `LESSONS.md` — add any new gotchas learned during implementation.
- `PROGRESS.md` — add session entry; consider updating `CLAUDE.md` principle 4 "Port trendscope math verbatim" to clarify that params are now user-adjustable while primitives remain verbatim.

---

## Open Questions

Defer until implementation forces:

1. API-key management UI — env-var-first today; settings modal + Tauri keyring slotted for M8.
2. Yahoo TSX after-hours cadence — blocked on adaptive-TTL work, revisit post-M8.
3. Command palette fuzzy-match library — Fuse.js vs simple custom matcher (M9).

**Resolved:**
- Plotting: Apache ECharts → M2
- Crypto history beyond 1Y: Yahoo fallback, on-demand
- Indices: separate section, 15 majors, local currency
- Layout density: 150px fixed row height + 2-line title clamp → v0.6
- Theme: dark-only, light theme out of scope for v1 → v0.6
- FRED values: TEXT in SQLite, parsed to f64 on read → v0.6
- Currency display: per-ticker `display_currency` column → v0.6
- Indicator compute: Rust-side, trait-based registry, f64
- Indicators: universally available, default OFF per ticker
- First three indicators (M6): SMMA Ribbon + RSI + ATR + flip markers
- Feature layer: 10 features distributed across M2, M3, M6, M8, M9
- **Indicator parameter tuning UI** → scoped and specified as M10 (post-v1). Per-ticker popover UI against existing `indicator_settings.params_json` column. See "M10 detailed spec" section.
- **News architecture (M7):** `INSERT OR IGNORE` on `(source, external_id)` PK; per-ticker news path routed through `watchlist_tickers` not `news_feeds` so watchlist-edit = news-coverage-change. Save-everything cache-first with 30-day retention on `fetched_at`. Category chips derived from `category` column; geopolitics folded into `world` for v1.

---

## Reference: trendscope port checklist

From `E:\Users\PBL\Documents\Dev\trendscope\src\trendscope\indicators.py`:

| Function | Lines | Rust destination |
|----------|-------|------------------|
| `smma(src, length)` | ~20 | `indicators/smma.rs` |
| `larsson_state(df, lengths)` | ~40 | `indicators/smma_ribbon.rs` |
| `confirm_state(raw_state, confirm_bars)` | ~20 | same module |
| `state_flips(df)` | ~15 | same module |
| `rsi(close, length)` | ~15 | `indicators/rsi.rs` |
| `atr(high, low, close, length)` | ~15 | `indicators/atr.rs` |

~130 lines Python → ~200 lines Rust. One weekend (M6).

**Read before porting:** `trendscope/CLAUDE.md` — "Tuning journey" section. confirm=3 is "good enough"; don't re-tune without calibration data.
