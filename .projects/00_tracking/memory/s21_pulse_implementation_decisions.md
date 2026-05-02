# S21 — Pulse implementation + Scanner deprecation (2026-05-02)

Build session for the v1.2 Pulse killer feature designed in S20. Visual prototype → real backend → click navigation → Scanner subsumption + cleanup. Master should land at HEAD of `feature/v1.2-pulse-implementation` (not yet committed at session-end time).

## Visual design lock (Style C + Palette 1)

Three rounds of ASCII mocking + screenshot iteration with the user before code. End state:

- **Cell rendering = Style C** — saturated colored block with number inside (96px × 26px). Number 15px monospace, font-weight 600, no internal cell border, 1px column-gap as the only separator. ASCII-bar glyph (▰▰▰▰▱) considered + dropped (5 quanta too coarse, "cute" not "graphic"). Number-on-tint without the block frame (Style B) considered + dropped — reads as "data table" not "heatmap."
- **Palette 1 (R→Y→G diverging)** — visceral / Bloomberg-y / marketing-cool. Palette 2 (cyan/amber non-judgmental) considered for honesty but rejected — TabIntro absorbs the value-judgment caveat the same way every Bloomberg/TradingView heatmap does.
- **Neutral-hold saturation curve** — 40-60 stays muted (alpha ramps 0 → 0.06), then ramps to 0.55 at the tails. `pulseCellBg(percentile)` in `PulseDashboard.tsx`. Makes extremes pop, mids fade. Linear-from-50 considered + rejected — too uniform, dilutes the "spot the outlier" use case.
- **DD column** — monotone red, depth-saturated. `ddCellBg(ddPct)` saturates at `-40%` via `Math.min(Math.abs(ddPct)/40, 1) * 0.55`.
- **Tight 26px rows** — fits ~25 rows above fold on 1080p. Comfortable 32px rejected — Pulse's value prop is "see the universe at one glance."
- **Heavy section header** — flat `--bg-elevated` background (cyan-fade gradient was first attempt, dropped after smoke-test feedback "too elegant for marketing-cool"). Row count + regime split inline (`8 rows · 6 BULL · 1 BEAR · 1 NEUT`).
- **Top banner** — PULSE title (cyan, fs-xl, letter-spacing 0.18em) + tagline + total counts split (BULL/BEAR/NEUT/macro/EXTREMES) + filter chips. Adds discoverability + "this is a product page, not a table."

## REGIME chip palette: SMMA tokens, not heatmap palette

User flagged a real visual disconnect: BULL chip = cyan (SMMA palette), heatmap "high" cell = green (status-up). Three options weighed:

- **A. Repaint chips to R/Y/G** — would override the user's customizable SMMA palette (Settings → Appearance per S9). **Wrong** because customization is silently ignored.
- **B. Repaint heatmap to cyan/rose** — cohesive but loses Bloomberg-y visceral pop. User explicitly preferred Palette 1 R/Y/G; this would walk back the design lock.
- **C (chosen). Two distinct color axes, intentionally** — REGIME = categorical state via SMMA palette tokens (user-customizable). Heatmap = continuous percentile via fixed Palette 1. They serve different semantic roles, so don't have to match. Mitigation: beef up REGIME chip presence so it self-anchors — `min-width: 84px`, padding `3px 12px`, alpha 0.28 background, border-color alpha 0.7. Reads as "the regime story" separate from "the percentile story."

This is a durable principle for future visual decisions: **state vs continuous metric** = different palettes is OK.

## Copy: "your watchlist" → "your universe"

User caught a real semantic clash. The app has a **WATCHLIST** sector_group (one of many, currently empty by default — the personal-additions slot). Pulse's banner + TabIntro initially said "your watchlist" — sounds like Pulse renders only that group. Truth: Pulse iterates EVERY ticker across EVERY sector_group + every FRED series.

Rename: "your watchlist" → "your universe" in banner tagline + TabIntro subtitle + first bullet. "Universe" is the right scale-word and doesn't collide with the WATCHLIST sidebar label. Tickers added to the WATCHLIST group will appear in Pulse under their own section header automatically — no special wiring.

## Backend architecture (`cross_section/`)

