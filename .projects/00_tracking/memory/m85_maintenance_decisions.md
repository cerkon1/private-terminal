# M8.5 Maintenance — design decisions (S10, 2026-04-25)

Inserted as an unplanned milestone between M8 polish and M9 features. Driven by user reframing scope from "build M9 cross-cutting features" to "shore up the maintenance story before giveaway." Four items: (a) hard-delete + cascade, (d) RSS feed CRUD, (c) SQLite maintenance + orphan sweep, (b) move/backup DB.

---

## (a) Hard-delete revival policy

Three options were on the table:

- **A.** Hard-delete the watchlist row + cascade data. **Rejected** — seed `INSERT OR IGNORE` would revive seeded tickers (AAPL, CNQ.TO, etc.) on next boot. Surprising for users.
- **B.** Tombstone table (`purged_tickers (ticker, sector_group_id)`) checked in seed path. **Rejected** — adds a table; soft-delete pattern already covers the revival case.
- **C.** Purge data + keep `user_hidden` row. **CHOSEN.** Watchlist row stays as `user_hidden=1`; cache tables (`price_history`, `quote_cache`, `indicator_settings`, per-ticker `news_items`) get cascaded only when this hide leaves zero visible references. Seed `INSERT OR IGNORE` stays a no-op (row exists). Re-adding the same ticker via the Add UI clears `user_hidden=1` and the user is back where they started — minus the cached data they explicitly purged.

Cascade scope is **two-layer** because of column keying:

- `price_history` + `quote_cache` keyed on `(ticker, data_source)` → cascade when no visible row exists for that pair.
- `indicator_settings` keyed on `ticker` only → cascade only when ticker has no visible reference under any data source.
- `news_items WHERE source='finnhub_ticker'` keyed on `ticker` only → same scope as `indicator_settings`.

This means: deleting AAPL from "Top 10" while it still exists in "Tech Watchlist" only hides the row in Top 10. If both groups were the only references, both cache scopes fire.

Whole cascade in a single transaction; partial failure rolls back.

UX: **🗑** button alongside the existing × in `TickerEditPanel`. × is now titled "Hide…" (no data loss); 🗑 is "Permanently delete…" (with confirm modal). Status line shows the cascade summary so the user can audit what was removed.

---

## (d) RSS feed CRUD scope

Same soft-delete pattern as sectors/tickers: `news_feeds.user_hidden INTEGER NOT NULL DEFAULT 0`. Schema migration in `Db::migrate()` is idempotent (same shape as the prior `sector_groups`/`watchlist_tickers` migrations).

Add form **restricted to `source_type='rss'`** — Finnhub general is keyed on `FINNHUB_API_KEY` and the seeded `finnhub_general` row covers it. Adding a second Finnhub row would need a non-default category keyword which our fetcher doesn't support. Edit form **allows all source types** (display name, URL, category, refresh, enabled toggle).

Categories use a dropdown derived from `categoryOptions = SEEDED_CATEGORIES ∪ {existing feed categories}` so user-added categories self-propagate. Refresh dropdown: `15m / 30m / 1h / 4h / daily` presets, with a fallback `<option>` for any non-preset value already in the DB.

Inline-edit pattern: extracted reusable `InlineEdit` component in `FeedsTab.tsx` for click-to-edit name/URL. Could be lifted to a shared component if a third consumer appears; not yet.

Confirm modal on delete (matches the (a) pattern). Soft-delete copy explains: *"Historical articles already fetched will age out within 30 days. To reactivate later, add a feed with the same id."* Re-adding the same id clears `user_hidden=1` (upsert on conflict).

---

## (c) SQLite maintenance — the post-VACUUM pass

The non-obvious finding: **VACUUM in WAL mode produces fresh WAL frames** roughly equal to the DB file size. Without a *second* `wal_checkpoint(TRUNCATE)` after VACUUM, on-disk total stays the same — main file shrinks, WAL refills.

Final flow in `db_maintenance`:

1. `PRAGMA integrity_check` — readonly, parse rows for `"ok"`.
2. `PRAGMA wal_checkpoint(TRUNCATE)` — clean up any pre-existing WAL frames.
3. `VACUUM` — rebuild main file in place.
4. `PRAGMA wal_checkpoint(TRUNCATE)` AGAIN — truncate the WAL frames VACUUM just produced.

Result reports:
- `beforeBytes` / `afterBytes` = total footprint (`main + -wal + -shm`)
- `walFramesCheckpointed` = sum across both passes
- `walCheckpointBlocked` = OR of `busy=1` from either pass (surface-only; cleanup still runs)
- `integrityOk` + `integrityMessage`
- `durationMs`

