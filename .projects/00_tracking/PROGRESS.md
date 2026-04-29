# Progress Log — Private Terminal

## Current Focus
**Awaiting cold-eye tester feedback on v1.0.0-rc.1.** S15 (2026-04-28) was a three-track session: (1) walked through and locked all six pre-Phase-1 open questions on `docs/v11_analysis_design.md`; (2) tokens-system audit + `chartTheme.ts` extraction + `app.css` rgba consolidation; (3) **Phase 1 implementation plan** — nine-step planning walkthrough locking DB schema, Rust pattern (no trait, const registry + free functions), compute I/O shapes, alignment rules, IPC catalog, TS types, frontend component tree, routing/persistence, and verification gates. Plan written into `docs/v11_analysis_design.md` as the canonical spec for the Phase 1 build session. No functional changes shipped this session; tokens visual smoke-test passed. S14 (2026-04-27) shipped one-line FeatureChart tooltip precision fix + drafted the v1.1 Analysis-section design sketch.

**Remaining before `1.0.0` final:**
1. Tester feedback round (cold-eye review). No code commitments until feedback lands.
2. After verification, bump `0.1.0-rc.1` → `1.0.0` in 4 places (`package.json`, `Cargo.toml`, `tauri.conf.json`, `version.ts`) + rebuild.

**7 of 9 v1 milestones + M8.5 + M8.6 polish + S12 release-blocker pass + S13 manage-watchlist refactor + RC.1 ship complete.**

