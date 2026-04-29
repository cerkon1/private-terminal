# LESSONS

Durable technical gotchas from past sessions. Read this before touching the subsystem.

Format: one row per gotcha. `ID` = short stable anchor. `Session` = where it was first surfaced. `Detail` = what to do.

## DB / SQLite

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| DB-1 | `INSERT OR IGNORE` doesn't update existing rows | S5 | When flipping a flag (e.g. `enabled`, `display_order`) for a row that may already exist, pair the INSERT with a follow-up `UPDATE ... WHERE id=...`. Applies to `sector_groups` enable flips when milestones come online. |
| DB-2 | Run seed on every boot, not "if empty" | S2→S3 | Seed uses `INSERT OR IGNORE` so it's idempotent. New rows added in later seeds (e.g. M3 tickers, M6 indicators) land automatically on existing DBs. `Db::seed()` is called unconditionally in `lib.rs`. |
| DB-3 | Schema spec ≠ schema file | S7, S8 | The `indicators`/`indicator_settings` tables were in DESIGN.md but not in `schema.sql` until M6. Same happened with `news_feeds`/`news_items` until M7. If DESIGN.md lists a table, grep `schema.sql` before seeding it. |
| DB-4 | Renaming an indicator id requires a migration | S7 | `indicator_settings.indicator_id` references `indicators.id`. When renaming (Larsson → SMMA Ribbon): `DELETE FROM indicator_settings WHERE indicator_id='<old>'; DELETE FROM indicators WHERE id='<old>';` BEFORE the new INSERT. |
| DB-5 | rusqlite `query_map` + closure + trailing `?` trips NLL | S8 | Pattern `stmt.query_map(params, map_row)?.collect::<Result<Vec<_>, _>>()?` at end of a block errors E0597 "`stmt` does not live long enough" — NLL can't track the borrow across the ControlFlow temporary the `?` creates. Workaround: drop to the low-level `let mut rows = stmt.query(params)?; while let Some(row) = rows.next()? { out.push(...); }`. See `list_news_items` for the reference shape. |
| DB-6 | Swapping a dead feed URL = DELETE + INSERT OR IGNORE | S8 | `news_feeds` row flipped URL from `bnnbloomberg.ca/feed` (404) to CBC Business. `INSERT OR IGNORE` on a new id leaves the old (broken) row behind. Pair with `DELETE FROM news_items WHERE feed_id='<old>'; DELETE FROM news_feeds WHERE id='<old>';`. Same pattern as DB-4. |
| DB-7 | VACUUM in WAL mode produces fresh WAL frames roughly equal to DB size | S10 | Single-pass `wal_checkpoint(TRUNCATE)` → VACUUM leaves the on-disk total unchanged: VACUUM rewrites pages as new WAL frames; the auto-checkpoint may have already cleaned the old ones. Maintenance flow MUST run a second `wal_checkpoint(TRUNCATE)` after VACUUM. See `db_maintenance` in `system_cmds.rs` for the four-step shape (integrity → ckpt → VACUUM → ckpt). Read column 0 of the PRAGMA result for the `busy` flag — surface it if either pass returned 1. |
| DB-8 | SQLite "size" is three files, not one | S10 | `<path>` (main) + `<path>-wal` (WAL sidecar) + `<path>-shm` (shared-memory sidecar). Reading just `metadata(path).len()` gives a misleading number — main is often half the actual on-disk footprint mid-session. Always sum all three for user-facing "size" displays. `total_db_footprint` helper in `system_cmds.rs` is the reference. Manual backup must copy all three files together OR run `wal_checkpoint(TRUNCATE)` first and copy only the main `.db`. |
| DB-9 | Live DB swap via `*guard = new_db` | S10 | `Mutex<Db>` doesn't directly support "close the old, open the new" since `Db` has no `Default`. Pattern: hold the `MutexGuard`, open the new `Db`, assign `*guard = new_db` — the old `Db` (and its rusqlite Connection) drops cleanly on assignment. SQLite's shared-read lock on Windows lets us copy the source file with the old connection still open, so no need for a placeholder. See `move_database` in `system_cmds.rs`. |

