# Project Memory — Private Terminal

(Renamed from Personal Terminal — S11. Internal binary/AppData/DB filename retain `personal-terminal` for backwards compat with existing data.)

## Project Status
- **S20 (2026-05-02) — v1.2 killer-feature design (Pulse) + database reformulation shipped on master at `05416a0`.** Three-arc session: (1) brainstorm landing on **Pulse** as the v1.2 killer feature — single-screen percentile-rank cross-section heatmap covering every watchlist ticker + macro series across REGIME / AGE / LEVEL / RSI / ATR / VOL / DD columns. Sortable, filterable, click-to-chart. Pure descriptive (no prediction → respects principle 9). Two long-form design docs locked under `.projects/03_cross_section_heatmap/` (`pulse_design.md` + `database_expansion.md`). (2) Full DB seed reformulation: 72 → 176 tickers + 25 → 29 FRED series. Symmetric US ↔ CA sub-sectors (10 each). New top-level groups: WATCHLIST (empty user slot), COMMODITIES (sub-sectored), FX, BONDS & RATES, VIX & RISK + PULSE pinned position 0. INDICES sub-sectored by region. Drops: BRK-B + USDT/USDC stablecoins. Moves: GLXY + WULF to US. (3) Sidebar polish: 180→220px width + child-padding bump + global themed scrollbars via `*` selector at top of `app.css` (replaces per-element duplicates, applies app-wide automatically). Refresh/Prime gap diagnosed during smoke test — REFRESH only fetches quotes; SCANNER → PRIME button (S9 feature) handles batch-fetching missing history for new tickers. Pulse implementation blocked on user executing the manual DB reset workflow so v1 ships against a clean reformulated universe (no leftover `futures_fx` orphans). See `memory/s20_pulse_design_decisions.md`.
- **S19 (2026-05-02) — Drawdown subpane + watermark pin + Features-tab full rewrite shipped on master at `7fd94ec`.** First FeatureChart enhancement on the v1.1 priority queue. New `DD` toggle in the candlestick toolbar producing a red filled-area subpane below price (% from running peak, max=0%, auto-fit floor); pane-index math refactored from per-toggle conditionals to sequential `nextPaneIdx++` so future fixed subpanes drop in cleanly. Watermark pinning fix: was sliding into subpanes when many were on (chart-container centre); now extracts `grids[0]` price-pane centre and pins there, line-mode unchanged. Features tab rewritten 7 cards → 19 cards across 4 section headers (Chart Overlays & Subpanes / Indicators / Analysis Section / Dashboard & Layout), closing the discoverability gap where the entire v1.1 Analysis surface had zero coverage. Analysis cards kept succinct since `<TabIntro>` carries the depth. SMMA Ribbon "Base" toggle behaviour diagnosed (intrinsic ECharts stacking + AUTO Y interaction, not a regression) + documented via Tip in the SMMA card. y-axis name labels on subpanes tried + reverted ("looks odd"). DD placement decision: kept in toolbar over IndicatorPanel due to persistence-shape mismatch (RSI/ATR are Rust-computed per-ticker; DD is TS-computed global) — moving to IndicatorPanel would require an adapter for what's really just frontend math. See `memory/s19_drawdown_decisions.md`.
- **v1.1 Analysis section Phase 3 fully shipped on master (2026-05-02, S18).** Master was `d471633` after S18, then `fc0c6c9` after the docs commit. Seven Analysis tabs live: Correlations · Yield Curve · Pairs · RRG · Recession Prob · Financial Conditions · Regime Quadrant. S18 closed out Phase 3 with the Macro Regime Quadrant — INDPRO YoY × CPI/PCE YoY 4-quadrant scatter, baseline-anchored crosshairs (not 0/0 — US inflation has been positive for decades; 0/0 split would put the entire trail in upper half), 12/24/36/48-month trail picker, deliberate crosshair-styling divergence from RRG (Regime baselines fall at non-round values that don't coincide with the gridline grid; RRG's 100/100 split does, so RRG doesn't need an explicit crosshair line). Quadrant-label fontSize bumped 10 → 16 across both RRG + Regime in lockstep; left-side labels moved to `left: 80` to clear RRG's longer y-axis tick labels. Watermark-style quadrant labels (mirroring `FeatureChart.tsx:769-787` ticker watermark) considered + deferred. 20/20 analysis math tests green (3 new YoY helper tests). Zero new FRED series — INDPRO + CPIAUCSL + PCEPILFE were all already seeded since M2.
- **v1.1 Analysis section Phase 2 + Phase 3 (lean) shipped on master (2026-04-30, S17).** Master was `d2e9a30`. Six Analysis tabs live before S18 added the seventh. Phase 2 added Pairs (ratio + rolling z-score, single-pickers via TickerChipPicker `maxChips=1`, Correlations cell-click cross-link via localStorage handoff + CustomEvent) + RRG (JdK weekly resample, four-quadrant scatter, Apply pattern on benchmark). Phase 3 lean added Recession Prob (`RECPROUSM156N` + 30/50% threshold lines) + FCI (`NFCI` + zero baseline). All four new tabs + retrofitted Phase 1 tabs ship with `<TabIntro>` per the new S17-codified pattern (subtitle + collapsible "How to read this" + collapsible "The math" + standard liability footer). Two ECharts smoke-test crashes caught + fixed (EC-14 visualMap+markArea, EC-15 display:none chart-init). See `memory/s17_phase2_phase3_decisions.md`.
- **v1.1 Analysis section Phase 1 shipped on master (2026-04-29, S16).** Correlations + Yield Curve tabs. Backend: `src-tauri/src/analysis/` module (no trait, const registry + per-tool typed compute free functions, alignment helper with 50%-coverage gate, 5 IPC commands, 10 math unit tests). Frontend: 4 React components, `useRecessionBars` hook with module-level cache, ECharts dual-pane yield-curve rendering with NBER recession-bar overlays. New schema: `analysis_tools` table + `tile_visible` column on `fred_series`. Seed: USREC + DGS3MO/DGS2/DGS5/DGS30 (analysis-only, hidden from MACRO) + 2 analysis_tools rows + new 'analysis' sector_groups row.
- **Repo infrastructure shipped same session (S16):** git init at v1.0.0-rc.1, `.projects/<NN_name>/` reorganization with credential-isolated `infrastructure/` folder, archive convention for PROGRESS pruning (`archive/README.md` + first archive `2026-04-29_v1_0_build_arc.md` carrying S1–S13).
- **Awaiting cold-eye tester feedback on v1.0.0-rc.1** (parallel track, unchanged). No code commitments on RC1 until feedback lands.
- S15 (2026-04-28) — three-track design + cleanup session. (1) Walked through all 6 pre-Phase-1 open questions on the v1.1 Analysis-section design sketch and locked decisions. (2) Tokens-system audit + `src/styles/chartTheme.ts` extraction (new runtime mirror for ECharts options) + `app.css` rgba consolidation (~33 hardcoded color literals → 0). Three new accent tokens (`--accent-amber/yellow/blue`); `tokens.css` `/* [L] */` markers for light-theme readiness; visual smoke-test passed. (3) **Phase 1 implementation plan** — nine-step planning walkthrough locking: DB schema (new `analysis_tools` table + `tile_visible` column on `fred_series`), Rust pattern (no trait, const registry + per-tool typed free functions), compute I/O shapes, alignment exclusion rule (50% lookback), IPC catalog (single `analysis_cmds.rs`), TS types (`src/types/analysis.ts`), frontend tree (`src/components/analysis/` directory + `useRecessionBars` hook), `.settings-tabs` → `.tab-strip` CSS refactor, per-tool `usePersistedState` keys, math-only Rust unit tests. Plan executed as designed in S16.
- S14 (2026-04-27) shipped one-line FeatureChart candlestick tooltip precision fix (magnitude-scaled decimals via new `formatTickerValue` helper) + drafted v1.1 Analysis-section design sketch at `.projects/02_v1_1_analysis/v11_analysis_design.md`.
- **v1.0.0-rc.1 shipped to first cold-eye tester (2026-04-26, S13).** All v1 release blockers cleared. Major UX consolidation this session: Manage Watchlist 3-tab modal replaces sidebar `Manage Groups` + dashboard inline `EDIT` toggle (one button, one surface for tickers + groups + news feeds). Group reparenting added (extends `update_sector_group` with tri-state `new_parent_id`, 2-level cap enforced backend-side). Stacked-buttons table-layout bug fixed via single-`<td>` pattern. SCANNER/MACRO/NEWS pinned at sidebar top with separator. Settings 6→5 tabs (News Feeds moved out). About-tab PrivateACB copy rewritten using local PrivateACB CLAUDE.md after web fetch returned 403 — corrected to "desktop crypto tax calculator for Canada, the US, Australia, and the UK" (was wrong on product type and jurisdictions). Version bumped 0.1.0→1.0.0-rc.1 in **four** files (`version.ts` comment was missing `tauri.conf.json`). Production build (19.8 MB exe) + tester README packaged into `release/private-terminal-v1.0.0-rc.1.zip` (8.1 MB), uploaded to Drive. See S13 entry in PROGRESS.md and `memory/s13_decisions.md`.

## Remaining before v1.0.0 final
1. **Cold-eye tester feedback round.** Friend running RC.1 with no prior exposure. No code commitments until feedback lands.
2. **Bump 1.0.0-rc.1 → 1.0.0** in 4 places when feedback is clean. Rebuild. Ship.
- **M8.5 Maintenance complete (2026-04-25, S10).** Inserted between M8 and M9 as giveaway-readiness work. Four shipped items: (a) hard-delete-with-cascade `purge_ticker` (option C — soft-delete watchlist row + cascade cache tables only when last visible occurrence), (d) RSS feed CRUD via Settings → News Feeds tab (new `news_feeds.user_hidden` column matching the soft-delete pattern), (c) `db_maintenance` (integrity_check + double-checkpoint VACUUM) + `purge_orphaned_data` orphan sweep + Storage tab, (b) move-database with `<data_dir>/db_location.txt` pointer file + Backup-copy sibling action via `tauri-plugin-dialog`. See S10 entry in PROGRESS.md and `memory/m85_maintenance_decisions.md`.
- **M8 code-complete (2026-04-24, S9).** Shipped session persistence (feature #7), scanner prime-histories (M6 gap closed), TS cleanup on FeatureChart (`tauri:build` now passes), Settings modal (API keys via SQLite KV + env fallback; user-customizable SMMA palette with 5 presets + per-color pickers; About tab with PrivateACB cross-promo placeholder + hidden-shortcut tips), tile range switch (1D/1W/1M/YTD/1Y). Keyboard shortcuts (#8) intentionally dropped — positional bindings conflict with user-editable groups; Ctrl+K in M9 covers that need properly. Remaining outside-code: icon swap + optional palette review. See S9 entry in PROGRESS.md and `memory/m8_polish_decisions.md`.
- **M8 Phase 1 shipped + verified (2026-04-24, S8 second half).** User-editable watchlist + groups — add/remove/rename/move tickers; create/rename/delete/reorder groups. Finnhub per-ticker news (US equities) wired. SMMA Ribbon palette centralized via CSS vars + mirrored Rust constants (palette choice now user-customizable via Settings → Appearance as of S9). See `memory/m8p1_edit_decisions.md`.
- **M7 shipped + verified (2026-04-24, S8).** NEWS — 8 RSS feeds (BBC Business/ME, Al Jazeera, CNBC, Financial Post, CBC Business, Fed/BoC press) + Finnhub general (now enabled; key in `.env`). Pluggable `source_type` dispatcher, `INSERT OR IGNORE` dedupe on `(source, external_id)`, 30-day retention on boot, `tauri-plugin-opener` for external links. See `memory/m7_news_decisions.md`.
- **M6 shipped + verified (2026-04-24, S7).** Indicator framework — Rust trait/registry + SMMA Ribbon + RSI(14) + ATR(14) + flip markers + Scanner section. SMMA Ribbon renamed from "Larsson Line" after lineage correction. See `memory/m6_indicator_rename.md`.
- **M5 shipped + verified (2026-04-24, S6).** CRYPTO (10 top tokens) + FUTURES & FX (CL/GC/SI/NG/HG + DXY). Seed-only delivery — no code touched; the extensibility-first pipeline absorbed both sections. See `memory/m5_crypto_futures_decisions.md`.
- **M4 shipped + verified (2026-04-24, S5).** CA EQUITIES — 5 sub-sectors (Energy / Banking / Telecom / Crypto Miners / Metal Miners), 31 tickers, collapsible sidebar tree. `TickerDashboard` reused unchanged; only Sidebar + App router touched. See `memory/m4_sidebar_decisions.md`.
- **M3 shipped (2026-04-24, S4).** Yahoo Finance fetcher (/v8/chart pivot after /v7 blocked) + US EQUITIES + INDICES + sidebar + market-hours strip + 24h heatmap on ticker tiles. See `memory/m3_ticker_decisions.md` and `memory/yahoo_endpoint_gotcha.md`.
- **M2 shipped + verified (2026-04-24, S3).** 18 FRED tiles, 6 category tabs, heatmap toggle (sign+magnitude tiers), ECharts feature chart with history, `connect('macro')` group wired for future multi-chart. See `PROGRESS.md` S3.
- **M1 shipped + verified (2026-04-24, S2).** Tauri v2 + SQLite (plain, no SQLCipher) + FRED DGS10 tile end-to-end. See `PROGRESS.md` S2 for the full delivery log and verification gate.
- Design sketch v0.5 complete in `docs/DESIGN.md`. Scope iterated five times in S1.

### Memory index
- [M2 dashboard design decisions](m2_dashboard_decisions.md) — batch IPC, no sparklines on MACRO, heatmap as toggle, inline overlay feature chart, `connect('macro')` group
- [Tile grid sizing convention](tile_grid_convention.md) — fixed row height + 2-line title clamp + hover-tooltip, validated on MACRO S3
- [M3 ticker / sidebar design decisions](m3_ticker_decisions.md) — no sparklines on ticker tiles (deferred), 15m flat TTL, INDICES flat grid, greyed unbuilt sections, market-hours strip at top. Includes explicit deferral list.
- [Yahoo endpoint gotcha](yahoo_endpoint_gotcha.md) — /v7/quote blocked (401 without crumb); /v8/chart works for quote+history. One call per symbol, semaphore-capped.
- [M4 sidebar / CA EQUITIES decisions](m4_sidebar_decisions.md) — parents are collapse/expand only (no aggregated view), always-expanded initial state, TSX uses same TTL as US.
- [M5 CRYPTO + FUTURES & FX decisions](m5_crypto_futures_decisions.md) — Yahoo for all crypto (CoinGecko deferred), fixed top-10 watchlist (dynamic discovery deferred), no schema changes.
- [Indicator rename — Larsson Line → SMMA Ribbon](m6_indicator_rename.md) — S7 rename; canonical names (id `smma_ribbon`, struct `SmmaRibbonIndicator`, module `smma_ribbon.rs`) + why.
- [M7 NEWS decisions](m7_news_decisions.md) — 8 RSS feeds + disabled Finnhub, cache-first with 30d retention, per-ticker news deferred to M8 alongside ticker-edit UI, opener plugin permission shape.
- [M8 Phase 1 edit decisions](m8p1_edit_decisions.md) — soft-delete via `user_hidden`, ticker symbol immutable (rename = display_name only), data_source inherited from group, Finnhub US-only filter pattern.
- [M8 Polish decisions](m8_polish_decisions.md) — keyring pivot to SQLite KV (Windows silent no-op), user-customizable palette architecture, tile range-switch calendar lookback, keyboard shortcuts dropped for extensibility reasons.
- [M8.5 Maintenance decisions](m85_maintenance_decisions.md) — purge revival policy (option C), DB pointer file outside the DB, post-VACUUM checkpoint requirement, total-footprint as the canonical size, Finnhub negative-whitelist filter, soft-delete on news_feeds, Backup-copy filename strategy.
- [M8.6 Polish decisions](m86_polish_decisions.md) — rename to Private Terminal (user-visible only), market-hours-strip direction tied to index `change_pct_24h`, FeatureChart viewer state under `session.feature_chart_*`, log mode considered + dropped (ECharts power-of-10 tick limitation), Volume Profile parked for v1.1.
- [S12 release-blocker pass decisions](s12_decisions.md) — VRVP rendering choices (Approach B + dedicated value-axis + 180 bins + close-bucketing + POC yellow + tooltip suppression), Layout D header + StatusBar repurpose, Features tab content + Wilder/Williams attribution policy, Tier 1 ECharts polish (PNG save filename pattern + watermark sizes), `cargo clean -p` overcorrection.
- [S13 manage-watchlist refactor decisions](s13_decisions.md) — tabbed-modal landing (Option B single-pane), 2-level cap as hard constraint, `Option<Option<String>>` tri-state IPC pattern, `NEW_GROUP_SOURCES` vs `EDITABLE_SOURCE_SET` split for CoinGecko gap, sidebar pinned-trio model, About copy sourced from local PrivateACB CLAUDE.md, RC.1 versioning convention, 4-file version-bump list.
- [v1.1 Analysis Phase 1 design](../../02_v1_1_analysis/v11_analysis_design.md) — full spec for cross-asset Analysis section (registry-driven tabs, 4-phase plan). Phase 1 (Correlations + Yield Curve) shipped S16. Phase 2 (Pairs + RRG) shipped S17. Phase 3 lean (Recession Prob + FCI) shipped S17. Phase 3 finish (Macro Regime Quadrant) shipped S18. MACRO-tile retrofit + watermark-style quadrant labels deferred. Tab presentation pattern (S17) codified in the same doc.
- [S17 Phase 2 + Phase 3 (lean) decisions](s17_phase2_phase3_decisions.md) — RRG math choice (weekly + 14w + 5w SMA-anchored-at-100), Pairs no-log-axis, cross-tab handoff via localStorage + CustomEvent, TabIntro three-layer pattern + standard liability copy, plain-language copy register, Phase 3 lean scope (RecProb + FCI Analysis-only; Regime Quadrant deferred), FCI visualMap stripped (EC-14), display:none chart-init pattern (EC-15).
- [S18 Phase 3 finish — Regime Quadrant decisions](s18_regime_quadrant_decisions.md) — INDPRO YoY for growth axis (NAPM toggle deferred to v1.2), CPI YoY default + Core PCE toggle for inflation, baseline-anchored crosshairs (not 0/0), explicit-crosshair-on-Regime / no-crosshair-on-RRG deliberate divergence, calendar-month inner-join for INDPRO × CPI/PCE alignment, fontSize 16 + `left: 80` quadrant-label parity across RRG + Regime, watermark-style labels deferred, Option α scope (Regime Quadrant only — no shared `<MacroSeriesView>` retrofit).
- [S19 Drawdown subpane + Features-tab rewrite decisions](s19_drawdown_decisions.md) — sequential `nextPaneIdx++` pane-index pattern (replaces per-toggle conditionals), DD subpane placement above volume/indicators, DD toolbar vs IndicatorPanel tradeoff, watermark pinning to price grid via `grids[0]` extraction, y-axis name labels rejected after smoke (looked odd), Features-tab section-header grouping pattern, SMMA Ribbon AUTO-Y / Base interaction diagnosed (intrinsic, not a regression).
- [S20 Pulse design + database reformulation decisions](s20_pulse_design_decisions.md) — Pulse killer-feature concept (percentile cross-section heatmap, 7 columns, universal indicator compute), Time Machine + Conviction Forge alternatives evaluated + rejected, full database reformulation (symmetric US/CA sub-sectors + WATCHLIST/COMMODITIES/FX/BONDS/VIX top-levels + INDICES regional sub-sectors), drop BRK-B + stablecoins, move GLXY/WULF to US, +4 FRED series, sidebar 180→220px + global themed scrollbars via `*` selector, REFRESH-vs-PRIME architecture notes.
- [Pulse design (full spec)](../../03_cross_section_heatmap/pulse_design.md) — implementation-ready design doc for Pulse v1.2 build. 7 open questions to lock at build time. Read top-to-bottom in the build session.
- [Database expansion (Phase 0 spec)](../../03_cross_section_heatmap/database_expansion.md) — full ticker populations + reset workflow + rate-limit assessment + DB size estimate. Implementation shipped S20.

### M1 gotchas worth remembering
- **Windows build requires `src-tauri/icons/icon.ico` even with `bundle.active: false`** — `tauri-build` embeds a Windows Resource file on every build. Placeholder currently copied from PrivateACB; generate a terminal-branded one in M8 polish.

---

## User Preferences (imported from PrivateACB session, 2026-04-24)

Persistent preferences across all projects:

- **Cantonese speaker** — Jyutping only, never Chinese characters.
- **Honest collaboration** — don't agree automatically. Acknowledge merit briefly, point out weaknesses gently, avoid flattery.
- **Explain tradeoffs before proposing** — all viable options with consequences. Don't sell the easiest fix.
- **Ask before editing** — describe the change, wait for approval.
- **User owns infrastructure deploys** — skip paste/deploy/curl pedagogy.
- **CSS design tokens** — `var(--token)` from `tokens.css`, no hardcoded values.
- **Synthesize, don't echo** — cross-reference completed work; never parrot stale to-do lists.

---

## Project-Specific Decisions

### Architecture
- **No Cloudflare / no cloud** — user declined. Desktop-only.
- **Extensibility-first is a HARD CONSTRAINT** — sectors, tickers, news feeds, AND indicators are extensible. New sector/ticker/feed = INSERT. New indicator = one Rust module + INSERT. Never hardcode sector names, ticker lists, or indicator IDs.
- **Left sidebar navigation** — scales cleanly.
- **Unified `quote_cache`** keyed by (ticker, data_source). Separate `price_history` for bars.
- **News dispatcher by `source_type`** — one fetcher module per type.

### Scope (7 sections + indicator framework + 10 features, ~100 tiles)
- MACRO (FRED ~18) · INDICES (15) · CRYPTO (10) · US EQUITIES (10) · CA EQUITIES (31 / 5 sub-sectors) · FUTURES & FX (6) · NEWS
- **Free-tier first.** Paid sources only when free hits a wall.
- **No overlap with PrivateACB** — research dashboard, not a tax tool.

### Data sources
- **Yahoo Finance** — US + TSX equities, futures, DXY, world indices, crypto history. Unofficial API, batch quote endpoint.
- **CoinGecko** — crypto discovery + live; 1Y historical limit accepted.
- **User may explore additional news feeds post-v1** — NewsData.io, Benzinga, MarketAux candidates.
- **News (M7):** 8 RSS feeds + Finnhub general (disabled, no key). RSS via `feed-rs`, browser-like UA. Dispatcher keyed on `source_type` in `news_feeds`. One fetcher module per type. Per-ticker news deferred to M8.

### Charting & Indicators
- **Chart library: Apache ECharts** — MIT, ~1 MB gzipped. Chosen over Lightweight Charts (initial pick, reversed) for native fill-between-two-lines, grid subpane system, custom-series API, and linked-cursor `connect()`. Runner-ups: klinecharts.js, Plotly.js.
- **Don't swap chart library without real evidence ECharts is insufficient.**
- **Indicator compute: Rust-side, on-demand, not persisted.** Bars persist; indicators recompute. `f64` precision (display-only).
- **Indicators universally available.** Default OFF per ticker via `indicator_settings`.
- **First three indicators (M6):** SMMA Ribbon (quad-SMMA state + confirm_3), RSI(14), ATR(14), flip markers — ported from trendscope. Renamed from "Larsson Line" in S7 after learning the math is derivative of public community work (see `memory/m6_indicator_rename.md`).
- **Trait-based registry.** Chart component is indicator-agnostic.
- **Liability framing:** decision support, not investment advice.
- **ECharts color tokens via `chartTheme.ts` runtime mirror (S15).** ECharts options is a JS object; CSS `var()` doesn't resolve there. `src/styles/chartTheme.ts` reads computed CSS vars on first access via `getComputedStyle()` and exports a typed `ChartTheme` object. Every ECharts component does `const theme = getChartTheme()` at the top of its option-builder and references `theme.bgBase`, `theme.statusUp` etc. instead of literals. `refreshChartTheme()` clears the cache for future light/dark toggle. Companion `tokens.css` convention: every color token that gets `rgba()`'d has a `-rgb` triplet companion (`--accent-cyan` + `--accent-cyan-rgb`) so `rgba(var(--*-rgb), α)` works in CSS and `rgbaVar('--*-rgb', α)` works in chartTheme. See LESSONS EC-13.

### Feature layer (10 features)
Distributed across milestones:
- **M2:** linked cursor (#6), macro heatmap view (#9)
- **M3:** market-hours indicator (#2)
- **M6:** regime shading (#4), multi-ticker scanner (#10)
- **M8:** session persistence (#7), keyboard shortcuts (#8)
- **M9 (new):** multi-ticker overlay (#1), command palette Ctrl+K (#3), watchlist performance summary (#5)

Brainstormed but not selected for v1 (v1.1 candidates): seasonality heatmap, correlation heatmap, yield curve viz, earnings/economic calendar, volume profile, candlestick pattern detection, system tray, news sentiment coloring, backtesting module.

### Layout
- **INDICES is own top-level sidebar section** (between MACRO and CRYPTO). Not folded into MACRO.
- **Index values in local currency** — no FX conversion.

### Ticker decisions (v1 seed)
- **Hut 8** — Canadian listing (HUT.TO).
- **Galaxy Digital** — US NASDAQ listing (GLXY).
- **Futures** — all 5: CL=F, GC=F, SI=F, NG=F, HG=F.
- **DXY** — Yahoo's `DX-Y.NYB`.

### v1.1 Analysis section (S16)
- **Tool registry pattern (Q2 of S15):** const slice + const ANALYSIS_TOOL meta in `analysis/registry.rs` is the source of truth for which tools exist. DB `analysis_tools` row only carries user-editable `enabled` + `config_json`. Adding a Phase 2+ tool: write Rust compute module + React tab, add to const slice + `ANALYSIS_TAB_REGISTRY` map, INSERT into seed.sql.
- **No trait, free functions:** heterogeneous compute output (matrix vs curve vs segment list) makes a trait costlier than valuable. Per-tool typed signatures.
- **Alignment helper exclusion rule:** `bar_count >= lookback_days × 0.5`. Below threshold → `ExcludedTicker` carrying actual count. Same gate runs in chip-picker (greyed) and `align_close_prices` (excluded from join). UI carries the truth via `list_tickers_with_coverage` IPC.
- **`tile_visible` column on `fred_series`:** display-layer flag, NOT enumeration-layer. `list_fred_series` returns all rows; `list_macro_tiles` filters at tile-build time (Phase 3). FRED fetch fires for hidden series so analysis observations stay populated. See LESSONS DB-10.
- **Recession bars: shared hook over per-component fetch.** `useRecessionBars` has module-level cache + Promise dedup; multiple consumers share one fetch per session. Returns ECharts `markArea`-shaped data array. Visibility threshold for dark-bg overlay: α=0.30 minimum (0.18 was invisible — caught at smoke-test).
- **TickerChipPicker UX:** cap autocomplete at 12 results when query non-empty (scannability); show full list when query empty (browsability). Modal-for-bulk deferred from S15 Q2 spec — clear extension point in `TickerChipPicker.tsx`.
- **Yield curve tenors:** DGS3MO + DGS2 + DGS5 + DGS10 + DGS30. Only DGS10 visible on MACRO (was already there); the other 4 are `tile_visible=0` analysis-only. Spread series 2s10s default, 3m10y selectable.
- **Per-tool persistence:** one `usePersistedState` key per tool — `session.analysis_<tool_id>_config`. Plus `session.analysis_active_tab` for layout. Each tool's config shape lives with that tool's component.

### v1.1 Analysis Phase 2 + Phase 3 (S17)
- **TabIntro pattern (HARD CONSTRAINT for all Analysis tabs going forward):** `<TabIntro>` component (`src/components/analysis/TabIntro.tsx`) sits at the top of every Analysis tab between header controls and chart. Three layers: subtitle (always-visible, ~1 sentence, plain English) + collapsible "How to read this" (interpretation guide + standard liability close) + collapsible "The math" (formula reference, optional but recommended). Standard liability copy: *"Decision support, not investment advice. Patterns are descriptive, not predictive."* Codified in `.projects/02_v1_1_analysis/v11_analysis_design.md` "Tab presentation pattern" section. Phase 3 + Phase 4 + future tools must ship with TabIntro filled in — no merge to master without it.
- **Copy register: plain-language for users, technical for math.** First TabIntro draft was quant-jargon-heavy ("Pearson correlation of log returns over the chosen lookback…"); user explicitly asked for friendlier rewrite. Pattern for future tabs: side-by-side comparison in chat (current vs rewritten) before code edit. Math sections kept technical for power-user transparency.
- **RRG math (S17 lock):** weekly resample (last close per ISO week), 14-week RS-Ratio lookback, 5-week RS-Momentum lookback, simple SMA-anchored-at-100 formulation (`RS = ticker/benchmark; RS_Ratio = 100 × RS / SMA(RS, 14w); RS_Momentum = 100 × RS_Ratio / SMA(RS_Ratio, 5w)`). Approximates JdK's proprietary z-score-of-z-score; drift vs Bloomberg accepted because four-quadrant interpretation is preserved and formula stays explainable. Math noted in TabIntro "The math" section.
- **RRG benchmark Apply pattern (S15 Q3):** plain text input + Apply button — re-normalization is too costly to fire per-keystroke. Apply button is `disabled` when input matches current. Resolves dataSource by matching the current `list_tickers_with_coverage` result; falls back to `'yahoo'` for new tickers.
- **Pairs no log-axis:** dropped per S11 finding (ECharts default log axis squashes sub-decade ranges, exactly where ratios live). Path (a) manual `log10()` transform tracked separately for both Pairs and FeatureChart.
- **Cross-tab navigation pattern:** Correlations cell-click → Pairs tab pre-loaded. Implementation: write to `localStorage['session.analysis_pairs_handoff']` (JSON `{numerator, denominator}`) + dispatch `analysis-set-active-tab` `CustomEvent` with `detail: 'pairs_ratio'`. PairsTab reads + clears handoff on mount; AnalysisLayout listens for the event. localStorage chosen over `usePersistedState` (SQLite-backed) because handoff is ephemeral and must survive the tab swap (PairsTab unmounts/remounts as part of dispatch).
- **TickerChipPicker `maxChips`:** new optional prop; when `selected.length >= maxChips`, the input + dropdown auto-hide. Combined with `placeholder?: string` for the cap=1 case. Used by Pairs (numerator + denominator pickers).
- **Phase 3 lean scope:** Analysis-only first; MACRO-tile retrofit (S15 Q4 "both surfaces") deferred. Both RecessionProbTab + FinancialConditionsTab fetch from existing FRED helpers; no new compute math beyond passthrough. Single-FRED-series tools share a `MacroPoint { date, value }` shape in `analysis/mod.rs`.
- **Recession Prob defaults:** 30% / 50% threshold lines as metadata (not computed) — conventional NY Fed warn / imminent levels. Empty-state UI includes external FRED link because the NY Fed has paused publication in past periods.
- **FCI single-color line, NOT visualMap split.** First draft used ECharts `visualMap` with `pieces` to color amber-above-zero / cyan-below — caused immediate webview crash on first click. Combination of `visualMap.pieces` + 35-segment `markArea` + 2,800-point weekly series hits a pathological ECharts render path. Single-color line + zero baseline (labeled "long-run avg") + recession bars carries the narrative through description and zero crossings. Captured as **EC-14** in LESSONS.
- **Chart container always-visible (NOT `display: data ? 'block' : 'none'`).** First Phase 2 draft hid the ECharts container until data arrived; `echarts.init` ran against a 0×0 div and cached that size. When data arrived, ECharts didn't re-measure. Match the YieldCurveTab pattern: container is unconditionally laid out at `minHeight: 480/520`, loading + placeholder UI sits above. **EC-15**.

### Project organization (S16)
- **`.projects/<NN_name>/`** for all non-code artifacts. `00_*` cross-cutting; `01_*+` sequential project work numbered for findability. Screenshots live inside their project folder. Convention documented in `CLAUDE.md` "Project Organization" section.
- **`infrastructure/` (gitignored)** for credential scratchpads, API keys, webhook secrets. Never crosses into git history. Sibling to `.projects/`, not nested.
- **PROGRESS archive:** `.projects/00_tracking/archive/YYYY-MM-DD_<slug>.md`. Pruning recipe documented in `archive/README.md` — single Python pass with sanity-assert anchors, never chunked Read+Write (LLM-token cost). Triggers: major release OR >30 sessions OR >1000 lines.
- **Cargo.lock tracked** (binary-app convention; library projects ignore it).

---

## Reference Repos

### PrivateACB — infrastructure reuse
**Path:** `E:\Users\PBL\Documents\Dev\PrivateACB_Tauri`

| Asset | PrivateACB Path |
|-------|-----------------|
| CoinGecko client + symbol mappings | `src-tauri/src/currency/crypto/mappings.rs` |
| SQLite+WAL setup + schema migration | `src-tauri/src/db/` |
| Design tokens | `src/styles/system/tokens.css` |
| Primitives | `src/styles/primitives.css`, `tables.css` |
| Tauri IPC wrapper | `src/utils/tauri-api/` |
| Serde/IPC rules (MUST follow verbatim) | `.claude/rules/serde-ipc.md` |
| Coding standards | `.claude/rules/coding-standards.md` |

### trendscope — indicator math source
**Path:** `E:\Users\PBL\Documents\Dev\trendscope`

| Function | trendscope path | Rust destination |
|----------|-----------------|------------------|
| `smma(src, length)` | `src/trendscope/indicators.py` | `src-tauri/src/indicators/smma.rs` |
| `larsson_state()` + `confirm_state()` + `state_flips()` | same file | `src-tauri/src/indicators/smma_ribbon.rs` |
| `rsi(close, length)` | same file | `src-tauri/src/indicators/rsi.rs` |
| `atr(high, low, close, length)` | same file | `src-tauri/src/indicators/atr.rs` |

**Read before porting:** trendscope's `CLAUDE.md` "Tuning journey" section. confirm=3 is "good enough"; don't re-tune without calibration data.

**trendscope chart.py is NOT the port target** — Plotly-specific. We use ECharts. But its multi-pane layout pattern (dynamic row heights across price + volume + RSI) is a useful reference for `FeatureChart.tsx`.

---

## Open Design Questions

Defer until implementation forces:
1. Command palette fuzzy matcher — Fuse.js vs simple custom → M9
2. Yahoo TSX after-hours cadence → blocked on adaptive-TTL infrastructure (see `memory/m3_ticker_decisions.md`)
3. **Macro Regime Quadrant growth-axis: NAPM vs INDPRO** — design doc lists both. NAPM = forward-looking but FRED publication has gaps; INDPRO = clean monthly history but backward-looking. Recommend INDPRO for data hygiene; NAPM toggle as a v1.2 escalation if narrative-mismatch becomes an issue. Locked when the Regime Quadrant gets built.
4. **MACRO-tile retrofit for Recession Prob + FCI (S15 Q4 "both surfaces")** — Phase 3 lean shipped Analysis-only. If a `<MacroSeriesView mode="tile" \| "chart">` shared component lands later, the MACRO-tile addition becomes cheap. Flag during the Regime Quadrant session.

**Resolved (v0.5):**
- Plotting: Apache ECharts → M2
- Crypto history beyond 1Y: Yahoo fallback, on-demand
- Indices: separate section, 15 majors, local currency
- Indicator compute: Rust-side, trait-based, f64
- Indicators: universally available, default OFF per ticker
- First three indicators: SMMA Ribbon + RSI + ATR + flip markers (M6)
- Feature layer: 10 features across M2, M3, M6, M8, M9

**Resolved (v0.6, S7):**
- Layout density → info-dense tiles (150px fixed row height + 2-line title clamp + hover tooltip, see `memory/tile_grid_convention.md`)
- Theme → dark-only de facto; light theme out of scope for v1
- FRED values: TEXT in SQLite, parsed to f64 on read (M1)
- Currency display: per-ticker `display_currency` column on `watchlist_tickers`; no FX conversion
- Indicator rename: Larsson Line → SMMA Ribbon (see `memory/m6_indicator_rename.md`)
- Regime shading (feature #4) delivered as SMMA Ribbon envelope fill, not full-chart background — envelope width carries signal
- Indicator `confirm_bars` UI — scoped as part of post-v1 **M10 Indicator parameter tuning UI** (DESIGN.md "M10 detailed spec"). Infrastructure already in place from M6; M10 is frontend-only.

**Resolved (v0.7, S8):**
- News architecture — save-everything cache-first, 30d retention on `fetched_at`. `INSERT OR IGNORE` on `(source, external_id)` PK is the entire dedupe mechanism.
- Per-ticker news path routed through `watchlist_tickers` (not a second `news_feeds` row per ticker). Deferred to M8 alongside ticker-editing script so watchlist-change = news-coverage-change in one code path.
- Finnhub feed seeded disabled — flipping `enabled=1` once `FINNHUB_API_KEY` lands is the activation mechanism. No code change needed.
- Geopolitics chip deferred — ME feeds folded under `world` category for v1. Revisit if category count grows.

**Resolved (v0.8, S9):**
- Session persistence — generic `usePersistedState<T>` hook with debounced writes + `{loaded, hadStoredValue}` status. Scope: active sidebar section + parent-expand set only (feature charts always start closed). `config` KV keys namespaced as `session.*`.
- API-key storage — SQLite `config` KV (plaintext, user-dir protected) with `.env` fallback. NOT OS keyring: Windows keyring v3 silently no-ops (writes go to process-local store, not Credential Manager). See `memory/m8_polish_decisions.md` and LESSONS SEC-1.
- SMMA Ribbon palette — user-customizable via Settings → Appearance. CSS vars set at runtime via `document.documentElement.style.setProperty`; ECharts indicator colors remapped by series-name in `applyThemeToIndicators()`. Rust constants = defaults only.
- Keyboard shortcuts (feature #8) — DROPPED. Positional `Ctrl+1..9` conflicts with user-editable groups; hardcoded section slugs break extensibility. Ctrl+K palette in M9 is the correct extensible-native nav shortcut.
- Tile range switch (1D/1W/1M/YTD/1Y) — computed server-side in `list_ticker_tiles` via `Db::close_at_or_before()` calendar lookbacks. Frontend selection persisted under `session.tile_range`. Heatmap thresholds scale per range.

**Resolved (S17, 2026-04-30):**
- **Tab presentation pattern (S17):** every Analysis tab MUST render `<TabIntro>` (subtitle + "How to read this" + optional "The math" + standard liability footer). Hard rule for Phase 3 + Phase 4 + future tools — no merge to master without it. Codified in `.projects/02_v1_1_analysis/v11_analysis_design.md`. Phase 1 retrofit + Phase 2 ship landed together.
- **RRG math formulation (S17):** weekly resampling + 14-week RS-Ratio + 5-week RS-Momentum + simple SMA-anchored-at-100 (`100 × RS / SMA(RS, n)` then `100 × RS_Ratio / SMA(RS_Ratio, m)`). Approximates JdK; quadrant interpretation preserved. Math documented inline + in TabIntro.
- **Cross-tab handoff pattern (S17):** Correlations cell-click → Pairs uses localStorage (`session.analysis_pairs_handoff`) for the data + `analysis-set-active-tab` `CustomEvent` for the dispatch. PairsTab reads + clears handoff on mount; AnalysisLayout listens for the event and calls `setActiveId`. localStorage > `usePersistedState` for ephemeral cross-component coordination because `usePersistedState` debounces writes through SQLite IPC and the handoff must survive the receiving tab's mount.
- **Pairs no log-axis (S17):** dropped per S11 finding. Path (a) manual `log10()` transform tracked separately for Pairs and FeatureChart together.
- **Phase 3 lean scope (S17):** Recession Prob + FCI shipped Analysis-only; MACRO-tile retrofit (S15 Q4 "both surfaces") deferred. Macro Regime Quadrant deferred pending NAPM-vs-INDPRO growth-axis decision.
- **Single-FRED-series passthrough tools share `MacroPoint` (S17):** declared in `analysis/mod.rs` with `{ date: NaiveDate, value: f64 }`. Used by `recession_prob.rs` + `financial_conditions.rs`. New macro tools that just plot one FRED series should reuse it; tools with structurally different output (e.g., the Regime Quadrant scatter trail) declare their own shape.
- **TickerChipPicker `maxChips` prop (S17):** `maxChips?: number` clamps selected count; input + dropdown auto-hide at the cap. Combined with `placeholder?: string` for the cap=1 case. Used by Pairs's two single-pickers.

**Resolved (v0.12, S13):**
- **Manage Watchlist 3-tab modal lands as Option B (single-pane).** Tickers / Groups / News Feeds tabs in one 900px modal. Picked over two-pane Tickers (Option A) because Groups + News Feeds tabs are full-width single-pane tables; Option A would have made Tickers asymmetric. Move-to dropdown means cross-group reorganization rarely needs landing on a destination, so the +1 click cost is trivial. Replaces sidebar `Manage Groups` button + dashboard inline `EDIT` toggle (latter removed entirely).
- **Group reparenting via tri-state `Option<Option<String>>`.** `update_sector_group` extended; absent → leave alone, null → top-level, value → under id. 2-level cap enforced backend-side: target parent must be top-level, group with own children rejected from non-null reparent. Self-cycle rejected. Captured as LESSONS IPC-4. Sidebar tree rendering unchanged (already handles 2 levels). Reparent dropdown UI mirrors the per-ticker Move-to dropdown.
- **Sidebar pinned trio + separator.** SCANNER, MACRO, NEWS pinned at top via hardcoded `PINNED_IDS = ['scanner', 'macro', 'news']` array — order is array order, not `display_order`. Separator `<hr className="sidebar__separator">` between pinned and user-managed. User-managed below, sorted by displayOrder. Same "infrastructure, non-editable" mental category for all three.
- **Settings 6 → 5 tabs.** News Feeds moves out of Settings (it's user data, not app config) into the Manage Watchlist modal as a tab. Settings is now: API Keys / Appearance / Storage / Features / About.
- **CoinGecko offered for visibility but not new groups.** `NEW_GROUP_SOURCES = ['yahoo']` (Add form options) vs `EDITABLE_SOURCE_SET = new Set(['yahoo', 'coingecko'])` (visibility filter). Existing CRYPTO group still appears in Groups table + Tickers picker even though CoinGecko fetcher isn't implemented today. When fetcher lands in v1.1, append to NEW_GROUP_SOURCES — no other change needed.
- **About-tab PrivateACB copy rewritten (last v1 release blocker).** Sourced from local `E:\Users\PBL\Documents\Dev\PrivateACB_Tauri\CLAUDE.md` after `WebFetch` on `privateacb.com` returned 403. New copy: "desktop crypto tax calculator for Canada, the US, Australia, and the UK" (was wrong on product type — said ACB calculator for Canadians; reality is crypto-specific, 4 jurisdictions). Avoided naming exchanges (decay risk), specific cost-base methods (jurisdiction-varies), and pricing (PrivateACB is paid; not Private Terminal's job).
- **Versioning convention: 4 files, RC.1 framing.** App version lives in **four** places, not three: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (wins over Cargo.toml for Tauri v2 bundle metadata), `src/version.ts`. `version.ts` comment in S12 was wrong (listed 3); corrected this session. RC.1 used because honest framing: feature-complete, awaiting cold-eye verification, not committing to "shipped" yet. Cargo accepts `-rc.1` semver pre-release suffix without flags.
- **Stacked-buttons table-layout fix.** `display: flex` on `<td>` is safe only for cells with multiple children; multiple sibling `<td>` cells with `display: flex` break Chromium's table-row layout (cells stack vertically). Pattern: consolidate action buttons into a single `<td>` containing a flex of buttons (matches `TickerEditPanel` shape).
- **Tester distribution shape.** `release/private-terminal-v1.0.0-rc.1.zip` (8.1 MB compressed; 19.8 MB exe + 6.4 KB README inside). Staging dir `release/private-terminal-v1.0.0-rc.1/` left on disk for re-zip without re-bundling. Uploaded to Drive; tester is "computer nerd so no worries" per user — Drive scan-warning mitigation skipped.

**Resolved (v0.11, S12):**
- VRVP overlay shipped — Approach B (translucent overlay in price pane, NOT side-grid). 180 close-bucketed bins. POC bin in translucent yellow. Persisted via `usePersistedState('session.feature_chart_show_vrvp', true)`, default ON. Auto-suppress when visible window has zero volume.
- VRVP must use a dedicated hidden value-axis (range `[0,1]`, anchor `0.5`) decoupled from the time-axis dataZoom. ECharts' off-screen culling of custom-series data points happens before `clip: false` takes effect; only fully decoupled axes defeat it. See LESSONS EC-11.
- VRVP series must set `tooltip: { show: false }` to keep its bins out of the chart-wide axis tooltip — `silent: true` only blocks mouse-event triggers, not axis-tooltip iteration. See LESSONS EC-12.
- Header Layout D adopted — two rows, top `PRIVATE TERMINAL` + `⚙`, subtitle `<path> · <size> · <N> series · <N> bars` with click-to-copy on path. Tagline "Personal research dashboard" dropped. Path in header is the canonical user-visible DB location reference (settings tabs that previously hardcoded paths now refer to it).
- StatusBar repurposed as centered cross-promo footer (`v{APP_VERSION} · Provided for free by the folks at PrivateACB.com`). New `src/version.ts` constant; bump in three places on release: `package.json`, `Cargo.toml`, `version.ts`.
- Settings tab order: API Keys / Appearance / News Feeds / Storage / **Features** / About. Features tab absorbs Tips section; About tab simplified to product/maker info.
- SMMA Ribbon attribution policy in user-facing copy: cite Bill Williams' Alligator (1995) + Wilder's RMA (1978) only. **Never** mention "Larsson Line" or trendscope. Liability framing kept ("Decision support, not investment advice").
- Tier 1 ECharts polish shipped: PNG save (filename `<safeTitle>-<YYYY-MM-DD>.png`, pixelRatio 2, dark bg) + faint centered watermark via `graphic` component (uses chart `title` prop, fontSize 96 candle / 56 line, `silent: true`, `z: 0`). PNG flash uses `--status-up` color via new `.feature-chart__flash` class.
- `cargo clean -p personal-terminal` is non-selective (removes per-package dependency compilations too). 13.4 GiB / 11,169 files wiped. Future: prefer `touch src-tauri/build.rs` or delete just the binary file to force a rebuild without the full re-compile cost. See LESSONS TB-5.
- Distribution model — staying portable exe (`bundle.active: false`) for now. Installer (NSIS/MSI) discussed and parked. Code-signing flagged as the bigger trust lever than installer-format choice.

**Resolved (v0.10, S11):**
- App name — **Private Terminal** (user-visible). Internal `personal-terminal` retained everywhere (binary, lib, identifier, AppData folder, DB filename) so existing user data isn't orphaned. Brand-family pull with PrivateACB.
- Market-hours strip semantics — outline color = direction since last close (`quote_cache.change_pct_24h` for the exchange's main index). Open/closed status is independent (cyan dot vs gray). Hardcoded `EXCHANGE_INDEX_MAPPING` in `commands/ticker_cmds.rs` because the exchange→representative-index choice is editorial, not user data.
- Y-axis auto-fit — default ON. `datazoom` event listener tracks `visibleRange`; `padBounds(_, 0.03)` adds 3% headroom above/below visible high/low. Volume pane stays at `min: 0`, RSI pane fixed `[0, 100]`, ATR/other subpanes auto-fit alongside price.
- Volume pane toggle — global persist via `session.feature_chart_show_volume`. `layoutGrids` rewrote: non-price panes get fixed 12% slim heights, price absorbs remainder. Toggling VOL meaningfully grows the price pane.
- Log Y-axis — attempted and **dropped**. ECharts default log axis ticks at `base^k` only; sub-decade ranges (e.g. BTC's $30k–$70k) get squashed between $10k and $100k boundaries. SMMA Ribbon's stacked-area envelope further breaks log mode (band components value 0 → `log(0)` collapses range). Three implementation attempts failed. Chart-library swap rejected. True log via manual `log10()` transform on linear axis tracked for v1.1.
- Volume Profile (VRVP) — parked for v1.1 (PROGRESS.md → Discovered). Right-margin horizontal histogram of volume-by-price; HVN/LVN/POC zones. ECharts can do it via side-grid bar series or `custom` series. ~1 weekend.
- Watchlist Performance summary (feature #5) — confirmed redundant with M6 Scanner (carry-over from S10).

**Resolved (v0.9, S10):**
- Hard-delete revival — option C (soft-delete the watchlist row, cascade data tables when this is the last visible occurrence). Keeps seed `INSERT OR IGNORE` a no-op on next boot. `indicator_settings` and `news_items WHERE source='finnhub_ticker'` cascade only when the ticker has no visible reference under any group (they're keyed on `ticker` only, not `(ticker, data_source)`).
- RSS feed CRUD — Settings → News Feeds tab. Soft-delete via `news_feeds.user_hidden=1`; Add UI restricted to `source_type='rss'` (Finnhub-general only edited, never re-added).
- DB size = total footprint — `get_db_info.size_bytes` returns `main + -wal + -shm` so it matches what the maintenance result reports. `mainBytes` + `walBytes` exposed for breakdown.
- Maintenance flow needs a *second* `wal_checkpoint(TRUNCATE)` after VACUUM — VACUUM in WAL mode writes the rebuild as fresh WAL frames roughly equal to DB size. Without the post-pass, on-disk size doesn't actually drop. See LESSONS DB-7.
- Move-DB pointer file — `<data_dir>/db_location.txt` (single line, UTF-8 path). Lives in default `data_dir` even when DB has moved. `config::resolve_db_path()` reads, validates, falls back to default. Old files left in place after a move (user-revertable; auto-delete deemed too risky).
- Finnhub eligibility — negative whitelist `ticker NOT LIKE '%.%'` instead of per-suffix blacklist. US Yahoo equity tickers never contain `.` (class-share separator is `-`). Drops all foreign exchange suffixes generically.
- Watchlist Performance summary (feature #5) — confirmed redundant with M6 Scanner. Not shipping as a separate feature; if 1D/1W/1M/YTD/1Y % change columns become a Scanner enhancement, that's a single-tab addition. M9 scope shrinks to features #1 + #3.

---

## Giveaway framing (new in S9)

User announced intent to release Personal Terminal as a free tool to promote PrivateACB. Implications captured while fresh:

- **API keys**: users expect OS-level protection, but we pivoted to SQLite KV after Windows keyring no-op. DB file lives in user-dir (`%APPDATA%\personal-terminal\`), OS perms protect at rest. Acceptable for free-tier API keys (FRED, Finnhub free tier). Revisit if paid APIs added.
- **About tab**: PrivateACB cross-promo card REWRITTEN in S13 — "desktop crypto tax calculator for Canada, the US, Australia, and the UK", same Tauri stack, same privacy-first framing. Sourced from local PrivateACB CLAUDE.md (web fetch was bot-blocked). Link target: `https://privateacb.com` (in `AboutTab.tsx`).
- **First-run UX**: no onboarding flow exists; app boots directly to MACRO with empty FRED tiles until user adds key. Settings modal is discoverable via ⚙ in header — fine for a self-hosted research tool but may need a setup nudge if distributing broadly.
- **Icon**: SHIPPED in S12. Octagonal candlestick `.ico` + full platform set generated from `.corel_draw/private_terminal4.png` via `npx tauri icon`. Embedded into release exe at `target/release/personal-terminal.exe`.
- **Licensing / telemetry / update mechanism**: not addressed. No telemetry, no auto-update. Currently shipping as portable `.exe` (`bundle.active: false`); installer (NSIS/MSI) discussed and parked. Code-signing flagged as the bigger trust lever than installer-format choice.

---

## Blueprint Images

`docs/images/`:
- `bloomberg_killers_data_sources.png` — 25-provider data-source inventory (Market Sentiment)
- `urbankaoberg_reference_layout.png` — IA + aesthetic reference
