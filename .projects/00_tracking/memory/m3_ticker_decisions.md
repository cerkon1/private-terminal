---
name: M3 ticker / sidebar design decisions
description: Five tradeoffs locked for M3 (Yahoo tickers + INDICES + US EQUITIES + sidebar + market-hours). Most are deferrals that need explicit revisit before later milestones.
type: project
---

Five tradeoffs resolved before M3 implementation (2026-04-24, S4). Most of these are deliberate deferrals — capture them here so they don't silently rot into forgotten promises.

### 1. No sparklines on ticker tiles in M3 — deferred
Yahoo's `/v7/finance/quote` batch endpoint does not return sparkline data. Adding them means 10–25 extra `/v8/finance/chart` calls per refresh.

- **Why defer:** YoY delta + click-through to feature chart covers the trend-at-a-glance need. Adds HTTP cost that isn't justified by M3's goals.
- **How to apply:** Revisit after INDICES + US EQUITIES land clean. When adding sparklines, batch the chart-endpoint calls with the same semaphore pattern as FRED (cap 6) and cache in `price_history` — tile render reads last 7 days from the cache, no separate column needed.

### 2. Quote cache TTL = 15 minutes flat (no adaptive market-hours logic yet)
M3 uses a single 15-min TTL on `quote_cache`, same pattern as FRED's 12h but shorter.

- **Why defer adaptive:** DESIGN.md specifies 5 min market-hours / 1 hour off-hours. That requires the market-hours logic in the fetcher scheduler, which couples two M3 subsystems and adds test surface. Flat TTL gets us to parity with the M2 pattern.
- **How to apply:** When `MarketHoursStrip` is battle-tested (say M4 after CA equities land), promote its timezone logic into `is_market_hours()` helper on the Rust side and add an adaptive TTL path to ticker commands.

### 3. INDICES rendered as a flat grid — no region tabs in M3
All 15 world indices shown in one grid, sorted by `display_order`.

- **Why defer:** Americas/Europe/Asia-Pacific tabs mirror the MACRO CategoryTabs pattern but aren't needed until the grid gets dense enough to hurt. 15 tiles fit in one visual scan.
- **How to apply:** If the grid feels crowded or the user wants geographic drill-down, add a `region` column to `watchlist_tickers` (or reuse `category`) and hand it to the existing `CategoryTabs` component. Don't build a separate tab component — the MACRO one is reusable.

### 4. Sidebar shows unbuilt sections greyed out, not hidden
CRYPTO, CA EQUITIES, FUTURES & FX, NEWS are seeded into `sector_groups` with `enabled=0`. Sidebar renders them at reduced opacity with a "Coming in Mx" tooltip.

- **Why:** Shows the roadmap. Prevents a future where a section is silently skipped because nobody remembers to add it to the sidebar. Reinforces the extensibility-first principle — sidebar is data-driven, sections come online by flipping `enabled`.
- **How to apply:** When a new section lands (e.g. M4 CA EQUITIES), flip `enabled=1` in the seed and remove the disabled styling at render time. No sidebar component changes needed.

### 5. Market-hours strip placement: TOP of app shell
Between `.app-header` and `.app-main`.

- **Why:** "Is the market open?" is a first-glance check — aligning with the `PERSONAL TERMINAL` title block is more scannable than tucking it below the fold.
- **How to apply:** Strip is one row, ~32px tall, 8 exchange chips (NYSE / TSX / LSE / TYO / HKG / SSE / ASX / KRX). Pure frontend TZ math via `Intl.DateTimeFormat`, updates every 60s. Don't migrate it to bottom without a reason — moving it after users learn its position costs more than it saves.

---

### Deferred items to revisit explicitly (not "just M3 scope")
These are listed here so future milestones can triage them against actual friction, not forget them:
- Sparklines on ticker tiles → when batch chart-fetch pattern exists
- Adaptive quote TTL (5m/1h) → when `MarketHoursStrip` logic is promoted server-side
- INDICES region tabs → when grid density warrants
- US EQUITIES sub-sector grouping (today it's a flat top-10) → if/when user extends the watchlist beyond mega-cap
- Cross-platform icons (Mac/Linux builds) → beyond M8 polish; Windows placeholder from PrivateACB still in place
- **Time-range switch on ticker tiles** (1D / 1W / 1M / YTD / 1Y) — heatmap color + change text both driven by the selected range. Deferred during M3 S4 when 24h heatmap landed; user explicitly wants this. Best target: solve once during M5 (CRYPTO) or M9 (watchlist-performance) since both domains need the same switch. Requires `price_history` lookback queries on the Rust side (`get_change_for_range(ticker, range)`) and a `RangeSwitch` component in `TickerDashboard`. Existing 24h heatmap is the "1D" option already — widening just needs the other four.
