---
name: M2 dashboard design decisions
description: Four architecture decisions locked for M2 (macro dashboard) that shape how M3+ tiles/charts/heatmaps/navigation are built
type: project
---

Four tradeoffs resolved before M2 implementation (2026-04-24, S3). All chose the simpler/atomic option.

### 1. Batch FRED fetch via `list_macro_tiles()`, not 18 parallel `invoke()` calls
Server snapshots cache under mutex, identifies stale series, fetches those in parallel with a tokio semaphore cap of **6 in-flight FRED requests**, returns one atomic array.

- **Why:** Single round-trip; single DB mutex touch; atomic dashboard view. FRED has no documented rate limit but 6 is polite for first-boot cold-cache storms.
- **How to apply:** Reuse this batch-command + capped-concurrency pattern for every source that needs many tiles fetched together (Yahoo batch quote in M3, CoinGecko in M5). Keep per-tile `get_fred_tile`-style commands only for on-demand single fetches (e.g. feature chart open).

### 2. No sparklines on MACRO tiles in M2 — sparklines land in M3 on ticker tiles
MACRO tile shows: value + units + obs date + YoY delta. Full history only reached via feature chart (tile click).

- **Why:** FRED series are slow-moving (monthly unemployment, quarterly GDP). Sparkline adds noise, not signal. ~2h of code with no learning payoff.
- **How to apply:** When M3 lands Yahoo tickers, sparklines go in (they're in the schema as `quote_cache.sparkline_7d`). Don't retrofit MACRO tiles with sparklines unless a specific reason emerges — the YoY delta + heatmap mode already give trend at a glance.

### 3. Heatmap view is a toggle on MACRO dashboard, not a separate route
Header button toggles "VALUES / HEATMAP". Heatmap mode replaces the value with colored YoY% (color intensity scales with |YoY|, green up / red down).

- **Why:** A dedicated route is wasted complexity before sidebar navigation exists (M3). Toggle reuses the same grid + tile component; one prop flip.
- **How to apply:** When M3 adds the sidebar, MACRO remains one sidebar entry — the heatmap toggle stays local to the dashboard view. Do NOT promote it to a sibling route.

### 4. Feature chart = inline overlay on tile click, not modal or split panel
Click tile → it expands to cover the main pane; back button returns. ECharts instance registers into `connect('macro')` group so future multi-chart views get linked cursor (feature #6) "for free" — no extra wiring needed per chart.

- **Why:** Zero modal-library dependency. Single-open-chart UX matches M2's scope; multi-chart payoff of `connect()` unlocks whenever multi-chart UI is added (M3 overlay, M9 multi-ticker).
- **How to apply:** Every new ECharts instance must call `echarts.connect('macro')` (or a scoped group id) at init. This is the substrate for feature #6 linked cursor — it costs one line per chart and pays off later without refactors.
