# Progress Log — Personal Terminal

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

### S13 — Manage Watchlist refactor + reparenting + version bump + RC.1 ship (2026-04-26)

Cognitive-load pass on ticker/group editing + last v1 release blocker cleared + first RC ship.

**(1) Manage Watchlist modal consolidation.**
- Two surfaces collapsed into one: sidebar `Manage Groups` button + dashboard inline `EDIT` toggle → single `Manage Watchlist` button at sidebar bottom opening a 3-tab modal (`Tickers / Groups / News Feeds`). Default tab Tickers; last-selected ticker group persisted at `session.manage_watchlist_group`.
- New `src/components/ManageWatchlistModal.tsx`. Tabs reuse `.settings-tabs` / `.settings-tab` CSS from `SettingsModal`. Body width `modal` default (900px) — Settings keeps `modal--wide` (720px).
- `TickersTab` (single-pane, Option B per the design discussion): group dropdown labels children with parent context (`CA EQUITIES › Energy`), filtered to ticker-holding leaves only (excludes parent containers + virtual/fred/news/mixed sources). Picks → `list_ticker_tiles` → reuses existing `TickerEditPanel` component verbatim.
- `GroupsTab`: existing `GroupsManagerModal` body lifted in + extended with reparent dropdown column + boundary-disabled ↑/↓ buttons + new column header `Move Under`.
- `NewsFeedsTab`: imports `FeedsTab` directly (component already self-contained).

**(2) Reparenting groups (backend + UI).**
- Tri-state `new_parent_id: Option<Option<String>>` field added to `UpdateSectorGroupInput` in `edit_cmds.rs`. Custom `deserialize_some` helper (uses `serde::de::Deserializer`) distinguishes absent (no field) → `None`, null → `Some(None)`, value → `Some(Some(s))`. Captured as **IPC-4** in LESSONS.
- 2-level depth cap enforced server-side: target parent must itself be top-level (`SELECT parent_id FROM sector_groups …` checks `IS NULL`); group being moved must have no visible children (else children land at depth 3). Self-reference rejected separately.
- SQL update uses `CASE WHEN ?5 = 1 THEN ?6 ELSE parent_id END` because COALESCE can't distinguish "leave alone" from "set to NULL".
- No schema migration required — `parent_id` column existed since M1.

**(3) Stacked-buttons bug fix in Groups tab table.**
- Original `GroupsManagerModal` rendered each action button (↑↓×) in its own separate `<td className="edit-panel__cell-actions">`. With `display: flex` on the cell (CSS line 1093), Chromium/WebView2 takes the cells out of table-row layout — three sibling flex `<td>` cells stack vertically, inflating row height ~3x. New `GroupsTab` consolidates all three buttons into ONE `<td>` matching `TickerEditPanel.tsx:353-370`. Flex behaves correctly within a single cell.

**(4) Sidebar refactor.**
- Pinned trio at top (`SCANNER`, `MACRO`, `NEWS`) via hardcoded `PINNED_IDS` in `Sidebar.tsx`. Order is the array order, not `display_order`.
- New `<hr className="sidebar__separator">` between pinned and user-managed roots (only rendered when both sets non-empty).
- User-managed roots sorted by `displayOrder`. `useMemo` partitioning replaces single `roots` list.
- Bottom button label flipped `Manage Groups` → `Manage Watchlist`; tooltip rewritten to mention all three editable surfaces.

**(5) TickerDashboard cleanup.**
- Removed: `editMode` state, `setEditMode` calls, `reloadAfterEdit` callback, `groups` prop, `TickerEditPanel` import. Range / refresh / heatmap controls always visible now (were hidden behind `!editMode`).
- App.tsx: `groups={groups}` prop dropped from `<TickerDashboard>` call.
- `GroupsManagerModal.tsx` deleted (fully superseded). `app.css` comment in `.edit-panel__select--source` block updated to refer to ManageWatchlistModal.

**(6) Settings 6 → 5 tabs.**
- News Feeds tab removed from `SettingsModal.tsx`. `TabId` union and `TABS` array trimmed. `FeedsTab` import dropped (now imported only from `ManageWatchlistModal`).
- New tab order: `API Keys / Appearance / Storage / Features / About`.

**(7) CoinGecko split.**
- Tester would have seen `coingecko` in the New-Group source dropdown despite no working CoinGecko fetcher today (CRYPTO is labelled `coingecko` in DB but routes through Yahoo per M5). Two-constant split in `ManageWatchlistModal.tsx`:
  - `NEW_GROUP_SOURCES = ['yahoo']` — what the Add form offers.
  - `EDITABLE_SOURCE_SET = new Set(['yahoo', 'coingecko'])` — what's visible in the Groups table + Tickers picker (so existing CRYPTO group still appears).
- When CoinGecko fetcher lands, append `'coingecko'` to `NEW_GROUP_SOURCES`; no other change.

**(8) Review fixes folded in.**
- `leafIds` → `parentIdsWithChildren` in `TickerEditPanel.tsx` (variable was misnamed — it stored *parent ids with children*, not leaf ids).
- Symbol cell tooltip: `"Ticker symbol can't be edited — purge and re-add to change it"`.
- CCY cell tooltip: `"Currency can't be edited after add — purge and re-add to change it"`.
- ↑/↓ at sibling-list boundaries now `disabled` instead of silent no-op. New CSS rule `.edit-panel__delete:disabled` (opacity 0.3, `cursor: default`).
- Group reparent dropdown shows `— top level —` + every other top-level ticker-source group (excluding self).

