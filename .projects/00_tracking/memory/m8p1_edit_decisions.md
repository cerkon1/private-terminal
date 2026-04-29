---
name: M8 Phase 1 — ticker + group edit decisions
description: Architectural choices for user-editable watchlist and sector groups (S8 second half, 2026-04-24). Soft-delete pattern, data_source inheritance, ticker-symbol immutability, Finnhub per-ticker news eligibility filter.
type: project
---

## Context
M8 Phase 1 landed user-editable watchlist + groups via two UI surfaces — inline edit mode on each ticker dashboard (add/remove/rename/move) and a sidebar-launched `GroupsManagerModal` (create/rename/delete/reorder groups). Drag-drop deferred to Phase 2+. Shipped S8.

## Decisions

### Soft-delete via `user_hidden` column, not hard DELETE
**Why:** The seed runs every boot with `INSERT OR IGNORE`. If we hard-DELETE a seeded row (say AAPL from us_equities), the next boot re-inserts it and the user sees their deletion undone. `user_hidden=1` is stable across boots — INSERT OR IGNORE leaves an existing row alone regardless of flag value. Seed's `UPDATE` statements (for milestone enable flips) are separately targeted and don't cascade to user_hidden changes.
**How to apply:** Every list query filters `WHERE user_hidden = 0`. Every "delete" mutation sets `user_hidden = 1`. Every "create" on an existing PK upserts with `user_hidden = 0` to restore a previously-hidden row. Pattern is: add/delete toggles the flag; `INSERT ... ON CONFLICT DO UPDATE ... user_hidden = 0` handles re-add cleanly. Applies to `sector_groups` + `watchlist_tickers` tables; other tables (indicators, fred_series, news_feeds) don't have this column because user CRUD doesn't touch them in Phase 1.

### Ticker symbol is immutable; "rename" = display_name change only
**Why:** Renaming a ticker symbol (e.g. AAPL → APPL) would orphan rows in `price_history`, `quote_cache`, `indicator_settings` — all keyed on ticker string. Supporting a true rename means atomic cross-table updates + edge cases (old data fetched under old name, indicator settings already tuned, etc.). Rare user action, high implementation risk.
**How to apply:** `update_ticker` only accepts `displayName`, `displayCurrency`, `newSectorGroupId` (move), `displayOrder`. To change a symbol, user deletes + re-adds. Document this in tooltip if UX feedback surfaces confusion.

### `data_source` inherited from sector_group at insert
**Why:** `data_source` gates fetcher dispatch (`yahoo` vs `coingecko` vs `fred`). A ticker under `us_equities` must be `yahoo` — mixing sources within a group breaks the batch-fetch pattern. Exposing data_source in the add-ticker UI would let users pick inconsistent combinations.
**How to apply:** `add_ticker` command reads `data_source` from `sector_groups` where id = input.sectorGroupId. UI never shows a data_source field for ticker creation. If a user wants a ticker under a different source, they create a group with that source first, then add the ticker there.

### Group delete blocks on non-empty content
**Why:** Cascading deletes of tickers + children would be surprising and hard to undo. Blocking forces explicit empty-then-delete, which is clearer about what's being destroyed.
**How to apply:** `delete_sector_group` errors with a specific message if the group has any `user_hidden=0` tickers OR child `sector_groups`. UI surfaces the error; user empties the group manually, then retries delete. No cascade policy lever.

### Finnhub per-ticker news: US-only SQL filter
**Why:** Finnhub free tier supports US-listed symbols only. Sending TSX (`.TO`), futures (`=F`), indices (`^*`), crypto (`*-USD`), or DXY (`DX-*`) to `/company-news` returns empty lists at best or HTTP errors at worst. A WHERE-clause filter at the SQL level is the single source of truth.
**How to apply:** `list_finnhub_eligible_tickers()` returns distinct tickers matching all these exclusions. As long as a new ticker fits a US-listed data_source='yahoo' pattern (no suffix prefix/exclusion), it automatically joins the per-ticker news rotation. Watchlist edits propagate to news coverage without a second code path — this was the architectural reason to tie ticker news to `watchlist_tickers` rather than a separate `news_feeds` row per ticker.

### Per-ticker news uses `source='finnhub_ticker'` + `ticker=<symbol>` + `category='ticker'`
**Why:** `(source, external_id)` PK dedupe works within a single source namespace. Using one source string for all ticker news keeps Finnhub IDs unique within it. `ticker` column populated so the frontend can show a symbol badge. `category='ticker'` populates the "My Tickers" filter chip — derived from `category` column like all other chips.
**How to apply:** Every ticker news upsert uses these three exact values. `feed_id` stays NULL (no corresponding `news_feeds` row). If future sources emerge (NewsData.io per-ticker etc.), use a different `source` string.

### Centralized state-color palette (also S8)
**Why:** SMMA Ribbon colors were scattered across Rust constants + CSS class rules in two files, making palette swaps tedious. User went through 5 palette iterations.
**How to apply:** Edit `src/styles/tokens.css` `--state-bull` / `--state-bear` / `--state-neutral` (+ their `-rgb` companions) and mirror in `src-tauri/src/indicators/smma_ribbon.rs` (FILL_BULL / FILL_BEAR / FLIP_*). Each file has a comment pointing at the other. Two files total, ~7 values. Frontend `.state-badge--bullish/bearish` in `app.css` already references the vars; news ticker badge too. Final palette choice parked pending spousal review.

## Deferred (Phase 2+)

- **Drag-drop reordering** — Option C of the original M8P1 scope discussion. Arrow buttons (↑↓) cover the need for now.
- **Move group between parents** — not supported via UI. Delete + recreate is the workaround. Revisit if real use case.
- **Ticker symbol rename (true rename)** — cross-table atomic update. Add only if user presents a real use case.
- **Per-group reorder UI for tickers** — backend `reorder_tickers` exists but no frontend UI; display_order follows insert order for now.
- **Per-ticker data_source override** — would require UI exposure of the field. No current need since users create groups scoped to a source.
