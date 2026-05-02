# Pulse — Percentile Cross-Section Heatmap (v1.2 design sketch)

Draft, 2026-05-02. Sibling to `DESIGN.md` and `02_v1_1_analysis/v11_analysis_design.md`. Status: **design only — no code commitments**. Awaiting database expansion (new sector groups + tickers) before implementation begins, so the v1 ship lands on a richer, more demonstrable universe.

---

## TL;DR

Single screen showing every ticker in the watchlist + every macro series, expressed as **percentile rank vs its own trailing-5-year history** across a small set of dimensions (regime state, regime age, level, RSI, ATR, volume, drawdown). Color-coded heatmap cells. Sortable by any column. Click a cell to jump into that ticker's feature chart.

The "morning weird-detector": a single screen that answers **what in my universe is at an extreme right now?** in five seconds.

---

## Goal

Surface the entire personal universe at one glance, with each ticker's current state expressed as percentile-ranks vs its own historical baseline. Tell the user where things are extreme, where things are quiet, and what's worth opening a chart for.

This is the "synthesis layer" the whole app architecture has been building toward. Without it, users navigate ticker-by-ticker through a sidebar tree; with it, they get the global picture and drill down on the outliers.

## Non-goals

- **No prediction.** No forecast, no probability claim, no "buy/sell" semantics, no conviction gauge. Pure descriptive — "this is high right now" is a fact about the present, not a claim about the future. Keeps the app on the right side of principle 9 ("decision support, not investment advice") that S17's `<TabIntro>` pattern was codified to protect.
- **No new data sources.** Builds entirely on what's already cached (`price_history`, `fred_observations`, indicator compute). No new fetchers, no schema growth beyond the analysis_tools registry row.
- **No alerts / notifications.** Pulse is a view, not a watchman. If the user wants to be paged when X crosses Y, that's a separate (out-of-scope) feature.
- **No personalization beyond the existing watchlist.** No "favorites within the heatmap," no "snooze this row." The watchlist is the universe; everything in it shows up.

---

## Why this is the killer feature *for this app*

Three things about the existing architecture make this work where competitors can't:

1. **A curated personal universe** (~100 tickers + 18 FRED macros after v1, growing pre-Pulse). Bloomberg shows the whole world; you can't ask Bloomberg "what does *my* watchlist look like as a heatmap." TradingView is one-ticker-per-tab. Personal terminal is the only place where the universe is small enough, specific enough, and accessible enough to be expressed in a single cross-section.
2. **All historical bars cached locally in one SQLite.** Web tools can't compute percentiles cleanly because they fetch on demand and don't have everything together. Personal terminal already has the entire 5-year history of every watchlist ticker on disk — percentile ranks are a single SQL aggregate away.
3. **The Analysis-section infrastructure is reusable.** The new tab plugs into the existing `analysis_tools` registry and `<TabIntro>` pattern shipped S17. Same Rust-compute-then-IPC-then-React-tab pipeline as Phase 3 tools. No new architectural patterns to invent.

## Naming

**Working name: PULSE.** Short, evokes "the pulse of the market right now," doesn't overpromise predictiveness. Sidebar slot label is one word, fits the existing pinned-trio aesthetic (SCANNER · ANALYSIS · MACRO · NEWS).

Alternative names considered: CROSS-SECTION (technical, verbose), HEATMAP (generic, undercaptures the percentile-rank semantic), SPECTRUM (vague), BREADTH (means something specific — "% of universe in bull regime" — and would mislead).

---

## Sidebar placement

Pinned at position 1 of the sidebar's pinned section, ahead of SCANNER. Rationale: Pulse is the "open this first" landing surface — the at-a-glance overview that should be the user's first stop on opening the app. Scanner remains for "drill into a specific filter," Analysis for "tools," Macro for "the macro picture," News for news.

```ts
const PINNED_IDS = ['pulse', 'scanner', 'analysis', 'macro', 'news'];
```

