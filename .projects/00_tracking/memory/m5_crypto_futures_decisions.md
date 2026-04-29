---
name: M5 CRYPTO + FUTURES & FX decisions
description: Pragmatic path — Yahoo for everything, defer CoinGecko integration and dynamic top-10 discovery
type: project
---

Resolved for M5 (2026-04-24, S6):

### Yahoo for crypto quotes AND history, not CoinGecko
DESIGN.md originally spec'd CoinGecko for crypto live quotes with Yahoo as history fallback. M5 uses Yahoo for both.

- **Why:** Zero new code. CoinGecko integration would require `sources/coingecko.rs`, a dispatch path in `list_ticker_tiles` by `data_source`, and either a schema change (`symbol` column on `watchlist_tickers`) or a hardcoded Yahoo-symbol mapping. ~150 lines of code for features (richer market cap, 24h volume in USD) that aren't displayed on tiles in M5.
- **How to apply:** When CoinGecko integration does land (post-M7), don't rip out the Yahoo crypto path — dispatch by `data_source` so both can coexist. A user may want to add a long-tail crypto that CoinGecko doesn't index; Yahoo is the fallback.

### Fixed top-10 crypto watchlist, not dynamic discovery
Seed 10 specific cryptos. No automatic "fetch current top-10 from CoinGecko every refresh" behavior.

- **Why:** Fixed list fits the same watchlist_tickers pipeline as INDICES/equities. Dynamic discovery requires a mutation step on `watchlist_tickers` during refresh, which complicates the extensibility story (user edits vs. API overwrites).
- **How to apply:** If dynamic discovery lands, treat it as a separate opt-in mode per sector_group (a `discovery_mode` column: 'static' | 'auto'). Don't retrofit it onto the existing static path.

### No schema changes for M5
Everything reuses `quote_cache` + `price_history` + `watchlist_tickers` as-is.
