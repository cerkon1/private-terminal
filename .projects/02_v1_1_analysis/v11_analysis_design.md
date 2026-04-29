# v1.1 — Analysis Section Design Sketch

Draft, 2026-04-27. Sibling to `DESIGN.md` so v1 spec stays focused. Status: design only — no code commitments. Awaiting v1.0 final ship + feedback before any of this lands.

---

## Goal

Add an **Analysis** top-level section that exposes professional cross-asset analysis tools — the kind of view a quant friend would expect from a Bloomberg-style terminal. Uses data already in the SQLite store; new fetchers only where the tool is impossible without them.

**Non-goals:**
- Trading signals / alerts / scoring (decision support, not advice — same liability framing as v1)
- Backtesting (v1.2+ if ever)
- Multi-portfolio / scenario analysis (out of scope; this is a research dashboard, not portfolio management)

---

## Architectural split

Two extension points, kept separate because they answer different questions:

| Layer | Question answered | Lives in |
|---|---|---|
| **Analysis section** | "How do these things relate to each other / what regime are we in?" | New top-level sidebar slot |
| **FeatureChart enhancements** | "What more can I see about *this one* ticker?" | New tabs / toggles inside the existing FeatureChart |

Cross-asset → Analysis. Single-asset → FeatureChart. Putting drawdown charts in Analysis would force ticker-picker UI for a per-ticker question; putting correlation matrices in FeatureChart breaks the per-ticker mental model. Resist mixing them.

---

## Analysis section

### Sidebar placement

Pinned at the top alongside SCANNER / MACRO / NEWS. Update `PINNED_IDS` in `Sidebar.tsx`:

```ts
const PINNED_IDS = ['scanner', 'analysis', 'macro', 'news'];
```

`analysis` lands second — it's the lens you read MACRO and the watchlist *through*, so it sits between the per-ticker scanner and the pure-data macro section.

### Internal shape — tabbed surface

Same pattern as `SettingsModal` and `ManageWatchlistModal`: tab strip across the top, single-pane content per tab. Reuse `.settings-tabs` / `.settings-tab` CSS.

Each tab is one analysis tool. Tabs are registry-driven (extensibility-first), not hardcoded.

```
ANALYSIS
├─ Correlations | Yield Curve | Pairs | RRG | Regime | (future…)
└─ <tool-specific control row>
   <tool-specific viz>
```

### Tool registry — extensibility-first

New table:

```sql
CREATE TABLE analysis_tools (
  id TEXT PRIMARY KEY,             -- 'correlation_matrix', 'yield_curve', ...
  display_name TEXT NOT NULL,      -- 'Correlations', 'Yield Curve'
  scope TEXT NOT NULL,             -- 'cross_asset' | 'macro' | 'sentiment'
  display_order INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT                 -- per-tool defaults (lookback, benchmark, etc.)
);
```

Same shape as `indicators` registry — registry controls **visibility / order / defaults**, not code loading. Each tool ships as a Rust compute module + React component pair; both reference the same `id`.

Adding a new analysis tool:
1. Write `src-tauri/src/analysis/<id>.rs` implementing `AnalysisTool` trait
2. Write `src/components/analysis/<Id>Tab.tsx`
3. Register in both `analysis::REGISTRY` (Rust) and `ANALYSIS_TAB_REGISTRY` (TS)
4. `INSERT` into `analysis_tools` via seed migration

Mirrors the `Indicator` trait pattern from M6.

### Compute model

- **Rust-side, on-demand, not persisted.** Same rule as indicators. Tab opens → IPC call → compute on existing `price_history` / `macro_observations` → return result struct → render. Recompute on control change.
- **f64 throughout** — display only, not tax-grade.
- **No new caches.** Correlation matrix on 60 tickers × 90 days = ~3,600 cells × 60 ops = sub-millisecond. Caching would just invite staleness.

### Data alignment gotcha