## IPC / Serde

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| IPC-1 | `rename_all = "camelCase"` on every IPC struct | S1 | Applies to nested structs too. `#[serde(default)]` on `Option<T>` fields. See `PrivateACB/.claude/rules/serde-ipc.md` for the non-negotiable checklist. |
| IPC-2 | `std::sync::MutexGuard` is `!Send` — drop before `.await` | S2 | Pattern: acquire, extract data into owned values, let the guard drop at block end, THEN await the network call. See `macro_cmds::list_macro_tiles` for the reference shape. |
| IPC-3 | Tauri v2 snake-case args arrive from frontend in camelCase | S1 | Rust `fn foo(series_id: String)` → frontend `invoke('foo', { seriesId: "..." })`. Tauri auto-converts. |
| IPC-4 | Tri-state Option for "absent vs null vs value" via `Option<Option<T>>` | S13 | Default `Option<T>` with `#[serde(default)]` collapses absent and null to `None` — fine when "leave alone" and "set to NULL" mean the same thing; broken when they don't (e.g. group `parent_id` reparenting where absent = leave alone, null = move to top-level, value = move under id). Pattern: declare `Option<Option<T>>` field with `#[serde(default, deserialize_with = "deserialize_some")]` where `deserialize_some<'de, T, D>(d: D) -> Result<Option<T>, D::Error>` is `T::deserialize(d).map(Some)`. Result: absent → `None`, null → `Some(None)`, value → `Some(Some(v))`. SQL update needs explicit gating (`CASE WHEN ?N = 1 THEN ? ELSE col END`) since COALESCE can't distinguish "leave alone" from "set to NULL" either. See `update_sector_group` in `edit_cmds.rs`. |

## Indicators / Chart

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| IND-1 | Don't re-tune SMMA Ribbon defaults | S7 | Lengths `[15,19,25,29]` and `confirm_bars=3` are trendscope's defaults; measured that N=1/3/5 shifts state distribution by <1%. See `trendscope/CLAUDE.md` "Tuning journey" before touching. |
| IND-2 | Indicators use f64, not rust_decimal | S7 | Display-only, not tax-grade. rust_decimal is reserved for quotes/FX (currently unused; will matter in M8+ if portfolio features land). |
| IND-3 | SMMA Ribbon signal IS the envelope width | S7 | Not the state colour alone. First rendering used full-height markArea (flat colour) — threw away the critical information. Render as state-coloured polygon between v1 and v2. |

## ECharts

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| EC-1 | `tooltip.show: false` kills the axisPointer too | S7 | Use `tooltip.showContent: false` instead — hides the values box, keeps the crosshair active. |
| EC-2 | `axisPointer` config belongs *inside* tooltip when `trigger: 'axis'` | S7 | Top-level axisPointer works as a complement for pane-to-pane linking (`link: [{ xAxisIndex: 'all' }]`) but the primary cross-type config lives in `tooltip.axisPointer`. |
| EC-3 | Fill between two lines via "stack trick" | S7 | ECharts has no native fill-between-two-curves. Approach: emit hidden baseline series (min of A,B) + N band-series of `|A-B|` (for each segment state, 0 elsewhere) sharing the same `stack` group, each with its own `areaStyle.color`. See `smma_ribbon.rs` + `FeatureChart.tsx`. |
| EC-4 | Category x-axis alignment requires dense data | S7 | Indicator series with sparse dates need to be mapped into a `Vec<Option<number>>` aligned to the bar dates. See `alignToCategories` in `FeatureChart.tsx`. |
| EC-5 | ResizeObserver needed on chart container | S3 | ECharts `init()` captures dimensions at construction; flex layout often hasn't settled. Attach `new ResizeObserver(() => chart.resize()).observe(el)` in the init effect. |
| EC-6 | `axisPointer.label.formatter` signature | S7 | Receives `{ value }: { value: number \| string }`. Needs a type guard before passing to numeric formatters like `formatValue(v, units)`. |
| EC-7 | ECharts candle data order is `[open, close, low, high]` | S7 | Not OHLC — O, C, L, H. `b.open ?? b.close` fallback when Yahoo returns nulls around holidays. |
| EC-8 | Triangle symbols only point up | S7 | For a down-flip marker use `symbol: 'triangle', symbolRotate: 180`. No `'triangle-down'` native symbol. |
| EC-9 | dataZoom config must reflect live state, not initial position | S11 | First implementation of AUTO Y kept `dataZoom[0].start = defaultStartPct, end = 100` hardcoded. Every option rebuild via `setOption({notMerge: true})` snapped the slider back to that default position, making the slider effectively unusable — drag, release, snap. Fix: track current zoom in component state (`visibleRange`) updated from the `datazoom` event handler reading `chart.getOption().dataZoom[0].start/end`, and use those values in the dataZoom config. Dedupe with `Math.abs(prev - cur) < 0.01` to avoid React re-render thrashing during continuous drag. |
| EC-10 | ECharts default log axis ticks at `base^k` only — broken for sub-decade ranges | S11 | `type: 'log'` with default tick generation places labels only at powers of the base (10, 100, 1000, …). Sub-decade data (e.g. BTC's $30k–$70k window) gets squashed between $10k and $100k boundaries with no intermediate ticks; real price action becomes invisible. Worse: SMMA Ribbon stacked-area envelope's value-0 components cause `log(0)` = -Infinity to silently collapse the entire price pane to a default 1–10 range. TradingView-style log (round-number ticks at log-spaced positions) requires a manual `Math.log10()` transform on data points rendered on a `type: 'value'` axis with custom label formatter. Default ECharts log axis is unsuitable for trading charts; don't ship it without the manual transform. |
| EC-11 | Custom-series `renderItem` calls are culled when the data point's xAxis value is outside the visible dataZoom window — `clip: false` does NOT defeat this | S12 | Initial VRVP impl anchored each bin's data point to `bars.length - 1` on the time-category xAxis. When the dataZoom right handle was pulled left of 100%, that anchor became off-screen and ECharts skipped the renderItem call entirely — the entire overlay vanished. `clip: false` only controls *output* clipping (whether the rendered shape is masked by the grid bounds), not upstream visibility filtering of the data points themselves. **Fix: dedicate a hidden value-axis on the same grid**, range `[0, 1]`, anchor every data point at `0.5`. Decouples the series from the time-axis dataZoom — renderItem fires for every bin regardless of slider position. Pixel positioning still uses `params.coordSys` so the visual output unchanged. Exclude the new axis from `dataZoom.xAxisIndex` and `axisPointer.link`. Reusable pattern for any future overlay that needs to render in price-pane pixel space without inheriting time-axis filtering. See `FeatureChart.tsx` VRVP series. |
| EC-12 | `series.silent: true` does NOT suppress axis-trigger tooltip entries | S12 | `silent: true` only blocks *mouse-event* triggers on the series (click, hover, etc.). The chart-wide axis tooltip (`trigger: 'axis'`) iterates every series at the cursor position regardless of silence — a custom series with N data points would list N entries in the tooltip even when silent. **Fix: per-series `tooltip: { show: false }`** filters that series out of the axis tooltip. Use this when you have decorative custom series (overlays, watermarks-as-data, etc.) that shouldn't appear in the hover stats. See VRVP series in `FeatureChart.tsx`. |
| EC-11 | Pane-height ratios hide pane-toggle UX wins | S11 | Original `layoutGrids` formula gave price `priceRatio = 0.62` of the available height regardless of pane count. Toggling a pane off (e.g. VOL hidden) only freed the inter-pane gap (~2% of usable), so the price chart barely grew. Fix: fixed slim height per non-price pane (12% each); price absorbs the remainder. New distribution: 1 pane = 86%, 2 panes = 72%, 3 panes = 58% to price. Toggle now produces a meaningful visual change. |
| EC-13 | ECharts options can't read CSS `var()` — use a runtime mirror | S15 | ECharts is configured via JS objects; passing `'var(--bg-base)'` as a color string makes ECharts treat it as an invalid color (silently falls back to defaults). Result: every chart accumulates inline hex/rgba literals that drift from `tokens.css` and silently break theming. **Fix: `src/styles/chartTheme.ts`** — runtime mirror that reads computed CSS vars via `getComputedStyle(document.documentElement).getPropertyValue('--token')` once and exports a typed `ChartTheme` object. Cached for page lifetime; `refreshChartTheme()` clears the cache (call after any change that mutates `:root` vars — e.g. light/dark toggle). Pattern: every ECharts component does `const theme = getChartTheme()` at the top of its option-builder function and references `theme.bgBase`, `theme.statusUp` etc. instead of literals. SMMA palette presets in `theme.ts` mutate `state-bull/bear/neutral` vars but those are NOT consumed by chartTheme — indicator series carry their own `color` field, so palette switches don't require a refresh. Companion `tokens.css` convention: every color token that gets `rgba()`'d also defines a `-rgb` triplet variant (e.g. `--accent-cyan: #00f7ff` + `--accent-cyan-rgb: 0, 247, 255`) so CSS-side use is `rgba(var(--accent-cyan-rgb), α)` and JS-side is `rgbaVar('--accent-cyan-rgb', α)` in chartTheme. |