**(9) Version bump 0.1.0 → 1.0.0-rc.1.**
- Four locations updated: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src/version.ts`.
- `version.ts` comment was incomplete — listed `package.json` + `Cargo.toml` only, missing `tauri.conf.json` (which wins over Cargo.toml for Tauri v2 bundle metadata). Comment expanded to all four files with note about the precedence rule.
- Cargo accepts the `-rc.1` semver pre-release suffix without flags.

**(10) About-tab PrivateACB copy rewrite (last release blocker).**
- WebFetch on `privateacb.com` returned 403 (bot blocking). Pivoted to local `E:\Users\PBL\Documents\Dev\PrivateACB_Tauri\CLAUDE.md` which has the canonical product description.
- Old copy was wrong on three specifics: claimed PrivateACB is "Adjusted Cost Base calculator for Canadian investors"; reality is **crypto tax calculator** for **CA / US / AU / UK** (4 jurisdictions, 22 tax reports, 194 commands per their CLAUDE.md). Used equity-style terminology ("splits, transfers, corporate actions") that doesn't apply to crypto.
- New copy in `AboutTab.tsx`: jurisdiction-correct cost-base method language, "imports transactions from major exchanges", tied back to Private Terminal via "same privacy-first, single-machine philosophy". Avoided naming specific exchanges (decay risk) and avoided pricing claims (PrivateACB is paid; not Private Terminal's job to advertise that).

**(11) Production build + RC.1 packaging.**
- `npm run tauri:build` → `target/release/personal-terminal.exe` 19.8 MB, ~58s release-profile compile (pre-existing `cargo clean -p` from S12 had already been recovered in a prior run).
- New `README.md` at project root — first-time README on this project. Friend-targeted: SmartScreen workaround, FRED-key signup walkthrough (90s), first-run expectation table, quick orientation, known limitations, feedback request framing (discoverability > bug-listing), DB location + uninstall path. Written in project voice (terse, no marketing fluff).
- Staging dir + zip built via PowerShell: `release/private-terminal-v1.0.0-rc.1/` contains exe + README, zipped to `release/private-terminal-v1.0.0-rc.1.zip` (8.1 MB compressed). Uploaded to Google Drive by user.

**Course corrections in-session.**
- **Tickers vs Groups split by tabbed UI vs two-pane.** Initial sketch had two-pane (Option A — group list left, tickers right). User flagged consistency concern: Groups tab and News Feeds tab are full-width single-pane tables, so two-pane Tickers would be the odd one out. Locked single-pane + dropdown picker (Option B). Move-to dropdown means cross-group reorganization rarely requires landing on the destination, so the "extra click to switch" cost is small.
- **2-level vs unlimited nesting.** Considered briefly. 2-level matches every realistic mental model for sectors (region → country, asset-class → instrument); unlimited would force a sidebar tree refactor and invite pathological depth. Locked 2-level cap, enforced backend-side.
- **NEWS sidebar position.** First proposal had it bottom-pinned solo. User chose to group with SCANNER/MACRO under one separator at top — same "infrastructure, non-editable" mental category.
- **CoinGecko caveat caught late.** Tester would have seen `coingecko` in the source dropdown but no fetcher exists; user spotted before zip ship. Split into NEW_GROUP_SOURCES + EDITABLE_SOURCE_SET — clean handle for v1.1 when fetcher lands.
- **Version "seems wrong" was the obvious read.** App at v1-blocker-pass-complete maturity with version `0.1.0` was the symptom of never bumping during development. Tagged `1.0.0-rc.1` for honest framing during exercise.

**Build + verification.**
- `npx tsc --noEmit` clean throughout.
- `cargo check` clean (after each edit_cmds change).
- `npm run build` clean (frontend chunk-size warning carries over from earlier sessions, accepted).
- `npm run tauri:build` clean → exe runnable, icon embedded, version metadata present.
- Visual end-to-end exercise: NOT done in dev (would require interactive window). User runs `tauri:dev` themselves; tester runs the production exe.

**Discussions parked.**
- **"BUILT BY THE SAME TEAM" / actionable-headline About copy variants.** Current heading "From the maker of PrivateACB" is fine for RC.1; can A/B later if signups warrant.
- **First-run onboarding flow** — still nonexistent. App boots to MACRO with empty tiles (or whatever section was last active). Friend will hit this. Mitigated in README, but a real first-run wizard is post-v1.
- **Code signing** — flagged repeatedly (S12, here). Costs real money. Not v1.0 blocker; probably v1.1.
- **Drive scan-warning risk** — user said "he's a computer nerd so no worries"; not pursuing zip-vs-loose-files distribution mitigation.

**Remaining outside-code items.**
- Cold-eye tester feedback. Loop back here when it lands.

**Next session entry point.**
- Tester feedback triage. Categorize into: (a) bugs (fix), (b) polish/UX (judge), (c) discoverability/expectation (often a docs fix or copy tweak), (d) "out of scope, v1.1" (file under Discovered).
- After feedback lands clean, bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
- v1.1 priority queue (existing): CoinGecko fetcher (unlocks the dropdown), bull/bear VRVP split, proper log mode (Path (a) — manual `log10()` transform on linear axis), M9 features (multi-ticker overlay + Ctrl+K palette), code signing.

---

### S12 — Icon swap + VRVP overlay + header refactor + Tier 1 polish (2026-04-25)

Five-track session knocking out two of the three remaining v1 release blockers + a Settings/header refactor + low-risk visual polish.

**(1) Icon swap (release blocker #1 — done).**
- `npx tauri icon ../.corel_draw/private_terminal4.png` from `src-tauri/`. Generated full platform set: `icon.ico` (17 KB, replacing 361 KB PrivateACB placeholder), `icon.icns`, PNG sizes 32/64/128/128@2x, Windows Store `Square*Logo.png` (30/44/71/89/107/142/150/284/310), iOS variants under `icons/AppIcon-*.png`, Android mipmaps under `icons/android/mipmap-{m,h,xh,xxh,xxxh}dpi/`.
- Source picked between two CorelDraw exports: `.corel_draw/private_terminal3.png` (top-left "candle" had no wick — read as a floating UI tile) vs. `private_terminal4.png` (clear upper wick, three candles read as a stair-step uptrend, more legible at favicon scale). Picked #4. Rendered preview confirmed the silhouette holds at 32×32.

**(2) Volume Profile (VRVP) overlay (release blocker #3 — done).**
- Three-decision arc: scope → rendering approach → implementation iteration.
- **Scope decisions:** ticker feature charts only (MACRO has no volume; sparklines too small; multi-ticker overlay N/A). Global persist via `usePersistedState('session.feature_chart_show_vrvp', true)`. Default ON. Auto-suppress when `sum(visible volume) === 0` (DXY/FX). 50→180 bin count after live comparison.
- **Rendering: prototyped both Approach A (side grid) and Approach B (price-pane overlay) in a throwaway 3-state cycling button** — `vrvpMode: 'off' | 'A' | 'B'`. User picked B after live testing — A felt heavy/Bloomberg-y, B is closer to TradingView/calmer. A code stripped after pick.
- **Anchor-point evolution** (the bug saga): initial impl anchored each bin's data point to `bars.length - 1`. Worked when right slider handle at 100%, broke any time it was pulled left — ECharts culls custom-series renderItem calls when the data point's xAxis value falls outside the visible dataZoom window, even with `clip: false` (clip controls *output* clipping, not upstream visibility filtering). First fix: dynamic anchor at `Math.ceil((visibleRange.end / 100) * bars.length) - 1`. Worked but finicky on mid-window pans (ECharts' internal visibility math differs from our slice math by 1-2 indices in some configurations). **Final fix: dedicate a hidden value-axis at index `xAxisArr.length` on grid 0**, range `[0, 1]`, anchor at `0.5`. Decouples VRVP from the time-axis dataZoom entirely — renderItem always fires regardless of slider position. `vrvpXAxisIndex` excluded from `dataZoom.xAxisIndex` and from `axisPointer.link`. Captured as **EC-11** in LESSONS.
- **Tooltip pollution.** With trigger:'axis' the chart-wide tooltip iterates every series at the cursor position, including VRVP. `silent: true` prevents *mouse-event* triggers but doesn't filter axis-tooltip iteration. Fix: `tooltip: { show: false }` on the VRVP series. Captured as **EC-12** in LESSONS.
- **Final shape** (in `FeatureChart.tsx`): one `custom` series, 180 close-bucketed bins computed in `computeVrvpBins(visibleBars, 50→180)`, anchor `[0.5, midPrice]` on dedicated value-axis, `params.coordSys` for pixel positioning on the right `VRVP_OVERLAY_RATIO = 0.18` of the price pane, POC bin in `rgba(250,204,21,0.55)`, others in `rgba(148,163,184,0.32)`, `z: 15` (above candles at z=10), `clip: false`, `silent: true`, `tooltip: { show: false }`.

**(3) Header redesign (Layout D).**
- New `AppHeader.tsx` component. Two-row header: top row `PRIVATE TERMINAL` (left) + `⚙` (right); subtitle row `<full-path> · <size> · <N> series · <N> bars` in muted mono. Click-to-copy on path with `navigator.clipboard.writeText` + 1.2s "copied" flash. Tagline "Personal research dashboard" dropped.
- `App.tsx` swaps the inline `<header>` for `<AppHeader refreshTrigger={dbRefreshCounter} onSettingsOpen={...} />`. DbInfo fetch moved out of StatusBar into AppHeader (same IPC + refresh-trigger pattern).
- CSS: `.app-header` becomes column-flex; new `.app-header__top-row`, `.app-header__sub-row`, `.app-header__path`, `.app-header__sep`, `.app-header__copied`, `.app-header__loading`. Old `.app-subtitle`, `.status-bar__path`, `.status-bar__copied`, `.status-bar__loading` rules removed (now orphaned by the refactor).

**(4) StatusBar repurposed.**
- Was: DB info strip with click-to-copy path. Now: centered `v0.1.0 · Provided for free by the folks at PrivateACB.com` cross-promo footer. URL portion is a `.status-bar__link` button that fires `openUrl('https://privateacb.com')`.
- New `src/version.ts` with `APP_VERSION = '0.1.0'` constant. AboutTab + StatusBar both consume it. Bump comment notes that `package.json` + `src-tauri/Cargo.toml` + `src/version.ts` must move together on release.

**(5) Settings restructure.**
- **New tab: Features** (`src/components/settings/FeaturesTab.tsx`). 7 cards: Volume Profile (VRVP), SMMA Ribbon, RSI(14)/ATR(14), Scanner, Market-hours strip, Tile range switch, Indicator framework. Plus a Tips & hidden shortcuts list (moved from About). SMMA Ribbon attribution: Bill Williams' Alligator (1995) + Wilder's RMA (1978) — explicitly NO mention of "Larsson Line" or trendscope per user direction. Liability framing kept ("Decision support, not investment advice"). Caveat block kept (best on tech/crypto, 4h–monthly timeframes).
- **About tab simplified.** Title + version + intro + PrivateACB cross-promo card. Tips section removed (now in Features).
- **API Keys help text simplified.** Was hardcoded `%APPDATA%\personal-terminal\personal-terminal.db`; now reads "stored in the app's local database (path shown in the header) — only your user account can read it." Path no longer drifts after M8.5 move-database operations.
- **Settings tabs grew from 5 → 6:** API Keys / Appearance / News Feeds / Storage / Features / About. `TabId` union and `TABS` array in `SettingsModal.tsx` updated.

**(6) Tier 1 ECharts polish.**
- **PNG save button** in the feature-chart toolbar (right of AUTO Y / VOL / VRVP on candle, alone on line). `chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0e14' })` → ephemeral `<a download>` click. Filename: `<safeTitle>-<YYYY-MM-DD>.png` (title sanitized via `replace(/[^\w\d-]+/g, '-')`). Toolbar now renders for both modes (was candle-only).
- **PNG flash feedback.** "✓ saved to Downloads" pill next to button for 1.5s after click. New `.feature-chart__flash` CSS rule: `--status-up` border + text, mono font, dark transparent bg.
- **Watermark** via `graphic` component: centered text using the chart's `title` prop, `silent: true`, `z: 0` (behind everything), `fill: rgba(229, 231, 235, 0.05)`, JetBrains Mono bold. fontSize 96 in candle mode (titles short — ticker symbols), 56 in line mode (FRED titles run long). Helper `watermarkGraphic(text, fontSize)` at module scope.

**(7) Production rebuild.**
- `npm run tauri:build` after icon swap → `target/release/personal-terminal.exe` ~19 MB, compiled in 3m 35s. User assessed icon working in title bar / taskbar / Alt+Tab. `bundle.active: false` so no installer artifact (portable exe model — discussed and parked; user may revisit for distribution but happy with portable for now).
- **`cargo clean -p personal-terminal` overcorrection.** Late in session, user reported old icons in dev mode (debug binary stale from before the icon swap; tauri-build's resource step didn't re-run on icon-only change because no Rust source had touched). Ran `cargo clean -p personal-terminal` to force a clean rebuild — wiped 13.4 GiB / 11,169 files. `cargo clean -p` is non-selective: removes per-package compilations of every dependency, not just the named package. Next `tauri:dev` or `tauri:build` will be a from-scratch ~5–10 min compile. Captured as **TB-5** in LESSONS.

**Course corrections in-session.**
- **VRVP visibility filter saga** — three iterations to land on the dedicated-value-axis approach. Each prior fix worked at first but failed under specific dataZoom positions. The lesson: ECharts custom-series visibility filtering is a real product, not an edge case — design the data-anchor strategy for it from the start.
- **Approach A vs B prototype before commit.** Build cost: ~30 min for both behind a 3-state cycling button. Decision quality: high — user could see both in their own data with their own SMMA Ribbon overlap, vs. comparing other people's app screenshots. Pattern worth reusing for any visual-tradeoff decision where opinion-from-screenshots is unreliable.
- **POC color stayed yellow** despite a brief consideration of cyan. Decision: yellow is the universal VRVP convention; recognition value > brand consistency for the specific element.
- **`silent: true` doesn't suppress axis tooltip.** First impulse was `silent: true` to kill VRVP tooltip noise; that disables mouse-event triggers but axis-tooltip iteration is independent. `tooltip: { show: false }` per-series is the correct lever.

