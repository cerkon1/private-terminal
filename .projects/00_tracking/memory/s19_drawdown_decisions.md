---
name: S19 Drawdown subpane + Features tab rewrite decisions
description: First FeatureChart enhancement (drawdown subpane), watermark pin fix, Features-tab full rewrite, and the SMMA Base / AUTO Y diagnosis.
type: project
---

# S19 — Drawdown subpane + watermark pin + Features-tab rewrite

Master at `7fd94ec` after S19. Pure frontend session — no backend, no
FRED series, no schema changes. Two commits, fast-forwarded to master.

## Decisions locked

### Drawdown lives in the toolbar, NOT in IndicatorPanel
- **Why:** Considered the conceptual case for grouping with RSI/ATR
  (all are "subpane series computed from price"). Persistence + compute
  shapes don't fit cleanly: indicators are Rust-computed + per-ticker
  via `indicator_settings`; drawdown is TS-computed + global. Forcing
  it into the indicator framework would add a Rust module that just
  delegates running-max math (dumb).
- **How to apply:** New chart-level toggles like Drawdown ship as
  toolbar buttons alongside AUTO Y / VOL / VRVP. Persisted as
  `session.feature_chart_show_<x>`. Revisit IndicatorPanel placement
  only if the toolbar gets crowded with multiple subpane toggles
  (Vol Cone, Return Distribution, etc).

### Drawdown sits directly below price, above volume + indicators
- **Why:** Drawdown is conceptually about price, not about volume or
  indicators. Stacking it next to price keeps the related panes
  visually adjacent.
- **How to apply:** Pane-index math refactored from per-toggle
  conditional offsets to a sequential `nextPaneIdx++` accumulator —
  toggling a fixed pane on/off increments the cursor; subpane
  indicators (RSI, ATR, ...) follow at `subpaneStartIndex`. Adding a
  future fixed subpane drops in as one new
  `const x = showX ? nextPaneIdx++ : -1` line, not a per-toggle
  cascade rewrite.

### Watermark pinned to price-grid centre, not chart-container centre
- **Why:** Was `top: 'middle', left: 'center'` — chart-container
  geometric centre. With multiple subpanes on, the chart's centre
  slides DOWN into the indicator stack. "Microsoft" ended up
  bisecting RSI lines instead of sitting behind the candles.
- **How to apply:** `watermarkGraphic(text, fontSize, gridCenter?)`.
  Candlestick path passes `{ leftPct: 50, topPct: parseFloat(grids[0].top) + parseFloat(grids[0].height)/2 }`.
  Line mode (single pane) keeps the original chart-centre default by
  passing no `gridCenter` arg. Horizontal centre stays at 50% — the
  `left:60 / right:24` (px) offsets are tiny relative to typical
  chart widths so the bias is negligible.

### Y-axis name labels on subpanes — TRIED + REVERTED
- **Why:** Spec'd as "subpane labeling" via ECharts native `yAxis.name`
  (rotated text in gutter). User flagged on first render: "looks odd
  I don't like it." Reverted same session.
- **How to apply:** Don't add `yAxis.name` to subpane axes. The
  Features tab + toolbar tooltips already cover the discoverability
  gap. If labeling becomes necessary later, prefer the corner-graphic
  approach (small text in pane corner via `graphic`, like RRG quadrant
  labels) over rotated y-axis names.

### Features-tab structural pattern
- **Why:** Tab grew from 7 cards to 19 cards (subpanes + entire v1.1
  Analysis surface). A flat scroll at 19 was visibly long during
  smoke; section headers add scannability without much code cost.
- **How to apply:** Insert `<div className="settings-subhead">` rows
  between groups of related cards. Sections used: Chart Overlays &
  Subpanes / Indicators / Analysis Section / Dashboard & Layout / Tips.
  No new CSS — the `.settings-subhead` class already exists from the
  Tips header.

