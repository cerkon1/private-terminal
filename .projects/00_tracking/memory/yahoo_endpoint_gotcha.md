---
name: Yahoo Finance endpoint — /v7 blocked, /v8 works
description: As of late 2025 Yahoo's /v7/finance/quote returns HTTP 401 without crumb-cookie auth; /v8/finance/chart remains open and supplies both live quotes (meta payload) and historical bars
type: reference
---

Yahoo's unofficial finance API shifted auth requirements in 2024–2025. Current state (confirmed 2026-04-24 S4):

- **`/v7/finance/quote?symbols=...`** — returns `HTTP 401 {"code":"Unauthorized","description":"User is unable to access this feature"}` without the full cookie+crumb auth flow (fetch finance.yahoo.com, extract `A1`/`A3` cookies, GET `/v1/test/getcrumb`, then pass `crumb=` on every request).
- **`/v8/finance/chart/{symbol}?range=X&interval=Y`** — still works with just a browser-like User-Agent. Response `chart.result[0].meta` contains `regularMarketPrice`, `previousClose`, `chartPreviousClose`, `regularMarketVolume`, `currency`, `symbol`. `chart.result[0].indicators.quote[0]` contains the OHLCV arrays aligned with `timestamp`.

**Applied fix in `src-tauri/src/sources/yahoo.rs`:**
- `fetch_quote(symbol)` wraps `get_chart(symbol, "1d")` and reads `meta` — no batch, one call per symbol. `ticker_cmds::list_ticker_tiles` parallelises via `tokio::sync::Semaphore` cap 6.
- `fetch_chart(symbol, range)` reads bars for the feature chart.
- Market cap is NOT returned by the chart endpoint. We accept the loss; fetching it would require crumb auth or a per-symbol `quoteSummary` call.

**If this breaks again:** consider implementing crumb auth (two extra HTTP calls on startup, stash crumb in `AppConfig`). Alternatives (all worse for this project's free-tier-first rule): Stooq (no market cap, delayed), Alpha Vantage (25 req/day free), Finnhub (has US-only quote, 60/min — already in scope for news). Do not swap to a paid tier before hitting a documented wall.