**Build incidents.**
- TS clean throughout (`npx tsc --noEmit` exit 0 after every edit).
- Cargo clean dropped 13.4 GiB. Next compile is ~5–10 min from scratch.
- Pre-existing chunk-size warning (1.34 MB / 442 KB gzipped) reaffirmed; no action.

**Discussions parked for v1.1 / future.**
- **Bull/bear volume color split on VRVP.** Standard variant in TradingView/most pro tools. Honest caveat surfaced: OHLCV doesn't tell you actual aggressor (close > open ≠ "buyers won"). Heuristic, not measurement. ~30 LOC if added.
- **VRVP per-bar hover tooltip** (price range / volume / % of POC / bar count). Currently `tooltip: { show: false }`; would need a custom formatter that splits axis-tooltip vs item-tooltip.
- **Tier 2 ECharts polish:** NBER recession bands on MACRO charts (`markArea`, ~25 LOC, hardcoded recession dates list); ATH/ATL `markPoint` on ticker charts (~15 LOC). Considered useful but not worth blocking v1.
- **Tier 3 ECharts polish:** `echarts.registerTheme` to centralize ~80 scattered hex codes; crosshair value labels styling polish. Defer until a light-theme arc forces the refactor.
- **Installer (NSIS / MSI) vs portable exe.** Discussed in detail; user staying portable for now. Code-signing flagged as the bigger trust lever than installer-format choice.

**Remaining outside-code items.**
- **About-tab PrivateACB copy rewrite** — last v1 release blocker. User authoring.

**Next session entry point.**
- User runs `npm run tauri:dev` to trigger the full from-scratch debug rebuild (~5–10 min one-shot cost from the cargo clean). Once dev binary lands, verify new icon in title bar + taskbar + Alt+Tab, exercise VRVP under all dataZoom positions, exercise PNG save in both modes, eyeball watermark prominence on a few charts.
- Then: About copy rewrite + final `tauri:build` → ship v1.0.
- Post-v1: bull/bear VRVP split, Tier 2 polish, M9 cross-cutting features (multi-ticker overlay + Ctrl+K palette), proper log mode via Path (a).

---

### S11 — M8.6 Polish: fonts + market-hours direction + AUTO Y + volume toggle + rename (2026-04-25)

Six-item polish pass after M8.5. Order ran: fonts → market-hours direction → Y-axis (Y1 + Y2) → volume toggle → rename → log mode dropped after live testing.