**Indicator naming note:** the quad-SMMA-state indicator was originally seeded as "Larsson Line" (trendscope's label). During S7 we renamed to **SMMA Ribbon** after confirming from the originator's own Medium post that the math is derivative of public community work, not his invention. Session logs below keep the original "Larsson" references as a historical record — code, DB seed, UI text, and `CLAUDE.md`/`DESIGN.md` use "SMMA Ribbon" going forward. See `memory/m6_indicator_rename.md`.

### S15 — Analysis design walkthrough + tokens audit + chartTheme extraction (2026-04-28)

Two-track session. (1) Walked through and locked all six pre-Phase-1 open questions on `docs/v11_analysis_design.md`; (2) tokens-system audit + `chartTheme.ts` extraction + `app.css` rgba consolidation. Design + cleanup; no functional changes shipped.

**(1) Analysis-section open questions — all six resolved.**
1. **Correlation cell click → navigate to Pairs tab pre-loaded with the pair.** Loses the Correlations view in exchange for full Pairs analysis depth. Inline cell-hopping (popover preview) is the v1.2 escalation if cell-hopping becomes the dominant usage pattern.
2. **Ticker multi-select → chip picker with autocomplete + modal for bulk.** Most-expressive shape; matches the cross-asset nature of the tools. Picked over inline checklist (vertical-space cost on 60-ticker watchlist) and group-only dropdown (loses ad-hoc combos).
3. **RRG benchmark → per-session selector in the RRG toolbar.** Persisted via `session.analysis_rrg_benchmark`. Friction-free switching between US/Canadian/crypto rotations.
4. **Recession Prob / FCI → both MACRO tile AND Analysis tab.** Same FRED series, two surfaces — daily glance from MACRO, in-context regime read from Analysis. Shared view component to keep them visually consistent.
5. **NBER recession bars → shared `useRecessionBars()` hook.** ~30 LOC; charts that want recession bars import the hook. Pays for itself the first time a "hide recession bars" toggle lands.
6. **Alignment dropouts → greyed chips in picker + result footnote.** Belt-and-suspenders. Chip greys with bar-count tooltip; post-compute footnote names what was excluded. Prevention + verification.

Pattern: all six picks landed on the most-expressive option — even where the sketch leaned leaner (Q5, Q6). Phase 1 effort revised ~30% over the sketch's lean-default estimate; closer to one weekend + one evening than one weekend.

**Knock-on notes (captured in design doc).**
- Q2 + Q6 are coupled — chip-picker IPC must return `{ ticker, bar_count, earliest_date, latest_date }` to support greyed-chip rendering. Day-1 IPC shape, not retrofit. Likely a new `list_tickers_with_coverage()` command alongside `list_ticker_tiles()`.
- Q3 needs an explicit `Apply` button next to the benchmark dropdown (full JdK re-normalization is too costly to fire on every keystroke).
- Q4 needs a shared `<MacroSeriesView>` component (or two siblings sharing a hook) to keep MACRO tile + Analysis chart formatting/threshold logic in one place.

**(2) Tokens audit + cleanup.**
- **Audit findings.** S12's "~80 scattered hex codes" guess overcounted. Reality: `app.css` had ~30 `rgba()` literals where the underlying RGB triplets matched already-defined tokens (accent-cyan, status-up/down, bg-surface) — devs bypassed the var system because those tokens lacked `-rgb` companions. `FeatureChart.tsx` had ~25 inline hex/rgba literals because ECharts options is a JS object — CSS `var()` doesn't resolve there. `theme.ts` SMMA palette presets are intentionally raw hex (user-selectable) — left alone. Two truly-untokenized colors found: `#f59e0b` (amber, on API-key warning badge + 1 site of `--accent-amber` reuse) and `#4b5563` (gray-600, single RSI threshold dashed-line site).
- **`tokens.css` extended.** Added `-rgb` triplet companions for `bg-base`, `bg-surface`, `text-primary/secondary/tertiary`, `accent-cyan`, `status-up/down/neutral`. Three new accent tokens for v1.1 Analysis prep: `--accent-amber` (scanner flip + future Yield Curve thresholds + RRG "improving" quadrant), `--accent-yellow` (VRVP POC + emphasis), `--accent-blue` (RRG "weakening" quadrant; distinct from accent-cyan so a future light theme can re-tune them independently). Each new token also defines a `-rgb` companion. `/* [L] */` comment markers added to every token that would need a counterpart on a white background — structural prep only, no light theme committed.
- **`app.css` rgba consolidation.** 19 unique `rgba(R, G, B, α)` patterns rewritten to `rgba(var(--*-rgb), α)` form via `replace_all` Edits across ~30 sites. Two `#f59e0b` hex literals on `.api-key__badge--warn` tokenized to `var(--accent-amber)`. `rgba(0,0,0,X)` (modal backdrop, shadow) and `rgba(255,255,255,X)` (subtle row hover) intentionally left as raw — semantically distinct from any color token.
- **`src/styles/chartTheme.ts` (new, ~98 LOC).** Runtime mirror module. Reads computed CSS vars via `getComputedStyle(document.documentElement).getPropertyValue('--token')` and exports a typed `ChartTheme` object with 21 fields (bg/border/text/accent/status/vrvp/zoom/watermark/marker). Cached on first read; `refreshChartTheme()` clears the cache for future light/dark toggle. Captured as **EC-13** in LESSONS.
- **`FeatureChart.tsx` refactored.** Module-level `CANDLE_UP/CANDLE_DOWN/VOL_UP/VOL_DOWN` constants deleted. Five functions get `const theme = getChartTheme();` at the top: the `saveImage` closure, `buildLineOption`, `buildCandlestickOption`, `buildMarkPoint`, `watermarkGraphic`. All 25+ inline hex/rgba literals replaced with `theme.X` references.
- **Two near-identical color substitutions** (verified visually, accepted):
  - VRVP bar gray `rgb(148,163,184)@0.32` → `text-secondary-rgb (156,163,175)@0.32`. Indistinguishable at α=0.32 — confirmed no visible change.
  - RSI threshold dashed line `#4b5563` (gray-600) → `var(--text-tertiary)` (`#6b7280`, gray-500). User confirmed the slightly-lighter dashed line is "perfectly ok" — no dedicated `--marker-line` token needed.
- **Verification.** `npx tsc --noEmit` clean. Final grep confirms only intentional hex remains: `theme.ts` (palette presets, raw-by-design) and `tokens.css` itself. Visual smoke-test passed end of S15 — no other visible changes from the consolidation.

**What this unlocks.**
- Phase 1 Analysis components reach for `var(--accent-amber-rgb)` etc. instead of inventing values.
- New ECharts components do `import { getChartTheme }` instead of re-discovering hex strings.
- Light theme is now ~30 lines in `tokens.css` (the `/* [L] */`-marked entries) + a `refreshChartTheme()` call on toggle. Zero chart-component edits.

**(3) Phase 1 implementation plan — nine-step planning walkthrough.**
- Same one-question-at-a-time format as the (1) open-questions arc. Goal: produce a self-contained spec the next coding session can read top-to-bottom without re-deriving choices.
- **Decisions locked (one per step, sometimes more):**
  1. **DB layer** — Q1.A: keep `analysis_tools.scope` column as designed (free extensibility for Phase 3+). Q1.B: add `tile_visible INTEGER NOT NULL DEFAULT 1` column to `fred_series`; USREC seeded with `tile_visible=0`; MACRO dashboard query filters `WHERE tile_visible=1`. Future-proofs Phase 3 auxiliary FRED series.
  2. **Rust pattern** — **No trait.** Const registry (`ANALYSIS_TOOLS: &[AnalysisToolMeta]`) + per-tool typed compute free functions. Indicator trait works because compute output is uniform; analysis-tool output is heterogeneous (matrix vs curve vs scatter), so a trait would only cost type safety with no rendering benefit.
  3. **Compute I/O** — Q3.A: typed `TickerKey { ticker, data_source }` in requests (frontend chip picker carries the source). Q3.B: Yield Curve missing data → partial response (`Option<f64>` per tenor). Q3.C: recession segments via separate `list_recession_segments()` IPC + `useRecessionBars()` hook owns cache; compute responses don't carry segments.
  4. **Alignment helper** — Q4.A: exclusion rule `bar_count >= lookback_days × 0.5`, applied identically in chip picker and align helper. Q4.B: helper queries `price_history` internally (self-contained per registry pattern). Q4.C: separate `list_tickers_with_coverage()` IPC for picker — independent SQL from alignment.
  5. **IPC commands** — single `src-tauri/src/commands/analysis_cmds.rs`, five commands: `list_analysis_tools`, `compute_correlations`, `compute_yield_curve`, `list_recession_segments`, `list_tickers_with_coverage`. Per-tool typed (forced by step 2). Persistence via existing `get_config`/`set_config`.
  6. **TS types** — single `src/types/analysis.ts`, camelCase fields (matches IPC-1), no invoke wrapper layer (matches existing per-component convention).
  7. **Frontend tree** — Q7.A: `TickerChipPicker` lives in `src/components/analysis/` (analysis-scoped; refactor up if M9 needs it). Q7.B: refactor `.settings-tabs` → generic `.tab-strip` in one pass (3 consumer files). Other shapes forced: `AnalysisLayout` owns active-tab state, registry as `Record<string, ComponentType>`, `useRecessionBars` hook in `src/hooks/`.
  8. **Routing/persistence** — Q8.B: per-tool `usePersistedState` keys (`session.analysis_<tool_id>_config`) — registry-aligned, each tool independent. `PINNED_IDS` extends to `['scanner', 'analysis', 'macro', 'news']`.
  9. **Verification** — Q9.A: minimal Rust unit tests in `src-tauri/src/analysis/tests.rs` covering Pearson, log_returns, align inner-join (~50 LOC). Build gates + manual smoke-test checklist (SPY×SPY=1.0 sanity, BTC×ETH ≈ 0.7-0.9, today's yield curve matches FRED published values, COVID + GFC recession bars visible) baked into the plan section.
- **Effort estimate**: ~12-14 hours total ≈ one weekend + one evening. Matches the post-decisions revised estimate from the open-questions session arc.
- **Two flagged items for the build session:** (a) confirm exact location of `Db::seed()` before adding `seed_analysis_tools()` call (not pre-read this session); (b) `tile_visible` column migration needs `PRAGMA table_info` guard before `ALTER TABLE ADD COLUMN` — first column-add migration in this project's history.

**Files touched.**
- `docs/v11_analysis_design.md` — "Open questions" replaced with "Resolved (S15, 2026-04-28)" + new "Implementation notes (knock-on from S15 decisions)" subsection + new "Phase 1 implementation plan (S15, 2026-04-28)" subsection (decision summary table, file touch-list, Rust struct shapes, suggested implementation order, smoke-test checklist, effort estimate).
- `src/styles/tokens.css` — RGB-variant additions + 3 new accent tokens + `[L]` light-theme readiness markers + comment header rewritten.
- `src/styles/app.css` — 19 rgba consolidations + 1 hex-pair tokenization. Net reduction: ~33 hardcoded color literals → 0.
- `src/styles/chartTheme.ts` — **NEW**, ~98 LOC.
- `src/components/charts/FeatureChart.tsx` — module constants deleted; 25+ inline literals replaced with `theme.X`.
- `LESSONS.md` — new EC-13 entry covering the runtime-mirror pattern.

**Aside (mid-session, non-project).**
- User added some HK stocks to the watchlist for personal use (Mexan Ltd `0022.HK`, Jinhai International `2225.HK`, Hang Seng S&P 500 ETF `3195.HK`, JPMorgan US Equity ETF `3476.HK`) and asked for chart reads to share with friends. Confirmed CCY column is the 3-letter ISO display currency (HKD for HK listings) — not the ticker number. Indicator reads given with CLAUDE.md principle 9 framing (decision support, not advice). User-flagged that two of the four are sub-dollar HK micro-caps where the SMMA Ribbon's design intent (tech / crypto, 4h–monthly) doesn't apply — Ribbon signals on those should be treated with extreme skepticism. Reads then translated into spoken Cantonese in 繁體 characters at user request (one-off override of the standing Jyutping-only preference; not changing the default).

**Next session entry point.**
- Still tester-feedback wait. When feedback lands: triage into bugs/polish/discoverability/v1.1, fix in-scope items, bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
- Visual smoke-test of the tokens cleanup passed end of S15. No further visual verification needed.
- v1.1 priority queue: **Analysis section Phase 1 (Correlations + Yield Curve) is fully planned** — design-locked + tokens-ready + implementation plan written into `docs/v11_analysis_design.md`. Build session reads the "Phase 1 implementation plan" section top-to-bottom; suggested ordering is in there. Two pre-build verifications flagged: (a) confirm `Db::seed()` location in `src-tauri/src/db/`, (b) `tile_visible` migration needs `PRAGMA table_info` guard pattern.
- Other v1.1 queue items: CoinGecko fetcher, bull/bear VRVP split, true log mode, M9 features (overlay + Ctrl+K palette), code signing.

---

### S14 — FeatureChart tooltip decimal scaling + v1.1 Analysis design sketch (2026-04-27)

Small tooltip precision fix while waiting on tester feedback + exploratory v1.1 design doc (no code commitment).

**(1) FeatureChart candlestick tooltip — magnitude-scaled decimals.**
- Problem: candlestick hover rendered raw `toLocaleString` output (e.g. `123.45678901`) for OHLC + indicator values. Line-mode chart (FRED) was already fine via existing `formatValue`; only the candlestick path lacked a `valueFormatter`.
- Fix: added `valueFormatter` to the candlestick `tooltip` block (`src/components/charts/FeatureChart.tsx:614`) calling new `formatTickerValue` helper at line ~745.
- Tier rule mirrors `formatPrice` in `src/types/sector.ts:67` for tile/chart consistency: `|v| ≥ 1000 → 2dp`, `|v| ≥ 1 → 4dp`, `|v| ≥ 0.01 → 4dp`, `0 → '0'`, `else → 6dp` (covers SHIB-class sub-cent crypto).
- **Tooltip-level, not per-series.** Applies to OHLC, SMMA Ribbon overlay, RSI subpane, ATR subpane, volume bar — all numeric. RSI lands at 4dp instead of an ideal 2dp; volume shows raw int. User accepted the tradeoff up front (single edit vs 4 series-touches). Escalation path: per-series `tooltip.valueFormatter` if RSI/volume noise becomes a complaint.
- `npx tsc --noEmit` clean. Visual end-to-end exercise not done — user runs `tauri:dev` themselves.

**(2) v1.1 Analysis-section design sketch.**
- New file `docs/v11_analysis_design.md` (~250 lines, sibling to `DESIGN.md`). **Design-only — zero code commitment**, awaiting v1.0 final + tester feedback before any of this lands.
- **Architectural split locked:** Analysis section = cross-asset (correlations, yield curve, pairs, RRG, regime quadrant); FeatureChart enhancements = per-ticker (drawdown, vol cone, return dist, seasonality, AVWAP). Different mental models, different surfaces — resist mixing.
- **Sidebar slot:** pinned trio becomes quartet — `PINNED_IDS = ['scanner', 'analysis', 'macro', 'news']`. Analysis lands second.
- **Registry-driven tabs** via new `analysis_tools` table mirroring the M6 indicator registry (id / display_name / scope / display_order / enabled / config_json).
- **Compute model:** Rust-side, on-demand, f64, not persisted — same rule as indicators. Shared `src-tauri/src/analysis/align.rs` handles cross-asset date alignment (crypto 7d vs equity 5d vs FRED weekday-with-lag is the real gotcha).
- **4-phase plan:** Phase 1 (Correlations + Yield Curve, +1 FRED series `USREC`), Phase 2 (Pairs + RRG, zero new data), Phase 3 (regime quadrant + recession prob + FCI, +3 FRED series), Phase 4 (COT + AAII + VIX term, real new fetchers). FeatureChart enhancements run in parallel.
- **Six open questions flagged** for pre-Phase-1 resolution: cell-click navigation between Correlations and Pairs · ticker multi-select UX (modal vs inline) · RRG benchmark scope · whether macro tools live as MACRO tiles, Analysis tabs, or both · shared NBER recession-bar overlay helper · alignment-dropout surfacing.

**Discussions parked.**
- "Crypto-only Private Terminal fork" — high-level human-curiosity discussion. Recommendation: stay single-app, treat crypto as a richer asset-class profile via the existing extensibility-first pipes (new fetchers + sector inserts, no fork). Real fork rationale would be branding/positioning, not technical. Not pursuing.

**Clean-up.**
- Glob for `*.bak` / `*.tmp` / `scratch.*` — none.
- Grep `console.log` / `TODO: remove` / `FIXME: delete` in touched files — none.
- No git initialized; no commit step.

**Next session entry point.**
- Still tester feedback triage (carry over from S13). When feedback lands: categorize bugs/polish/discoverability/v1.1, fix in-scope items, bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
- v1.1 priority queue (existing): CoinGecko fetcher (`NEW_GROUP_SOURCES` extension point already carved), bull/bear VRVP split, true log mode, M9 features, code signing — and now Analysis section per `docs/v11_analysis_design.md` Phase 1 (Correlations + Yield Curve).

---

## Archived

Sessions S1–S13 — the entire v1.0 build arc from project inception through the v1.0.0-rc.1 ship — live in [`archive/2026-04-29_v1_0_build_arc.md`](archive/2026-04-29_v1_0_build_arc.md). See [`archive/README.md`](archive/README.md) for the archive convention.

---

## Discovered (future tasks)

- Explore additional news feeds post-v1 — NewsData.io, Benzinga, MarketAux
- Yahoo TSX after-hours cadence — defer to M3
- Currency display split (US=USD, CA=CAD) — defer to M3/M4
- Indicator confirm_bars UI — per-ticker slider vs global default
- Future indicators (post-v1) — MACD, Bollinger Bands, Ichimoku, Volume Profile, candlestick patterns. All plug into the same trait.
- v1.1 feature candidates (from brainstorm): seasonality heatmap, correlation heatmap, yield curve viz, earnings/economic calendar, backtesting module
- Backtesting module (trendscope's own "Discovered" gap — "we've never measured whether flips are profitable")
- **v1.1 Analysis section design sketch** (`docs/v11_analysis_design.md`, S14) — 4-phase plan for cross-asset analysis tools (correlations, yield curve, pairs, RRG, regime quadrant, sentiment) + parallel FeatureChart per-ticker enhancements (drawdown, vol cone, return dist, seasonality, AVWAP). Registry-driven, mirrors M6 indicator pattern. Six pre-Phase-1 open questions flagged in the doc.
- **Per-series tooltip valueFormatter on candlestick chart** (S14) — current tooltip-level formatter applies one decimal-tier rule to all series (OHLC, SMMA, RSI, ATR, volume). RSI lands at 4dp instead of ideal 2dp; volume shows raw int instead of K/M/B. Escalate to per-series formatters if noise becomes a complaint.

### Deferred during M8.6 polish (2026-04-25, S11) — VRVP since shipped (S12)
- ~~**Volume Profile / VRVP overlay.**~~ **SHIPPED in S12 (Approach B — translucent overlay in price pane, frontend-only, no IPC).** Different shape than what S11 spec'd: chose `custom` series over side-grid `bar` series, frontend bin computation (not Rust IPC), close-bucketed (not honest proportional). 180 bins default. POC highlight only (no HVN/LVN multi-tier in v1). Auto-suppress when no volume in visible window. See S12 entry above.
- **Proper log mode (Path (a)).** Manual `Math.log10()` transform on data points + linear y-axis with custom `axisLabel.formatter` showing `10^value`. Gives TradingView-style round-number ticks at log-spaced positions. Need to also transform SMMA Ribbon band data (filter zeros) and candle OHLC arrays. ~2-3 hours when prioritized. **Stays v1.1** — log is nice-to-have, VRVP is the feature that pulls weight.
- **Bull/bear color split on VRVP.** TradingView-style two-color rendering — green for `close >= open` bar volume, red for `close < open`. Stacked horizontally per bin. ~30 LOC. Honest caveat: OHLCV can't actually distinguish aggressor; this is a heuristic, not a measurement.
- **VRVP per-bar hover tooltip** (price range / volume / % of POC). Custom tooltip formatter that splits axis-tooltip vs item-tooltip. ~30 LOC.
- **Tier 2 ECharts polish.** NBER recession bands on MACRO line charts via `markArea` (hardcoded recession dates ~12 since 1948). ATH/ATL `markPoint` on ticker charts. Both ~15-25 LOC each, deferred for post-v1 cycle.
- **`reset_database_location` UI surface** (still deferred — backend exists since S10).
- **Backup-restore command + dialog file-filter** (still deferred since S10).

### Deferred during M8.5 (2026-04-25, S10)
- **`reset_database_location` UI surface.** Backend command exists; no frontend trigger. Manual revert path documented in S10 ("delete the new copy + delete db_location.txt"). Add a "Reset to default location" button under Storage tab if a user reports needing it.
- **Backup-restore command.** We can backup but not restore from a backup file. Restore is just a copy + relaunch, but a one-click "Open backup" button would close the loop. Defer until requested.
- **Network-drive detection.** Storage-tab move modal warns "network drives are not recommended" via copy. No programmatic UNC-path or remote-drive check. Add when a user actually trips the issue.
- **Cross-volume move atomicity.** Currently uses `std::fs::copy` (works across volumes); old files left untouched per design. If a user later wants "move and clean up source", add a `delete_old_database(path)` command — must validate the path is an old DB location (matches stored or default).
- **`tauri-plugin-dialog` filter for backup file restore.** When restore lands, the picker should filter to `.db` files; currently we use folder picker only.

### Deferred during M7 planning (2026-04-24, S8)
Tracked in `memory/m7_news_decisions.md`. Summary:
- **Finnhub `/company-news?symbol=X` per-ticker news** — deferred to M8 alongside ticker-editing script. Architectural payoff: watchlist row = news subscription (no second edit needed).
- **News search + unread/read state** — post-M8. `news_items` schema is already sufficient; frontend work.
- **Geopolitics chip** — deferred. ME feeds folded into `world` for v1. Revisit if the category count grows enough to blur.
- **SMMA Ribbon palette — await visual review.** Iterated through 5 candidates (teal/fuchsia, sky/pink-500, sky/pink-400, cyan-600/rose-400, plus the original Larsson gold/navy). None landed. Centralized palette refactor landed (CSS vars in `tokens.css` + Rust constants in `smma_ribbon.rs` — one file each, cross-referenced). Currently cyan-600/rose-400 in place as working default. Future swap: edit 3 vars in `tokens.css` + 4 constants in `smma_ribbon.rs`.

### Deferred during M3 planning (2026-04-24, S4)
Tracked in `memory/m3_ticker_decisions.md`. Summary for quick-scan:
- **Sparklines on ticker tiles** — revisit when a batch chart-fetch path exists (after INDICES + US EQUITIES land clean)
- **Adaptive quote TTL** (5m market-hours / 1h off-hours) — revisit once `MarketHoursStrip` timezone logic is promoted to Rust
- **INDICES region tabs** (Americas / Europe / Asia-Pacific) — revisit if flat grid gets dense
- **US EQUITIES sub-sector grouping** — if watchlist extends beyond mega-cap
- **Time-range switch on ticker tiles** (1D / 1W / 1M / YTD / 1Y) — user-requested during S4 after 24h heatmap landed. Drives both heatmap color AND change text. Target milestone: M5 (CRYPTO) or M9 (watchlist-performance) where the pattern repeats. Needs Rust `get_change_for_range(ticker, range)` and a `RangeSwitch` component.
- **CoinGecko integration for CRYPTO live quotes** — DESIGN.md originally spec'd CoinGecko for crypto quotes (with Yahoo for deep history). Deferred during M5 S6 in favor of Yahoo-for-everything pragmatic path. Buys richer crypto-specific metadata (proper market cap, 24h volume in USD) when the tile grows those fields. Target: post-M7, alongside `market_cap` on tile display.
- **Dynamic top-10 crypto auto-discovery** — DESIGN.md spec'd a per-refresh call to `/coins/markets` to rebuild the watchlist from current market cap ranking. Deferred during M5 S6 (fixed watchlist of 10 seeded cryptos used instead). Target: same milestone as CoinGecko integration above — they're the same HTTP call.
- **FRED incremental fetch** (`observation_start=<last_date>`) — FRED has no delta endpoint; the ~200KB/series refetch is acceptable
- **Cross-platform icons** (Mac/Linux) — beyond M8; Windows placeholder from PrivateACB still in place
