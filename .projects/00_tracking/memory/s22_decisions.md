# S22 — UX leverage week (2026-05-03)

Single-day session, eight commits on master. One bug fix, five user-facing
features, two readability passes. Theme: every commit closed a known wart
or shipped a "should have always been there" UX win. No backend
architectural shifts; v1.2 now feels like a coherent product layer over
the v1.0 / v1.1 core.

Master timeline:

| Commit | Topic |
|---|---|
| `1cdafcf` | fix(charts): center watermark horizontally on candlestick view |
| `0922f85` | feat(macro): RecProb + FCI tile retrofit with Analysis cross-link |
| `39b9f20` | feat(charts): Anchored VWAP overlay with click-to-anchor |
| `8004deb` | feat(db): persisted per-ticker last_fetch_error across sessions |
| `ea8de9b` | feat(shell): Ctrl+K command palette with fuzzy search |
| `4301295` | feat(tiles): right-click context menu for watchlist + purge |
| `74f0b92` | style(sidebar): readability pass — brighter, bolder, less tracked |
| `22525e9` | style(tokens): brighten text-secondary + text-tertiary app-wide |

## Watermark horizontal-center fix

S19 pinned the candlestick watermark vertically to the price grid. The
horizontal positioning regressed: `left: '50%'` (numeric percentage) on
an ECharts graphic text element anchors the bounding box's **left
edge** at 50%, not its center, even with `textAlign: 'center'`. Visible
as the ticker name appearing right of center on every candlestick chart
(captured in `Screenshot 2026-05-03 063716.png`). The line-mode path
already used the keyword `'center'` and worked correctly — that keyword
is what triggers ECharts' auto-centering of the bounding box.

Fix: drop `leftPct` from the `gridCenter` interface, use `'center'`
keyword for horizontal anchor, keep numeric `topPct` for the price-pane
vertical pin. The grid's actual horizontal center is offset 18px right
of container center (`left: 60` / `right: 24` asymmetry); at fontSize
96 the offset is invisible. Captured as **EC-17** in LESSONS.

## MACRO-tile retrofit (RecProb + FCI dual-surface)

Closes the S15 Q4 "both surfaces" deferral. Three options weighed:

- **A. Just flip `tile_visible = 1`.** Cheapest. Loses threshold lines
  + recession bars on click — tile drill-down opens generic FRED line
  chart, not the rich Analysis tab.
- **B. Flip flag + cross-link click.** Tiles appear in MACRO; click
  navigates to ANALYSIS section + activates the matching tab via
  existing handoff infrastructure.
- **C. Build shared `<MacroSeriesView mode="tile" | "chart">`.** S15's
  original spec. Real refactor for what's currently two series.

Picked B. A loses too much value (threshold lines + NBER bars are the
whole point of the rich Analysis rendering); C is yak-shaving for two
series. New localStorage handoff `session.analysis_handoff_tab`
consumed by AnalysisLayout on mount once `usePersistedState.loaded`
resolves — gating prevents the async load race that would otherwise
overwrite a synchronously-set `setActiveId`. Same shape as the S17
Correlations→Pairs handoff (localStorage > CustomEvent because the
target component unmounts/remounts during the section flip).

Seed flip is idempotent — keeps `RECPROUSM156N` / `NFCI` out of the v1.1
analysis-only UPDATE list AND adds an explicit `tile_visible = 1`
UPDATE so existing v1.1 DBs upgrade correctly.

Known wart accepted: NFCI's `units = 'Index'` makes `computeYoY`
produce a percent change. NFCI hovers near zero (standardized index in
σ units) → percent changes near zero are misleading ("+25%" for
`-0.4` → `-0.5`). Direction is correct, magnitude is weird. Add a
`yoyKind` override later if it becomes a real annoyance.

## Anchored VWAP overlay

First **interactive** chart element in the app — clicking sets the
anchor. Standard VWAP: cumulative `Σ(typical_price × volume) / Σ(volume)`
where `typical_price = (h + l + c) / 3`. "Anchored" = user picks the
starting bar.

Decisions locked before build:

- **Anchor persistence: transient** (lost on toggle-off and bar change).
  Anchors are exploratory; persisting risks stale "starts at random old
  date" confusion. After ship the user surfaced "toggle off should clear
  it so re-toggling on shows the hint fresh" — added a small useEffect
  watching `showAvwap`.
- **Click target: whole price pane via ZRender** (`chart.getZr().on('click')`)
  not chart-level `.on('click')`, so empty-pane clicks register, not
  just clicks on candles. `chart.containPixel({gridIndex: 0}, [x,y])`
  filters to clicks in the price grid only.