## Yahoo Finance

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| YH-1 | `/v7/finance/quote` is blocked (401) without crumb auth | S4 | Pivot to `/v8/finance/chart/{symbol}?range=X&interval=Y`. Response `meta.regularMarketPrice` / `meta.previousClose` are all we need for quotes. See `memory/yahoo_endpoint_gotcha.md`. |
| YH-2 | One call per symbol, semaphore-cap concurrency | S4 | No batch endpoint available without crumb. Cap at `MAX_CONCURRENT_FETCHES = 6` via `tokio::sync::Semaphore` + `futures::join_all`. |
| YH-3 | Browser-like User-Agent required | S4 | Default `reqwest` UA returns 429. Set a recent Chrome UA. See `sources/yahoo.rs::USER_AGENT`. |

## Tauri / Windows build

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| TB-1 | `tauri-build` requires `icons/icon.ico` on Windows | S2 | Even with `bundle.active: false` — it's used for the .exe Windows Resource file. Placeholder OK; swap for terminal-branded icon during M8 polish. |
| TB-2 | MSVC linker anon-symbol errors after many cargo-watch cycles | S7 | Incremental compile cache corrupts. Fix: `rm -rf target/debug/incremental/`. Full `cargo clean` is overkill. Symptom: `LNK1120: N unresolved externals` naming `anon.*.llvm.*` symbols. |
| TB-3 | Vite port 5173 sticks after unclean tauri-dev shutdown | S7 | `netstat -ano \| grep :5173` → `taskkill /F /PID <n>`. Also kill stray `node.exe` processes. |
| TB-4 | App binary locks its rlib during rebuild | S3 | "file is being used by another process" — close the running app window before the next Rust rebuild, or let cargo-watch kill + relaunch cleanly. |
| TB-5 | `cargo clean -p <pkg>` is non-selective on dependency artifacts | S12 | Running `cargo clean -p personal-terminal` to "force a rebuild" wiped 13.4 GiB / 11,169 files — `cargo clean -p` removes the per-package compilations of *every* dependency that was built specifically for that package, not just the named package's own outputs. Next compile is from scratch, ~5–10 min. **Better alternatives** when you want to force tauri-build's resource step (e.g., after icon.ico changes that incremental cargo missed): (a) `touch src-tauri/build.rs` — re-runs build.rs + relinks, doesn't recompile dependencies; (b) delete just the binary file (`rm src-tauri/target/{debug,release}/personal-terminal.exe`) — Cargo rebuilds only what's needed. Reserve `cargo clean -p` for "I genuinely want everything gone." |

