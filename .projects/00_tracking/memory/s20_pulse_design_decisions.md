---
name: S20 Pulse design + database reformulation decisions
description: v1.2 killer-feature design (Pulse percentile cross-section heatmap), Time Machine + Conviction Forge evaluated + rejected, full DB seed reformulation (symmetric US/CA + new top-level groups), sidebar polish + app-wide scrollbar theming.
type: project
---

# S20 — Pulse design + database reformulation

Master at `05416a0` after S20. Three-arc session: (1) killer-feature
brainstorm; (2) full DB seed reformulation as Phase 0 of the Pulse
build; (3) sidebar polish + global scrollbar theming.

## Pulse — the v1.2 killer feature (LOCKED)

### Concept
Single screen showing every watchlist ticker + every macro series as
percentile-rank vs its own trailing-5y history across 7 columns:
**REGIME · AGE · LEVEL · RSI · ATR · VOL · DD**. Sortable, filterable
(ALL / BULL / BEAR / EXTREMES), click-cell-to-chart. The "morning
weird-detector" — at-a-glance sense of what in the universe is at
extremes right now.

### Why this is THE killer for THIS app
- **Architectural ace nobody else can copy:** local-first SQLite +
  curated personal universe + all bars cached together. Bloomberg
  shows the world (can't ask "MY watchlist's regime"); TradingView is
  one-ticker-per-tab.
- **Pure descriptive, zero prediction.** Respects principle 9
  ("decision support, not investment advice") that S17's TabIntro
  pattern was codified to protect.
- **Compounds with everything already built.** SMMA / RSI / ATR /
  drawdown / FRED / sector_groups — all reusable, no new fetchers.

### Two alternatives evaluated + rejected
- **Conviction Forge** (Monte Carlo trade simulator with conviction
  gauge 0-100, proposed by an external AI in `01_initial_design/
  potential_killer_feature.mb`). **Rejected** — gauge values like
  "Probability of +8% in 10 sessions: 62%" are trade signals
  regardless of disclaimer wording. Plus: 5-input "Narrative
  Resonance Score" weights are arbitrary numerology with double-
  counting (correlated inputs); claimed Monte Carlo calibration is
  curve-fit waiting to happen; depends on data the app doesn't have
  (news sentiment, fundamentals, real-time order flow); growth/
  monetization framing is wrong for a personal-use tool.
- **Time Machine** (date picker that snaps the entire dashboard to
  any past date, proposed by me). **Killed by data-window
  constraint** — Yahoo's `/v8/chart` only serves ~5y back, so the
  demo wow ("show 2008 GFC") doesn't work. Macro-only time machine
  technically viable (FRED has decades) but loses the whole-dashboard
  punch.

### Pulse — the column inventory (locked)
| Column | Type | Source |
|---|---|---|
| REGIME | chip BULL/BEAR/NEUTRAL | SMMA Ribbon current state |
| AGE | days | bars since most recent regime flip |
| LEVEL | percentile 0-100 | current value vs 5y own-history |
| RSI | percentile 0-100 | current RSI(14) vs 5y own-history |
| ATR | percentile 0-100 | current ATR(14) vs 5y own-history |
| VOL | percentile 0-100 | trailing-5d-avg volume vs 5y |
| DD | signed % | `(close / running_max - 1) × 100`, NOT percentile |

NEWS column **considered + dropped** during design — too ephemeral;
news count varies more with media cycles than with what users care
about.

### Design decisions worth flagging for build time
- **Universal indicator compute** — Pulse ignores per-ticker
  `indicator_settings.enabled` flags. Runs SMMA/RSI/ATR with default
  params for every watchlist ticker so every row gets every column.
- **Trailing-5y baseline** for percentiles. v1.2 toggle for 1y/3y/max
  if requested.
- **HTML grid (not ECharts heatmap)** per Correlations precedent —
  cleaner sortable headers, easier cell behaviors.
- **Macro rows** show LEVEL only; em-dash everywhere else.
- **Coverage gracefulness** — tickers with <252 bars get asterisk
  suffix + tooltip; <30 bars get all-em-dash row; 0 bars get greyed.

### How to apply
Spec is locked in `.projects/03_cross_section_heatmap/pulse_design.md`
(~370 lines). Build session reads it top-to-bottom. 7 open questions
to lock at build time. Pinned at sidebar position 0
(`PINNED_IDS = ['pulse', 'scanner', 'analysis', 'macro', 'news']`).

## Database reformulation — Phase 0 of Pulse (SHIPPED S20)

### Why reformulate, not extend
User explicitly asked for **structural mirroring** between regions —
US EQUITIES should have the same sub-sector tree as CA EQUITIES, not
just a flat list of mega-caps next to CA's deep sub-sectoring. Mirror
makes Pulse demonstrable (US vs CA breadth visible side-by-side); it
also feels coherent in the sidebar.

Reformulation requires a **full DB reset** at deploy time — not an
`INSERT OR IGNORE` migration on top of the old DB (would leave orphan
rows). User executes the reset workflow per the FeaturesTab Tip.

### 12 locked decisions
1. **Drop BRK-B** — conglomerate doesn't fit any sub-sector cleanly.
2. **Move GLXY + WULF to US Crypto Miners** — US-listed; geography
   aligns with listing exchange.
3. **CRYPTO stays flat, drop USDT-USD + USDC-USD** — stablecoins are
   permanent flat rows = Pulse noise.
4. **VIX & RISK as top-level group** (not folded into INDICES).
5. **Accept Telecom + Healthcare asymmetries** — US Telecom 3 vs CA
   Telecom 4; CA Healthcare 2 vs US Healthcare 8. Reflects market
   structure, not a bug.
6. **CA Tech: 5 names** — SHOP/CSU/OTEX/KXS/DSG.
7. **Sub-sector COMMODITIES** into Energy / Metals / Agriculturals.
8. **Sub-sector INDICES** into Americas / Europe / Asia-Pacific.
9. **Add Healthcare / Staples / Utilities / REITs to BOTH regions** —
   full mirror across 10 standard equity sub-sectors.
10. **WATCHLIST top-level group seeded empty** — personal-additions
    slot at top of user-managed sidebar section. Pulse picks it up as
    its own section header. Prevents users from feeling the seed is
    the whole universe.
11. **Initial-prime burst risk: LOW** — 176 tickers × 1 historical
    fetch each, semaphore-capped at 5 → <1 minute total. Mitigation:
    optional batched-prime extension if Yahoo tightens.
12. **Migration vs full reset: full reset.** No `INSERT OR IGNORE`
    migration path supported. Documented in design doc + new tip.

### Final structure
```
Pinned: PULSE · SCANNER · ANALYSIS · MACRO · NEWS
User-managed:
  WATCHLIST (empty)
  INDICES (3 sub-sectors)
  US EQUITIES (10 sub-sectors)
  CA EQUITIES (10 sub-sectors)
  CRYPTO (flat, 14)
  COMMODITIES (3 sub-sectors, 11 total)
  FX (flat, 6)
  BONDS & RATES (flat, 6)
  VIX & RISK (flat, 1)
```

Final counts: **176 tickers + 29 FRED = 205 Pulse rows**, in the
sweet spot.

### MACRO additions
4 new FRED series — all `tile_visible=1`:
- `M2SL` — money supply (Liquidity category)
- `DTWEXBGS` — trade-weighted dollar (Liquidity)
- `BAMLH0A0HYM2` — HY credit spread (Risk)
- `DCOILWTICO` — WTI from FRED (Energy — deeper history than `CL=F`)

### How to apply
Implementation lives in `src-tauri/src/db/seed.sql`. For a clean
upgrade, user runs the manual reset workflow:
1. Settings → Storage → Backup-copy
2. Close app
3. Rename or delete DB file at the path in app header
4. Reopen app — fresh seed runs against empty DB

## Sidebar layout polish (SHIPPED S20)

### Width 180 → 220px + child-padding bump
Smoke test of the new sidebar revealed 180px felt cramped with the
deeper sub-sector tree. Bumped to 220px (+22%), then tightened
parent/child hierarchy by bumping `.sidebar__item--child`
left-padding from `var(--space-xl)` to
`calc(var(--space-xl) + var(--space-xs))`.

### Themed scrollbars app-wide via `*` selector
**Single source of truth at the top of `app.css`.** Replaces per-element
scrollbar styling that I'd added separately to `.sidebar__scroll`,
`.scanner-table-wrap`, and `.app-main`.

```css
*, *::before, *::after {
  scrollbar-width: thin;
  scrollbar-color: var(--border-emphasis) transparent;
}
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--border-emphasis);
  border-radius: 3px;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
```

### Why
- Replaces the default Windows scrollbar (white-ish track that fights
  the dark theme) with a dim-tone bar matching the FeatureChart
  dataZoom slider styling.
- Both `scrollbar-width:thin`/`scrollbar-color` (Firefox + spec) AND
  `::-webkit-scrollbar` pseudos must be set — the Tauri webview is
  Chromium-based but cross-browser consistency is cheap.
- New scrollable surfaces inherit automatically.

## REFRESH vs PRIME — architecture notes (diagnosed during smoke test)

User reported "not all tickers have data" after the seed re-ran on top
of the existing DB. Investigation found two separate fetch paths:

| Action | Fetches | Where |
|---|---|---|
| **REFRESH** (per-section) | Current quote → `quote_cache` | Top-right of each ticker dashboard |
| **PRIME** (one place, global) | Historical bars → `price_history` | SCANNER section → PRIME button (S9) |

For **new tickers** added via the seed, REFRESH gives them a price
but the change-percent columns (1w/1m/YTD/1Y) stay `—` because
`price_history` is empty. PRIME (S9 `prime_scanner_histories`) is the
fix — batch-fetches historical bars for any ticker with zero bars.
Function correctly handles the new parent/child sub-sector structure
(iterates leaf groups, skips parents). No code change needed —
existing feature already covers the case.

## Course corrections in-session

- **Time Machine before checking data window.** Proposed Time Machine
  as the killer feature before verifying Yahoo's history limit. User
  pointed out we only have 5y of ticker bars; the demo wow ("show
  2008") doesn't work. Should have checked data availability first.
- **Refresh-button confusion misread initially.** User said "not all
  tickers have data" — almost dove into modifying the refresh path
  before tracing architecture. The real issue was REFRESH only
  fetches quotes; HISTORY needs PRIME. Existing PRIME button already
  handles this — explained instead of modified.
- **Per-element scrollbar styling refactored to global.** First pass
  styled `.sidebar__scroll` then `.scanner-table-wrap` then
  `.app-main` separately. User asked for app-wide consistency;
  collapsed to a single `*` selector at the top of `app.css`. Removed
  the three per-element duplicates.
- **Watermark-style Pulse cells considered + rejected** during the
  earlier S19 conversation; carried into Pulse design as a
  documented non-goal. In-place column cells with bar-glyph + raw
  number in tooltip is the locked choice.

## Future polish parked / scope deferred

- **Pulse implementation** — design locked, blocked on user executing
  manual DB reset so Pulse v1 ships against a clean universe.
- **Old `futures_fx` group cleanup** — only disappears on full reset;
  current upgrade-state DB has it alongside the new structure.
- **Optional batched-prime extension (Phase 0d)** — original design
  considered staging in batches of 30-50 with delays. Skipped —
  current PRIME with semaphore=5 handled the user's smoke test fine.
  Add only if Yahoo throttling observed.
- **MOVE bond-vol index** for VIX & RISK — Yahoo coverage unreliable;
  skipped for v1.2.
- **NAPM toggle for Regime Quadrant growth axis** — v1.2 escalation
  if INDPRO YoY's backward-looking nature creates narrative-mismatch.
- **Per-row collapse / expand UI** — at 205 rows Pulse is at the
  upper end of the sweet spot. If universe grows beyond 200, add
  per-section collapse to the heatmap.