Click PULSE → main pane shows the cross-section. Tab bar inside the pane is empty for v1 (single view); v1.2 could add tabs for "snapshot history" or alternative groupings.

---

## The view at a glance

```
                        REGIME  AGE   LEVEL  RSI    ATR    VOL    DD
INDICES
  ^GSPC                 ●BULL   71d   ▰▰▰▰▱  ▰▰▰▱▱  ▰▰▱▱▱  ▰▰▱▱▱  -1.2%
  ^IXIC                 ●BULL   83d   ▰▰▰▰▰  ▰▰▰▰▱  ▰▰▱▱▱  ▰▰▱▱▱  -0.8%
  ...
US EQUITIES
  AAPL                  ●BULL   42d   ▰▰▰▱▱  ▰▰▰▱▱  ▰▰▱▱▱  ▰▰▱▱▱  -3.2%
  MSFT                  ●BULL   89d   ▰▰▰▰▰  ▰▰▰▰▱  ▰▰▱▱▱  ▰▰▱▱▱  -1.1%
  NVDA                  ●BULL  127d   ▰▰▰▰▰  ▰▰▰▰▰  ▰▰▰▰▱  ▰▰▰▰▱  -0.8%
  TSLA                  ●BEAR    8d   ▰▰▱▱▱  ▰▱▱▱▱  ▰▰▰▱▱  ▰▰▰▰▱ -22.4%
  ...
CRYPTO
  BTC-USD               ●BULL   71d   ▰▰▰▰▰  ▰▰▱▱▱  ▰▰▰▰▱  ▰▰▰▰▱  -4.1%
  ETH-USD               ●NEUT   12d   ▰▰▰▱▱  ▰▰▱▱▱  ▰▰▰▱▱  ▰▰▱▱▱  -8.6%
  ...
CA BANKING
  RY.TO                 ●BULL   38d   ▰▰▰▱▱  ▰▰▰▰▱  ▰▰▱▱▱  ▰▱▱▱▱  -2.5%
  TD.TO                 ●NEUT   19d   ▰▰▱▱▱  ▰▰▰▱▱  ▰▰▰▰▱  ▰▰▰▰▱  -6.8%
  ...
MACRO
  DGS10                 —       —     ▰▰▰▰▱  —      —      —      —
  CPIAUCSL              —       —     ▰▰▱▱▱  —      —      —      —
  NFCI                  —       —     ▰▱▱▱▱  —      —      —      —
  ...
```

Story-per-row reads instantly:
- **NVDA**: bull regime, 4 months mature, extended on every dimension → momentum stretched
- **TSLA**: bear regime, fresh 8-day flip, big drawdown, vol elevated → developing breakdown
- **BTC**: bull regime, mature, level extreme but RSI cooled → coiling
- **TD.TO**: neutral, RSI mid, vol elevated, modest drawdown → not yet a story
- **NFCI at 1st percentile**: financial conditions easier than they've been in 5 years → macro tailwind

The "5-second scan" use case isn't a fantasy — the eye is great at picking out cells at the saturation extremes. A wall of green-and-yellow with two red cells is a story you absorb instantly.

---

## Column inventory (locked v1 set)

Seven columns, ordered to support left-to-right narrative reading. **NEWS** considered + dropped during design (too ephemeral; news count varies more with media cycles than with what users care about).

### 1. REGIME

- **Type:** Categorical chip — `BULL` / `BEAR` / `NEUTRAL` / `—` (when unavailable)
- **Color:** SMMA Ribbon palette tokens — `--state-bull` (cyan) / `--state-bear` (rose) / `--state-neutral` (gray)
- **Source:** SMMA Ribbon current-bar state, computed from `price_history` via the existing `smma_ribbon::compute()` Rust path (M6 indicator framework)
- **Universal compute:** Cross-section needs regime for *every* ticker regardless of `indicator_settings.enabled` — recompute on tab open for all watchlist tickers, ignore the per-ticker enable flag for this view. Cheap (~ms per ticker × 100 tickers = sub-second).
- **Macro rows:** N/A. Em-dash.

