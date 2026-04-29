# S12 release-blocker pass — decisions (2026-04-25)

Captures durable design / implementation decisions made in S12. See PROGRESS.md S12 entry for the change log; this file is the "why" record for future sessions.

## VRVP overlay (release blocker #3)

### Scope
- **Ticker feature charts only.** MACRO is line mode (no volume); sparklines too small; multi-ticker overlay (M9, not built) doesn't have a "whose volume?" answer.
- **Auto-suppress when visible window has zero volume.** DXY / FX have null/zero volume from Yahoo. Toggle still cycles state, but no overlay renders. Same pattern as the volume pane (M8.6) showing nothing meaningful for those tickers.
- **Default ON.** Discoverable on first launch; one click to dismiss permanently.

### Approach B chosen over Approach A
Prototyped both behind a 3-state cycling button (`vrvpMode: 'off' | 'A' | 'B'`) and tested live on real BTC-USD data with SMMA Ribbon overlap. Decision drivers:
- B feels "calmer" — translucent overlay reads as a sublayer; A's dedicated side panel reads as a separate Bloomberg-style instrument.
- B preserves existing layout: no `layoutGrids` rewrite, no slider-position pinning, no axisPointer-link surgery.
- A's appeal was Bloomberg-y dedication; B won on integration-with-existing-flow.

### The dedicated value-axis pattern (the fix that stuck)
Initial impl anchored each bin's data point to `bars.length - 1`. This is in the time-axis category coordinate system. ECharts' dataZoom culls custom-series renderItem calls when the data point's xAxis value falls outside the visible window, **even with `clip: false` set** — `clip` only controls *output* clipping, not upstream visibility filtering.

