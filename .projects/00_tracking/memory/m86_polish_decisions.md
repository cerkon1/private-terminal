# M8.6 Polish — design decisions (S11, 2026-04-25)

Six-item polish pass after M8.5. Initial scope was five items; log mode shipped then dropped after live testing exposed ECharts limitations.

---

## Rename to Private Terminal — user-visible only

User-facing strings updated everywhere:
- `App.tsx` header: `PERSONAL TERMINAL → PRIVATE TERMINAL`
- `AboutTab.tsx`: heading + first sentence
- `index.html` `<title>`
- `tauri.conf.json`: `productName` + window title
- `package.json` description
- `src-tauri/Cargo.toml` description

**Internal names kept** — the user has live data in `%APPDATA%\Roaming\personal-terminal\` and renaming would orphan it:
- Cargo package name: `personal-terminal`
- Lib name: `personal_terminal_lib`
- Binary name: `personal-terminal.exe`
- Tauri identifier: `com.personal.terminal`
- Data dir folder: `personal-terminal/`
- DB filename: `personal-terminal.db`

If a future major rebrand is warranted, add a one-time migration: copy `%APPDATA%\Roaming\personal-terminal\personal-terminal.db` → `<new-folder>\<new-name>.db`, write a tombstone in the old folder. Don't ship that without explicit user opt-in.

**Why "Private" not "Personal":**
- Brand-family pull with PrivateACB (the user's flagship product this app is built to promote).
- "Terminal" word retains the Bloomberg-killer aesthetic (vs. "Dashboard" which is generic).
- Accept the privacy-implication risk (no auth/encryption features) — About tab clarifies "Private = local, single-user, no cloud."

---

## Market-hours strip — direction coloring

Exchange → main-index mapping is hardcoded in `commands/ticker_cmds.rs::EXCHANGE_INDEX_MAPPING`:

```
NYSE → ^GSPC      (S&P 500)
TSX  → ^GSPTSE    (S&P/TSX Composite)
LSE  → ^FTSE      (FTSE 100)
TYO  → ^N225      (Nikkei 225)
HKG  → ^HSI       (Hang Seng)
SSE  → ^SSEC      (Shanghai Composite)
ASX  → ^AXJO      (S&P/ASX 200)
KRX  → ^KS11      (KOSPI)
```

This is **editorial**, not user data. The choice of "the index that represents this exchange" is a curation decision — users editing their watchlist shouldn't change what the strip displays. Lives in Rust (not in DB) for that reason.

**IPC: `list_market_index_quotes() → Vec<MarketIndexQuote>`.** Read-only against `quote_cache`; doesn't trigger fetches. Quotes refresh through the existing INDICES dashboard flow (user-driven). Strip falls back to neutral-gray coloring when no quote is cached yet.

**Visual decoupling:** outline color = direction since last close (always shown — what traders care about even when the desk is closed); cyan dot = OPEN status (independent — separate "is the desk live" signal). Bloomberg pattern.

Direction thresholds: `pct > 0.05% = up`, `pct < -0.05% = down`, else `flat`. The 0.05% deadband prevents jittering between up/flat for nearly-flat sessions.

**Refresh cadence:** mount + every 5 min in the strip itself. Cheap (read-only DB lookup); no rate-limit concerns.

---

## FeatureChart viewer state

Two persistent toggles introduced in S11 — user-customizable via toolbar buttons in the chart's top-right corner:

**`session.feature_chart_autofit` (default `true`).**
- Listens to ECharts `datazoom` event, reads current `start/end` from `chart.getOption().dataZoom[0]`, dedupes (skip if delta < 0.01%), pushes to `visibleRange` state.
- Helpers in `FeatureChart.tsx`: `sliceVisibleBars`, `priceLowHigh`, `subpaneSeriesLowHigh`, `padBounds(_, 0.03)`.
- Price pane and ATR-style subpanes auto-tighten with 3% headroom. Volume pane stays at `min: 0` (volume bars need 0-baseline). RSI pane stays fixed `[0, 100]` (indicator's whole semantic).
- Off = stable Y across all data — useful for spotting tighter periods relative to history.

**`session.feature_chart_show_volume` (default `true`).**
- Structural rebuild: `volumePaneIndex = showVolume ? 1 : -1`, `subpaneStartIndex = showVolume ? 2 : 1`. Indicator subpane indices shift down by one when VOL is off.
- `layoutGrids(paneCount)` rewritten: original ratio-based formula gave price 62% regardless of pane count, so toggling VOL only freed the 2% inter-pane gap. Now: non-price panes are fixed slim 12% each, price absorbs remainder.
- New distribution: 1 pane = 86%, 2 panes = 72%, 3 panes = 58%, 4 panes = 44% to price.

Both states are **global** (apply to all open feature charts). User confirmed: per-chart override would add state for marginal benefit. Single global toggle is simpler.

---

## Log Y-axis — three failures + drop

Initial scope included a `LIN/LOG` button (Y2). Implemented, hit problems, attempted three fixes, finally dropped.

### Why log mode failed in ECharts

**Failure 1 — squashing.** Default ECharts log axis ticks at `base^k` only. For BTC's $30k–$70k range, no power of 10 falls inside, and the visible range stretches to enclose `[10000, 100000]`. Real price action squashes into a narrow vertical sliver between two ticks.

**Failure 2 — `scale: true` interference.** Inheriting `scale: true` from the linear baseAxis confuses log-axis tick generation when combined with explicit min/max bounds. ECharts silently reverts to default 1–10 display with no data visible. Setting `baseAxis.scale = undefined` doesn't fully clear it (property still present in object).

**Failure 3 — SMMA Ribbon stacked envelope poisons log range.** Bull/Bear/Neutral Band components carry value 0 on bars not matching their state. Linear stacking hides this (`0+0+delta+0 = delta`); on log axis, `log(0) = -Infinity` → axis range collapses to 1–10. Even after suppressing the stack rendering in log mode, the underlying series data still affects range computation.

### Why we didn't fight harder

TradingView's working log mode uses round-number ticks (60k/70k/80k/…) at log-spaced positions — **not** a default ECharts feature. To replicate requires either:

- **Path (a):** custom `axisLabel.interval` + tick generator. Possible but ECharts log-axis tick logic is opaque; high implementation risk.
- **Path (b):** manual `Math.log10()` transform on data points + render on `type: 'value'` axis with custom `axisLabel.formatter` showing `10^value`. Full control. Requires transforming candle OHLC arrays + SMMA Ribbon series (filter zeros). ~2-3 hour scoped feature.
- **Path (c):** chart-library swap (Lightweight Charts has working log out of the box). 1.5–2 weeks; loses ~2 weeks of M6+M8.6 ECharts investment for a single-feature gap. Rejected.

User decision: drop log entirely for v1. Path (b) tracked in PROGRESS.md → Discovered as the proper v1.1 implementation.

### What was removed

- `LIN/LOG` toolbar button
- `yScale` state + `usePersistedState('session.feature_chart_yscale')`
- All log branches in `buildCandlestickOption` (axis config, suppressStack flag, legend filter)
- The orphaned `session.feature_chart_yscale` config row stays in user DBs harmlessly — no code reads it now. If we ever revisit, choose a fresh key name to avoid stale-data interactions.

---

## Volume Profile (VRVP) — parked for v1.1

Discussed during S11; not implemented. Tracked in PROGRESS.md → Discovered.

**What it is:** right-margin horizontal histogram showing how much volume traded at each price level across the visible window. Identifies HVN (high-volume nodes — support/resistance), LVN (low-volume nodes — price moves through), POC (point of control — single highest bar), Value Area (~70% volume band).

**What it needs:**
- Backend: `compute_volume_profile(ticker, dataSource, startPct, endPct, binCount) → Vec<{priceLow, priceHigh, volume}>`. Pure SQLite query against `price_history` — no fetches. Distribute each bar's volume across the bins it covers (cheap: 100% to close-bin; honest: proportional across `[low, high]`). ~30 lines of Rust.
- Frontend: subscribe to `datazoom` event (already done for AUTO Y), recompute profile when window changes. Render via ECharts side-grid `bar` series (cleanest data model) OR `custom` series in price pane (more flexible) OR `graphic` API overlay (quickest hack).
- ~1 weekend feature.

Scope for v1.1, not v1.

---

## Course corrections in-session

- **Slider snap-back.** First version of dataZoom config kept hardcoded `start: defaultStartPct, end: 100`. Every option rebuild snapped slider back to default window. Fix: read `visibleRange.start/end` in dataZoom config so option rebuilds preserve the user's drag position. Captured as **EC-9** in LESSONS.
- **Volume toggle didn't grow price pane.** Original `layoutGrids` ratio-based formula gave price ~62% regardless of pane count. Hiding VOL only freed the 2% inter-pane gap. Fixed pane-height layout — non-price slim, price absorbs remainder. User flagged via screenshot.
- **Log mode three failures** — see "Log Y-axis" section above.
- **`get_db_info` size mismatch** — pre-existing from S10 fix; reaffirmed user value of consistent total-footprint reporting.

---

## Touched-file map

Backend:
- `src-tauri/src/commands/ticker_cmds.rs` — `EXCHANGE_INDEX_MAPPING` + `list_market_index_quotes`.
- `src-tauri/src/lib.rs` — register new command.
- `src-tauri/Cargo.toml` — description rename.
- `src-tauri/tauri.conf.json` — productName + window title.

Frontend:
- `src/styles/tokens.css` — font-size bumps.
- `src/components/MarketHoursStrip.tsx` — quotes fetch + direction classes.
- `src/components/charts/FeatureChart.tsx` — toolbar, AUTO Y + datazoom listener, volume toggle structural rebuild, helpers (sliceVisibleBars, priceLowHigh, subpaneSeriesLowHigh, padBounds, layoutGrids rewrite).
- `src/components/App.tsx` — header rename.
- `src/components/settings/AboutTab.tsx` — heading rename.
- `src/styles/app.css` — market-chip direction styles, feature-chart toolbar.
- `index.html` — `<title>`.
- `package.json` — description.

No DB schema changes. No new dependencies. Migration list unchanged.