Cross-asset compute (correlation, RRG, pairs) needs **aligned bar dates** across tickers. Yahoo crypto bars are 7-day; equity bars are 5-day; FRED series are weekday-only with publish lags. Standard pattern:

```rust
// inner-join on date across all selected tickers' price_history
// drop any date not present in every series
// then compute log-returns on the aligned set
```

Helper lives in `src-tauri/src/analysis/align.rs` so every cross-asset tool reuses it. Returns `AlignedSeries { dates: Vec<NaiveDate>, series: HashMap<String, Vec<f64>> }`.

### Persistence

- `session.analysis_active_tab` — last open tab
- `session.analysis_<tool_id>_config` — per-tool control state (selected tickers, lookback, benchmark)

Reuses the existing `usePersistedState<T>` hook + `config` KV from M8.

---

## Phase 1 tools (launch surface)

Two tabs, zero new fetchers. Validates the registry + alignment + tab-rendering pattern before scope grows.

### 1. Correlations

- **Compute:** Pearson correlation of log-returns over selected lookback (30 / 60 / 90 / 180 / 365d), aligned across selected tickers.
- **Data:** existing `price_history`. Zero new fetchers.
- **Controls:** lookback dropdown · ticker multi-select (reuses ManageWatchlistModal's group → ticker picker pattern) · "select all in group" shortcuts.
- **Viz:** HTML/CSS grid (not ECharts heatmap — cleaner for clickable cells, diagonal masking, ticker labels on both axes). Cell color via existing heatmap-bucket CSS classes; cell value optional (toggle). Click a cell → opens FeatureChart for that pair as a ratio chart (cross-pollination with Pairs tool).
- **Why HTML grid over ECharts heatmap:** ECharts heatmap requires you to fight axis label rotation, cell padding, and tooltip-vs-click semantics. A `<div>` grid with `display: grid; grid-template-columns: repeat(N, 1fr)` is ~30 lines and behaves naturally.

### 2. Yield Curve

- **Compute:** plot 3M / 2Y / 5Y / 10Y / 30Y current + 6m-ago + 5y-ago snapshots; spread chart of `DGS10 - DGS2` as a separate panel; NBER recession bars overlaid via `markArea`.
- **Data:** existing FRED series (DGS3MO, DGS2, DGS5, DGS10, DGS30) + **one new FRED series**: `USREC` (NBER recession indicator, monthly 0/1).
- **Controls:** snapshot date picker · spread series toggle (2s10s / 3m10y / 5s30s).
- **Viz:** ECharts dual-pane (term structure on top, spread-over-time on bottom). Recession bars as gray `markArea` segments where `USREC == 1`. Zero line on the spread pane in red dashed.
- **Why this first:** every macro person checks 2s10s. Single highest-signal-per-pixel chart in the whole app.

---

## Phase 2 tools

Pure compute on existing data. Adds visual variety without expanding the data layer.

### 3. Pairs / Ratio

- **Compute:** `series_a / series_b` over time; rolling z-score for mean-reversion view.
- **Data:** existing `price_history`. Zero new fetchers.
- **Controls:** numerator picker · denominator picker · z-score lookback · log/linear toggle.
- **Viz:** single-pane line + optional second pane for z-score with ±2σ bands.
- **Suggested defaults / quick-picks:** BTC/ETH, GLD/SLV, copper/gold (HG/GC), HYG/IEF, QQQ/SPY. Stored in `analysis_tools.config_json` as a list — user can edit.

### 4. RRG (Relative Rotation Graph)

- **Compute:** for each ticker vs benchmark, compute (RS-Ratio, RS-Momentum) using JdK normalization (14-day default — Bloomberg's convention). Plot last N weeks as a tail behind the current dot.
- **Data:** existing `price_history`. Zero new fetchers.
- **Controls:** benchmark picker (defaults to ^GSPC) · ticker multi-select · tail length (4 / 8 / 12 weeks) · normalization period (14d default).
- **Viz:** ECharts scatter on a 4-quadrant plane (axes both centered at 100, light quadrant fills: green TR / yellow TL / red BL / blue BR). Each ticker = one tail (line) + dot at the head. Tail uses opacity gradient (recent = solid).
- **Why this is impressive:** it's *the* visual that people associate with Bloomberg. Single-screen sector-rotation read. Worth the extra build effort once Phase 1 proves the section.

---

## Phase 3 tools — macro regime

Adds three FRED series. Same fetcher path; pure additive seed.

### 5. Macro Regime quadrant

- **Compute:** 4-quadrant scatter — x-axis = Growth proxy (PMI / `NAPM` or `INDPRO` YoY), y-axis = Inflation proxy (CPI YoY from `CPIAUCSL`). Plot last 24 months as a trail; current dot highlighted.
- **Data:** new FRED series — `NAPM` (or `INDPRO`), `CPIAUCSL`. Existing FRED fetcher absorbs them.
- **Quadrants:** Reflation (low inflation, rising growth) / Goldilocks (stable both) / Stagflation (high inflation, falling growth) / Disinflation (falling both). Labels in faint text per quadrant.

### 6. Recession Probability

- **Data:** new FRED series `RECPROUSM156N` (NY Fed model, monthly).
- **Viz:** single-line chart with horizontal threshold lines at 30% / 50% (historical "warning" / "imminent" levels). Recession bars overlay (USREC).
- **Could also be a tile in MACRO** instead of a tab. Consider: lives in MACRO as a tile, *and* shows up here in context with the regime quadrant.

### 7. Financial Conditions

- **Data:** new FRED series `NFCI` (Chicago Fed weekly). Optional: `ANFCI` (adjusted).
- **Viz:** single-line; positive = tight, negative = loose; zero line emphasized.
- **Same MACRO-tile candidacy** as recession prob.

---

## Phase 4 tools — sentiment / positioning

Real new data work. Each is its own fetcher module. Schedule like other periodic fetchers.

### 8. COT (Commitments of Traders)

- **Source:** CFTC publishes `deacot.txt` (legacy) or `*.xls` weekly Friday afternoon, free, no auth.
- **Coverage:** every futures contract you track (CL, GC, SI, NG, HG). Net non-commercial positioning is the headline number.
- **Storage:** new table `cot_reports (contract_code, report_date, noncomm_long, noncomm_short, comm_long, comm_short, ...)`.
- **Fetch cadence:** weekly Saturday morning (one HTTP get + parse). Cheap.
- **Viz:** for each tracked contract — net non-commercial position over time, with current percentile rank vs trailing 3y. Extreme readings (>90th pct = stretched bullish, <10th = stretched bearish) flagged.

### 9. AAII Bull/Bear Sentiment

- **Source:** AAII publishes the weekly survey as a downloadable spreadsheet, free.
- **Storage:** new table `sentiment_aaii (week_ending, bullish, neutral, bearish)`.
- **Viz:** stacked area + bull-bear spread line with ±1σ bands.

### 10. VIX Term Structure

- **Source:** CBOE publishes EOD VIX futures settlements free.
- **Viz:** front-month vs back-month spread; contango (negative) vs backwardation (positive) over time. Backwardation is the rare-but-strong fear signal.

---

## FeatureChart enhancements (parallel track, not in Analysis section)

These are per-ticker analytical views that belong inside the existing `FeatureChart.tsx`. Same code-loading pattern as VRVP / SMMA Ribbon — toggle button in the toolbar, persisted via `usePersistedState`.

| Tool | Shape | New data? |
|---|---|---|
| **Drawdown** | New subpane below price showing `(price - rolling_max) / rolling_max` × 100% as a filled area going negative. Floor = max drawdown. | None |
| **Return distribution** | Modal popover or right-side panel with histogram of daily/weekly returns + skew/kurtosis annotations | None |
| **Volatility cone** | Overlay current realized vol vs 10/50/90th percentile bands across lookback windows (10 / 21 / 63 / 126 / 252 days) | None |
| **Seasonality heatmap** | Separate tab inside FeatureChart (not subpane) — month-of-year × year grid with median return overlay | None |
| **Anchored VWAP** | Overlay on price pane; anchor date = user-clickable | Volume already in `price_history` |

All zero-new-data. Drawdown is the cheapest first ship — fits the existing subpane infrastructure (RSI, ATR, etc. are already subpanes).

---

## Phasing summary

| Phase | Tools | New fetchers | Rough effort |
|---|---|---|---|
| 1 | Correlations + Yield Curve | 1 FRED series (`USREC`) | ~1 weekend |
| 2 | Pairs + RRG | None | ~1 weekend |
| 3 | Regime quadrant + Recession prob + FCI | 3 FRED series | ~1 weekend |
| 4 | COT + AAII + VIX term | 3 new fetchers | ~2-3 weekends |
| FC parallel | Drawdown subpane | None | ~1 evening |
| FC parallel | Vol cone / return dist / seasonality / AVWAP | None | ~1 weekend each |

Don't schedule all of Phase 4 — pick whichever sentiment tool you'd actually use. The architecture lets them ship one at a time without re-touching anything in Phase 1–3.

---

## Resolved (S15, 2026-04-28)

Walked through all six pre-Phase-1 open questions. Decisions captured below.

1. **Correlation cell click → Pairs tab pre-loaded.** Click a cell in the correlation matrix (e.g. BTC×ETH) → navigate to the Pairs tab with that pair pre-selected. Loses the Correlations view in exchange for full Pairs analysis depth. Inline cell-hopping (popover preview) is the v1.2 escalation if cell-hopping becomes the dominant usage pattern.

2. **Ticker multi-select → chip picker with autocomplete + modal for bulk.** A row of selected-ticker chips with X-to-remove; typing in the input filters an autocomplete dropdown. `+ ADD` button opens a modal picker (ManageWatchlistModal pattern) for bulk selection. Most expressive shape; matches the cross-asset nature of the tools. Picked over inline checklist (vertical-space cost on 60-ticker watchlist) and group-only dropdown (loses ad-hoc combos like "US banks + Canadian banks + JPM").

3. **RRG benchmark → per-session selector in the RRG toolbar.** Dropdown sits in the same toolbar row as the chip picker. Persisted via `session.analysis_rrg_benchmark`. Friction-free switching between US (`^GSPC`) / Canadian (`^GSPTSE`) / crypto (BTC) rotations. Picked over single hardcoded default (forces DB editing) and Settings-level configuration (Settings is set-and-forget; doesn't fit the per-rotation switch workflow).

4. **Recession Prob / FCI → both MACRO tile AND Analysis tab.** Same FRED series feeds two surfaces — MACRO tile for daily glance ("is anything alarming?"), Analysis tab for in-context regime read (sits next to Regime quadrant where the macro story coheres). Compute is shared; extract a shared view component to keep the two surfaces visually consistent.

5. **NBER recession bars → shared `useRecessionBars()` hook.** ~30 LOC React hook returns ECharts `markArea` config segments, ready to splat into any chart's options. Charts that want recession bars import the hook; charts that don't, don't. Pays for itself the first time we add a "hide recession bars" toggle (plausible v1.2). Picked over inline-per-chart `markArea` (4× duplication, 4 files to change for any styling tweak).

6. **Alignment dropouts → greyed chips in picker + result footnote.** Belt-and-suspenders: the chip picker greys out tickers that can't satisfy the chosen lookback (with tooltip showing actual bar count: "only 84 days; needs 365"); after compute, a footnote confirms what was actually included ("3 tickers excluded: HUT.TO, BITF.TO, GLXY — need 365 days, have 84/127/198"). Prevention + verification. Picked over single-surface options because silent dropping is the failure mode being avoided here.

---

## Implementation notes (knock-on from S15 decisions)

- **Q2 + Q6 coupling — picker IPC shape.** Greyed chips need per-ticker bar-count metadata available *during* picker rendering. The chip-picker IPC must return `{ ticker, bar_count, earliest_date, latest_date }`, not just ticker symbols. Expand the picker IPC shape on day 1 of Phase 1, not retrofit later when Q6 lands. Consider a `list_tickers_with_coverage()` command alongside the existing `list_ticker_tiles()`.
- **Q3 explicit Apply button.** Per-session benchmark switching triggers full JdK re-normalization (originally flagged in Risks section above). Don't auto-apply on dropdown change — render an `Apply` button next to the benchmark dropdown. Carry this through to RRG implementation.
- **Q4 shared component extraction.** Both MACRO tile and Analysis tab consume the same Recession Prob / FCI series. Extract a `<MacroSeriesView mode="tile" | "chart">` component (or two siblings sharing a hook) to keep formatting/threshold logic in one place. Avoid copy-pasting threshold lines and color rules across two surfaces.
- **All six picks landed on the most-expressive option.** Phase 1 effort is ~30% over the sketch's leaner-default scenarios. Account for this in scheduling — Phase 1 was originally one weekend; now closer to one weekend + one evening for the chip-picker IPC + greyed-chip plumbing.

---

## Phase 1 implementation plan (S15, 2026-04-28)

Walked through nine planning steps with the user; all decisions locked. This section is the canonical spec for the Phase 1 build session — the next coding pass reads from here.

### Decision summary

| # | Topic | Decision |
|---|---|---|
| 1.A | `analysis_tools.scope` column | Keep as `TEXT NOT NULL` per design — values `'cross_asset' \| 'macro' \| 'sentiment'`. Free extensibility for Phase 3+ tab grouping. |
| 1.B | USREC FRED series | Add `tile_visible INTEGER NOT NULL DEFAULT 1` column to `fred_series`. USREC seeded with `tile_visible = 0`. MACRO dashboard query filters `WHERE tile_visible = 1`. Future-proofs Phase 3 auxiliary FRED series (`RECPROUSM156N`, `NFCI`). |
| 2 | Rust analysis-tool pattern | **No trait.** Const registry (`ANALYSIS_TOOLS: &[AnalysisToolMeta]`) + per-tool typed compute free functions. Each tab is bespoke React, so abstracting compute behind `Box<dyn>` would lose static type safety with no rendering benefit. |
| 3.A | Correlations request shape | Typed `TickerKey { ticker, data_source }` pairs. Frontend chip picker carries the source; backend does no resolution. |
| 3.B | Yield Curve missing-data | Partial response: `TenorPoint.yield_pct: Option<f64>` (None = missing). Render only present tenors; error banner only when zero tenors available. |
| 3.C | Recession segments | Separate `list_recession_segments()` IPC. Owned by `useRecessionBars()` hook (one fetch per session, JS cache). Compute responses do NOT carry segments. |
| 4.A | Alignment exclusion rule | `bar_count >= lookback_days × 0.5`. Same rule in chip picker (greyed chips) and alignment helper (`excluded` list). |
| 4.B | Alignment helper data source | `align_close_prices(db, req)` queries `price_history` internally. N round-trips (one per ticker). Self-contained per the registry+free-function pattern. |
| 4.C | Picker coverage IPC | Separate `list_tickers_with_coverage()` command. Picker calls on mount, greys chips locally based on current lookback selection. Independent of alignment helper SQL. |
| 5.A | IPC commands location | Single `src-tauri/src/commands/analysis_cmds.rs` containing all five Phase 1 commands. |
| 6   | TS types location | Single `src/types/analysis.ts`. camelCase fields. Components do raw `invoke<T>(...)` — no wrapper layer. |
| 7.A | `TickerChipPicker` location | `src/components/analysis/TickerChipPicker.tsx` — analysis-scoped. Refactor up to `src/components/` if/when M9 multi-ticker overlay needs it. |
| 7.B | Tab styling | Refactor `.settings-tabs` / `.settings-tab` → generic `.tab-strip` / `.tab-strip__btn`. Update three consumers in one pass: `SettingsModal.tsx`, `ManageWatchlistModal.tsx`, new `AnalysisLayout.tsx`. |
| 8.B | Per-tool persistence | One `usePersistedState` key per tool: `session.analysis_<tool_id>_config`. Plus `session.analysis_active_tab` for the layout. Each tool's state is local to its component. |
| 9.A | Math unit tests | Minimal Rust unit tests in `src-tauri/src/analysis/tests.rs` (~50 LOC). Cover Pearson correlation, log_returns, and `align_close_prices` inner-join with mock data. No frontend tests. |

### File touch-list

**New (Rust, all under `src-tauri/src/`):**
- `analysis/mod.rs` — module declaration + shared types (`TickerKey`, `AnalysisError`, `ExcludedTicker`)
- `analysis/registry.rs` — `ANALYSIS_TOOLS` const + `AnalysisToolMeta` struct + `seed_analysis_tools()`
- `analysis/align.rs` — `align_close_prices()`, `log_returns()`, `AlignmentRequest`, `AlignedSeries`
- `analysis/correlations.rs` — `compute_correlations()`, `CorrelationsRequest`, `CorrelationsResponse`, Pearson math
- `analysis/yield_curve.rs` — `compute_yield_curve()`, `YieldCurveRequest`, `YieldCurveResponse`
- `analysis/coverage.rs` — `list_tickers_with_coverage()`, `TickerCoverage`
- `analysis/macro_overlays.rs` — `list_recession_segments()`, `RecessionSegment` (run-length encoded from `USREC` observations)
- `analysis/tests.rs` — math unit tests (Q9.A)
- `commands/analysis_cmds.rs` — five `#[tauri::command]` wrappers exposing the above

**Modified (Rust):**
- `db/schema.sql` — add `CREATE TABLE IF NOT EXISTS analysis_tools (...)`. Add `tile_visible` column to `fred_series` via idempotent guard (`PRAGMA table_info` check, then `ALTER TABLE ... ADD COLUMN ...DEFAULT 1` if missing).
- `db/seed.rs` (or wherever `Db::seed()` lives) — call `seed_analysis_tools()`. Add USREC row to FRED series seed with `tile_visible = 0`.
- `lib.rs` (or `main.rs`) — register the five new commands in `tauri::generate_handler!`.
- `commands/macro_cmds.rs` — `list_macro_tiles` SQL gets `WHERE tile_visible = 1` filter.

**New (Frontend, all under `src/`):**
- `components/analysis/AnalysisLayout.tsx` — tab strip, active-tab dispatch, persistence
- `components/analysis/CorrelationsTab.tsx` — HTML grid heatmap + chip picker + lookback dropdown
- `components/analysis/YieldCurveTab.tsx` — ECharts dual-pane chart (term structure + spread + recession bars)
- `components/analysis/TickerChipPicker.tsx` — chip + autocomplete + modal-for-bulk
- `components/analysis/registry.ts` — `id → React.ComponentType` map
- `hooks/useRecessionBars.ts` — fetches once via `list_recession_segments`, returns ECharts `markArea` config
- `types/analysis.ts` — all TS types mirroring the Rust IPC contract

**Modified (Frontend):**
- `components/Sidebar.tsx` — extend `PINNED_IDS` to `['scanner', 'analysis', 'macro', 'news']`
- `App.tsx` — add `'analysis'` case to section dispatch
- `components/SettingsModal.tsx`, `components/ManageWatchlistModal.tsx` — rename `.settings-tabs` → `.tab-strip` (Q7.B refactor)
- `styles/app.css` — rename CSS class definitions; add `.analysis-layout` chrome rules

### Rust struct shapes (IPC contract)

```rust
// shared
pub struct TickerKey { pub ticker: String, pub data_source: String }
pub struct ExcludedTicker { pub ticker: String, pub bar_count: u32, pub reason: String }
pub enum AnalysisError { NoData, InsufficientCoverage(Vec<String>), Db(String) }

// registry
pub struct AnalysisToolMeta {
    pub id: &'static str,
    pub display_name: &'static str,
    pub scope: &'static str,
    pub display_order: i32,
    pub default_config_json: &'static str,
}
pub struct AnalysisToolInfo {       // IPC shape — registry meta + DB-stored enabled/config
    pub id: String,
    pub display_name: String,
    pub scope: String,
    pub display_order: i32,
    pub enabled: bool,
    pub config_json: Option<String>,
}

// alignment
pub struct AlignmentRequest {
    pub keys: Vec<TickerKey>,
    pub lookback_days: u32,
    pub min_bars_required: u32,     // = lookback_days / 2 per Q4.A
}
pub struct AlignedSeries {
    pub dates: Vec<NaiveDate>,
    pub series: Vec<(TickerKey, Vec<f64>)>,
    pub excluded: Vec<ExcludedTicker>,
}

// correlations
pub struct CorrelationsRequest { pub tickers: Vec<TickerKey>, pub lookback_days: u32 }
pub struct CorrelationsResponse {
    pub tickers: Vec<String>,
    pub matrix: Vec<Vec<f64>>,
    pub lookback_days_requested: u32,
    pub lookback_days_actual: u32,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub bar_count: u32,
    pub excluded: Vec<ExcludedTicker>,
}

// yield curve
pub struct YieldCurveRequest { pub snapshot_date: Option<NaiveDate>, pub spread: String }
pub struct TenorPoint { pub tenor: String, pub yield_pct: Option<f64> }
pub struct CurveSnapshot { pub label: String, pub date: NaiveDate, pub points: Vec<TenorPoint> }
pub struct SpreadPoint { pub date: NaiveDate, pub value: f64 }
pub struct YieldCurveResponse {
    pub term_structure: Vec<CurveSnapshot>,
    pub spread_label: String,
    pub spread_series: Vec<SpreadPoint>,
}

// coverage (chip picker)
pub struct TickerCoverage {
    pub ticker: String,
    pub data_source: String,
    pub bar_count: u32,
    pub earliest_date: NaiveDate,
    pub latest_date: NaiveDate,
}

// recession bars
pub struct RecessionSegment { pub start: NaiveDate, pub end: NaiveDate }
```

All structs use `#[serde(rename_all = "camelCase")]` for IPC (per IPC-1).

### Suggested implementation order

Each step compiles + passes its build gate before the next starts.

1. **DB layer** — schema + seed + migration for `tile_visible`. `cargo check` clean.
2. **Math primitives + tests** — `pearson()`, `log_returns()`, `align_close_prices()` + the unit-test file. `cargo test --package personal-terminal --lib analysis::tests` passes.
3. **Compute modules** — `correlations.rs`, `yield_curve.rs`, `coverage.rs`, `macro_overlays.rs` using the primitives.
4. **IPC layer** — `analysis_cmds.rs` + register in `tauri::generate_handler!`. `cargo check` clean.
5. **TS types** — `src/types/analysis.ts` (`npx tsc --noEmit` should pass against the Rust contract since IPC fields are camelCase-renamed).
6. **CSS refactor** — `.settings-tabs` → `.tab-strip` rename pass (Q7.B). Manual visual check that Settings + Manage Watchlist still look right.
7. **Frontend components** — `TickerChipPicker` first (used by Correlations); then `CorrelationsTab`; then `YieldCurveTab`; finally `AnalysisLayout` + `useRecessionBars` hook.
8. **Routing wire-up** — Sidebar `PINNED_IDS` + App router case.
9. **Smoke-test** — execute the checklist below.

### Smoke-test checklist (executed when Phase 1 ships)

**Build gates:**
- `cargo check --manifest-path src-tauri/Cargo.toml` clean
- `cargo test --package personal-terminal --lib analysis::tests` all pass
- `npx tsc --noEmit` clean
- `npm run build` succeeds

**Correlations:**
- `SPY × SPY = 1.000` on diagonal (sanity)
- `BTC × ETH` over 90d ≈ 0.7-0.9
- `GLD × SPY` over 90d near 0 or mildly negative
- Pick a ticker with short history → confirm appears in `excluded` footnote with correct `bar_count`
- Switch lookback 90d → 365d → matrix re-renders + dropouts update

**Yield Curve:**
- Today's 3M / 2Y / 5Y / 10Y / 30Y match FRED's published numbers (cross-check fred.stlouisfed.org)
- 2s10s spread series matches `DGS10 - DGS2` plot on FRED directly
- Recession bar visible over 2020-Mar–Apr (COVID); over 2008-Jan–2009-Jun (GFC)
- Toggle spread `2s10s` ↔ `3m10y` → spread chart re-renders with correct label

**Chip picker:**
- Greyed chip appears for any ticker with `< lookback × 0.5` bars
- Tooltip on greyed chip shows "X of needed Y days"
- Multi-select / deselect works; chips persist across tab switches per Q8.B

**Recession bars hook:**
- `list_recession_segments` fires once per session, not per chart (verify via console / network log)
- Same gray bars appear identically on Yield Curve spread pane

### Effort estimate

- DB + math primitives + tests: ~2 hours
- Compute modules + IPC: ~3 hours
- TS types + CSS refactor: ~1 hour
- Frontend (chip picker + tabs + layout + hook): ~5-6 hours
- Smoke-test + fixes: ~1-2 hours

**Total: ~12-14 hours.** Roughly one weekend + one evening (matches the revised post-decisions estimate from the Implementation notes section above).

---

## Risks / what could go wrong

- **Scope creep from "while we're here" thinking.** Once Analysis exists, every "wouldn't it be cool if…" idea pulls toward it. The phase plan exists to gate that — Phase 1 must ship and prove the registry pattern before Phase 2 starts.
- **Correlation matrix usefulness depends on universe size.** 5 tickers = trivial table. 50 tickers = visually loud. Provide a "select group" shortcut that defaults to a sensible subset (e.g., one per asset class).
- **RRG benchmark drift.** If the user changes their benchmark mid-session, the JdK normalization needs a full re-fetch + recompute. Make the benchmark change explicitly costly (button, not auto-apply) so it doesn't fire on every keystroke.
- **COT lag.** CFTC report dates are Tuesday close, published Friday. Tile freshness needs to communicate "as of last Tuesday" — don't show it as live.
- **NBER recession date lag.** NBER officially dates recessions 6-18 months after they end. The trailing edge of the recession bar may shift as new data lands. Acceptable.

---

## What this *isn't* doing

- Not adding alerts / notifications (out of scope for v1.x — terminal is observe-only)
- Not adding paper-portfolio / position tracking (PrivateACB territory)
- Not building an indicator-builder UI (M10 in v1 backlog handles indicator parameter tuning; this is separate)
- Not adding chart annotations / drawing tools (would be its own design doc)

---

## Reference material

- **RRG math:** Julius de Kempenaer's original whitepaper; Bloomberg help docs on RRG function. JdK RS-Ratio normalization is the standard.
- **NBER recession dates as FRED series:** `USREC` (monthly indicator), `USRECM` (alternative).
- **NY Fed recession probability:** `RECPROUSM156N` on FRED.
- **Chicago Fed FCI:** `NFCI` on FRED.
- **CFTC COT format:** `https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm` (legacy format documentation in the same directory).
- **AAII survey archive:** `https://www.aaii.com/sentimentsurvey/sent_results` (downloadable historical XLS).