## Frontend layout / CSS

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| FL-1 | `flex: 1` needs a parent with definite height | S3 | `min-height: 100vh` on `.app-shell` doesn't give children a target. Use `height: 100vh` + `overflow: hidden` + `min-height: 0` on flex chain children. Feature chart's ECharts container depends on this. |
| FL-2 | Fixed tile height + line-clamp for grid consistency | S3 | `grid-auto-rows: 150px` + `-webkit-line-clamp: 2` on title + `title=` attribute for full-text hover tooltip. Without fixed rows, long titles stretch entire rows. See `memory/tile_grid_convention.md`. |
| FL-3 | `<select width:100%>` inside flex row steals space from siblings | S8 | A `select` with `width: 100%` but no `flex` basis inside a flex container grows to fill available width, collapsing neighbouring inputs to near-zero. Symptom: GroupsManagerModal's `yahoo`/`parent` dropdowns consumed the display-name input's space → user couldn't see where to type → disabled-button click fired no event → no console log (disabled elements swallow clicks). Fix: give selects explicit `flex: 0 0 <px>` + `width: auto`. |
| FL-4 | A `disabled` button swallows the click event | S8 | Clicking a disabled button fires no `onClick` — this is HTML spec, not a React quirk. DevTools console shows nothing at all (no log, no handler invocation). When debugging "click does nothing," check `button.disabled` first via `document.querySelectorAll('button').forEach(b => console.log(b.textContent, b.disabled))`. |

