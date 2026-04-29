---
name: M7 NEWS design decisions
description: M7 (S8) news architecture choices — feed taxonomy, dedupe PK, retention, per-ticker deferral, opener plugin permission shape, RSS feed URL rot handling.
type: project
---

## Context
M7 NEWS shipped in S8 (2026-04-24). Decisions below are the ones that will matter when extending news (search, per-ticker, new feed types) or diagnosing dedupe/retention/permission issues.

## Decisions

### Save-everything cache-first (not read-through)
**Why:** Matches the M1-M6 pattern (every section is SQLite-backed); RSS feeds drop old items silently, persistence preserves history; offline browsing works.
**How to apply:** All news fetchers upsert into `news_items`. Frontend reads from DB. Retention (`cleanup_old_news_items(30)`) runs once on app boot — bounded table size regardless of how long the app runs between resets.

### Dedupe via `(source, external_id)` PK + `INSERT OR IGNORE`
**Why:** Zero custom dedupe logic. Every feed has a stable per-item id (RSS `<guid>` / Atom `<id>` via feed-rs, Finnhub numeric id). Re-fetches silently no-op on duplicates.
**How to apply:** Never add a dedupe pass in fetcher code — the SQL PK does it. If a feed omits guid/id, the RSS fetcher falls back to `sha256(link+pubDate)` — stable across re-fetches.

### Per-ticker news follows `watchlist_tickers`, not a second feed row
**Why:** Future ticker-editing script becomes a single source of truth. Add/remove a ticker → news coverage moves with it. If per-ticker news were `news_feeds` rows, every ticker add needs a matching feed-insert (and the two can drift).
**How to apply:** When M8 lands per-ticker Finnhub news, read `watchlist_tickers WHERE data_source = 'yahoo' AND ticker NOT LIKE '^%' AND ticker NOT LIKE '%=F'` (i.e. US equities, not indices or futures). Use `source = 'finnhub_ticker'`, `ticker = <symbol>`, `feed_id = NULL` in `news_items`. No schema change required — the columns exist.

### Finnhub seeded but disabled by default
**Why:** Free setup has no `FINNHUB_API_KEY`. Without the disable, every refresh spams the error list. Disabling keeps the row (= the plumbing) intact for future key adds.
**How to apply:** Users add `FINNHUB_API_KEY=...` to `.env`, then `UPDATE news_feeds SET enabled=1 WHERE id='finnhub_general'` in SQLite (or the M8 settings UI does this).

### Category taxonomy — `world` / `us` / `canada` / `central_bank` only
**Why:** Keeps chip count low (4 + "All" = 5 chips). ME coverage (BBC Middle East, Al Jazeera) folds into `world`. A "geopolitics" chip was proposed but rejected for v1 — chips derive from the `category` column, so we can add one without schema change if the list stays noisy.
**How to apply:** When seeding a new feed, pick one of the existing 4 categories. Don't invent new ones unless the volume in an existing chip makes it unreadable.

### RSS feed URL rot handling
**Why:** `bnnbloomberg.ca/feed` returned 404 on first smoke test (S8). Feed URLs are maintained by third parties and can break silently.
**How to apply:** When swapping a dead feed, use the "Larsson rename" pattern — DELETE existing rows + INSERT OR IGNORE new. `INSERT OR IGNORE` alone won't replace existing rows. See seed.sql "Feed migrations" comment. Captured as LESSONS NEWS-1.

### External-link opening via `tauri-plugin-opener`
**Why:** Webviews can't `window.open()` arbitrary URLs into the system browser without a plugin in Tauri v2.
**How to apply:** `@tauri-apps/plugin-opener` on frontend + `tauri-plugin-opener` crate + `opener:default` + a scoped `opener:allow-open-url` capability rule restricting to `https://*` + `http://*`. `opener:allow-open-url` alone isn't sufficient — need the default permission bundle too. Captured as LESSONS TV-1.

## Deferred (pick up in M8 or later)

- **Finnhub `/company-news?symbol=X`** — per-ticker news. Lands in M8 with ticker-editing script.
- **Search box across news items** — post-M8.
- **Unread/read state** — post-M8. Would need a `seen_at` column + optimistic client-side update.
- **Adaptive feed `refresh_minutes`** — if a feed consistently errors, back off. For now, every feed has its seed `refresh_minutes` value.
- **RSS pre-fetch headers** (If-Modified-Since / ETag) — most feeds support it; we ignore it. Harmless extra bytes per poll given the current refresh cadence.
- **Feed-level enable/disable UI** — users currently can't toggle feeds from the app. M8 settings modal scope.