- **Zero-volume edge case: auto-suppress line.** When cumulative volume
  from anchor is 0 (DXY / FX / volumeless indices), `computeAvwap`
  returns all-null and the series push is skipped. Same shape as VRVP's
  zero-volume auto-suppress.
- **Color: accent-amber.** New `accentAmber` token in chartTheme;
  distinct from candles (green/red), SMMA Ribbon (palette colors), and
  VRVP (yellow/grey).
- **Anchor marker: downward triangle** at the anchor bar via
  `markPoint` — reads as "anchor is here."

ZRender click handler attached **once** in a useEffect with empty deps;
refs (`showAvwapRef`, `barsRef`, `modeRef`) feed the latest values to
the single attached handler. Re-attaching on every render would race
ECharts' internal pointer-event state during drag-pan. Captured as
**FE-6** in LESSONS.

Bug caught at smoke-test: first impl used
`chart.convertFromPixel({xAxisIndex: 0}, [x, y])`. Returns NaN/undefined
because the `{xAxisIndex}` finder expects a **single number**, not a 2D
pair. Fix: use `{gridIndex: 0}` for both `containPixel` and
`convertFromPixel` so the 2D pixel input round-trips to a 2D
`[xValue, yValue]` output. **EC-16** in LESSONS.

## Persisted last_fetch_error