### 2. AGE

- **Type:** Numeric (days)
- **Source:** Days since the most recent SMMA Ribbon state flip in the ticker's history. Reuses `state_flips` output from `smma_ribbon.rs`.
- **Interpretation:** Long age = mature trend. Short age (<30d) = fresh flip; treat with caution. No coloring — number speaks for itself.
- **Macro rows:** N/A. Em-dash.

### 3. LEVEL

- **Type:** Percentile (0-100)
- **Source:** Current value's rank within all values in the trailing-5-year window for that series. Equity tickers: `close` price. Macro series: the FRED observation value.
- **Why "LEVEL" not "PRICE":** Works uniformly across equity prices and macro values (which aren't prices). Avoids misleading row-by-row mental model.
- **Color:** Diverging heatmap — 0 (red) → 50 (yellow) → 100 (green). Current value is "high" or "low" relative to its own range, not relative to "good" or "bad."
- **Macro rows:** Same compute. The only column that lights up for macros.

### 4. RSI

- **Type:** Percentile (0-100) of the *current RSI value* within the trailing-5-year distribution of RSI values for this ticker
- **Source:** Current bar's RSI(14) from existing `rsi.rs`. Compute on the fly for all watchlist tickers (same universal-compute path as REGIME).
- **Why percentile vs raw RSI:** A current RSI of 65 is "high" for a low-vol bond ETF and "normal" for a momentum-tech stock. Percentile-vs-own-history normalizes across the universe.
- **Color:** Same diverging heatmap. Note: the *raw* RSI value is also informative (>70 / <30 thresholds); show it in the cell tooltip for users who want it.
- **Macro rows:** N/A. RSI is a price-derived oscillator. Em-dash.

### 5. ATR

- **Type:** Percentile (0-100) of the *current ATR value* within the trailing-5-year distribution of ATR values for this ticker
- **Source:** Current bar's ATR(14) from existing `atr.rs`.
- **Interpretation:** High ATR percentile = current vol regime is elevated vs history (turbulent). Low percentile = quiet regime. Useful for "is this a calm or choppy moment for this asset" reads.
- **Color:** Same diverging heatmap.
- **Macro rows:** N/A. Em-dash.

### 6. VOL

- **Type:** Percentile (0-100) of *trailing-5-day average volume* within the trailing-5-year distribution of trailing-5-day average volumes for this ticker
- **Source:** `price_history.volume`. 5-day average smooths intraday spikes; percentile vs 5y captures regime shifts in participation.
- **Why average vs raw current volume:** Single-day volume spikes are noisy (one earnings release, one news event); 5-day average captures sustained activity. Still sensitive enough to flag genuine attention shifts.
- **Color:** Same diverging heatmap.
- **Macro rows:** N/A. FRED series have no volume. Em-dash.

### 7. DD (Drawdown)

- **Type:** Signed percentage (e.g., `-3.2%`, `-22.4%`, `0.0%`). NOT a percentile.
- **Source:** Current close vs the trailing-5-year running peak. Same `computeDrawdown` math as the FeatureChart subpane shipped S19.
- **Why signed % vs percentile:** The number is intrinsically meaningful and bounded (0% = at peak, can't go positive). Percentile would obscure the "this is at -22%" magnitude that users care about.
- **Color:** Red intensity scales with drawdown depth — 0% white, -5% pale red, -20% medium red, -40%+ deep red. Discontinuous from the diverging-heatmap palette to make it visually distinct as the only signed-magnitude column.
- **Macro rows:** N/A for most. *Could* apply to macro series with meaningful peaks (e.g., NFCI loose-vs-tight cycles), but the semantic is muddy. Em-dash for v1.

---

## Compute model

### Per-cell compute

For each (ticker, dimension) pair:

```
let baseline = trailing_5y_distribution(ticker, dimension)
let current = current_value(ticker, dimension)
let percentile = percentile_rank(current, baseline)
```

`percentile_rank(x, vs)` = `(count of values in vs <= x) / len(vs) * 100`. Standard empirical percentile (no interpolation needed at this scale).

### Baseline window

**Trailing 5 years from "today"** (most recent observation date in the cache). Anchors the percentile to a stable lookback that captures the recent cycle the user lived through. v1.2 could expose this as a "1y / 3y / 5y / max" toggle if the request comes up.

### Universal SMMA + RSI + ATR compute

Existing M6 indicators compute per-ticker, gated by `indicator_settings.enabled`. For Pulse, the cross-section needs these for *every* ticker regardless of the user's per-ticker enables. Path:

- Fetch all bars for the ticker (existing `db.close_history` / `db.all_price_bars_ohlcv`)
- Run `smma_ribbon::compute()` / `rsi::compute()` / `atr::compute()` directly with default params (no params_json lookup)
- Read the last bar's state / RSI / ATR

Cost: each compute is ms-scale. ~100 tickers × 3 indicators = ~300 ms total for a fresh tab open. Acceptable.

If perf becomes an issue at higher ticker counts (post-database-expansion), the cross-section can cache the latest computed values in a new `cross_section_cache` table refreshed on the same cadence as `quote_cache`.

### Coverage gracefulness

Tickers with insufficient history get graceful fallback:

- **<252 bars (1 trading year):** Row appears, but percentile cells render with `*` suffix and a tooltip ("Only 142 days of history; percentile vs available range"). Users see something instead of nothing.
- **<30 bars:** Row appears greyed out with single em-dash spanning all percentile columns ("Insufficient history"). Regime/age may still compute if SMMA's warm-up has cleared.
- **No bars at all:** Row shows ticker name + em-dashes everywhere + a stale-data tooltip ("Bars not yet fetched"). Encourages user to refresh that section.

---

## Macro row treatment

The macro section is at the bottom of the heatmap. Each macro series gets one filled column (LEVEL — percentile of current observation vs trailing 5y of observations) and em-dashes everywhere else. Visually distinguishable from equity rows by the dominant em-dash pattern. Users still get one informative number per macro series.

For FRED series with deeper history than 5 years (most), the trailing-5y baseline is what's used — keeps the comparison fair across all rows. v1.2 could expose a per-row "use full history" toggle for the macro rows, but it complicates the unified comparison and probably isn't worth it.

---

## Color & visual design

- **Diverging heatmap (LEVEL / RSI / ATR / VOL):** 0th → red, 50th → near-neutral (low saturation yellow), 100th → green. Reuses existing `--status-up-rgb` / `--status-down-rgb` tokens with a yellow midpoint via `--accent-amber-rgb`. Saturation scales with distance from 50 — extremes pop, middle values fade into the table.
- **DD column:** monotone red, intensity scales with drawdown depth. Distinguishes itself from diverging columns (no green possible).
- **REGIME column:** SMMA Ribbon palette chips — `BULL` cyan, `BEAR` rose, `NEUTRAL` gray. Matches the FeatureChart envelope colors so users build one palette mental model.
- **AGE column:** uncolored monospace text. Numeric.
- **Section headers** (sector_group rows): use existing sidebar group styling — slightly larger, slightly subdued color, no row data. Visual grouping anchor.
- **Cell glyph:** percentile rendered as 5-block bar (`▰▰▰▱▱`) + raw number in tooltip. Glyph is glanceable; tooltip is for the data-curious.

All colors via existing `tokens.css` variables — no new tokens needed.

---

## Interactivity

- **Sortable columns** — click any column header to sort the visible rows by that column (descending by default; click again for ascending). Section grouping is preserved (sort happens within each sector_group), OR a "flat sort" toggle un-groups everything and sorts globally. Default: grouped sort, with global-sort as a one-click escape.
- **Filter / scope toggle** — header chips: `[ALL] [BULL ONLY] [BEAR ONLY] [EXTREMES (>80 or <20 on any column)]`. Mirrors the kind of "weird detector" use case Pulse is built for.
- **Click cell → opens that ticker's feature chart** in the appropriate section. Lossless navigation back via the existing breadcrumb / back-button pattern.
- **Hover cell → tooltip** with raw value + percentile rank + lookback window length + last-fetched timestamp. Tooltip is the "details on demand" layer.
- **Row hover** lights up the entire row faintly so the eye can scan across without losing track.

---

## TabIntro content

Per the S17-mandatory pattern. Required.

**Subtitle (always visible, ~1 sentence, plain English):**
> *Where each ticker in your watchlist sits today vs its own 5-year range, expressed as percentile-rank cells. Greens mean "high vs history," reds mean "low," middle values mean "normal."*

**"How to read this" (collapsible, plain language):**
- Each cell shows the current value's percentile rank within the last five years of that ticker's own history. A green LEVEL cell at 95 means today's price is in the top 5% of the last five years. A red RSI cell at 12 means RSI is in the bottom 12%.
- REGIME = SMMA Ribbon current state (cyan = bullish ordering, rose = bearish, gray = neutral). AGE = days since the most recent regime flip — long age = mature trend, short age = fresh.
- DD is a signed % drawdown from the 5-year running peak — not a percentile. -22% means the asset is 22% below its 5-year high.
- The "extreme detector" use case: scan for cells at saturation. Greens at 90+ or reds at 10- are where stories develop.
- Universe-wide patterns matter — if half your watchlist's RSI column is red simultaneously, that's a market-wide momentum cool-off, not a ticker-specific signal.
- Sortable by any column. Click a row to open that ticker's chart.

Standard liability close: *Decision support, not investment advice. Patterns are descriptive, not predictive.*

**"The math" (collapsible, optional but recommended):**
- For each (ticker, dimension): `percentile = (count of historical values <= current_value) / total_count × 100`.
- Baseline: trailing 5 years from the most recent observation in the cache (anchors comparison to the recent cycle).
- LEVEL: percentile of `close` (equities) or observation `value` (macro).
- RSI: 14-period Wilder RSI percentile vs 5y of historical RSI values.
- ATR: 14-period Wilder ATR percentile vs 5y of historical ATR values.
- VOL: trailing 5-day average volume percentile vs 5y of historical 5-day-avg volumes.
- DD: `(close / running_max - 1) × 100`, signed, where `running_max` is the trailing 5y running peak of `close`.
- REGIME: SMMA Ribbon state from quad-SMMA classifier with 3-bar confirmation (defaults). AGE: bars since most recent confirmed-state flip.

---

## Architectural placement

### Backend

New tool in the `analysis_tools` registry following the established pattern:

```sql
INSERT OR IGNORE INTO analysis_tools VALUES (
  'pulse',
  'Pulse',
  'cross_asset',
  0,                  -- display_order; lands at top of registry
  1,                  -- enabled
  '{"lookbackYears":5}'  -- default config_json
);
```

But — Pulse isn't a tab inside the existing Analysis section; it's a top-level pinned sidebar slot. So `analysis_tools` registry placement is *for consistency* (lets users disable Pulse via the same mechanism, exposes it via `list_analysis_tools`) but it doesn't render inside `<AnalysisLayout>`.

New Rust module `src-tauri/src/cross_section/`:

```
cross_section/
  mod.rs              # shared types — CrossSectionRow, CrossSectionCell
  compute.rs          # main compute_cross_section() entry point
  percentile.rs       # percentile_rank helper + tests
  baseline.rs         # trailing-5y window selection per ticker
  tests.rs            # math unit tests
```

(Could alternatively live under `analysis/cross_section.rs` to match Phase 1-3 convention. Top-level `cross_section/` makes more sense given Pulse's distinct sidebar placement and the likely growth of percentile-related compute. Decide at implementation time.)

New IPC command:

```rust
#[tauri::command]
pub fn compute_cross_section(
    request: CrossSectionRequest,
    state: State<'_, AppState>,
) -> Result<CrossSectionResponse, String>
```

Request carries lookback config + group filter (optional). Response is a flat `Vec<CrossSectionRow>` where each row carries the ticker key, sector_group_id, and per-dimension cells.

### Frontend

New top-level component `src/components/pulse/PulseDashboard.tsx`:

- Fetches `compute_cross_section` on mount + on lookback-config change
- Renders `<TabIntro>` per S17-mandatory pattern
- Renders the heatmap as an HTML grid (NOT ECharts) — same reasoning as `CorrelationsTab.tsx` (cleaner cell behavior, easier sortable columns, no axis-rotation fights)
- Uses existing heatmap CSS classes from `corr-matrix__cell` family + adds `pulse-cell` variants for the percentile / regime / drawdown / age column types
- Persists user state (sort column, filter scope) via `usePersistedState` keys `session.pulse_sort_column` + `session.pulse_filter_scope`

Sidebar wiring — `Sidebar.tsx` extends `PINNED_IDS` to include `'pulse'` at position 0. `App.tsx` adds `case 'pulse': return <PulseDashboard />;`.

---

## Persistence

Per-component state via `usePersistedState`:
- `session.pulse_sort_column` — `{ column: 'level' | 'rsi' | ..., direction: 'asc' | 'desc' }`
- `session.pulse_filter_scope` — `'all' | 'bull' | 'bear' | 'extremes'`

No new DB tables for Pulse v1. Compute on tab open; trust that's fast enough at v1 universe size. Add a `cross_section_cache` table only if measurements show the recompute is too slow.

---

## Performance considerations

Worst-case v1 size: ~150 tickers (current 100 + planned database expansion) × 5 indicator-derived dimensions = 750 universal indicator computes per tab open. Each indicator compute on a 5y history (~1250 daily bars) is sub-millisecond in Rust. Total: ~1 second worst-case for a fresh tab open with no caching.

If that's too slow:

1. **Cache indicator outputs in a new `cross_section_cache` table** keyed on `(ticker, last_bar_date)`. Recompute only on bar updates. Cache hit = <50 ms total tab open.
2. **Lazy-render rows** as the user scrolls the heatmap. React's intersection-observer pattern, no compute change needed.
3. **Background compute** on bar refresh — when the scheduler updates a ticker's bars, it also recomputes that ticker's cross-section row in the background. Tab open reads from cache only.

Pick the smallest of these that solves the actual measured perf problem; don't pre-optimize.

---

## Implementation phases

### Phase 0 — pre-build database expansion (separate session, blocks Phase 1)

User has flagged this as a prerequisite: save the current DB and expand the watchlist with new sector groups, more tickers, additional asset classes — so the Pulse v1 ship has a richer, more demonstrable universe. Specifics tracked in a separate planning doc / conversation.

Categories to consider for the expansion (informed by this design's strengths):
- More INDICES (more world coverage gives the LEVEL column more variety)
- ETF baskets (sector ETFs, factor ETFs, country ETFs — the heatmap shines on baskets)
- More CRYPTO (current 10 is the bare minimum; the story-per-row works with 20-30)
- US sectors (currently CA-focused; XLK, XLE, XLF, XLV, XLU, XLP, XLY, XLI, XLB, XLRE for US sector breadth)
- More macro series (FRED has hundreds; pick 5-10 more high-signal additions)
- New asset class? FX pairs? Bonds? Pulse thrives on heterogeneity.

### Phase 1 — backend

1. New `cross_section/` module with types, compute, percentile helper, tests.
2. IPC command `compute_cross_section`.
3. Universal indicator compute path (call `smma_ribbon::compute()` / `rsi::compute()` / `atr::compute()` directly without indicator_settings lookup).
4. ~5-8 unit tests on the percentile math + the universal-compute path.
5. Optional: `analysis_tools` registry row for visibility/config plumbing.

### Phase 2 — frontend

1. `src/types/cross_section.ts` — IPC contract types.
2. `src/components/pulse/PulseDashboard.tsx` — main component.
3. `src/components/pulse/PulseRow.tsx` + `PulseCell.tsx` — render units.
4. CSS additions for the heatmap grid + percentile glyphs in `app.css` (no new files; reuses tokens).
5. Sidebar / App routing wire-up.
6. `<TabIntro>` filled in per the standard pattern.

### Phase 3 — smoke test

Per S17 lessons (EC-14, EC-15) — webview render verification beyond `tsc` + `npm run build`. Focus areas:
- Rows render for every visible watchlist ticker
- Macro section appears with correctly-blanked cells
- Color scaling reads at the extremes (greens visibly green, reds visibly red)
- Sort works on each column
- Filter chips do what they say
- Cell click opens the ticker's feature chart
- Tickers with <252 bars render gracefully (asterisk + tooltip)
- Cells without data (e.g., FRED series RSI) are em-dash, not empty

---

## File touch-list (estimate)

**New (Rust):**
- `src-tauri/src/cross_section/mod.rs`
- `src-tauri/src/cross_section/compute.rs`
- `src-tauri/src/cross_section/percentile.rs`
- `src-tauri/src/cross_section/baseline.rs`
- `src-tauri/src/cross_section/tests.rs`
- `src-tauri/src/commands/cross_section_cmds.rs`

**Modified (Rust):**
- `src-tauri/src/lib.rs` — register new IPC command
- `src-tauri/src/db/seed.sql` — optional analysis_tools row (or skip and rely on Sidebar pinning)

**New (Frontend):**
- `src/types/cross_section.ts`
- `src/components/pulse/PulseDashboard.tsx`
- `src/components/pulse/PulseRow.tsx`
- `src/components/pulse/PulseCell.tsx`

**Modified (Frontend):**
- `src/components/Sidebar.tsx` — extend PINNED_IDS
- `src/App.tsx` — route 'pulse' → PulseDashboard
- `src/styles/app.css` — pulse-specific cell styling

---

## Smoke-test checklist (executed when Phase 2 ships)

**Build gates:**
- `cargo check --manifest-path src-tauri/Cargo.toml` clean
- `cargo test --package personal-terminal --lib cross_section::tests` all pass
- `npx tsc --noEmit` clean
- `npm run build` succeeds

**Visual:**
- Pulse renders with all watchlist tickers + all macro series in section-grouped rows
- A known-extreme ticker shows a saturated cell (e.g., a recent leader has green LEVEL); a known-quiet ticker shows pale/yellow cells
- DD column displays signed percent (e.g., `-3.2%`), not a percentile
- Macro rows show LEVEL only; other columns are em-dashes
- Section headers use existing sidebar group styling
- Tooltips on cell hover show raw value + percentile + lookback length

**Interactivity:**
- Click LEVEL header → rows sort by LEVEL descending; click again → ascending
- Click cell → opens that ticker's feature chart
- Filter chip "BULL ONLY" → only bull-regime rows visible
- Filter chip "EXTREMES" → only rows with at least one >80 or <20 percentile cell

**Coverage edge cases:**
- A ticker with 100 bars total renders with asterisks + tooltip
- A ticker with 0 bars renders greyed
- FRED series RSI is em-dash, not 0

---

## Risks

- **Visual overload at universe scales >200 tickers.** With many rows, the wall of color becomes wallpaper. Mitigation: filter scopes + sort. v1.2 could add per-section collapse / expand to compress unwatched sectors.
- **Percentile drift at re-baseline boundaries.** Today's "5y trailing" window includes day X; tomorrow's drops day X-1825 and adds day X+1. Percentiles for stable-history tickers shift a percentile or two daily. Acceptable as background drift; might be misleading for users at boundary cases. Tooltip should communicate the lookback window.
- **Universal-compute cost at scale.** 150 tickers × 3 indicators is fine; 500+ tickers might hit perceptible latency. Stay vigilant on tab-open timing during smoke test; cache only if measured.
- **SMMA state unreliable on short-history tickers.** A ticker with <50 bars hasn't cleared SMMA's warm-up; AGE / REGIME may show artifacts. Already covered by the coverage-gracefulness fallback — those tickers show asterisks / em-dashes.
- **Macro rows look sparse next to equity rows.** Em-dashes everywhere but LEVEL might read as "broken" rather than "intentional." Tooltip on the em-dash explains; a small "macro section" header above the macro block adds context. Visual smoke test will tell.

---

## Open questions to lock before build

1. **Backend module location** — `cross_section/` top-level vs `analysis/cross_section.rs` under existing module? My lean: top-level, given the distinct sidebar placement and the likely growth of percentile-related compute.
2. **`analysis_tools` registry row** — include for consistency, or skip since Pulse isn't an Analysis tab? Including it lets users disable Pulse via the existing toggle infrastructure without bespoke code.
3. **Default sort + filter on first open** — alphabetical / by-section / by-extreme? My lean: by-section (matches sidebar mental model), no filter (show everything).
4. **Click cell → which behavior:** open that ticker's feature chart? open the relevant Analysis tab (e.g., LEVEL cell → ?) ? My lean: feature chart, every cell, simple.
5. **Section header rendering** — section-row in the table (matches sidebar) vs visual-only divider? Section-row probably; gives the section header row a sortable label + a count of tickers in it.
6. **Frequency of cross-section refresh on open** — recompute every tab open (~1 sec) vs cache + invalidate on bar update? Start with recompute every open; add caching only if measured slow.
7. **SMMA state computed with default params or with user's per-ticker overrides?** Default params for cross-section (consistency across the table); the user's per-ticker overrides apply only when they open the ticker's feature chart. My lean: default params for Pulse universally.

---

## What this *isn't* doing

- Not predicting price moves
- Not generating buy/sell signals
- Not weighting cells into a composite "score" (avoid the Conviction Forge trap from S20 brainstorm — single score = false confidence)
- Not adding alerts / notifications
- Not building a screener with custom filters (filter chips are intentionally limited)
- Not personalizing per-cell weighting beyond the watchlist itself (the watchlist IS the personalization)

---

## Reference / inspiration

- **Bloomberg HRH function** — heat-map ranking utility for analyst-defined universes. Closest commercial analog. HRH is keyed on a Bloomberg portfolio and uses Bloomberg's full data layer. Pulse is the local-first version with a personal universe and free-tier data.
- **Factor tilts in long-short equity** — the columns chosen here (level / RSI / ATR / vol / drawdown) are conventional factor stack components (value-ish via level, momentum via RSI, vol regime via ATR, attention via volume, downside via drawdown). The percentile-vs-own-history framing avoids cross-sectional comparison problems.
- **TradingView's "Heat Map" tab** — sector-rotation visualization via box sizes. Different shape, different intent, but proves the heatmap-as-overview pattern resonates with traders.
- **The S20 brainstorm conversation** — Pulse was the third proposed candidate after Time Machine (killed by 5-year data limit) and Conviction Forge (killed by principle-9 violation). Locked as v1.2 killer feature 2026-05-02.

---

## Status

- Design locked: 2026-05-02 (S20 brainstorm conversation)
- Implementation: blocked on database expansion (Phase 0 — separate session)
- Target ship: post-database-expansion, single weekend feature build