- **Top-level Rust module**, not under `analysis/`. Pulse isn't an Analysis tab; it's a top-level pinned sidebar slot. Distinct sidebar placement + likely growth of percentile-related compute justifies the separation. (Open question Q1 from `pulse_design.md` resolved.)
- **`analysis_tools` registry row included** for consistency. Cost is one seed line; gains uniform `enabled` toggle infrastructure if/when needed. (Open question Q2 resolved.)
- **No new schema tables** — Pulse uses existing `price_history`, `fred_observations`, `watchlist_tickers`, `sector_groups`. No `cross_section_cache` table for v1; add only if measured slow. (Open question Q6 resolved — "compute every open" wins.)
- **Universal-compute path bypasses `indicator_settings`.** SMMA Ribbon / RSI / ATR run with default params for every ticker via direct `find_indicator(id).compute(&bars, &json!({...defaults}))`, ignoring per-ticker enable flags + params overrides. Reasoning: cross-section reads break if half the rows use different SMMA confirm_bars or RSI lengths. (Open question Q7 resolved.)
- **Files:** `mod.rs` (types), `compute.rs` (main + helpers), `percentile.rs`, `tests.rs`, `commands/cross_section_cmds.rs`. ~430 LOC Rust + 9 unit tests.

## Coverage thresholds (per design doc)

- `<30 bars` → `no_bars: true`, row greyed, all percentile cells em-dash
- `<252 bars` (1y) → `partial_history: true`, percentile cells get a trailing `*` asterisk
- `>=252 bars` → full percentile compute

Per-FRED-series partial threshold is `<60 obs` — catches sparse-frequency series (weekly, monthly) without falsely tagging daily series with deep history.

## Section ordering bug (caught at smoke-test)

First implementation sorted leaves by `(parent.display_order ?? 0, own.display_order ?? 0)`. Top-level leaves with no parent collapsed to `(0, ...)`, sorting them *before* sub-sectors of any other parent. Result: CRYPTO appeared above INDICES_AMERICAS, FX above US_TECH, etc.

Fix:
```rust
match g.parent_id.as_ref().and_then(|pid| groups_by_id.get(pid)) {
    Some(parent) => (parent.display_order, g.display_order),  // sub-sector
    None => (g.display_order, 0),                              // top-level leaf
}
```

Top-level leaves now sort by their own `display_order` as the major key. Sub-sectors slot under their parent. Pattern: any cross-group enumeration with a hierarchical `parent_id` column needs this sort treatment. See LESSONS DB-11.

## Ticker-click navigation: ticker column only

User asked between **whole-row click** vs **ticker column only**. Picked ticker column. Reasoning:

Pulse's design doc promises hover-on-cell shows raw value + percentile + lookback + last-fetched. That tooltip behavior is part of the value prop. Whole-row click would put every cell hover one accidental misclick away from navigation. Apps that do whole-row click (Gmail, Linear, Slack) don't put per-cell tooltips inside the row — the convention doesn't transfer to Pulse.

Bloomberg HRH / TradingView heatmaps treat ticker as a hyperlink, cells as read-only data. That's the right model. CSS: `.pulse__ticker--clickable` gets cyan-on-hover + underline + cursor-pointer. Macro rows + no-bars rows render the ticker as a non-clickable `<div>` (no chart to open).

## Auto-open feature chart on land

Click handoff via localStorage matches the S17 Correlations→Pairs pattern:
- `localStorage['session.pulse_feature_chart_target'] = JSON.stringify({ ticker, dataSource })`
- `onSelectSection(row.sectorGroupId)` (prop drilled from App.setActiveSection)
- TickerDashboard reads + clears the handoff after tiles load (always-clear, even on mismatch — prevents stale handoffs hijacking later manual navigation)
- Auto-`setSelected(matchingTile)` opens the inline feature chart

Required adding `data_source` field to `CrossSectionRow` so the handoff has an exact `(ticker, dataSource)` key. Same ticker can exist under different sources; `ticker` alone isn't a primary key on `watchlist_tickers`.

App.tsx fallback: if `usePersistedState('session.active_section')` resolves to an invalid id (e.g. legacy 'scanner', user-deleted custom group), redirect to 'pulse' once `groups` loads. Effect runs on every `groups` change.

## Scanner deprecation

Honest assessment: Pulse subsumes Scanner's analytical content. Scanner's unique value reduced to:
- **PRIME button** (genuinely critical — needs new home)
- **RECOMPUTE button** (dead weight — both Scanner and Pulse already recompute on mount)
- **Raw RSI / ATR / price** (debatable — percentile lens is more useful for cross-asset)