**(1) Font-size bumps.**
- `src/styles/tokens.css`: `--fs-xs` 0.6875→0.75rem (11→12px), `--fs-sm` 0.8125→0.875rem (13→14px). Touches Manage Groups, Settings tables, footer status bar, edit-panel rows. Existing fixed-row layouts (FL-2's `grid-auto-rows: 150px`) absorb the bump.
- `--fs-md`/`--fs-lg`/`--fs-xl` left alone — already readable.

**(2) Market-hours strip with direction coloring.**
- Hardcoded `EXCHANGE_INDEX_MAPPING` in `commands/ticker_cmds.rs`: `NYSE→^GSPC, TSX→^GSPTSE, LSE→^FTSE, TYO→^N225, HKG→^HSI, SSE→^SSEC, ASX→^AXJO, KRX→^KS11`. Editorial choice — these are exchange-level indicators, not user data.
- New IPC `list_market_index_quotes() → Vec<MarketIndexQuote>`. Read-only against `quote_cache`; doesn't trigger fetches. Quotes refresh through the existing INDICES dashboard flow.
- `MarketHoursStrip.tsx` rewritten: pulls quotes on mount + every 5 min, maps by exchange code, applies `--up`/`--down`/`--flat` classes based on `changePct24h` (>0.05% = up, <-0.05% = down, else flat).
- Visual decoupling: outline color = direction since last close (always shown); cyan dot = OPEN status (independent). Pct readout (`+0.42%`) appended to chip with separator border. Tooltip shows full `name · tz · time · OPEN/CLOSED · ticker pct`.

**(3) Y1 — Auto-fit Y axis on dataZoom.**
- `FeatureChart.tsx` registers a `datazoom` event listener inside the init `useEffect`. Reads `chart.getOption().dataZoom[0].start/end` (event payload shape varies between `inside` and `slider`); pushes into `visibleRange` state with deduping (`Math.abs(prev-cur) < 0.01`).
- Helpers added: `sliceVisibleBars`, `priceLowHigh`, `subpaneSeriesLowHigh`, `padBounds(bounds, 0.03)`. Price pane and ATR pane auto-tighten to visible window with 3% breathing room. Volume pane stays anchored to 0 (`min: 0`); RSI pane stays fixed at `[0, 100]`.
- `usePersistedState('session.feature_chart_autofit', true)` — toggle button persists.
- `defaultStartPct` lifted from inside `buildCandlestickOption` to the parent component as a `useMemo` so `useEffect([defaultStartPct, bars.length])` can reset visibleRange on ticker switch.

**(4) Volume pane toggle.**
- `usePersistedState('session.feature_chart_show_volume', true)` + `VOL` button in toolbar. Same global-persist pattern as AUTO Y (no per-chart override; user-confirmed).
- Structural rebuild: `volumePaneIndex = showVolume ? 1 : -1` and `subpaneStartIndex = showVolume ? 2 : 1`. Pane indices for indicator subpanes shift down by one when VOL is off.
- Series push for volume bar wrapped in `if (showVolume)`.
- `layoutGrids(paneCount)` rewritten — first attempt failed: original ratio-based formula gave price ~62% regardless of pane count, so toggling VOL only freed the 2% inter-pane gap. Fixed to fixed-slim non-price panes (12% each) + price absorbs remainder. New distribution: 1 pane = 86%, 2 panes = 72%, 3 panes = 58%, 4 panes = 44% to price.

**(5) Y2 — Log mode shipped + dropped same session.**
- Initial implementation: `LIN/LOG` button + `usePersistedState('session.feature_chart_yscale')`. Log axis tried with explicit min/max from `priceBounds`, then with power-of-10 rounding, then with no bounds at all.
- **All three approaches failed** for sub-decade ranges. ECharts default log axis ticks at `base^k` only; for BTC's $30k–$70k window, no power of 10 falls between, and the axis silently reverts to default 1–10 with no data visible.
- Discovered SMMA Ribbon stacked-area envelope amplifies the failure: band components carry value 0 on bars not matching their state. `log(0) = -Infinity` poisons the y-axis range computation. Adding `if (isStacked && suppressStack) continue;` to skip stacked bands in log mode helped but axis still didn't render BTC.
- TradingView's working log mode uses round-number ticks (60k/70k/80k/…) at log-spaced positions — **not** a default ECharts feature; requires either a custom-tick implementation or a manual `Math.log10()` transform on a linear axis. Chart-library swap considered and rejected (1.5–2 weeks for a single-feature gap; loses ~2 weeks of M6+M8.6 ECharts work).
- **Decision:** drop log mode entirely. Removed: `LIN/LOG` button, `yScale` state + persistence, log-related branches in `buildCandlestickOption`, `suppressStack` logic, log-mode legend filter. Orphaned `session.feature_chart_yscale` config row left in DB harmlessly. Volume Profile / better log captured as v1.1 backlog.

**(6) Rename → Private Terminal.**
- User-visible strings updated: `App.tsx` header title `PERSONAL TERMINAL → PRIVATE TERMINAL`, `AboutTab.tsx` heading + first sentence, `index.html` `<title>`, `tauri.conf.json` `productName` + window title, `package.json` description, `src-tauri/Cargo.toml` description.
- **Internal names kept** for backwards compat: binary `personal-terminal`, lib name `personal_terminal_lib`, identifier `com.personal.terminal`, AppData folder `personal-terminal`, DB filename `personal-terminal.db`. User has live data in `%APPDATA%\Roaming\personal-terminal\` — renaming would orphan it.

**Course corrections in-session.**
- **Slider snap-back.** First version of dataZoom config kept hardcoded `start: defaultStartPct, end: 100`. Every option rebuild snapped the slider back to the default visible window. Fix: read `visibleRange.start/end` in the dataZoom config so option rebuilds preserve the user's drag position. Captured as **EC-9** in LESSONS.
- **Volume toggle didn't expand price pane.** Original `layoutGrids` used fixed `priceRatio = 0.62` so price always got ~62% regardless of how many panes were on. Hiding VOL only freed the 2% gap. Fixed pane heights (non-price = 12% slim, price = remainder). User flagged in screenshot.
- **Log mode three failure modes** — see (5) above.
- **`get_db_info` size mismatch** — actually pre-existing from S10; flagged in S10 logs but the dual-display issue surfaced again as users tried maintenance more. No code touched this session.

**Discussions parked for v1.1.**
- Volume Profile / VRVP (right-margin horizontal histogram of volume-by-price). Discussed: it's a Visible Range Volume Profile showing HVN/LVN/POC zones. Backend = Rust function bucketing visible bars across N price bins; frontend = ECharts `bar` series on a side-grid sharing the price y-axis OR `custom` series in the price pane. Not blocked by anything; ~1-session weekend feature.
- TradingView-style log mode. Two paths if revisited: (a) manual `log10()` transform on a linear axis with custom labels; (b) chart-library swap (Lightweight Charts). Path (a) is the right call for v1.1.
- Light / midway theme — already deferred to v1.1 in S10; reaffirmed.

**Build incidents.**
- TS `tsc --noEmit` clean throughout. No unused-var errors despite removing `yScale` parameter from `buildCandlestickOption` (tsconfig non-strict on unused).
- Cargo check clean — no deps changed this session.

**Next session entry point.**
- Pre-release: icon swap (user-supplied `.ico`) + About-tab PrivateACB copy rewrite.
- Then build a `tauri:build` artifact and ship.
- Post-release v1.1 priority queue: Volume Profile (1 weekend) > proper log scale via Path (a) (~2-3 hours) > multi-ticker overlay (M9 #1) > Ctrl+K palette (M9 #3).

---

### S10 — M8.5 Maintenance: hard-delete cascade + RSS CRUD + SQLite maintenance + move/backup DB (2026-04-25)

Inserted as an unplanned milestone between M8 polish and M9 features. User reframed scope from "build M9 cross-cutting features" to "shore up the maintenance story before giveaway." Four items, in order: (a) → (d) → (c) → (b).

**(a) Hard-delete + cascade purge (`purge_ticker`).**
- New `commands/edit_cmds.rs::purge_ticker(ticker, sectorGroupId, dataSource) → PurgeResult`. Soft-deletes the watchlist row (option C — keeps seed `INSERT OR IGNORE` a no-op on next boot) + cascades data tables when this was the last visible occurrence.
- Visibility check is two-layer: `(ticker, data_source)` count for `price_history`/`quote_cache`, `(ticker)` count for `indicator_settings`/`finnhub_ticker` news (the latter aren't keyed on data_source). Cache rows from a still-shared ticker are preserved.
- Whole cascade in one transaction; partial cascade rolls back.
- `TickerEditPanel` gets a 🗑 button alongside the existing × (now titled "Hide …"). Confirm modal with split-footer CANCEL / PURGE. Status line on completion: `Purged AAPL · 1248 bars · quote · 3 indicator setting(s)` or "Removed AAPL from this group · cached data kept" depending on cascade outcome.
- New CSS: `.edit-panel__status`, `.edit-panel__delete--purge`, two-button `.edit-panel__cell-actions` flex layout (col widened to 84px), `.modal--narrow`, `.modal__list`, `.modal__danger`, `.modal__footer--split`, `.view-toggle--danger`.

**(d) RSS feed CRUD.**
- Schema migration: `news_feeds.user_hidden INTEGER NOT NULL DEFAULT 0` added to `schema.sql` + idempotent ALTER in `Db::migrate()`. `Db::list_news_feeds(enabled_only)` filters `user_hidden = 0` in both branches.
- `commands/feed_cmds.rs` (new): `add_news_feed` (upsert clears `user_hidden`), `update_news_feed` (COALESCE pattern), `delete_news_feed` (soft via `user_hidden=1`). Validation: id slug, sourceType ∈ {rss, finnhub}, refresh ∈ [5, 1440], URL `http(s)://`, max-lengths.
- `NewsFeedDto` extended with `url: Option<String>` + `NewsFeed` TS type updated — UI now displays + inline-edits the URL alongside other fields.
- `src/components/settings/FeedsTab.tsx` (new): two-row Add form (id + ⓘ-help + name; url + category + refresh + ADD) restructured to fit the 720px modal width without input collapse (FL-3 pattern). Reusable `InlineEdit` component for click-to-edit name/URL. Category + refresh dropdowns. Enable checkbox + × delete consolidated into one `On / Delete` cell. Confirm modal for delete.
- `id_slug` placeholder language replaced with `short_name` + an inline ⓘ help icon (`title=` attribute on input + on the icon). Same fix applied to `GroupsManagerModal` after user flagged the jargon.
- Settings modal grew a "News Feeds" tab; total tabs now 5 (API Keys / Appearance / News Feeds / Storage / About).
- Smoke-test follow-up fixes: Reuters URL (`feeds.reuters.com`) was a stale suggestion (host doesn't resolve) — user verified the feed deletion path. Finnhub eligibility filter widened from `NOT LIKE '%.TO'` to `NOT LIKE '%.%'` (US Yahoo equity tickers never contain `.`; class-share separator is `-`). Filter now correctly drops `.SS`, `.HK`, `.DE`, `.L`, `.T`, etc. — fixes 403s when user adds non-US exchange tickers.

**(c) SQLite maintenance + orphan sweep + bytes-discrepancy fix.**
- `commands/system_cmds.rs::db_maintenance() → MaintenanceResult` runs `PRAGMA integrity_check` (parsed for "ok"), `wal_checkpoint(TRUNCATE)`, `VACUUM`, then a **second** `wal_checkpoint(TRUNCATE)`. The post-VACUUM checkpoint is the load-bearing detail — VACUUM in WAL mode writes the rebuild as fresh WAL frames roughly equal to DB size, so without the second pass on-disk size doesn't actually drop. Reports total footprint (main + `-wal` + `-shm`) before/after, summed checkpointed-frames across both passes, and a `walCheckpointBlocked` flag (true when either pass returned `busy=1`).
- `commands/system_cmds.rs::purge_orphaned_data() → PurgeOrphansResult` — single transaction, four `DELETE … WHERE NOT EXISTS (SELECT 1 FROM watchlist_tickers …)` over `price_history`, `quote_cache`, `indicator_settings`, and `news_items WHERE source='finnhub_ticker'`. Different scoping per table — `(ticker, data_source)` for the first two, `ticker` only for the others.
- `commands/system_cmds.rs::get_storage_stats() → StorageStats` — row counts for the maintenance-relevant tables + `(visible / hidden)` watchlist split.
- `DbInfo.size_bytes` was main-file-only; mismatched the maintenance result. Changed to total footprint and added `mainBytes` + `walBytes` for the breakdown shown in the Storage tab. `formatSignedBytes` extracted into `types/system.ts` (had been duplicated in `StorageTab.tsx`). Footer `StatusBar` automatically picks up the new total.
- `src/components/settings/StorageTab.tsx` (new): row-count grid, "Run Maintenance" + "Sweep Orphans" sections, result strips. Help copy explicitly explains the WAL→main redistribution: *"main grows, WAL drops, total stays the same"* unless rows were actually deleted.

**(b) Move database + Backup copy.**
- Added `tauri-plugin-dialog = "2"` (Rust) + `@tauri-apps/plugin-dialog ^2.0.0` (JS) for the folder picker. Capability: `"dialog:default"` + `"dialog:allow-open"`.
- `config.rs::resolve_db_path()` reads `<data_dir>/db_location.txt` on boot, validates target exists, falls back to default. `db_pointer_path()` + `write_db_pointer(Option<&Path>)` round out the pointer-file API. `DB_FILENAME = "personal-terminal.db"` constant.
- `lib.rs` boot now uses `resolve_db_path()` + always creates the default data dir (the pointer file lives there even when the DB has moved).
- `commands/system_cmds.rs::backup_database(destination) → BackupResult` — checkpoints WAL into main, copies the `.db` to `dest/personal-terminal.backup-YYYYMMDD-HHMMSS.db`. AppState unchanged.
- `commands/system_cmds.rs::move_database(destination) → MoveResult` — checkpoint → copy to `dest/personal-terminal.db` → open new connection → `*guard = new_db` swap (drops old) → write pointer file. Failure cleanup: if the new-connection open fails, the partial copy is removed and the function returns Err with AppState still on the original DB. Old files left at the source location per design (user-revertable).
- `commands/system_cmds.rs::reset_database_location()` — clears the pointer file. Registered but no UI yet (manual revert path is "delete the new copy + delete db_location.txt").
- Storage tab grew a "Database location" section above maintenance: 3-files explainer ("`.db`, `.db-wal`, `.db-shm` … run Backup copy or copy all three together"), **BACKUP COPY…** + **CHANGE LOCATION…** buttons. Confirm modal for the move (it changes the live DB) showing both paths + the network-drive caveat.

**In-session course corrections.**
- **`get_db_info` reported main-file-only size** while `db_maintenance` reported total footprint — user flagged the disagreement (20.97 MB vs. 42.12 MB on the same DB). Unified both around the total + exposed the breakdown. SEC-issue: when designing per-feature size displays, always use the same definition across the feature surface.
- **VACUUM in WAL mode produces ~21 MB of new WAL frames** that the original single-checkpoint maintenance flow left on disk. Result strip honestly reported "0 WAL frames · ±0 B" because by then auto-checkpoint had already cleaned the original WAL — the new frames came after that. Fix: second checkpoint after VACUUM, sum frames, surface `busy` flag. Captured as **DB-7** in LESSONS.
- **FL-3 pattern hit again on FeedsTab Add form** — six flex children in a 720px modal collapsed the URL + Display Name inputs to ~0px. User screenshot caught it. Restructured into two `.edit-panel__add-row` lines via a `.edit-panel__add--stacked` wrapper. Flex sizing per-control (`.edit-panel__select--source` on category/refresh dropdowns, explicit `--wide` on URL).
- **`id_slug` jargon** — user flagged that "id_slug" placeholder is meaningless to non-developers. Replaced with `short_name` everywhere + added inline ⓘ help icon explaining the "lowercase letters / digits / underscore, used to dedupe" semantics. Same fix in GroupsManagerModal.
- **Reuters RSS feed dead** — my smoke-test suggestion (`feeds.reuters.com/reuters/businessNews`) returned DNS NXDOMAIN. Reuters discontinued public RSS years ago. Flagged in LESSONS NEWS-1 territory; user removed via the new delete UI (which exercised the deletion path nicely). MarketWatch (`feeds.content.dowjones.io/public/rss/mw_topstories`) noted as a working US-business alternative.
- **Finnhub 403 on `000001.SS`** — Shanghai Composite snuck through the eligibility filter because we only excluded `.TO`. Tightened to `NOT LIKE '%.%'` (no dot in US ticker symbols). All foreign exchange suffixes now correctly excluded from per-ticker news fetches.

**Build incidents.**
- Cargo lock-file update added `tauri-plugin-dialog v2.7.0` + `tauri-plugin-fs v2.5.0` (transitively) + `rfd v0.16.0`. ~16s rebuild after lockfile-update; subsequent type-checks ~1s.
- npm install for the dialog plugin completed clean; 2 moderate vulnerabilities reported (pre-existing, not from this session) — not addressed.

**Remaining outside-code items (not blocking):**
- **Icon swap** — `src-tauri/icons/icon.ico` still the PrivateACB placeholder. Needs user-supplied terminal-branded asset.
- **About-tab PrivateACB copy rewrite** — placeholder text from S9 still in place.
- **First-run UX** — no onboarding flow; app boots to MACRO with empty FRED tiles until user adds a key. Settings ⚙ icon discoverable but not surfaced. Acceptable for MVP giveaway.

**Decisions captured in memory:**
- Soft-delete revival policy for ticker purge → option C (purge data, keep `user_hidden` row).
- DB pointer file lives in default `data_dir` even when DB has moved (chicken-and-egg avoided).
- Move-DB leaves old files in place (user-revertable); auto-delete is too risky.
- Backup-copy filename is timestamped to allow repeats without overwriting.
- Finnhub eligibility uses negative whitelist (`NOT LIKE '%.%'`) instead of per-suffix blacklist.

**Next session entry point:**
- Pre-release polish: icon swap + About-tab copy + first-run UX nudge if needed.
- Then M9 work (multi-ticker overlay, Ctrl+K palette) post-release as a v1.1.

---

### S9 — M8 Polish: session persistence + scanner prime + settings modal + tile range switch (2026-04-24)

Six distinct shippable items; M8 effectively code-complete. No schema changes; everything rides on existing tables.

**1. Session persistence (feature #7).**
- New `config` KV helpers `Db::get_config(key)` / `Db::set_config(key, value)`.
- Rust commands: `get_session_key`, `set_session_key` (plain KV pass-through).
- Frontend generic hook `usePersistedState<T>(key, initial, opts?)` in `src/hooks/usePersistedState.ts`. 300ms debounced writes; exposes `{ loaded, hadStoredValue }` status so consumers can distinguish first-launch from deliberate-empty. Custom serialize/parse for non-JSON-trivial types (Set<string>, etc.).
- App.tsx → `activeSection` persisted under `session.active_section`.
- Sidebar.tsx → expanded-parent Set persisted under `session.sidebar_expanded` (JSON array). First-ever launch expands all parents (`hadStoredValue === false` branch); subsequent launches respect stored set verbatim.
- Feature charts always start closed (explicit spec decision per user — pick-up-where-you-left-off applied to section + sidebar, not drill-down state).

**2. Scanner prime-histories (closes M6 deferred gap).**
- New Rust command `prime_scanner_histories()` in `indicator_cmds.rs`: enumerate scanner-eligible tickers with no bars, Semaphore(6) parallel fetch via `yahoo::fetch_chart(t, "5y")`, upsert. Returns `{primed, failures: [{ticker, error}]}`.
- Scanner UI gets a `PRIME (N)` button beside RECOMPUTE, only visible when N > 0 (computed from `state === null` row count). On completion auto-recomputes + shows status line `Primed N · X failed`.
- This turned "open every ticker's feature chart once" chore into a single click. Scanner now usable without pre-priming ritual.

**3. TS cleanup on FeatureChart.tsx (unblocks tauri:build).**
- Five pre-existing errors fixed: `valueFormatter: (v: number | string) => ...` (explicit lambda arg type) + widened `series: echarts.EChartsCoreOption['series'] = []` → `series: any[]` (the heterogeneous candlestick + line + bar mix is hard to narrow cleanly; runtime shape is what ECharts reads). `series!.push(...)` → `series.push(...)` across the file.
- `npm run build` now passes fully (tsc + vite build). Bundle = 1.3 MB / 430 KB gzipped — one chunk warning, accepted as future polish.

**4. Settings modal + API-key UI + theme customization + About tab.**
- Trigger: new ⚙ button in app header (right-aligned).
- Three tabs: API Keys · Appearance · About & Tips.
- **API Keys.** First attempt used `keyring` crate (OS-native credential manager). On Windows, keyring v3 silently fell back to a process-local store that didn't actually write to Credential Manager (`cmdkey /list` showed zero `personal-terminal*` entries despite set+read-back verification returning Ok). Pivoted: store keys in SQLite `config` KV at `api_key.fred` / `api_key.finnhub`. `.env` fallback preserved. New source enum: `Stored | Env | None`. Masked-value display (`••••74eb`). SAVE writes DB + shows transient `Saved ✓`; CLEAR sets value='' (fred_api_key_source filters empty → falls through to env/none). All existing callers refactored to take `&Db` (`macro_cmds`, `news_cmds`). Captured as **SEC-1** in LESSONS.
- **Appearance.** User-customizable SMMA Ribbon palette (resolves the 5-iteration palette problem from S8 — hand it to the user). Seeded 5 presets (Gold/Navy, Teal/Fuchsia, Sky/Pink, Cyan/Rose, Emerald/Red) as one-click shortcuts; 3 native HTML5 color pickers (`<input type="color">`) for per-state fine-tuning; live preview strip with state-coloured bands + badges; reset-to-defaults. Persistence via `session.palette` on `config` KV as `{bull, bear, neutral}` JSON.
- **Theme application path.** `useThemeColors()` hook (in `src/hooks/useThemeColors.ts`) sets CSS vars on `:root` (`--state-bull`, `--state-bull-rgb`, etc.) via `document.documentElement.style.setProperty` — state badges + news chips + any `var(--state-*)` consumer auto-update. For ECharts-rendered SMMA Ribbon bands + flip markers, `applyThemeToIndicators(indicators, theme)` (in `src/utils/applyThemeToIndicators.ts`) remaps `IndicatorSeries.color` by series name (`Bull Band`/`Bear Band`/`Neutral Band`, alphas 0.5/0.5/0.3 matching Rust constants) and marker color by `label` field (`Bull Flip`/`Bear Flip`/`Neutral Flip`). Wired in TickerDashboard via `useMemo`.
- **About tab.** Placeholder PrivateACB cross-promo card ("from the maker of PrivateACB" + LEARN MORE button → `openUrl` via `tauri-plugin-opener`). User plans to rewrite copy before release. Hidden-shortcut tips section lists: Ctrl+right-click tooltip toggle, Scanner PRIME, Manage Groups ⚙, Ticker EDIT mode.

**5. Tile range switch — 1D / 1W / 1M / YTD / 1Y (closes M3/S4 deferred item).**
- New DB helper `Db::close_at_or_before(ticker, data_source, target_date)` returning the nearest price_history close on/before the given date.
- `TickerTileData` extended with `change_pct_1w/1m/ytd/1y` fields; 1D stays on Yahoo's `change_pct_24h`. Computed in `list_ticker_tiles` Phase 3 using calendar lookbacks (7d / 30d / Dec-31-prior-year / 365d).
- Frontend `RangeSwitch` component (pill row). Selection persisted globally under `session.tile_range`. Tiles render the selected change — 1D keeps `abs (pct%)` format; non-1D shows `pct%` only (avoids needing back-compute of absolute from live price).
- Heatmap thresholds scale per range: 1D=1%, 1W=3%, 1M=5%, YTD=15%, 1Y=20%. Prevents long ranges from painting the grid uniformly "strong-up/down".
- Tiles without primed history show "—" for non-1D ranges → PRIME in Scanner fills them in.

**6. Keyboard shortcuts (feature #8) — DROPPED.**
User flagged conflict: numbered `Ctrl+1..9` mapped positionally breaks when groups are user-editable (reordered, added, deleted). Alternative (hardcoded section slugs) violates extensibility-first HARD CONSTRAINT. Correct answer is Ctrl+K command palette (M9 feature #3) which navigates by fuzzy-match — extensible-native. Decision: drop #8 entirely. Relevant bindings that don't conflict (sidebar toggle, `?` help modal, `Esc` close-modal) deferred to M9/post-v1. Not a gap; a dropped spec item.

**In-session course corrections.**
- **Keyring silently no-op on Windows** — already discussed above (pivot to SQLite KV). SEC-1 in LESSONS.
- **Rust NLL borrow-checker on tile struct literal** — `pct_from` closure captured `&t.ticker`/`&t.data_source` while the struct literal moved `t.data_source`. Fix: compute all pct changes into locals (`chg_1w`, `chg_1m`, etc.) BEFORE the struct literal. Trivial once the error pointed the way.
- **Stale background `tauri:dev` blocked port 5173** — continuation of TIME_WAIT issue from prior S8. User closed the leftover window manually; `npm run tauri:dev` relaunched clean.
- **Background `run_in_background` tauri:dev cascade-exits** — Tauri dev mode doesn't survive being detached from the bash session. User runs `npm run tauri:dev` themselves in their own terminal; I avoid re-backgrounding the dev server. Captured as **TV-4** in LESSONS.

**Remaining M8 (not blocking v1 release).**
- Icon swap — user-provided `.ico` replacing PrivateACB placeholder.
- Palette finalization — moot; now a user preference, no developer decision needed.

---

### S8 second half — SMMA palette refactor + M8 Phase 1 (2026-04-24)

Continuation of S8 after formal M7 session-end. Two tranches:

**SMMA Ribbon palette centralization + 5 iterated attempts (parked).**
- Iterated palettes: teal/fuchsia → sky/pink-500 → sky/pink-400 → cyan-600/rose-400. None resonated with user; parked pending spousal review.
- Durable win: **centralized palette system.** CSS vars `--state-bull`, `--state-bear`, `--state-neutral` + `-rgb` variants in `src/styles/tokens.css`; mirrored Rust constants in `smma_ribbon.rs` (FILL_BULL/FILL_BEAR/FLIP_*). Cross-references in comments. Future swap: 3 CSS vars + 4 Rust constants, no other touchpoints.
- Flip labels renamed `Gold Flip`/`Blue Flip` → `Bull Flip`/`Bear Flip` to decouple from any future color swap.
- Series names in `smma_ribbon.rs` renamed from snake_case (`band_base`, `v1`, `v2`) → human (`Base`, `Bull Band`, `Bear Band`, `Neutral Band`, `SMMA Fast`, `SMMA Slow`). `rsi`→`RSI`, `atr`→`ATR`.
- FeatureChart: dropped `${ind.id}:` prefix from legend data; `legend.icon: 'roundRect'` + `itemStyle.color` on every series so stacked-area swatches match their fills (previously showed invisible/gray line-icons because `lineStyle.opacity=0`).

**M8 Phase 1 — user-editable watchlist + groups.**
- Schema migration: `user_hidden INTEGER NOT NULL DEFAULT 0` on `sector_groups` + `watchlist_tickers`. `Db::migrate()` runs ALTER + swallows "duplicate column" on existing DBs. Soft-delete semantics: seed's `INSERT OR IGNORE` doesn't revive hidden rows.
- `list_sector_groups` + `list_tickers_in_sector` filter `WHERE user_hidden = 0`.
- Rust: `commands/edit_cmds.rs` with 8 commands — `add_ticker`, `remove_ticker` (soft), `update_ticker` (incl. move-to-group via `newSectorGroupId`), `reorder_tickers`, `create_sector_group`, `update_sector_group`, `delete_sector_group` (blocks if non-hidden tickers or children), `reorder_sector_groups`. Validation: ticker uppercase/trim/max 15, group id lowercase slug/max 40, display name max 80.
- Ticker `data_source` inherited from parent sector_group at create — never exposed in UI.
- Ticker rename = display_name change only. Symbol is immutable (preserves `price_history` / `quote_cache` / `indicator_settings` FK consistency).
- Frontend: `TickerEditPanel.tsx` (edit-mode toggle on ticker dashboards — add/rename/delete/move). `GroupsManagerModal.tsx` (sidebar ⚙ button opens — add/rename/delete/reorder, ↑↓ arrow buttons for order, no drag-drop per scope). Parent-group picker on new-group form. Inline rename via click→edit→blur/Enter.
- Finnhub per-ticker news: `fetch_company_news(key, symbol, from, to)` added to `sources/news/finnhub.rs`. `refresh_news` walks `list_finnhub_eligible_tickers()` (US equities only — excludes `^*`, `*=F`, `*.TO`, `*-USD`, `DX-*`) + upserts with `source='finnhub_ticker'`, `ticker=<symbol>`, `category='ticker'`. Chip labeled "My Tickers" on frontend.
- CSS additions: `.edit-panel__*` (add row + table + inline rename), `.modal-backdrop`/`.modal__*` (generic modal shell), `.sidebar__manage`/`.sidebar__scroll` (sidebar layout split), `.news-item__ticker` (sky-blue ticker badge on news rows).
- Capabilities: `opener:default` (for news external links), unchanged; edit commands don't require extra permissions.

**In-session course corrections:**
- **rusqlite subquery-in-VALUES trip**: first `create_sector_group` used `VALUES (..., COALESCE(?5, (SELECT MAX(...)+1 FROM ...)), ...)`. Swapped to two-query flow (SELECT MAX, then INSERT) for robustness. Same pattern applied to `add_ticker`.
- **Modal form column widths**: first GroupsManagerModal add-row had `.edit-panel__select` with `width: 100%` causing `yahoo` dropdown + parent dropdown to dominate width. Display Name input collapsed to near-zero, looking like it didn't exist. User couldn't add because validation blocked on empty name, and the disabled button didn't fire a click event (= no console log, invisible to DevTools). Fix: fixed-flex widths for selects (`flex: 0 0 110px`/`180px`) + explicit `.edit-panel__input--id` class. Captured as **FL-3** in LESSONS.
- **Tauri v2 "proc macro panicked" during `cargo check`**: standalone `cargo check` hits `generate_context!()` expecting `frontendDist: "../dist"` to exist. tauri:dev runs `--no-default-features` which skips this path. Workaround: use `cargo check --no-default-features` locally. Captured as **TV-3** in LESSONS.

**Remaining gaps (not blocking):**
- Reorder tickers in-group: backend `reorder_tickers` command exists but no frontend UI; display_order follows insert order. Add ↑↓ buttons in TickerEditPanel if needed.
- Change a group's parent: not supported via UI (delete + recreate). Consider if use case emerges.
- Move ticker across groups via drag-drop: Option C scope, deferred.

---

### S8 — M7 NEWS dispatcher + 8-feed seed + opener plugin (2026-04-24)

**What changed:**
- Schema: `news_feeds` + `news_items` tables added to `schema.sql` (spec'd in DESIGN.md since v0.5, missing from M1 — same situation as M6's indicator tables). PK `(source, external_id)` makes `INSERT OR IGNORE` the entire dedup mechanism; no custom "what's new" logic in fetchers.
- Rust `src-tauri/src/sources/news/`: `mod.rs` (`NewsItem` DTO, `NewsError`), `rss.rs` (feed-rs parser, browser-like UA, SHA-256 synthetic guid fallback, HTML stripper with entity decode), `finnhub.rs` (general news via `/api/v1/news?category=general`; company-news deferred).
- DB helpers: `list_news_feeds(enabled_only)`, `upsert_news_items(source, feed_id, ticker, category, items)` returning insert count, `list_news_items(category_filter, limit)`, `mark_feed_fetched(feed_id)`, `cleanup_old_news_items(30)`.
- Commands `src-tauri/src/commands/news_cmds.rs`: `list_news(category?, limit?)`, `list_news_feeds()`, `refresh_news(force)` walking enabled feeds under `Semaphore(6)` + `join_all`, per-feed `refresh_minutes` freshness check, errors collected into `RefreshResult.errors` without failing the whole refresh.
- `lib.rs`: registers `tauri_plugin_opener::init()`, runs `cleanup_old_news_items(30)` on boot (logs count removed).
- Capabilities: `opener:default` + scoped `opener:allow-open-url` with `[{url:"https://*"},{url:"http://*"}]` — `allow-open-url` alone isn't sufficient in Tauri v2.
- Cargo.toml: `feed-rs = "1.5"`, `sha2 = "0.10"`, `tauri-plugin-opener = "2"`. package.json: `@tauri-apps/plugin-opener ^2.0.0`.
- Frontend: `types/news.ts`, `NewsDashboard.tsx` (chip filter derived from items, frontend-side filter via `useMemo`, debounced-ish auto-refresh on mount, `openUrl()` on headline click, `news-errors` red panel for per-feed failures, relative-time badges). App router adds `section === 'news'` branch.
- CSS: new `.news-dashboard`, `.news-list`, `.news-item__*`, `.news-errors` block in `app.css`.
- Seed migrations: `DELETE FROM news_items/news_feeds WHERE id='bnn_bloomberg'` (dead URL); `UPDATE news_feeds SET enabled=0 WHERE id='finnhub_general'` (no key in free setup).

**Decisions captured in memory:**
- `memory/m7_news_decisions.md` — ticker-news path follows `watchlist_tickers` not news_feeds (= future edit-script work auto-updates news coverage); save-everything cache-first matches M1-M6; 30-day retention on `fetched_at`; filter chips derived from `category` column; no "geopolitics" chip for v1 (ME feeds folded into `world`).

**In-session course corrections:**
- First capability attempt `opener:allow-open-url` alone → runtime ACL error "Not allowed by ACL". Fix: added `opener:default` + explicit scoped allow-url for http/https schemes. `default` alone also insufficient; needs the scoped rule.
- `bnnbloomberg.ca/feed` returned 404 (site rebranded under Bell Media). Swapped to CBC Business (`cbc.ca/webfeed/rss/rss-business`) with DELETE migration. Captured as NEWS-1 in LESSONS.
- Finnhub feed was spamming the error list on every refresh (no API key in free setup). Disabled (`enabled=0`) rather than deleted — plumbing stays intact for future key adds.
- User asked for Middle East coverage — added BBC Middle East + Al Jazeera under `world` category. No new chip.

**Build incidents:**
- E0597 on `list_news_items`: rusqlite `query_map` + closure + trailing `?` — NLL tracks `stmt` borrow across the match arm's ControlFlow temporary and complains "does not live long enough". Fix: swap to low-level `stmt.query(params)?; while let Some(row) = rows.next()? { out.push(...); }`. Captured as DB-5 in LESSONS.
- Unused `NewsError::MissingApiKey` variant — removed (fetch_one uses String errors via `.to_string()`, not the typed variant).

**Remaining M7 gaps (not blocking):**
- Finnhub `/company-news?symbol=X` per-ticker path — deferred, lands alongside M8 ticker-editing script so the watchlist-change → news-coverage relationship is codified in one place.
- News search + unread/read state — post-M8.
- Pre-existing TypeScript errors in `FeatureChart.tsx` (5 errors, untouched this session) — will block `tauri:build` but not `tauri:dev`. Separate cleanup needed before any production bundle.

**S8 addendum — SMMA Ribbon palette swap:**
Follow-up to the S7 Larsson→SMMA Ribbon rename. The gold/navy envelope colors were visually verbatim and read as a copy despite the name change. Swapped to teal (`rgba(20, 184, 166, ...)`) + fuchsia (`rgba(217, 70, 239, ...)`). Touched: `smma_ribbon.rs` (FILL_BULL/FILL_BEAR + FLIP_BULL/FLIP_BEAR constants + flip labels Gold/Blue→Bull/Bear), `app.css` `.state-badge--bullish/bearish` color families, module doc comment. See `memory/m6_indicator_rename.md` "Palette swap" section.

**Next session entry point — M8 Polish:**
1. **Ticker-editing script** (user-requested S8) — add/remove/rename `watchlist_tickers` via UI; paired with Finnhub per-ticker news subscription so coverage follows the watchlist automatically.
2. **Session persistence** (feature #7) — `config` KV for last ticker, last timeframe, indicator toggles, sidebar expand state, active sector_group. Hook into App.tsx at load/unmount.
3. **Keyboard shortcuts** (feature #8) — Ctrl+1..9 section switch, `/` focus search, `` ` `` toggle sidebar. `useKeyboardShortcuts` hook.
4. **Settings modal + API-key UI** — migrate FRED + Finnhub keys from `.env` to Tauri keyring or encrypted local KV. First UI touchpoint for api-key management; unblocks Finnhub for users without dev-setup.
5. **Icon swap** — replace PrivateACB placeholder `icon.ico` with a terminal-branded icon; generate Mac/Linux variants.
6. **TypeScript cleanup pass** on `FeatureChart.tsx` errors so `tauri:build` works end-to-end.

---

### S7 — M6 indicator framework + SMMA Ribbon rename (2026-04-24)

**What changed:**
- Rust `src-tauri/src/indicators/`: `mod.rs` (trait, `Bar`, `IndicatorOutput` with `series`/`markers`/`regions`, static registry via `OnceLock`), `smma.rs` (primitive, Wilder seed + recursion with Option<f64> gaps), `smma_ribbon.rs` (4 SMMAs on hl2, state classifier, confirm=3, 6-series output for state-coloured envelope), `rsi.rs` (Wilder RSI via SMMA), `atr.rs` (Wilder ATR via SMMA). Math ported verbatim from `trendscope/src/trendscope/indicators.py`.
- Schema: added `indicators` + `indicator_settings` tables to `schema.sql` (were spec'd in DESIGN.md but absent from the M1 schema). Seed: 3 registry rows (`smma_ribbon`, `rsi_14`, `atr_14`) + DELETE-before-INSERT migration path for old `'larsson'` id.
- DB helpers: `all_price_bars_ohlcv` (full OHLCV, feeds candles + indicator compute), `get_indicator_settings(ticker)`, `upsert_indicator_setting(ticker, indicator_id, enabled, params_json)`.
- Commands: `list_indicators`, `get_indicator_settings`, `set_indicator_setting`, `compute_indicators(request: {ticker, dataSource, indicatorIds})`, `scanner_snapshot` (walks all enabled leaf sector_groups × computes Larsson/RSI/ATR on cached bars).
- `TickerBar` / `TickerHistory` extended to carry OHLC + volume (was close-only).
- Frontend types: `types/indicator.ts` (`IndicatorOutput`, `IndicatorSeries` with `stackGroup`+`hidden`, `IndicatorRegistration`, `IndicatorSetting`).
- `FeatureChart.tsx` rewrote for `mode: 'line' | 'candlestick'`. Candlestick mode builds per-pane `grid[]` / `xAxis[]` / `yAxis[]` for price + volume + N subpane indicators, one-call-per-symbol dataZoom via `inside` + `slider` with 1y default window, stacked area fill for SMMA Ribbon envelope (`stackGroup` → ECharts `stack` + `areaStyle` trick), `markPoint` for flips with `triangle`/`symbolRotate: 180` for down-flips.
- `IndicatorPanel.tsx` (checkbox chips) + `TickerDashboard.tsx` wiring: tile click → parallel `get_ticker_history` + `get_indicator_settings` → compute if enabled → pass to `FeatureChart`. Toggle persists via `set_indicator_setting`.
- `Scanner.tsx`: sortable table (ticker / sector / name / price / state / bars-since-flip / RSI / ATR%), state-tier filter chips, state badges coloured gold/navy/gray.
- Sidebar entry `scanner` seeded with `display_order=0`; App router has dedicated route for `scanner` section.
- Right-click tooltip toggle — `tooltip.showContent: tooltipVisible` keeps the axisPointer firing; crosshair survives the right-click.
- SMMA Ribbon rename: file rename (`larsson.rs` → `smma_ribbon.rs`), struct (`LarssonIndicator` → `SmmaRibbonIndicator`), id, display_name, liability footer text, seed row, `CLAUDE.md`/`DESIGN.md`/`MEMORY.md` active references. Historical refs kept per Option A decided in this session.

**Decisions captured in memory:**
- `memory/m6_indicator_rename.md` — why the rename, canonical new names, what stays "Larsson" on purpose.

**In-session course corrections:**
- First attempt at SMMA Ribbon drew full-height background shading (`markArea`) coloured by state — wrong; lost the envelope-width-is-the-signal property of the original indicator. Rewrote as stacked-area fill between v1 and v2 (hidden baseline series + 3 state-coloured band layers), matching trendscope's `fill='toself'` polygon approach in Plotly.
- Right-click toggle broke both tooltip AND crosshair on first try — `tooltip.show: false` also kills axisPointer. Swapped to `tooltip.showContent: false`, kept `show: true`.
- Crosshair had only the vertical line — moved `axisPointer` config back inside `tooltip` block (ECharts binds them when `trigger: 'axis'`), top-level `axisPointer.link: [{ xAxisIndex: 'all' }]` for pane sync.

**Build incidents:**
- Rust/MSVC incremental-compile cache corrupted after many cargo-watch cycles → linker LNK1120 "unresolved anon symbols". Fix: delete `target/debug/incremental/`; full `cargo clean` is overkill.
- Vite port 5173 stuck after tauri-dev subtree killed without reaping node.exe. `netstat -ano | grep :5173` + `taskkill /F /PID <n>` unblocked relaunch.

**Remaining M6 gaps (not blocking):**
- Scanner's "no bars" rows require user to open each ticker's feature chart once to populate `price_history`. Could be solved by a "prime all histories" button or an eager background fetch on scanner open — deferred.
- Regime shading (DESIGN feature #4) was originally spec'd as full-chart background colour; replaced by the SMMA Ribbon envelope fill. Envelope width is more informative; treat the feature as *delivered via a different mechanism* rather than re-adding the background shading.
- `scanner_snapshot` re-computes indicators from cached bars every call — no memoisation. For 60+ watchlist tickers it's <1s on my machine but would be noticeable on a weaker box.

**Next session entry point — M7 NEWS:**
1. Schema (already present in `schema.sql`): `news_feeds`, `news_items`. Confirm they're created at init.
2. Seed `news_feeds`: 1 Finnhub row (source_type='finnhub', refresh_minutes=15), 2–3 Canadian RSS rows (source_type='rss').
3. `sources/finnhub.rs` + `sources/news/rss.rs` fetcher modules. Dispatcher in `commands/news_cmds.rs` keyed by `feed.source_type`.
4. `list_news(source?, limit)` command; upsert into `news_items` with `fetched_at`.
5. Frontend `NewsDashboard.tsx` — list view, feed selector tabs from DB (same pattern as MACRO's `category` tabs), click-through to external URL via `tauri-plugin-opener` (new dep, first use of the plugin).
6. Flip `news` sector_group to `enabled=1` on seed.
7. Smoke test.

---

### S6 — CRYPTO + FUTURES & FX (2026-04-24)
- 10 crypto pairs (BTC-USD … TRX-USD) seeded under `crypto` sector_group, Yahoo data source.
- 6 commodity/FX tickers (CL=F, GC=F, SI=F, NG=F, HG=F, DX-Y.NYB) seeded under `futures_fx`.
- UPDATE statement in seed.sql flips both parent sector_groups to enabled=1 on every boot (INSERT OR IGNORE leaves existing rows' `enabled` unchanged).
- Deferrals logged: CoinGecko integration + dynamic top-10 auto-discovery (both targeted post-M7 as a single enhancement) — see `memory/m5_crypto_futures_decisions.md`.

### S5 — CA EQUITIES + collapsible sidebar (2026-04-24)
- 31 Canadian tickers seeded across 5 child sector_groups (parent_id='ca_equities'). Energy (7), Banking (6), Telecom (4), Crypto Miners (5 incl. GLXY/WULF US-listed), Metal Miners (9).
- `Sidebar` rewritten to group by `parent_id`, render parents as collapse/expand headers, children as indented leaf buttons. Always-expanded initial state; session persistence deferred to M8.
- `App.tsx` generalised: any enabled leaf `sector_group` with no special-case handler routes through `TickerDashboard`. Section label includes parent context ("CA EQUITIES · Energy").
- No new backend code — `list_sector_groups` and `list_ticker_tiles` already supported the hierarchy via `parent_id`.
- Pattern: `INSERT OR IGNORE` won't update an existing row's `enabled` flag, so when flipping a placeholder group live, pair the INSERT with a subsequent `UPDATE ... SET enabled=1 WHERE id=...` in seed.sql. Now in place for `ca_equities`.

---

## Sessions

### S3 — M2 macro dashboard shipped (2026-04-24)

**Delivered:**
- Seed expanded to 18 FRED series across 6 categories (Rates / Inflation / Labor / Growth / Consumer / Housing). Idempotent via `INSERT OR IGNORE`; `seed()` now runs on every boot (renamed from `seed_if_empty`) so new milestones' seed rows land automatically.
- Rust: `list_macro_tiles()` batch command — snapshots cache under mutex, fetches stale series in parallel via `futures::join_all` with a `tokio::sync::Semaphore` cap of 6. Per-series fetch failures degrade to cached values + `fetchError` marker; one flaky series doesn't block the dashboard.
- Rust: `get_fred_history(series_id)` reads full observation history from DB (no extra fetch — history is always upserted alongside latest value).
- Rust: YoY lookback via `fred_value_at_or_before(series_id, target_date)` — handles FRED's business-day gaps by taking nearest earlier non-sentinel value. `date_minus_one_year` helper handles Feb 29 → Feb 28 fallback.
- Frontend: `MacroDashboard` fetches batch, derives category tabs from API `category` field (never hardcoded), renders `MacroTile` grid with click-through to inline `FeatureChart` overlay. `← Back` returns to grid.
- Heatmap toggle: sign + magnitude tiers (`heatmap-soft-up/strong-up/soft-down/strong-down`). Thresholds 0.5pp for Percent units, 2% for others. Not per-series calibrated; acceptable for at-a-glance.
- ECharts feature chart: raw `echarts` (no React wrapper), single line series with cyan-fade area, dark-theme tooltip, `connect('macro')` group registration — substrate for feature #6 linked cursor that pays off when multi-chart UIs land.
- `computeYoY`/`formatYoY` helpers in `src/types/macro.ts` — kind discriminator (`'pp' | 'pct'`) based on units.

**Smoke-test findings + fixes (live during S3):**
- Tile row-height inconsistency: DGS10's 3-line title stretched its whole row taller than siblings. Fix: `grid-auto-rows: 150px` + `-webkit-line-clamp: 2` on titles + `title=` attr on h2 for hover tooltip. See `memory/tile_grid_convention.md`.
- Feature chart rendered ~80px tall instead of filling the pane: ECharts captures container dimensions at `init()`, but the flex chain wasn't resolving to a definite height. Root cause: `min-height: 100vh` on `.app-shell` doesn't give flex children a target for `flex: 1` distribution. Fix: `height: 100vh` + `overflow: hidden` on `.app-shell`, plus `overflow-y: auto` on `.app-main` so content can scroll if it exceeds viewport. Also added `ResizeObserver` on the chart container for future split-pane / sidebar layouts.

**Deliberately deferred (per `memory/m2_dashboard_decisions.md`):**
- Sparklines on MACRO tiles → M3 on ticker tiles where intraday movement matters
- Per-series calibrated heatmap intensity — current tiered thresholds are fine for MVP
- Sidebar navigation — M3 when INDICES + US EQUITIES need sibling sections
- Linked cursor visible payoff — `connect('macro')` is wired but needs multiple open charts to demo

**Next (M3 scope reminder):**
Yahoo Finance fetcher + US EQUITIES (10 tickers) + INDICES (15 majors) + sidebar nav skeleton + market-hours strip (feature #2).

### S3 addendum — Refresh button + DB status bar (2026-04-24)

**Delivered (user-requested polish before M3):**
- Rust: `list_macro_tiles(force: bool)` — `force=true` bypasses the 12h freshness check and re-fetches every series via the existing semaphore-capped parallel path. `force=false` (initial load) honors cache.
- Rust: `Db::path()` + `Db::count(table)`; new `commands/system_cmds.rs::get_db_info()` returns `{ path, sizeBytes, seriesCount, observationCount }`.
- Frontend: Refresh button next to Heatmap toggle — `REFRESH` → `REFRESHING…` (disabled) → inline `Updated HH:MM:SS · N/M tiles` summary, with `· K errors` if any `fetchError` tiles came back.
- Frontend: `StatusBar` footer strip — shows full DB path (click to copy, flashes "copied") + size + series count + total observation count. Re-reads after every successful refresh via `refreshTrigger` counter lifted to `App.tsx`.
- CSS: `.macro-dashboard__actions` cluster + `.status-bar` footer (bordered, mono, tertiary text). Status bar sits outside `.app-main`'s scroll so it's always visible.

**Caching verification (captured for future reference):**
The 12h TTL + `is_fresh(last_fetched)` path in `list_macro_tiles` is the only place FRED HTTP calls originate. Warm reloads (within 12h) render the dashboard entirely from SQLite with zero network traffic. `INSERT OR IGNORE` on series + `ON CONFLICT DO UPDATE` on observations makes every upsert idempotent — re-fetches preserve history and update in place. Force-refresh is the only way to bypass this from the UI.

---

---

## Sessions

### S2 — M1 scaffold shipped (2026-04-24)

**Delivered:**
- Frontend shell: Vite + React 18 + TS, single-page App with `MacroTile` component calling `invoke('get_fred_tile', { seriesId })`
- Token subset (`src/styles/tokens.css`) — focused dark-terminal palette; full PrivateACB port deferred to M3 when UI density grows
- Tauri v2 Rust backend: plain `rusqlite` (no SQLCipher — personal use, no encryption), `reqwest`, `dotenvy`, `dirs`
- SQLite schema with WAL + FK pragmas: `sector_groups`, `watchlist_tickers`, `fred_series`, `fred_observations`, `config`
- Seed: MACRO sector_group + DGS10 series stub (metadata overwritten on first FRED fetch)
- FRED source module: `fetch_series_meta` + `fetch_observations` endpoints, sentinel "." preserved as TEXT
- Command: `get_fred_tile(series_id)` with 12h cache TTL; cache-miss path fetches + upserts, always reads from DB for response
- Serde/IPC rules obeyed: `MacroTileData` is `rename_all = "camelCase"`, mutex guard dropped before awaits

**M1 shape decisions (from green-light):**
- API keys: env-var first (`.env` + `dotenvy`), migrate to Tauri keyring in M8 settings modal
- FRED values: TEXT in SQLite, parsed to f64 on read (cache uniformity)
- Scaffold scope: only what M1 touches — no menu bar, no fs/dialog/clipboard plugins, `bundle.active: false` to skip icon generation until M2+
- FRED series pick: **DGS10** (10Y Treasury) — daily, single value, recognizable

**Deliberately deferred:**
- Tauri bundle icons (`bundle.active: false` for M1) → M2+
- PrivateACB full design-token port → M3 (when tile density ramps)
- Tauri keyring for API keys → M8 settings modal
- `rust_decimal` → M3 (first appears when quotes land; FRED observations are f64)
- `tauri-plugin-opener` / external-link cmds → M7 news section

**Next (M2 green-light checklist):**
- Bring in ECharts, port remaining FRED series (17 more), build category tabs, add feature chart with linked cursor (#6), macro heatmap view (#9)

**Verification gate for M1 — PASSED (2026-04-24):**
- `npm install`: clean (72 packages, 9s)
- `npm run tauri:dev`: window launched, DGS10 tile rendered with title "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity…", value 4.30%, obs date 2026-04-22, units Percent
- Build-blocker encountered: `tauri-build` on Windows requires `src-tauri/icons/icon.ico` even when `bundle.active: false` (it's used for the exe's Windows Resource file). Placeholder copied from PrivateACB — swap with terminal-branded icon during M8 polish.

---

### S1 — Project inception + five scope iterations (2026-04-24)

**Origin:** conversation during PrivateACB session. User wants a personal Bloomberg-terminal-like desktop dashboard for their own research, separate from PrivateACB's tax scope.

**Reference material:**
- Bloomberg Killers table (Market Sentiment) — 25 free/cheap financial-data providers
- urbankaoberg.com screenshot — layout / IA / tile-density reference
- trendscope (`E:\Users\PBL\Documents\Dev\trendscope`) — Python Larsson Line clone, indicator-math porting source

**Phase 1 — Initial decisions:**
- Tauri v2 desktop, Rust backend, React frontend, SQLite+WAL
- Reuse ~30-40% from PrivateACB
- No Cloudflare / cloud / auth — desktop-only
- Free-tier data sources

**Phase 2 — Asset-universe scope:**
- 6 sections, ~85 tiles: MACRO, CRYPTO, US EQUITIES, CA EQUITIES (5 sub-sectors), FUTURES & FX, NEWS
- +Yahoo Finance (US+TSX equities, futures, DXY), +RSS (Canadian news)
- Extensibility-first as HARD CONSTRAINT
- Left sidebar navigation tree
- Ticker list finalized: HUT.TO (CA), GLXY (US), all 5 futures

**Phase 3 — Plotting, crypto-history, world indices:**
- +INDICES section (15 majors, Yahoo, local currency)
- Crypto history beyond CoinGecko's 1Y → Yahoo fallback
- Initial plotting choice: Lightweight Charts (later reversed)

**Phase 4 — trendscope review + indicator framework:**
- Reviewed trendscope (Python/Streamlit/Plotly, 18-ticker Larsson clone)
- Larsson Line math: ~130 lines Python → ~200 lines Rust (SMMA + state + confirm + flips)
- **Chart library reversed: Lightweight Charts → Apache ECharts.** Reason: Larsson's state-colored fill and future custom indicators need ECharts' native fill-between-curves + grid subpane system. Lightweight Charts would require Custom Series plugin for every custom indicator.
- **Indicator framework: Rust-side, trait-based, universally available.** Compute on-demand (not persisted), f64 precision, per-ticker toggles via `indicator_settings`.
- M6 added for indicator framework + Larsson + RSI + ATR + flip markers port.
- Milestones 7 → 8.

**Phase 5 — Feature layer (10 features distributed across milestones):**

Brainstormed a feature menu (~25 candidates) organized by theme (Chart/Analysis, Dashboard, Macro, News, UX, Power). User selected 10:

| # | Feature | Milestone |
|---|---------|-----------|
| 1 | Multi-ticker overlay (% change comparison) | M9 (new) |
| 2 | Market-hours indicator (app shell strip) | M3 |
| 3 | Command palette (Ctrl+K) | M9 |
| 4 | Regime shading on feature chart | M6 |
| 5 | Watchlist performance summary (sortable table) | M9 |
| 6 | Linked cursor across charts (ECharts `connect()`) | M2 |
| 7 | Session persistence (last ticker/timeframe/toggles) | M8 |
| 8 | Keyboard shortcuts (Ctrl+1..9, /, `) | M8 |
| 9 | Macro heatmap view (FRED tiles by YoY delta) | M2 |
| 10 | Multi-ticker scanner (Larsson bull-state roster) | M6 |

**New M9 "Feature layer" milestone** added for the three cross-cutting features that need the full watchlist + indicator system live. Total milestones 8 → 9.

Out-of-scope items surfaced but not selected: seasonality heatmap, candlestick pattern detection, system tray, news sentiment coloring, earnings/economic calendar, correlation heatmap, yield curve viz, backtesting. Worth reconsidering for v1.1.

**Artifacts produced in S1 (all five phases):**
- `CLAUDE.md` — rules, reuse checklists (PrivateACB + trendscope), extensibility-first, chart-library, indicator architecture
- `docs/DESIGN.md` v0.5 — 7 sections, indicator framework, feature layer, ECharts, trendscope port checklist, schema, 9 milestones
- `memory/MEMORY.md` — preferences + project-specific decisions
- `docs/images/` — both blueprint images

**Next session:**
- Green-light M1: Tauri scaffold + SQLite init + `sector_groups`/`watchlist_tickers` schema + seed data + one FRED tile end-to-end

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