## Project process

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| PP-1 | Deferrals rot silently | S4 | Every "defer this to later" must land in `memory/m*_decisions.md` + `PROGRESS.md` "Discovered" with target milestone. User has explicitly flagged this twice ("As long as you are keeping track and deferral properly"). |
| PP-2 | Session logs preserve historical name changes | S7 | When an indicator/module is renamed, keep old references in past session entries as a record. Rename only active code + docs. |

## Tauri v2

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| TV-1 | `opener:allow-open-url` alone → "Not allowed by ACL" at runtime | S8 | The opener plugin needs *both* the default permission bundle *and* a scoped URL allow-rule. Minimum working config: `"permissions": ["core:default", "opener:default", {"identifier":"opener:allow-open-url", "allow":[{"url":"https://*"},{"url":"http://*"}]}]` in `capabilities/default.json`. The granular `opener:allow-open-url` identifier alone fails because the URL-scope isn't attached. |
| TV-2 | Capability file edits trigger a cargo rebuild | S8 | Tauri's codegen consumes `capabilities/*.json` at build time, so changing a permission recompiles the binary (~10-15s incremental). No Vite-level hot-reload path. |
| TV-3 | `cargo check` fails with "proc macro panicked" expecting `../dist` | S8 | Standalone `cargo check` (default features on) runs `generate_context!()` which resolves `frontendDist`. In dev, `tauri dev` uses `--no-default-features` (drops `custom-protocol` feature). Use `cargo check --no-default-features` for local typecheck — matches the dev profile. |
| TV-4 | `tauri:dev` cascade-exits when backgrounded from a different shell | S9 | Launching `npm run tauri:dev` with Bash `run_in_background` lets the parent npm shell exit while the Rust app is mid-launch; the spawned `personal-terminal.exe` gets orphaned and dies almost immediately. Don't try to baby-sit the dev server from the agent side — have the user run `npm run tauri:dev` in their own terminal and report results. |
| TV-5 | `tauri-plugin-dialog` needs both `dialog:default` and `dialog:allow-open` | S10 | Same shape as TV-1 (opener). The granular `dialog:allow-open` alone fails the runtime ACL check. Minimum working set in `capabilities/default.json`: `"dialog:default", "dialog:allow-open"`. Also requires Cargo dep `tauri-plugin-dialog = "2"`, npm dep `@tauri-apps/plugin-dialog`, and `.plugin(tauri_plugin_dialog::init())` in `lib.rs`. Frontend `open({directory: true, multiple: false})` returns `string \| string[] \| null` — caller must handle all three (the array form appears even with `multiple: false` on some platforms). |

## News / RSS

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| NEWS-1 | RSS feed URLs rot silently | S8 | `bnnbloomberg.ca/feed` returned 404 on first smoke (site rebranded under Bell Media). Always verify URLs at seed time; when swapping, use the DB-6 DELETE + INSERT OR IGNORE pattern. CBC Business (`cbc.ca/webfeed/rss/rss-business`) is the stable Canadian replacement as of S8. |
| NEWS-2 | feed-rs resolves `<guid>`/`<id>` into `entry.id` uniformly | S8 | RSS 2.0 and Atom both produce non-empty `entry.id` when the feed is well-formed. Fallback for feeds that omit it: `format!("sha256:{:x}", Sha256::digest(format!("{link}|{published}").as_bytes()))` — stable across re-fetches, keeps `INSERT OR IGNORE` dedup working. See `sources/news/rss.rs`. |
| NEWS-3 | `INSERT OR IGNORE` on `(source, external_id)` PK is the whole dedupe mechanism | S8 | Re-fetches silently no-op on duplicates; fetchers don't need to check "what's new." `upsert_news_items` returns the count of actual inserts (via `execute()` per-statement returning 0 for ignored). |
| NEWS-4 | Some RSS feeds 429/403 default reqwest UA | S8 | Set a browser-like User-Agent on the client (see `rss.rs::USER_AGENT`). Same gotcha as YH-3 for Yahoo. |
| NEWS-5 | HTML entity decode is worth the 10 lines | S8 | Feeds emit `&amp;`, `&#39;`, `&nbsp;` verbatim in summaries. Without decode, the UI shows literal ampersand-encoded entities. See `rss.rs::decode_entities`. |
| NEWS-6 | Reuters RSS feeds are dead | S10 | `feeds.reuters.com/*` returns DNS NXDOMAIN — Reuters discontinued public RSS years ago. Never suggest as an example URL. Stable US business alternatives: MarketWatch (`feeds.content.dowjones.io/public/rss/mw_topstories`), Yahoo Finance (`finance.yahoo.com/news/rssindex`). |
| NEWS-7 | Finnhub free tier US-only filter via negative whitelist | S10 | Per-suffix blacklist (`NOT LIKE '%.TO'` etc.) can't keep up with all foreign exchange suffixes (`.SS`, `.HK`, `.DE`, `.L`, `.T`, `.KS`, `.AX`, `.SA`, `.PA`, …). Use `ticker NOT LIKE '%.%'` instead — US Yahoo equity tickers never contain `.` (class-share separator is `-`, e.g. `BRK-B`). Combine with `NOT LIKE '^%' AND NOT LIKE '%=F' AND NOT LIKE '%-USD' AND NOT LIKE 'DX-%'` for indices, futures, crypto, DXY. See `Db::list_finnhub_eligible_tickers`. |