Closes the S21 PRIME-failure UX wart. New `quote_cache.last_fetch_error
TEXT` column with idempotent migration. Written on PRIME failures +
quote-refresh failures; cleared on either path's success
(`upsert_quote` sets NULL unconditionally; PRIME calls
`set_quote_fetch_error(None)` after `upsert_price_bars` since that
helper doesn't touch quote_cache).

Schema location decision: `quote_cache` (per `(ticker, data_source)`)
NOT `watchlist_tickers` (per `(ticker, sector_group_id)`). The same
ticker can be in multiple sector groups but the fetch state is
per-data-source, not per-group. New `Db::set_quote_fetch_error` helper
upserts a row if absent (first-ever-fetch failure for a new ticker
still gets diagnosed) and deliberately doesn't touch `last_fetched` so
the freshness check keeps treating the row as stale.

Pulse no-bars rows that have an error now render `⚠ <message>`
spanning the percentile cells with an amber left-border accent and the
full message in the row tooltip. Non-errored no-bars rows keep the
existing greyed-em-dash treatment.

`TickerTileData.fetch_error` already existed but was transient
(populated only from in-memory errors during the current refresh).
Now falls back to the persistent column when the in-memory map is
empty — same field, lifecycle extended across sessions.

## Ctrl+K command palette

Spotlight-style modal triggered by `Ctrl+K` (or `Cmd+K` on Mac) from
anywhere. Fuse.js@7.3.0 (12KB gzipped, threshold 0.4 — handles `btif`
→ `BITF.TO`). Searches four navigation surfaces:

| Category | Source | Action |
|---|---|---|
| Tickers | new `list_palette_tickers` IPC | `setActiveSection(sectorGroupId)` + S21 localStorage handoff → TickerDashboard auto-opens chart |
| Sectors | `list_sector_groups` (already loaded) | `setActiveSection(group.id)` |
| FRED series | `list_macro_tiles` | `session.macro_chart_handoff` localStorage → MacroDashboard auto-opens chart on initial tile load |
| Analysis tabs | `list_analysis_tools` | `session.analysis_handoff_tab` (S22 reuse from MACRO retrofit) → AnalysisLayout consumes after persisted-state load |

New IPC `list_palette_tickers` returns one row per `(ticker,
sector_group_id)` so navigation is unambiguous (same ticker in multiple
sectors becomes multiple searchable entries with sector context in
tertiary text). `list_tickers_with_coverage` (S16) does `SELECT
DISTINCT ticker, data_source` — wrong shape for navigation, would
collapse multi-sector tickers.

Settings sections + Pulse cells deliberately NOT indexed for v1.2.
Settings would need an `initialTab` prop on SettingsModal; Pulse cells
are dynamic state better expressed through Pulse's own filters. Tighter
scope wins.

Aggregator hook `useCommandSearchables` calls three IPCs in parallel
on mount, refetches tickers when `groups` changes (add/remove ticker →
re-aggregate). Memoized `searchables` so Fuse instance in
CommandPalette rebuilds only on real data changes, not parent
re-renders.

Modal styling tuned at user feedback:

- Backdrop opacity bumped 0.55 → 0.78 + `backdrop-filter: blur(3px)`
- Modal background `--bg-surface` → `--bg-elevated` so it reads as a
  distinct surface above the chart
- Drop shadow strengthened + subtle cyan ring (1px outer at 0.15 alpha)
- Hint / footer copy bumped from `text-tertiary` to `text-secondary`
  for legibility

Discoverability: visible `⌘K` button in AppHeader next to the gear,
both refactored into shared `.app-header__icon-btn` class wrapped in
`.app-header__actions` flex cluster.

## Right-click context menu on tiles

Three-item menu, contextually surfaced:

- **Add to WATCHLIST** when ticker isn't in WATCHLIST sector_group
- **Remove from WATCHLIST** when it is (mutually exclusive with above)
- **Purge from database…** always available, with confirm dialog

Backend: `AddTickerInput` extended with optional `data_source`
override. WATCHLIST is seeded `data_source = 'mixed'` (a routing label,
not a fetcher key). The current behavior — inheriting the group's
data_source — would write `watchlist_tickers.data_source = 'mixed'` for
every right-click add, breaking quote/history fetches. Override is
backwards-compatible: `TickerEditPanel` calls without `dataSource`
and continues to inherit.

Frontend:

- `TileContextMenu.tsx` (~80 LOC) — positioned at clientX/clientY,
  clamped to viewport, click-outside via `mousedown` capture so the
  menu closes BEFORE the underlying tile click fires. Without capture
  the click would dismiss the menu AND open the feature chart.
- `TickerTile` accepts new `onContextMenu` prop forwarding the tile +
  the React event; `e.preventDefault()` suppresses the browser's native
  menu.
- WATCHLIST membership tracked as `Set<string>` via
  `list_palette_tickers` (reuses S22 IPC), refetched on a
  `watchlistVersion` bump after any add/remove/purge.
- Purge confirm reuses the existing `.modal` pattern (narrow variant)
  with new `.view-toggle--destructive` red-bordered button.
- Transient action toast bottom-right (cyan for success, red for error,
  click-to-dismiss, ~2.4s auto-fade) reports outcome.
- When user removes a ticker from WATCHLIST while currently viewing
  WATCHLIST, the dashboard refetches tiles immediately so the removed
  row disappears.

Surface scope: TickerDashboard tiles only for v1.2. Pulse rows could
get the same menu later — different DOM target, different click
semantics, separate ship.

## Sidebar readability pass (Level 1)

User flagged the sidebar as hard to read, especially for anyone with
mild visual impairment. Diagnosis: previous values stacked **three**
accessibility taxes on the same surface — `text-secondary` mono items
at 14px with 0.08em tracking, plus parent labels in dim
`text-tertiary` at 12px ALL CAPS with 0.15em tracking. ALL CAPS strips
word silhouettes, monospace disables width-based word recognition,
tight tracking spreads letters so eye saccades work harder.

Three levels of fix proposed:

1. **Tactical sidebar-only** (chosen) — fix `.sidebar__*` rules only.
2. **Token bump app-wide** — brighten `text-secondary` + `text-tertiary`
   tokens.
3. **Settings → Comfortable mode toggle** — bigger, ongoing tax.

Built Level 1 first to see how it feels, then user asked for Level 2
on top.

Level 1 changes:

- Items: `text-secondary` → `text-primary`, `fs-sm` → `fs-md`
  (14→15px), font-weight 400 → 500, tracking 0.08em → 0.02em
- Parent labels: `text-tertiary` → `text-secondary`, `fs-xs` → `fs-sm`
  (12→14px), weight 500, tracking 0.15em → 0.06em. ALL CAPS preserved
  — display name in DB is already uppercase; CSS-level transform stays
  for hierarchy
- Sub-sector children: weight 500, tracking 0.02em
- Disabled opacity 0.35 → 0.45 (legible-but-off)
- Hover: items already at primary, now adds subtle cyan-tinted
  background instead of just bumping color

## Token brightness pass (Level 2)

Following Level 1's sidebar-only fix, brightened the two dim text
tokens app-wide. Affects every "lower-priority context" surface:
VRVP volume bars, Pulse partial-history asterisks, FRED tile
metadata, ECharts axis labels, news timestamps, modal subtitles,
footer caveats.

| Token | Before | After | Contrast vs `--bg-base` |
|---|---|---|---|
| `--text-secondary` | `#9ca3af` (gray-400) | `#b8bdc7` | 6.7:1 → ~9.4:1 |
| `--text-tertiary` | `#6b7280` (gray-500) | `#8a91a0` | 4.4:1 → ~6.0:1 |

Both now well above WCAG AAA (7:1) for secondary and AA-large for
tertiary. No hue shift — same gray family. RGB companions updated in
lockstep so `rgba(var(--*-rgb), α)` usages auto-pick-up. chartTheme.ts
mirror picks up new values via `getComputedStyle` on next page load.

Deliberately untouched:

- `--text-primary` — already bright at gray-200
- `--status-neutral` (`#6b7280`) — used only for the market-hours
  "neutral" dot where muted is intentional
- `--state-neutral` (`#9ca3af`) — SMMA palette "neutral state" color,
  semantically different (and user-customizable per S9)
- `hexToRgb` fallback in `theme.ts` — tied to SMMA palette presets

Level 3 (Settings → Comfortable mode toggle) deferred — adds ongoing
complexity tax to every future feature and only worth it if the app
were shared with users whose visual needs differ.

## Phase 4 Analysis tools — explicitly deferred from v1.2

User considered COT (Commitments of Traders) as a single high-value
Phase 4 tool, then weighed cost against alternatives in the v1.2
queue and dropped it: "the amount of work for the value — I don't
think it is there." All three Phase 4 tools (COT / AAII / VIX term)
now formally deferred from v1.2:

- COT — weekend of fetcher / parser / schema / scheduler / UI for a
  signal that applies to 5 of ~200 tickers. Lopsided ratio against
  cheaper / broader alternatives.
- AAII — weakest of the three for this app's audience; overlaps with
  widely-available retail-sentiment surveys (CNN Fear & Greed, etc.)
- VIX term structure — flat / uninteresting most of the time; only
  fires during stress.

Unblocks the next-best v1.2 targets without re-litigating Phase 4.
Update `v11_analysis_design.md` to reflect the deferral.

## Discussions parked / scope deferred

- **Pulse row right-click menu** — design parity with TickerDashboard
  tiles, but different DOM target + click semantics. Separate ship.
- **Day-of-week returns Analysis tool** — user considered, dropped
  ("really only added value for crypto, but for now we pass"). Could
  revisit if crypto-specific seasonality becomes interesting.
- **MacroSeriesView shared component** (S15 Q4) — still deferred.
  Phase 3 retrofit landed via cross-link instead. If a third FRED
  series ever wants the dual-surface treatment, this becomes the
  refactor moment.
- **Pulse cells indexed in palette** — out of scope for v1.2; Pulse's
  own filters cover the cross-state lookup ("show all BULL").
- **Settings sections in palette** — needs `initialTab` prop on
  SettingsModal. Cheap addition; deferred to a future iteration when
  Settings tabs grow.
- **Light theme / Comfortable mode toggle** — both queued post-RC1
  conditional on tester feedback raising it.
- **Multi-anchor AVWAP** (e.g. simultaneous "since earnings" + "since
  YTD low") — v1.3 candidate; v1.2 ships single anchor.
- **NFCI YoY units fix** — current "+%" framing misleads on
  near-zero standardized index. Add a `yoyKind` override on
  `MacroTileData` if it becomes annoying in practice.
- **Vol Cone / Return Distribution / Seasonality** — FeatureChart
  enhancement queue from S19/S20 unchanged. AVWAP filled the
  highest-leverage slot for this session.

## Build artifacts

- 8 commits on master, listed at top.
- All gates clean across every commit: `cargo check` clean, 9/9
  cross_section + 20/20 analysis math tests green, `tsc --noEmit`
  clean, `npm run build` ~3.8–5.0s.
- Bundle grew ~30KB / +11KB gzipped from Fuse.js (12KB gzipped); rest
  of additions are CSS / TS code at expected scale.
- Two smoke screenshots committed:
  - `Screenshot 2026-05-03 063716.png` — watermark-bug evidence (drove
    the centering fix)
  - `Screenshot 2026-05-03 084918.png` — palette-readability
    feedback (drove the modal-styling pass)

## Next session entry point

- v1.2 priority queue thinned considerably; remaining items in order
  of leverage: Vol Cone subpane (~1 evening, FeatureChart enhancement
  following S19/S22 AVWAP precedent) → Return Distribution / Seasonality
  / multi-anchor AVWAP (each ~1 evening) → CoinGecko fetcher → bull/bear
  VRVP split → true log Y-axis (Path a — manual `log10()`) → light
  theme (post-RC1, conditional) → code signing → v1.3 cleanup (delete
  Scanner.tsx + scanner_snapshot IPC)
- RC1 tester feedback still pending — no code commitments on that
  track.
- Phase 4 Analysis tools deferred — don't propose without a fresh
  user signal.