Decision: kill Scanner, move PRIME to Pulse banner, drop RECOMPUTE entirely. PRIME-in-Pulse is contextual UX done right: button only renders when `noBarsCount > 0`, tied directly to the user's "why are these greyed?" moment.

Dropped from sidebar: `'scanner'` removed from `PINNED_IDS` in Sidebar.tsx. Dropped from App.tsx SectionView. Soft-deleted via `UPDATE sector_groups SET user_hidden = 1 WHERE id = 'scanner'` in seed.sql so existing DBs hide it on next boot. INSERT for fresh installs no longer includes the scanner row.

Files preserved one release: `Scanner.tsx`, IndicatorScanner component, `scanner_snapshot` IPC. Easy revert if a use case emerges. Delete in v1.3 cleanup.

DESIGN.md feature #10 ("Multi-ticker scanner") is now superseded by Pulse — same rationale that killed feature #5 (Watchlist Performance) in S10.

## PRIME failure surfacing

Old: `Primed 0 · 1 failed` — silent about which ticker. Prime tooltip lied: "Fetch missing price history for greyed rows" but PRIME can't help when the symbol itself is invalid (e.g. HIVE.TO is on the TSX Venture as HIVE.V, not TSX as HIVE.TO).

Two fixes shipped (option 1 + 2 from a 3-option weighing):
1. `result.failures: Array<{ticker, error}>` rendered as a list under the prime-status strip — one row per failure with monospace ticker + error message + hint about exchange-suffix mismatch.
2. Tooltip rewritten: "Fetch missing price history. Tickers that fail (typically because the symbol isn't on the data source) are listed below the banner."

Option 3 (persisted `last_fetch_error TEXT` column on `watchlist_tickers`) considered for v1.3 — would survive across sessions, no re-PRIME needed to see the error. Schema work + fetcher modifications kept it out of v1.2.

## Light theme: deferred

User asked at session end "is this a good time?" Answered no:
- S15 token markers (`/* [L] */`) are *structural* readiness, not a designed light palette.
- Real light theme = 2-session arc: design palette + per-component audit + ECharts re-tuning + heatmap saturation curve re-tuning for white backplate.
- Identity tradeoff — the Pulse "marketing-cool" Bloomberg aesthetic was just polished to enhance dark mode. Light mode would dilute it. Marketing screenshot is dark.
- No demand signal — RC1 cold-eye feedback hasn't landed.
- Better next sessions: Vol Cone / Return Distribution / Seasonality / Anchored VWAP / MACRO-tile retrofit / CoinGecko fetcher / M9 features.

Queue light theme for post-RC1 if feedback raises it.

## Files

**New (Rust):**
- `src-tauri/src/cross_section/mod.rs` — types + module declarations
- `src-tauri/src/cross_section/compute.rs` — main entry + helpers (~280 LOC)
- `src-tauri/src/cross_section/percentile.rs` — `percentile_rank` helper
- `src-tauri/src/cross_section/tests.rs` — 9 unit tests
- `src-tauri/src/commands/cross_section_cmds.rs` — IPC wrapper

**New (Frontend):**
- `src/types/cross_section.ts` — IPC contract types
- `src/components/pulse/PulseDashboard.tsx` — single-file Pulse view (~430 LOC)

**Modified (Rust):**
- `src-tauri/src/lib.rs` — module declaration + IPC handler registration
- `src-tauri/src/commands/mod.rs` — module declaration
- `src-tauri/src/db/seed.sql` — `pulse` analysis_tools row, scanner removed from sector_groups INSERT, scanner row UPDATE'd to user_hidden=1

**Modified (Frontend):**
- `src/App.tsx` — pulse routing, scanner unrouting, stale-section fallback, setActiveSection prop drill
- `src/components/Sidebar.tsx` — PINNED_IDS = ['pulse', 'analysis', 'macro', 'news']
- `src/components/TickerDashboard.tsx` — Pulse handoff consumption on tile load
- `src/styles/app.css` — full Pulse stylesheet (~280 LOC of `.pulse__*` classes), prime status + failures styling, ticker-clickable affordance

**Deleted:**
- `src/components/pulse/pulseSampleData.ts` — visual prototype's hardcoded data