Two intermediate fixes failed:
1. Dynamic anchor at `Math.ceil((visibleRange.end / 100) * bars.length) - 1` — worked for right-handle drags but finicky on mid-window pans (ECharts' internal visibility math vs. our slice math diverged by 1-2 indices in some configurations).
2. (no second attempt — went straight to the dedicated axis).

**Final pattern: dedicate a hidden value-axis on grid 0**, range `[0, 1]`, anchor every data point at `0.5`. Decouples VRVP from the time-axis dataZoom entirely. `vrvpXAxisIndex` excluded from `dataZoom.xAxisIndex` and from `axisPointer.link`. renderItem fires for every bin regardless of slider position. This pattern is reusable for any future overlay that needs to render in price-pane pixel space without inheriting time-axis filtering.

See LESSONS EC-11 for the gotcha summary.

### Tooltip suppression
`silent: true` only blocks mouse-event triggers on the series. The chart-wide axis tooltip (`trigger: 'axis'`) iterates every series at the cursor position regardless of silence — it would list every VRVP bin in the tooltip. Fix: `tooltip: { show: false }` on the VRVP series. See LESSONS EC-12.

### Bin count: 50 → 180
Initial 50 bins looked chunky vs. TradingView/Bookmap reference shots. 180 lands close to the "fluid silhouette" feel without paying perceptible compute cost. Trivial frontend bin computation in `computeVrvpBins(visibleBars, 50→180)`. Bumping further (e.g., 300) starts fighting the 0.5px inter-bar gap; not worth it without also dropping the gap.

### What was NOT shipped (parked for v1.1)
- Bull/bear color split (red/green stacked per bin). Pro-tool convention but a heuristic — OHLCV doesn't tell us the actual aggressor; `close > open` ≠ "buyers won." ~30 LOC if added. Surfaced honest caveat to the user.
- Per-bar hover tooltip (price range / volume / % of POC / bar count). Custom formatter that splits axis-tooltip vs item-tooltip. ~30 LOC.
- HVN/LVN multi-tier highlighting (top-N bins brighter, bottom-N dimmer). POC highlight only in v1.
- TPO-style spread (one bar's volume distributed across its high-low range). Close-bucketing only in v1.

### Code anchors
- Helper: `computeVrvpBins(bars: CandleBar[], binCount: number) → VrvpData | null` at `FeatureChart.tsx` module scope.
- Series push: inside `buildCandlestickOption`, after subpane indicator series.
- Constants: `VRVP_BIN_COUNT = 180`, `VRVP_OVERLAY_RATIO = 0.18`.
- POC fill: `rgba(250, 204, 21, 0.55)` (translucent yellow). Bar fill: `rgba(148, 163, 184, 0.32)` (translucent gray).

## Header Layout D + StatusBar repurpose

### Why Layout D (not A/B/C)
A: single inline row felt cramped on long paths.
B: two-row header with both branding + tagline + DB info — visually balanced but lots of chrome.
C: middle-truncated path inline — saves space but loses path readability.
**D: two rows, branding row + DB-info row, NO tagline** — cleanest. Bloomberg-like product name + active-context line, no marketing copy.

### DB info promoted from footer to header
Moved from bottom `StatusBar` to top `AppHeader`. The path is now the canonical user-visible reference for "where is my data" — settings tabs that previously hardcoded `%APPDATA%\...` (which could lie after M8.5 `move_database`) now reference the header instead.

### StatusBar new role
Centered cross-promo: `v{APP_VERSION} · Provided for free by the folks at PrivateACB.com`. Footer becomes a brand-family signal rather than a status display. Link via `tauri-plugin-opener` `openUrl`.

### Version constant
New `src/version.ts` exporting `APP_VERSION = '0.1.0'`. AboutTab + StatusBar both consume it. Bump comment notes the three places to update on release: `package.json`, `src-tauri/Cargo.toml`, `src/version.ts`. We don't auto-import from `package.json` because Vite JSON imports increase bundle size and the manual sync friction is acceptable for an app with infrequent version bumps.

## Settings restructure

### Tab order: API Keys / Appearance / News Feeds / Storage / Features / About
- About slimmed to product/maker info + PrivateACB cross-promo card. Tips & shortcuts moved to Features.
- Features tab is the new canonical home for "what does this app do" documentation — 7 cards covering each user-facing system.
- ApiKeysTab help paragraph dropped its hardcoded path string; now references the header.

### SMMA Ribbon attribution policy (in user-facing copy)
- Cite Bill Williams' Alligator (1995, *Trading Chaos*) — math derivative.
- Cite Welles Wilder's RMA (1978, *New Concepts in Technical Trading Systems*) — SMMA primitive source.
- **Never** mention "Larsson Line" or trendscope in user-facing UI.
- Liability framing kept: "Decision support, not investment advice."
- Caveat block kept: "Most useful on tech equities and cryptocurrencies on 4-hour through monthly timeframes. Not designed for commodities, FX, or intraday HFT."

The historical name change (Larsson Line → SMMA Ribbon, S7) and the trendscope code-port lineage are internal context (CLAUDE.md, MEMORY.md, m6_indicator_rename.md). Public copy attributes only to the public-domain technical-analysis sources.

## Tier 1 ECharts polish

### PNG save button
- Renders in toolbar for both line and candle modes (toolbar previously was candle-only).
- Filename: `<safeTitle>-<YYYY-MM-DD>.png`. Title sanitized via `replace(/[^\w\d-]+/g, '-').replace(/^-+|-+$/g, '')`.
- `pixelRatio: 2` for retina-sharp output. `backgroundColor: '#0a0e14'` to match app theme (without this the export has a transparent bg that looks broken when pasted into light contexts).
- Flash feedback: "✓ saved to Downloads" pill next to button for 1.5s. New `.feature-chart__flash` CSS rule using `--status-up` color.

### Watermark via `graphic` component
- Centered text using the chart's `title` prop. `silent: true`, `z: 0` (behind everything).
- `fill: rgba(229, 231, 235, 0.05)` (5% white, very faint).
- `fontSize: 96` for candle mode (titles short — ticker symbols), `fontSize: 56` for line mode (FRED titles run long).
- Helper `watermarkGraphic(text, fontSize)` at module scope.

## `cargo clean -p` overcorrection

Late in session, user reported old icons in dev mode. Diagnosis: debug binary stale from before the icon swap; tauri-build's resource step hadn't re-run because no Rust source had touched.

Ran `cargo clean -p personal-terminal` to force a clean rebuild. **Wiped 13.4 GiB / 11,169 files** — `cargo clean -p` is non-selective, removes per-package compilations of every dependency, not just the named package.

Better alternatives next time:
1. `touch src-tauri/build.rs` — forces build.rs to re-run + tauri-build's resource step + a binary relink. Doesn't recompile dependencies.
2. Delete just the debug binary (`rm src-tauri/target/debug/personal-terminal.exe`) — Cargo will rebuild only what's needed.

See LESSONS TB-5.