## Security / credentials

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| SEC-1 | Rust `keyring` v3 silently no-ops on Windows dev builds | S9 | `keyring::Entry::new(...).set_password()` returns Ok and `get_password()` within the same Entry round-trips fine (read-back verification passes), but subsequent reads from a fresh `Entry::new()` return `NoEntry` and `cmdkey /list` shows zero entries in Windows Credential Manager. The crate falls back to a process-local store without reporting failure. Diagnosed via `cmdkey /list | grep personal-terminal` → empty, despite saved state. Pivot: store secrets in SQLite `config` KV at `api_key.<service>`; user-dir perms are adequate protection for free-tier API keys. Don't revisit keyring without reproducing the write-path in a standalone test binary first. |

## Frontend state / persistence

| ID | Gotcha | Session | Detail |
|---|---|---|---|
| FE-1 | `usePersistedState` needs `hadStoredValue` to distinguish first-launch from deliberate-empty | S9 | A component that wants "expand-all on first launch, respect user choice afterward" can't tell those apart from `value` alone — both could be an empty Set. Hook returns `[value, setValue, { loaded, hadStoredValue }]`; consumers gate first-launch defaults on `hadStoredValue === false`. Sidebar expand-all hit this: without the flag, a user who deliberately collapsed all parents would see them re-expand every relaunch. |
| FE-2 | Runtime CSS var changes need both hex and rgb forms | S9 | `useThemeColors` sets `--state-bull` (hex) AND `--state-bull-rgb` (comma-separated) because consumers use both: solid colors via `var(--state-bull)` and alpha blends via `rgba(var(--state-bull-rgb), 0.2)`. Miss one and half the UI stops updating. Helper: `hexToRgb(hex): [r,g,b]` in `src/types/theme.ts`. |
| FE-3 | ECharts series colors can't be themed via CSS vars | S9 | ECharts reads `color` / `itemStyle.color` at option-set time as literal hex strings. Updating a CSS var doesn't re-flow the chart. Theme override for chart series requires a post-processing pass on `IndicatorOutput` (`applyThemeToIndicators` in `src/utils/`) that remaps colors by series name + marker label before handing to the chart component. |
| FE-4 | App rename = user-visible only; keep internal identifiers stable | S11 | Renamed Personal Terminal → Private Terminal in S11. Updated only user-facing strings: `App.tsx` header, About tab heading, `index.html <title>`, `tauri.conf.json` productName + window title, package descriptions. Kept Cargo package name, lib name (`personal_terminal_lib`), Tauri identifier, AppData folder (`%APPDATA%\Roaming\personal-terminal`), DB filename — the user has live data in those locations and changing them would orphan it. If a future migration is needed, do it explicitly with a one-time data-copy pass + tombstone. Don't change AppData paths casually. |
| FE-5 | Orphaned `usePersistedState` keys are harmless but accumulate | S11 | Dropping a feature that used `usePersistedState('session.feature_chart_yscale')` left a config row in user DBs. No code reads it now, so it's harmless — but if we ever revisit log mode, choose a fresh key name to avoid stale-data interactions. Rule of thumb: deleting features doesn't require deleting persisted keys; reviving features under the same key requires explicit clear/reset in the migration. |