Captured as **DB-7** in LESSONS.

Footprint helper `total_db_footprint(path)` sums:
```
<path>           = main file
<path>-wal       = WAL sidecar
<path>-shm       = shared-memory sidecar
```
Built via `path.as_os_str().to_owned()` + `push("-wal")` rather than `with_extension("db-wal")` (cleaner across path shapes).

`get_db_info.size_bytes` was changed to total footprint to match — old behavior reported main-file-only and disagreed with maintenance results.

### Orphan sweep (`purge_orphaned_data`)

Single transaction, four `DELETE … WHERE NOT EXISTS (SELECT 1 FROM watchlist_tickers …)` queries. Different scoping per table per the cascade rules above. Use case: user has been hiding tickers via × (soft-delete only) for a while and wants to reclaim cache space without manually 🗑-purging each one.

Run **maintenance after sweep** to reclaim the freed bytes — sweep deletes rows but doesn't shrink the file.

---

## (b) Move database — pointer file architecture

**The chicken-and-egg.** A pointer telling us where the DB is can't live *in* the DB (we'd need to know where the DB is to read it). Solution: `<default_data_dir>/db_location.txt` — a single-line UTF-8 file with the absolute path of the active DB. Default `data_dir` always exists; the pointer file rides along.

`config::resolve_db_path()` on boot:
1. Read `db_location.txt` from default `data_dir`.
2. If absent or unreadable → use default `<data_dir>/personal-terminal.db`.
3. If present but target file doesn't exist → log warning, fall back to default. (User deleted the moved DB without resetting the pointer? Survivable; we open a fresh DB at default.)
4. If present and target exists → open from there.

`write_db_pointer(Some(path))` writes; `write_db_pointer(None)` deletes. `reset_database_location` command clears the pointer (registered, no UI).

### Move flow (`move_database`)

Steps, each must succeed before the next:
1. Validate destination is a directory + not the current location + has no existing `personal-terminal.db`.
2. `wal_checkpoint(TRUNCATE)` to consolidate WAL into main.
3. `std::fs::copy` source.db → dest/personal-terminal.db.
4. `Db::open(new_path)` — failure → remove partial copy, return Err with AppState unchanged.
5. `*guard = new_db` — replaces the inner Db while holding the Mutex guard. Old connection drops on assignment.
6. `write_db_pointer(Some(&dest_path))`. Failure here surfaces a warning but doesn't roll back — DB is open at the new location, just won't survive next boot.

Old files **left in place** by design. Auto-delete deemed too risky:
- User can verify the new location works for a session before manually cleaning up.
- Reverting is trivial: delete the new copy + delete `db_location.txt` → default location resumes.

### Backup-copy (`backup_database`)

Simpler sibling: checkpoint → `std::fs::copy` to `dest/personal-terminal.backup-YYYYMMDD-HHMMSS.db`. AppState unchanged. Timestamped filename allows repeat backups without overwrite.

User explicitly asked for this alongside Move because users might manually copy `.db` from Explorer and miss the WAL — Backup forces a checkpoint first so the copied file is self-contained.

### Plumbing details

- Added `tauri-plugin-dialog = "2"` (Rust) + `@tauri-apps/plugin-dialog ^2.0.0` (JS).
- Capability: `"dialog:default"` + `"dialog:allow-open"` (mirror of TV-1 opener pattern).
- Frontend uses `open({ directory: true, multiple: false, title })` from `@tauri-apps/plugin-dialog`. Returns `string | string[] | null`; helper handles all three.
- Confirm modal for move (it's destructive of state — changes the live DB). Backup needs no confirmation (additive only).

---

## Smoke-test issues fixed in-session

- **`get_db_info` size mismatch with maintenance result.** Two different definitions of "size." Fixed by unifying around total footprint.
- **VACUUM WAL refill** (DB-7) — added second checkpoint pass.
- **FL-3 hit again** on FeedsTab's six-field add row (URL + name collapsed in 720px modal). Restructured into two-row stacked form via `.edit-panel__add--stacked`.
- **`id_slug` jargon** — replaced placeholder + added inline ⓘ help in both FeedsTab and GroupsManagerModal.
- **Reuters RSS dead** — `feeds.reuters.com` doesn't resolve. Reuters discontinued public RSS years ago. User exercised the delete path (silver lining). MarketWatch (`feeds.content.dowjones.io/public/rss/mw_topstories`) noted as a stable alternative.
- **Finnhub 403 on `000001.SS`** — Shanghai Composite slipped through `NOT LIKE '%.TO'`. Tightened to `NOT LIKE '%.%'` (negative whitelist on US tickers). Drops all foreign exchange suffixes generically.