### Feature-card content style guideline
- **Why:** Mixed-length cards in the original tab made the long ones
  feel padded. Don't force every card into the same template.
- **How to apply:** `What:` mandatory. `Where:` mandatory (so users
  can find it). `Caveat / Liability / Origin / Tip` only when
  meaningful — short cards stay short. Analysis-section cards stay
  succinct because each tab carries its own `<TabIntro>` disclosures
  with the deep explanation.

### SMMA Ribbon "Base" / AUTO Y interaction is a documented feature, not a bug
- **Why:** User reported clicking "Base" in the chart legend used to
  drop the SMMA Ribbon to the x-axis as state-coloured hills/valleys;
  now it disappears. Investigation: SMMA emits 4 stacked series from
  Rust (Base = `min(v1, v2)` transparent lifter + Bull/Bear/Neutral
  Bands = `|v1-v2|` matched-state-only). Click Base off → stack
  collapses → bands stack from y=0 → bands at y=0-5 fall below AUTO Y's
  price range ($290+ for MSFT) → invisible. **NOT a regression** from
  this session — verified via `git diff master --stat` that none of
  the S19 changes touched the SMMA series push, the legend, the VRVP
  wiring, or the price y-axis bounds. The behaviour is intrinsic to
  ECharts stacking + the AUTO Y bounds added in S11 (M8.6).
- **How to apply:** Documented via Tip line in the SMMA Ribbon Features
  card: "Click Base in the chart legend (with AUTO Y off) to drop the
  bands to the x-axis and see the state-coloured hills / valleys laid
  out independent of price." User confirmed the workaround works
  (screenshot `Screenshot 2026-05-02 085740.png`). Don't try to
  auto-extend the price y-axis to include band heights — that would
  change AUTO Y's contract for an edge-case interaction.

## VRVP safety checklist (for future chart polish)

S19 reaffirmed three rules to preserve VRVP (EC-11 / EC-12):
- Never share VRVP's xAxisIndex with another time-series series — its
  dedicated value-axis (range `[0,1]`, decoupled from the time-axis
  dataZoom) is the only thing keeping ECharts from culling its data
  points off-screen.
- Keep `tooltip: { show: false }` on the VRVP series — `silent: true`
  alone doesn't block the chart-wide axis tooltip from iterating
  every bin.
- Keep VRVP at `z: 15` (above candles at `z: 10`). If a future series
  needs to render above the candles, choose `z` carefully relative to
  VRVP — don't bump VRVP down.

## Smoke-test outputs

Three screenshots in `.projects/01_initial_design/screenshots/`:
- `Screenshot 2026-05-02 081808.png` — drawdown subpane on MSFT, toolbar
  showing DD toggle active. First post-fix render.
- `082036.png` — MSFT with VOL + VRVP + DD + RSI + ATR all on. Captured
  the watermark drift problem that drove the price-grid pinning.
- `085740.png` — SMMA Ribbon Base toggled off with AUTO Y off, showing
  the state-coloured hills/valleys at chart bottom (the user's
  remembered "fall to x-axis" behaviour, restored by AUTO Y off).

## Future polish parked

- **Per-pane corner-graphic labels** ("DRAWDOWN" / "VOLUME" / "RSI" small
  text in pane corners via ECharts `graphic`, RRG-quadrant-style).
  Alternative to the rejected `yAxis.name` approach. Low priority —
  Features tab + tooltips cover the discoverability need.
- **Watermark fontSize auto-scaling** based on price pane height. With
  many subpanes on, the price pane shrinks; fontSize 96 may dwarf a
  small pane. v1.2 polish.
- **DD button promotion to IndicatorPanel.** Revisit if chart toolbar
  becomes crowded with future subpane toggles.
- **Vol Cone / Return Distribution / Seasonality / Anchored VWAP.** The
  next FeatureChart enhancements per design doc. Each ~1 evening using
  the same `nextPaneIdx++` pattern.
