# Progress Log — Private Terminal

## Current Focus
**v1.1 Analysis section Phase 3 fully shipped on master (2026-05-02, S18).** Master at `d471633`. Seven Analysis tabs live: Correlations · Yield Curve · Pairs · RRG · Recession Prob · Financial Conditions · Regime Quadrant. The last Phase 3 tool (Macro Regime Quadrant) ships with INDPRO YoY (growth axis) × CPI YoY default + Core PCE toggle (inflation axis), 12/24/36/48-month trail picker, four-quadrant scatter with crosshairs anchored at long-run baselines, and the standard `<TabIntro>` pattern. Zero new FRED series — INDPRO + CPIAUCSL + PCEPILFE were already seeded since M2. 20/20 analysis math tests green (was 17/17 — three new YoY helper tests).

**Phase 3 still-deferred:** MACRO-tile retrofit for Recession Prob + FCI (S15 Q4 spec'd "both surfaces"; lean path shipped Analysis-only). A shared `<MacroSeriesView mode="tile" | "chart">` component would land the tile twins cheaply; not blocking.

**Awaiting cold-eye tester feedback on v1.0.0-rc.1** (parallel track, unchanged). Remaining before `1.0.0` final:
1. Tester feedback round (cold-eye review). No code commitments until feedback lands.
2. After verification, bump `1.0.0-rc.1` → `1.0.0` in 4 places (`package.json`, `Cargo.toml`, `tauri.conf.json`, `version.ts`) + rebuild.

**v1.1 priority queue (post-Phase-3-complete):** optional MACRO-tile retrofit for RecProb/FCI (shared `<MacroSeriesView>`) → Phase 4 (COT / AAII / VIX term — real new fetchers) → CoinGecko fetcher → bull/bear VRVP split → true log mode (Path a) → M9 features (overlay + Ctrl+K palette) → code signing.

**Indicator naming note:** the quad-SMMA-state indicator was originally seeded as "Larsson Line" (trendscope's label). During S7 we renamed to **SMMA Ribbon** after confirming from the originator's own Medium post that the math is derivative of public community work, not his invention. Session logs below keep the original "Larsson" references as a historical record — code, DB seed, UI text, and `CLAUDE.md`/`DESIGN.md` use "SMMA Ribbon" going forward. See `memory/m6_indicator_rename.md`.

### S18 — v1.1 Analysis Phase 3 finish: Macro Regime Quadrant (2026-05-02)

Single-tool session closing out Phase 3. Two commits on `feature/v1.1-regime-quadrant`, fast-forwarded to master at `d471633`. Zero new FRED series.

**(1) Pre-build decisions locked.** Four open items resolved up front before any code:
- **Growth axis: INDPRO YoY (vs NAPM).** INDPRO has clean continuous monthly history; NAPM publication has historical gaps. NAPM toggle deferred to v1.2.
- **Inflation axis: CPI YoY default with Core PCE toggle.** Both already seeded — `CPIAUCSL` (headline) and `PCEPILFE` (Core PCE — what the Fed actually targets). Per-request dropdown.
- **Scope: Option α (Quadrant only).** Skipped the shared `<MacroSeriesView>` retrofit for Recession Prob + FCI MACRO tiles — that's a separate session if/when it lands. Phase 3 lean → Phase 3 complete in this session, no extra abstraction.
- **Trail: 24mo default with 12/24/36/48 picker.** Configurable; the 48-month view shows the full COVID-era inflation spike trailing through Stagflation back to current readings.

**(2) Backend — `analysis/regime_quadrant.rs` (commit `613e3f3`, ~210 LOC).**
- `compute_regime_quadrant(req)` pulls `INDPRO` + (`CPIAUCSL` or `PCEPILFE` per `inflation_proxy`) via existing `db.all_fred_observations`. Both monthly index series.
- Shared `yoy_pct_change(points, months)` helper added to `analysis/mod.rs` alongside new `RegimePoint { date, growth_yoy, inflation_yoy }` shape. Single 12-month-offset percent-change formula with NaN guards on warm-up (first 12 entries) and non-positive priors (avoids div-by-zero / sign-flip).
- Inner-join on `(year, month)` rather than exact date — INDPRO and CPI observation dates don't always coincide within a month, so calendar-month keying preserves all valid pairs.
- Long-run baselines (arithmetic means of the full joined history) returned for crosshair placement. Critical detail: US inflation has been positive for 50+ years, so 0/0 quadrant split would put the entire trail in the upper half. Anchoring at long-run means turns the chart into "above-trend vs below-trend" — economically informative.
- `axis_bounds` expand to include both trail min/max AND the baselines, padded ±1.5pp. Symmetric-around-zero falls back only when the trail is empty.
- 3 new unit tests (`yoy_basic_12_month_pct_change`, `yoy_warmup_first_n_are_nan`, `yoy_skips_nonpositive_prior`) → 20/20 total green.
- Registry: `regime_quadrant` (display_order 7, scope `macro`, default config_json `{"inflationProxy":"cpi","trailMonths":24}`).
- IPC: `compute_regime_quadrant` command + `lib.rs::tauri::generate_handler!` registration.

**(3) Frontend — `RegimeQuadrantTab.tsx` (commit `d471633`, ~330 LOC).**
- Toolbar: inflation-proxy dropdown (CPI YoY headline / Core PCE YoY) + trail-length picker (12/24/36/48). Persisted via `usePersistedState('session.analysis_regime_quadrant_config')`.
- ECharts scatter with four `markArea` quadrant fills split at the baselines: TR Reflation (green), BR Goldilocks (blue), BL Disinflation (gray), TL Stagflation (red). Stagflation/Disinflation alphas at 0.09 (bumped from 0.06/0.07 first draft for stronger left-half contrast).
- Single trail line with per-point opacity gradient (0.2 oldest → 1.0 head) + scatter head dot with `position: 'right'` label showing the current observation date. Tooltip per-point shows date + growth/inflation YoY.
- Crosshair `markLine` at both baselines, `theme.markerLine` solid width 1. **Deliberate divergence from RRG** — RRG has no explicit crosshair because its quadrant boundary lands on x=100 / y=100 where the splitLine grid happens to render. Regime baselines fall at non-round values (~2.74 / 3.52) that don't coincide with gridlines, so the boundary needs an explicit cue.
- TabIntro filled in per the S17-mandatory pattern. Subtitle reads in plain language; "How to read this" walks through each quadrant with the regime-color mapping; "The math" gives the YoY formula + the calendar-month inner-join note + the baseline-as-mean note.
- Always-visible chart container with `minHeight: 520` (EC-15 lesson — never `display: data ? 'block' : 'none'`).
- Footer: `current <date> · growth X% · inflation Y% · baselines G% / I% · trail N months · series INDPRO × CPIAUCSL`.

**(4) Layout polish — RRG + Regime in lockstep.** Three iterations during smoke test:
- **Quadrant-label readability.** First draft fontSize 10 was too small to read. Bumped 10 → 13 → 16 across two iterations; same change applied to RRG for visual parity.
- **Left-side label collision (RRG only).** "LAGGING" was clipping behind the y-axis tick label area — RRG's tick labels like "115.0" (4 chars wide) collided with the `left: 60` graphic position. Moved `left: 60 → 80` for the IMPROVING/LAGGING pair (and the symmetric STAGFLATION/DISINFLATION pair on Regime) so both charts stay aligned. Regime's tick labels are short (1-3 chars) so it didn't actually need the move, but applied for symmetry.
- **Crosshair iteration on Regime.** First draft used `theme.markerLine` solid (correct intent). User flagged it was more distinct than RRG's. Tried `borderSubtle` dashed (matches gridlines) — too subtle, the user noted "the white quadrant separation line no longer appears." Restored to original `theme.markerLine` solid + width 1 with a comment explaining the deliberate divergence (see decision above). Captured as a non-bug — RRG and Regime intentionally differ here.

**(5) Watermark-style quadrant labels considered + rejected.** During the readability iteration the user asked whether ECharts could render the quadrant names as faint backgrounds behind the data, like FeatureChart's terminal-style ticker watermark (pattern at `FeatureChart.tsx:769-787` — single centered `graphic` text, `fill: theme.watermarkFill` = `text-primary @ 0.05`, `z: 0`, `silent: true`). For a 4-quadrant chart the implementation diverges: 4 entries, dynamic positioning (Regime quadrants are anchored at runtime baselines, not fixed coords), color/alpha tradeoffs (semantic colors faded vs neutral). User picked the simpler path — bump the existing corner labels' fontSize and leave them in place. Pattern noted as a future enhancement option.

**(6) Smoke-test outputs.** Four screenshots committed under `01_initial_design/screenshots/`:
- `Screenshot 2026-05-02 072116.png` — CPI YoY, 24-month trail. Head at 2026-03-01 in DISINFLATION (growth 0.74% < baseline 2.74%; inflation 3.32% < baseline 3.52%) — economically plausible (cooling inflation off 2022 spike + below-trend industrial production).
- `072205.png` — Core PCE toggle, 24mo. Same head positioning, slightly different y-axis range.
- `072336.png` — Core PCE, 48-month trail. Full COVID-era inflation spike visible in upper portion (4-5%+ inflation, weak growth in 2022-23) trailing back down to current near-baseline reading.
- `074346.png` — RRG with bumped fontSize 13 showing the LAGGING-clip issue that drove the `left: 80` fix.

**Course corrections in-session.**
- **0/0 vs baseline crosshair.** Initial axis-bounds compute centered the chart at 0/0. Realized US inflation has been positive for 50+ years so the trail would sit entirely in the upper half — non-informative. Refactored backend to compute long-run mean baselines and expand axis bounds to include them. Quadrant interpretation shifted from "absolute level" to "above-trend vs below-trend."
- **Crosshair styling oscillation.** Three styling iterations driven by smoke test (markerLine-solid → borderSubtle-dashed → back to markerLine-solid). The lesson: RRG and Regime intentionally diverge here — RRG's split coincides with grid; Regime's doesn't. Don't force them to match where the data shape doesn't allow it.
- **Quadrant-label fontSize.** Three rounds (10 → 13 → 16). 16 is readable at the four corners without dominating; the watermark-behind-data alternative was deferred as future work.
- **`left: 60` vs `left: 80` for left-side labels.** Driven by RRG's longer y-axis tick labels. Both charts now use `left: 80` for visual symmetry.

**Discussions parked / scope deferred.**
- **Watermark-style quadrant labels.** User-considered, deferred. Would replace the small corner labels with large faint quadrant names rendered behind the trail data, mirroring `FeatureChart.tsx`'s ticker watermark. Implementation has tradeoffs (4 entries, dynamic positioning for Regime's runtime baselines, color choice) — user picked the simpler "bump fontSize in place" fix this session.
- **MACRO-tile retrofit for Recession Prob + FCI** (S15 Q4 "both surfaces"). Still deferred. Shared `<MacroSeriesView mode="tile" | "chart">` component would land cheaply; useful when daily-glance value is desired.
- **NAPM toggle for Regime Quadrant.** v1.2 escalation if INDPRO YoY's backward-looking nature becomes an issue.
- **Path (a) manual `log10()` transform** for Pairs + FeatureChart. Carry-over from S11/S17.
- **Bulk-add modal on TickerChipPicker.** Carry-over from S16/S17.

**Build artifacts.**
- 2 commits on `feature/v1.1-regime-quadrant`, both fast-forwarded to master:
  - `613e3f3` feat(analysis): regime quadrant backend — INDPRO/CPI(PCE) YoY compute + IPC
  - `d471633` feat(analysis): RegimeQuadrantTab — quadrant scatter with trail + RRG label parity
- Net additions: ~830 lines / 11 files. 20/20 analysis math tests green. `tsc --noEmit` clean. `npm run build` 3.91s, 664 modules.

**Next session entry point.**
- **If RC1 feedback lands:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump 4 files `1.0.0-rc.1` → `1.0.0`; rebuild; ship final.
- **If continuing v1.1:** options are (a) MACRO-tile retrofit for RecProb/FCI via shared `<MacroSeriesView>` (small, closes a known design-doc gap), (b) Phase 4 (COT/AAII/VIX term — real new fetchers, larger), (c) FeatureChart enhancements (drawdown subpane is the cheapest first ship), (d) the watermark-style quadrant labels as a polish round on RRG + Regime.

---

### S17 — v1.1 Analysis Phase 2 + Phase 3 (lean) + TabIntro pattern (2026-04-30)

Single-day arc covering two phases of v1.1 Analysis plus a cross-cutting UX retrofit. 5 commits across 2 feature branches; both fast-forwarded to master and deleted. End state: master at `d2e9a30`.

**(1) Phase 2 design lock-in (4 open items resolved up front).**
- **RRG math choice.** Spec mentioned "JdK normalization, 14-day default" — picked weekly sampling (last close per ISO week, Bloomberg convention), 14-week RS-Ratio lookback, 5-week RS-Momentum. Math: `RS = ticker/benchmark; RS_Ratio = 100 × RS / SMA(RS, 14w); RS_Momentum = 100 × RS_Ratio / SMA(RS_Ratio, 5w)`. Drift vs Bloomberg's proprietary z-score-of-z-score accepted — quadrant interpretation preserved, formula explainable.
- **Pairs log/linear toggle.** Dropped — same S11 ECharts log-axis finding (default tick generation broken for sub-decade ranges, exactly where ratios live). Path (a) manual `log10()` transform tracked as a separate v1.1+ task for both Pairs and FeatureChart.
- **Cross-tab navigation (Correlations cell → Pairs).** S15 Q1 locked the destination. Implementation: localStorage handoff key `session.analysis_pairs_handoff` + `analysis-set-active-tab` `CustomEvent`. PairsTab reads + clears handoff on mount; AnalysisLayout listens for the event and calls `setActiveId(detail)`. Cheap, no new abstraction. localStorage chosen over `usePersistedState` (which is SQLite-backed via session_cmds) because the handoff is ephemeral and must survive the tab swap (PairsTab unmounts/mounts as part of the dispatch).
- **Pairs picker shape.** New `maxChips?: number` + `placeholder?: string` props on `TickerChipPicker`. `maxChips=1` clamps to single-select; the input + dropdown auto-hide once at the cap. Backwards-compatible (undefined = no cap).

**(2) Phase 2 backend (commit `61a107b`).**
- `analysis/pairs.rs` (~210 LOC) — `compute_pair_ratio` + `rolling_zscore` over aligned closes. Uses existing `align_close_prices`. Returns ratio series, z-score series, summary stats (current, μ, σ, min, max), excluded list. Sample stdev (n−1 denominator) per finance convention. NaN guard on zero/negative denominator.
- `analysis/rrg.rs` (~290 LOC) — `compute_rrg` with `weekly_close_resample` (last close per ISO week via `(year, week)` BTreeMap key — `chrono::Datelike::iso_week()`), `rolling_sma`, `rolling_sma_skip_nan` (handles warm-up NaNs from chained passes). Inner-join on ISO week between ticker and benchmark; drops below `rs_period + momentum_period` joined weeks. Tail trimmed to last `tail_length` valid (RS-Ratio, RS-Momentum) pairs.
- `analysis/registry.rs` — added `pairs_ratio` (cross_asset, default config_json with quick-picks) + `rrg` (cross_asset, default benchmark/periods/tail).
- `db/seed.sql` — 2 new `analysis_tools` rows with same default configs.
- `commands/analysis_cmds.rs` + `lib.rs` — `compute_pair_ratio` + `compute_rrg` IPC commands.
- `analysis/tests.rs` — 7 new unit tests covering `rolling_zscore` (4: too-short, constant-window, basic-step, centered-zero), `weekly_close_resample` (1: takes-last-per-iso-week), `rolling_sma` (1: warmup-then-steady), `rolling_sma_skip_nan` (1: requires-n-finite). 17/17 total green.
- `types/analysis.ts` — `PairsRequest/Response`, `PairsHandoff`, `RrgRequest/Response`, `RrgTail`, `RrgPoint`. camelCase.

**(3) Phase 2 frontend (commit `7683c3f`).**
- `PairsTab.tsx` — two single-pickers (chip-picker `maxChips=1`), lookback 90/180/365/730/1825d, z-window 20/60/90/120, ECharts dual-pane (ratio top + z-score bottom with ±2σ dashed markLines), quick-picks button row pulled from `analysis_tools.config_json`. Magnitude-scaled `formatRatio` for tooltips.
- `RrgTab.tsx` — benchmark text input + Apply button (S15 Q3 — re-normalization too costly per-keystroke), ticker chip-picker, tail-length picker (4/8/12 wk), ECharts scatter with quadrant fills via `markArea` (TR green / BR amber / BL red / TL blue, all alpha 0.07), per-ticker tail with linear opacity gradient (0.2 oldest → 1.0 head), head dot with backed label, four `graphic` text quadrant labels (LEADING / WEAKENING / LAGGING / IMPROVING), ticker palette cycles 5 colors.
- `CorrelationsTab.tsx` — non-diagonal cells now have `corr-matrix__cell--clickable` class + onClick that writes `session.analysis_pairs_handoff` to localStorage + dispatches `analysis-set-active-tab` event. Diagonal cells unchanged.
- `AnalysisLayout.tsx` — listens for `analysis-set-active-tab` CustomEvent and calls `setActiveId(detail)`.
- `TickerChipPicker.tsx` — `maxChips`/`placeholder` props.
- `registry.ts` — adds `pairs_ratio: PairsTab`, `rrg: RrgTab`.
- `app.css` — `.corr-matrix__cell--clickable` (cyan outline on hover), `.analysis-pairs__quickpicks/__quickpick`, `.analysis-rrg__benchmark-row/__benchmark-input/__apply`, `.tab-intro` and 8 sub-classes (added later in the TabIntro retrofit).

**(4) Phase 2 smoke-test fix — chart-init zero-size bug.** First Phase 2 run (screenshots `Screenshot 2026-04-30 102436.png` + `102520.png`) showed footer-populated, chart-blank state on both Pairs and RRG. Both tabs hid the chart container with `style={{ display: data ? 'block' : 'none' }}` on first render — `echarts.init(container)` fired against a 0×0 div and cached that size; when data arrived and display flipped to `'block'`, ECharts never re-measured and rendered into nothing. Fix: drop the `display` toggle entirely; let the container be unconditionally laid out at `minHeight: 480/520`; loading + placeholder states sit above. Matches the YieldCurveTab pattern that worked. Captured as **EC-15** in LESSONS. Post-fix screenshot `103125.png` shows BTC-USD vs ^GSPC RRG with the full Improving → Lagging → Leading tail visible.

**(5) TabIntro pattern (S17-new) + retrofit (commit `7683c3f`).** RRG smoke-test surfaced the gap directly: quadrant labels like "Leading" sound like trade recommendations, but no tab explained itself. The user flagged that this needs strategizing across all tabs, not just RRG.
- **Three-layer pattern:** subtitle (always-visible, ~1 sentence, plain English) + collapsible "How to read this" (interpretation guide as `<ul>` + paragraph + standard liability close) + optional collapsible "The math" (formula reference for power users). Standard liability copy: *"Decision support, not investment advice. Patterns are descriptive, not predictive."*
- `components/analysis/TabIntro.tsx` (~48 LOC) — props: `subtitle: string` + `howToRead: ReactNode` + `math?: ReactNode` + `liabilityNote?: string`. Native `<details>` for accessibility-by-default; custom caret `▸ → 90°-rotated on open`. Cyan left-border + faint surface — sits visually between controls and chart without competing.
- Retrofit in same commit: Correlations, Yield Curve (Phase 1) + Pairs, RRG (Phase 2) all gain `<TabIntro>` between header controls and content area.
- **Copy iteration.** Initial draft was technical ("Pearson correlation of log returns over the chosen lookback…"). User asked for a less-technical rewrite ("Math stays as-is. Provide implemented text, then re-written text so I can compare. No code yet."). Side-by-side comparison shipped in chat for all four tabs; user approved all rewrites; second edit pass swapped each `<TabIntro>` body to plain-language form. Math sections kept technical (purpose: power-user transparency).

**(6) Design doc codification (commit `8760606`).** New "Tab presentation pattern (S17, 2026-04-30) — applies to ALL Analysis tabs" section in `.projects/02_v1_1_analysis/v11_analysis_design.md`, before "Risks". Documents the three-layer pattern, the standard liability copy, the component signature, the rule that Phase 3 + Phase 4 tools ship with `TabIntro` filled in (no merge to master without it), and the Phase 1 retrofit-alongside-Phase 2 note. Pattern is now a hard requirement, not a soft preference.

**(7) Phase 2 commit/merge.** Three commits on `feature/v1.1-analysis-phase-2`:
- `61a107b` feat(analysis): Phase 2 backend — Pairs + RRG compute, IPC, registry, math tests
- `7683c3f` feat(analysis): Phase 2 frontend — PairsTab, RrgTab, cell-click cross-link, TabIntro retrofit
- `8760606` docs(analysis): codify TabIntro pattern + Phase 2 smoke-test screenshots

Fast-forward merge to master; branch deleted.

**(8) Phase 3 scope decision (mid-session).** User asked about continuing into Phase 3. Three open items flagged before commit: (a) NAPM vs INDPRO for the Regime Quadrant growth axis (NAPM = forward-looking but FRED data has gaps; INDPRO = clean monthly history but backward-looking), (b) S15 Q4 "MACRO tile AND Analysis tab" — leaner path is Analysis-only first, (c) RECPROUSM156N data freshness (NY Fed has paused publication in past periods; FRED website blocks WebFetch so couldn't verify mid-session). User chose **option B** — ship just Recession Prob + FCI this session, defer Regime Quadrant. Recession Prob built with graceful empty-state handling (placeholder text + FRED link) in case the series turns out to be stale.

**(9) Phase 3 backend (commit `1d29223`).** Lean path — 2 simpler tools, no shared compute logic.
- `analysis/recession_prob.rs` (~80 LOC) — pulls `RECPROUSM156N` via `db.all_fred_observations`, returns points (`Vec<MacroPoint>`) + `RecessionThresholds { warn_pct: 30.0, imminent_pct: 50.0 }` + current value + units + observation count. Single-FRED-series passthrough; no derivable math, no unit tests.
- `analysis/financial_conditions.rs` (~90 LOC) — pulls `NFCI` similarly, returns points + current + min/max range + units + observation count. Same shape.
- `analysis/mod.rs` — shared `MacroPoint { date: NaiveDate, value: f64 }` type for both single-FRED-series tools. Inline-defined rather than per-module to avoid duplication.
- `analysis/registry.rs` — register `recession_prob` (display_order 5) + `financial_conditions` (display_order 6), both `scope: "macro"`, no default config.
- `db/seed.sql` — `RECPROUSM156N` (Percent, Monthly, category=Recession) + `NFCI` (Index, Weekly, category=Conditions) added to `fred_series` block; both flipped to `tile_visible=0` in the existing UPDATE. 2 new `analysis_tools` rows.
- `commands/analysis_cmds.rs` + `lib.rs` — `compute_recession_prob` + `compute_financial_conditions` IPC commands.
- `types/analysis.ts` — `MacroPoint`, `RecessionProbRequest/Response`, `RecessionThresholds`, `FinancialConditionsRequest/Response`. Empty-object request types via `Record<string, never>`.

**(10) Phase 3 frontend (commit `d2e9a30`).** Both tabs are simple ECharts line + NBER bars + TabIntro.
- `RecessionProbTab.tsx` (~255 LOC) — single line plot with `markLine` at 30% (amber dashed) + 50% (red dashed) + NBER `markArea` overlay. Empty-state placeholder includes external FRED link to verify series status. Footer surfaces current value + date + observation count + series id. Cyan accent fill matches existing chart aesthetic.
- `FinancialConditionsTab.tsx` (~250 LOC) — single line + zero baseline `markLine` labeled "long-run avg" + NBER overlay. Footer adds full-series min/max range. **Note:** initial draft used ECharts `visualMap` with two `pieces` to color the line amber-above-zero and cyan-below — caused immediate webview crash on first click. Crash was deterministic and reproducible. Suspect: `visualMap.pieces` + 35-segment `markArea` + 2,800-point weekly series hit a pathological ECharts render path. Stripped the `visualMap`; single accent-cyan line + zero baseline carries the narrative through the description and zero crossings. Captured as **EC-14** in LESSONS. TabIntro copy adjusted accordingly ("Above the solid zero line" / "Below the zero line", removed amber/cyan-color references).
- `registry.ts` — adds both tabs.

**(11) Phase 3 commit/merge.** Two commits on `feature/v1.1-analysis-phase-3`:
- `1d29223` feat(analysis): Phase 3 backend (lean) — Recession Prob + FCI compute, IPC, FRED seed
- `d2e9a30` feat(analysis): Phase 3 frontend — RecessionProbTab + FinancialConditionsTab

Fast-forward merge; branch deleted. User confirmed both tabs render correctly: "both work great - smoke tests passed."

**Course corrections in-session.**
- **Display:none chart-init.** Hiding the ECharts container on first render with a conditional `display` style = caches 0×0 at init. Caught by smoke-test, fixed by always-visible container + placeholder-above pattern. EC-15.
- **visualMap + long-series + multi-segment markArea.** ECharts pathological path → webview crash. Caught by smoke-test on first FCI click. Fixed by stripping visualMap. EC-14.
- **TabIntro copy register.** First draft was quant-jargon-heavy; user explicitly asked for plain-language version. Pattern: side-by-side comparison in chat before code edit, especially for user-facing prose. Cheap to do, prevents wasted PR-style cycles.
- **FRED bot-blocking on WebFetch.** `fred.stlouisfed.org` returns 403 on Claude Code's WebFetch (both page and CSV endpoints). Pragmatic posture: ship with graceful empty-state handling instead of trying to verify mid-session. Empty-state UI explains and links out so the user can verify themselves.
- **Recursive ECharts overlap risks.** Both EC-14 and EC-15 surfaced from "natural" ECharts patterns that don't error, just silently misbehave or crash. New rule of thumb: smoke-test every new tab in the actual webview before committing — `npm run build` + `tsc` doesn't catch render-time issues.

**Discussions parked / scope deferred.**
- **Macro Regime Quadrant.** 4-quadrant scatter (growth × inflation, 24-month trail). Held pending the NAPM-vs-INDPRO decision and a fresh look at MACRO-tile coupling. Reuses RRG's tail-rendering pattern when it lands.
- **MACRO-tile retrofit for RecProb + FCI** (S15 Q4 "both surfaces" intent). Both tools currently Analysis-only. If a `<MacroSeriesView mode="tile" | "chart">` shared component lands in the future, it makes the tile addition cheap.
- **`RECPROUSM156N` upstream verification.** Couldn't WebFetch FRED mid-session (403). Tab ships with empty-state placeholder + external link; user will see the latest observation date in the footer and can swap to `USRECP` if needed.
- **Bulk-add modal on TickerChipPicker** (carry-over from S16 — still deferred).

**Build artifacts.**
- 5 commits this session (3 Phase 2 + 2 Phase 3), all fast-forwarded to master:
  - `61a107b` Phase 2 backend
  - `7683c3f` Phase 2 frontend (incl. TabIntro retrofit)
  - `8760606` TabIntro pattern docs + Phase 2 smoke screenshots
  - `1d29223` Phase 3 backend (lean)
  - `d2e9a30` Phase 3 frontend
- Net additions: ~3,070 lines / 33 files. 17/17 analysis math tests green. `tsc --noEmit` clean. `npm run build` 3.84s, 663 modules.
- Screenshots committed: `Screenshot 2026-04-30 102436.png` (Pairs pre-fix, chart blank), `102520.png` (RRG pre-fix, chart blank), `103125.png` (RRG post-fix, BTC-USD tail rendering correctly).

**Next session entry point.**
- **If continuing v1.1:** Macro Regime Quadrant. Decide growth-axis (suggested INDPRO YoY for data hygiene; NAPM toggle as v1.2 escalation). Decide whether RecProb + FCI MACRO tiles land alongside (recommended: shared `<MacroSeriesView>` component). Add 1-3 FRED series to seed; new `analysis/regime_quadrant.rs` reusing RRG's tail-rendering pattern; `RegimeQuadrantTab.tsx` with TabIntro per the now-mandatory pattern.
- **If RC1 feedback lands:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump 4 files `1.0.0-rc.1` → `1.0.0`; rebuild; ship final.

---

### S16 — Git init + repo reorganization + PROGRESS prune + v1.1 Analysis Phase 1 (2026-04-29)

Largest single session of the project. Three discrete arcs in one sitting: (1) infrastructure (git + reorg + archive), (2) v1.1 Phase 1 build (backend + frontend), (3) two rounds of smoke-test fixes. Final state: 9 new commits + 4 prior + 1 inherited = master at `ef12190`.

**(1) Git initialization at v1.0.0-rc.1.**
- Reviewed pre-existing 327-byte `.gitignore` + drafted robust replacement covering node deps, Vite/dist, Rust target/ (8.2 GB), env + SQLite + IDE/OS, `release/` (27 MB), `infrastructure/`, `.claude/settings.local.json`, Windows `nul`. `Cargo.lock` kept tracked (binary-app convention; PrivateACB pattern).
- `git init` + first commit `1b9c85e` (chore: initial commit at v1.0.0-rc.1) — 198 files, 25,020 insertions.
- Verified ignores at commit time: `.env` (FRED + Finnhub keys), 8.2 GB target/, 27 MB release/ all correctly excluded.

**(2) Repo reorganization — `.projects/` structure.**
- Convention: `00_*` = pinned/cross-cutting; `NN_<name>/` = sequential feature projects, numbered for findability. Screenshots live inside their project folder.
- Skeleton: `.projects/00_bugs/`, `.projects/00_tracking/{archive,memory}/`, `.projects/01_initial_design/{images,icon_design,screenshots}/`, `.projects/02_v1_1_analysis/`.
- Moves: PROGRESS.md + LESSONS.md + memory/ → 00_tracking/; DESIGN.md + docs/images/ + .corel_draw/ → 01_initial_design/; v11_analysis_design.md → 02_v1_1_analysis/; root screenshots/*.png → 01_initial_design/screenshots/. `Analaysis_review/` (typo'd) deleted; `screenshots/finnhub_stuff.md` (live API key + webhook secret scratchpad) moved to `infrastructure/` (gitignored sibling, never crosses into git).
- `CLAUDE.md` path references rewritten + new "Project Organization" section documenting the convention. `.claude/commands/session-start.md` + `session-end.md` paths updated. Historical references inside PROGRESS/DESIGN/decision files left untouched (they record what paths were at the time — don't rewrite history).

**(3) PROGRESS prune + archive convention.**
- `archive/README.md` documents convention: filename `YYYY-MM-DD_<slug>.md`, immutable once written, prune triggers (major release OR >30 sessions OR >1000 lines), header schema (archived date + source commit + sessions covered + time span + reason + where-live-resumes), Python single-pass recipe with sanity-assert anchors before mutating.
- First archive `archive/2026-04-29_v1_0_build_arc.md` carries S1–S13 verbatim (project inception → v1.0.0-rc.1 ship).
- Pruned PROGRESS.md from 784 → 168 lines via single Python pass after a first-attempt false-start: initial mechanism did chunked Read + reconstructed Write (re-shipped ~25K tokens through the LLM); user flagged the inefficiency. Second-pass Python script slices `lines[:115] + POINTER + lines[737:]` in <1s.
- Title refreshed `Personal Terminal → Private Terminal` (post-S11 user-visible rename).
- Commit `866a338` (docs: prune PROGRESS.md and establish archive convention).

**(4) Feature branch `feature/v1.1-analysis-phase-1`.**
Branched from `master` at `866a338` for the Phase 1 build. Local-only (no remote yet). Merged back via fast-forward at session end; branch deleted post-merge.

**(5) v1.1 Analysis Phase 1 — backend.**
- **Pre-build verifications.** Confirmed `Db::seed()` location (`db/mod.rs:87`). Discovered S15 plan mis-flagged `tile_visible` migration as the project's first column-add — the existing migrations slice in `db/mod.rs:50-82` has 3 user_hidden migrations from M8.5 with the same error-swallow pattern (no `PRAGMA table_info` guard needed).
- **DB layer (commit `71f3a34`):** `schema.sql` adds `tile_visible INTEGER NOT NULL DEFAULT 1` to fred_series + new `analysis_tools` table (id / display_name / scope / display_order / enabled / config_json). `seed.sql` adds USREC + DGS3MO/DGS2/DGS5/DGS30 (all `tile_visible=0`) + 2 analysis_tools rows (`correlation_matrix` cross_asset / `yield_curve` macro) + new `('analysis', NULL, 'ANALYSIS', 'virtual', 1, 1)` sector_groups row + display_order shifts. Migrations slice gets the fred_series.tile_visible row.
- **Analysis module (`src-tauri/src/analysis/`, 7 files, ~540 LOC):** `mod.rs` (TickerKey, ExcludedTicker), `registry.rs` (`ANALYSIS_TOOLS` const + `AnalysisToolInfo` IPC shape), `align.rs` (align_close_prices with calendar-day window via `chrono::Duration` + 50%-coverage gate, log_returns, pearson with diagonal-pin), `correlations.rs` (compute_correlations + req/resp), `yield_curve.rs` (compute_yield_curve, 3 snapshots × 5 tenors + spread series 2s10s/3m10y), `coverage.rs` (list_tickers_with_coverage joining watchlist visibility with bar coverage), `macro_overlays.rs` (list_recession_segments run-length-encoded from USREC monthly 0/1). No trait per S15 Q2 — heterogeneous output shapes (matrix vs curve vs segment list) make a trait costlier than valuable.
- **Math unit tests (`analysis/tests.rs`, 10, all pass):** pearson perfect ±, constant-y zero-var, short-input; log_returns basic + edges; align inner-join, exclusion-below-min, calendar-day trim, empty-input.
- **DB helpers added (db/mod.rs):** `close_history(ticker, data_source)` → tighter shape than `all_price_bars_ohlcv` for analysis paths that only need closes. `ticker_coverage(ticker, data_source)` → bar count + earliest/latest dates for the chip-picker greyed-chip path.
- **IPC layer (commit `9081acb`):** `commands/analysis_cmds.rs` with 5 `#[tauri::command]` wrappers (`list_analysis_tools` merging const registry + DB enabled/config_json; `compute_correlations`, `compute_yield_curve`, `list_recession_segments`, `list_tickers_with_coverage`); registered in `lib.rs::tauri::generate_handler!`. Dead-code warnings from previous commit cleared once IPC referenced all the analysis functions.

**(6) v1.1 Analysis Phase 1 — frontend.**
- **TS types (commit `bdb6492`):** `src/types/analysis.ts` mirroring the IPC contract — TickerKey, ExcludedTicker, AnalysisToolInfo, Correlations{Request,Response}, YieldCurve{Request,Response} + nested TenorPoint/CurveSnapshot/SpreadPoint, TickerCoverage, RecessionSegment. NaiveDate → ISO date string.
- **CSS rename `.settings-tabs` → `.tab-strip`** across `app.css` + `SettingsModal.tsx` + `ManageWatchlistModal.tsx` (S15 Q7.B). Generic horizontal-tab pattern reused by Settings + Manage Watchlist + new Analysis layout. Class name shifts: `.settings-tab` → `.tab-strip__tab`, `--active` → `.tab-strip__tab--active`. No visual change.
- **`useRecessionBars` hook:** module-level cache (`cachedSegments` + in-flight `Promise` dedup); one fetch per session shared across all consumers. Returns raw segments + ECharts `markArea`-shaped data array (`MarkAreaPair[]`).
- **Components (commits `5aed75a`, `d58daa0`):**
  - `TickerChipPicker` — chip + autocomplete (case-insensitive prefix on ticker, substring on display name) + greyed-chip rendering when `bar_count < lookback × 0.5` + bar-count tooltip (Q2 + Q6). Click-outside dismiss for dropdown. Stateless; selection lives in parent for `usePersistedState` per-tool persistence.
  - `CorrelationsTab` — lookback dropdown 30/60/90/180/365, sticky-header heatmap table (no chart-lib dep — HTML table). Cell color via `rgba(var(--status-up-rgb), α)` / `--status-down-rgb` with α scaling 0.15..0.70 by |r|. Diagonal pinned to 1.0 in Rust compute. Footer shows bar count + date range + excluded-ticker list (in `--accent-amber`).
  - `YieldCurveTab` — ECharts dual-pane (term-structure on category x-axis + spread on time x-axis with `markArea` recession overlay). Uses `getChartTheme()` from `chartTheme.ts`. Spread toggle 2s10s/3m10y. Snapshot anchor defaults to "latest" (snapshotDate: null on IPC).
  - `AnalysisLayout` — tab strip dispatch via `ANALYSIS_TAB_REGISTRY` (id → ComponentType); persists `session.analysis_active_tab`; falls back to first visible tool when stored active id no longer enabled.
- **Wire-up:** Sidebar `PINNED_IDS` extended to `['scanner', 'analysis', 'macro', 'news']`; App.tsx adds `case 'analysis'` → `<AnalysisLayout />`.

**(7) First smoke test caught two issues** (screenshots `02_v1_1_analysis/screenshots/Screenshot 2026-04-29 19{0508,0603}.png`).
- **Picker capped at 12 candidates regardless of query** — alphabetically-late tickers (BTC, SPY, etc.) invisible without typing on long watchlists. Fix in `TickerChipPicker.tsx`: cap only when query non-empty; with empty query return full list, dropdown's existing max-height + overflow-y handles scroll.
- **Yield curve rendered with only DGS10 data, spread 0 observations** — `WHERE tile_visible=1` filter on `list_fred_series` cut hidden series out of the FRED fetch enumeration (`list_macro_tiles` Phase 1 used the same helper). USREC + 4 treasury tenors had zero observations because they were never fetched.
  - Fix: revert SQL filter on `list_fred_series` (return all rows), add `tile_visible: bool` to `FredSeriesRow`, filter at tile-build time in `list_macro_tiles` Phase 3 (skip rows where `!row.tile_visible`). After fix + manual MACRO refresh: 11,162 spread observations + full yield curve rendered. Captured as **DB-10** in LESSONS (filter at display layer, not enumeration layer).
- Commit `e5bb299` (fix: fetch hidden FRED series + uncap picker dropdown).

**(8) Second smoke caught recession-bar visibility** (screenshot `Screenshot 2026-04-29 191205.png` showed term structure populated but no NBER bars on spread).
- markArea was rendering correctly but `α=0.18 + rgb(150,150,150)` fell below visual noise floor against dark background. Bumped α=0.18→0.30 + swapped hardcoded rgb for `rgba(var(--text-tertiary-rgb), 0.30)` token. Footer rewritten to always show segment count for diagnosability ("35 NBER recession segments" — full USREC history goes back to 1854; ~5 visible in the spread chart's 1982+ date range).
- Commit `ef12190` (fix: bump recession-bar visibility + diagnostic footer). Screenshot `Screenshot 2026-04-29 191752.png` confirms bars visible over 1981-82, ~1990, ~2001, 2008-09, 2020.

**(9) Merge to master + branch cleanup.**
- All gates green: `cargo check --no-default-features` clean (zero warnings on master); `cargo test --lib analysis::tests` 10/10; `tsc --noEmit` clean; `npm run build` 4.31s, 658 modules (chunk-size warning carries from S9).
- Fast-forward merge `master → ef12190` (31 files changed, 2,225+/30-). `feature/v1.1-analysis-phase-1` branch deleted.

**Course corrections in-session.**
- **`tile_visible` filter location** — initially put it in `list_fred_series` SQL, which silently broke the FRED fetch for hidden series. Lesson: separate "what to enumerate" from "what to display." See LESSONS DB-10.
- **Picker cap** — autocomplete-style cap-at-12 was right impulse but hostile UX with empty query. Cap conditional on query presence is the cleaner contract.
- **PROGRESS prune mechanism** — first attempt did chunked Read + reconstructed Write; user flagged the LLM-token cost of re-shipping ~25K tokens. Second pass used single Python pass + sanity-assert anchors. Pattern captured as the canonical recipe in `archive/README.md`.
- **MSVC incremental cache corruption** during long-running tauri:dev session — known issue (LESSONS TB-2). Cleared `target/debug/incremental/` (1.9 GB) without touching dependency builds; resolved on restart.
- **Cargo.lock** initially gitignored from the original `.gitignore`; corrected during git-init pass (binary app, not library — Cargo.lock should track per PrivateACB pattern).

**Discussions parked / scope deferred.**
- **Bulk-modal ticker selection** (S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"). Shipped chip + autocomplete only; bulk-add modal can land if user feedback shows it's needed. Clear extension point in `TickerChipPicker.tsx`.
- Smoke-test items not literally cross-checked: SPY×SPY=1.000 (verified via AEM×AEM=1.00 and BTC×BTC=1.00, same diagonal-pin property), GLD×SPY mildly negative, FRED published-value cross-check on yield curve, 2s10s↔3m10y toggle exercise, lookback 90d→365d switch, greyed-chip tooltip text. None blocking; all paper checks against published values.

**Build artifacts.**
- 9 commits on feature branch, fast-forwarded to master:
  - `71f3a34` feat(analysis): scaffold v1.1 Analysis section — schema, registry, math primitives
  - `9081acb` feat(analysis): IPC layer — 5 Tauri commands wrapping the analysis module
  - `bdb6492` feat(analysis): TS types, CSS tab-strip rename, useRecessionBars hook
  - `5aed75a` feat(analysis): TickerChipPicker + CorrelationsTab + heatmap CSS
  - `d58daa0` feat(analysis): YieldCurveTab + AnalysisLayout + sidebar/router wire-up
  - `e5bb299` fix(analysis): fetch hidden FRED series + uncap picker dropdown
  - `ef12190` fix(analysis): bump recession-bar visibility + diagnostic footer
- Plus 2 infrastructure commits: `1b9c85e` initial git, `866a338` PROGRESS prune.

**Next session entry point.**
- **If tester feedback lands on RC1:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump `1.0.0-rc.1` → `1.0.0` in 4 files; rebuild; ship final.
- **If proceeding to v1.1 Phase 2:** Pairs + RRG (zero new data, registry-driven additions only). Mirrors Phase 1 pattern — new `analysis/pairs.rs` + `analysis/rrg.rs` Rust modules + `PairsTab.tsx` + `RrgTab.tsx` components + 2 rows in `analysis_tools` seed + 2 entries in `ANALYSIS_TAB_REGISTRY`. RRG benchmark needs an explicit Apply button (S15 Q3 — JdK normalization too costly per-keystroke). Phase 1's chip-picker bulk-modal can land alongside if feedback warrants.

---

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
- **v1.1 Analysis section design sketch** (`.projects/02_v1_1_analysis/v11_analysis_design.md`, S14) — 4-phase plan for cross-asset analysis tools. **Phase 1 (Correlations + Yield Curve) shipped 2026-04-29 (S16). Phase 2 (Pairs + RRG) shipped 2026-04-30 (S17). Phase 3 lean (Recession Prob + FCI) shipped 2026-04-30 (S17). Phase 3 finish (Macro Regime Quadrant) shipped 2026-05-02 (S18).** Phase 4 (COT + AAII + VIX term — real new fetchers) follows.

### Deferred from v1.1 Phase 3 finish (2026-05-02, S18)
- **Watermark-style quadrant labels for RRG + Regime Quadrant.** User-considered during the S18 polish round. Would replace the corner labels (currently fontSize 16 with low opacity) with large faint labels rendered BEHIND the trail data — mirroring the `FeatureChart.tsx:769-787` ticker watermark pattern (single centered text, `text-primary @ 0.05`, `z: 0`, `silent: true`). For a 4-quadrant chart the implementation diverges: 4 graphic entries instead of 1; positioning is dynamic on Regime (quadrants split at runtime baselines), static on RRG (always 100/100); color choice between semantic-faint (~0.10 alpha on each quadrant's color) vs neutral-faint. User picked the simpler in-place fontSize fix this session. Can land in a future polish round if the corner layout starts to feel cramped.
- **NAPM toggle for the Regime Quadrant** — v1.2 escalation if INDPRO YoY's backward-looking nature creates a financial-media-narrative mismatch. Watch for FRED's NAPM publication gaps before implementing.

### Deferred from v1.1 Phase 2 + Phase 3 lean (2026-04-30, S17)
- **MACRO-tile retrofit for Recession Prob + FCI.** S15 Q4 locked "both MACRO tile AND Analysis tab"; lean Phase 3 path shipped Analysis-only. Add when there's clear daily-glance value, ideally alongside the Macro Regime Quadrant build so the shared view component lands once.
- **`RECPROUSM156N` upstream verification.** FRED's website 403'd Claude Code's WebFetch mid-session, so the series' current publication status couldn't be confirmed before commit. Tab ships with empty-state placeholder + external FRED link. If the user's smoke-test post-MACRO-refresh shows zero observations, swap to `USRECP` or another alternative in a follow-up commit.
- **Path (a) manual `log10()` transform** (carry-over from S11) — for Pairs ratio chart AND FeatureChart price pane. ECharts default log axis is broken on sub-decade ranges (which is exactly where ratios live), so Pairs shipped without a log toggle. Pays for both surfaces at once when prioritized; ~2-3 hours.
- **NAPM toggle for the Regime Quadrant** — once Regime Quadrant ships with INDPRO YoY, a v1.2 toggle to switch to NAPM/PMI for the growth axis would catch users who want the financial-media narrative match. Watch for FRED's NAPM publication gaps before implementing.
- **`list_recession_segments` cross-consumer test** (carry-over from S16) — hook is wired with module-level cache + Promise dedup. Phase 3 added two more consumers (`RecessionProbTab`, `FinancialConditionsTab`) on top of `YieldCurveTab` from Phase 1. Verify in DevTools that all three share a single fetch.
- **Bulk-add modal on TickerChipPicker** (still deferred from S16) — S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"; chip + autocomplete shipped Phase 1, single-pickers via `maxChips=1` shipped Phase 2. Bulk modal still pending. Extension point clear.

### Deferred from v1.1 Phase 1 (2026-04-29, S16)
- **Bulk-modal ticker selection on TickerChipPicker.** S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"; shipped chip + autocomplete only. Add a `+ Bulk` button on the picker that opens a checklist-modal grouped by sector_group when feedback shows users want to add 5+ tickers at once. Extension point clear in `TickerChipPicker.tsx`.
- **Smoke-test items not literally cross-checked.** SPY×SPY=1.000 (verified via AEM×AEM and BTC×BTC, same diagonal-pin property), GLD×SPY mildly negative, FRED published-value cross-check on yield curve, 2s10s↔3m10y toggle exercise, lookback 90d→365d switch, greyed-chip tooltip text. None blocking; paper checks against published values.
- **`list_recession_segments` single-fetch verification via DevTools.** Hook is wired with module-level cache + Promise dedup so it should fire once per session, but only one consumer (YieldCurveTab) in Phase 1. Verify behavior is correct when Phase 3 adds a second consumer.
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
