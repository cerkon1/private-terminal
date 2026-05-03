# S23 — Responsive density Phase 1 decisions (2026-05-03)

Same-day follow-up to S22. Tester returned diagnostic info + 7 screenshots within hours of the project-04 scoping commit. Phase 1 of `.projects/04_responsive_density/design.md` shipped against ground truth.

## Tester diagnostics (load-bearing for future Phase 2 work)

- **Native resolution:** 2256 × 1504 (3:2 panel — Surface-class ultraportable).
- **Windows display scaling:** 200% recommended.
- **Effective CSS pixels:** 1128 × 752.
- **Threshold implication:** `@media (max-height: 800px)` is the right Phase 2 trigger if revisited — captures this user with a 48px buffer.

Screenshots committed to `.projects/04_responsive_density/test_user_screenshots/` (untracked — large PNGs, decide whether to commit at session-commit time).

## Honest screenshot-as-SoT vs design-doc reassessment

Design.md was written end-of-S22 before screenshots arrived; user explicitly called this out ("that document was written BEFORE you saw the screenshots — best to use the screenshots as the SOT"). What changed from doc estimates:

| Surface | Doc estimate | Actual on tester | Outcome |
|---|---|---|---|
| MarketHoursStrip | ~28px hide below threshold | ~52px (wraps to 2 rows at 1128px wide) | Bigger reclaim than expected |
| Pulse banner | ~120px | ~70px stacked (smaller than feared) | Less critical — addressed via tagline + subtitle removal anyway |
| Analysis tab strip | not flagged in doc | 7 tabs wrap to 2 lines at 1128px | **New finding — addressed via label rename** |
| Multi-indicator price-pane crushing | doc said "compression" | Price pane crushed to ~120px when 3 indicators on | Real, not addressed this session |
| Sidebar collapse | width-threshold worth investigating | Tester is 1128px wide; sidebar isn't biting | **Skip — doc was wrong on priority** |

## Decisions

### ECharts polish
- **Legend collision (no-fly zone over scroll/wrap).** Picked `right: 360` constraint over `type: 'scroll'` (single-row arrow scroll) or canvas-bottom relocation. Reason: ECharts default `type: 'plain'` wraps to multi-row when constrained — preferred for at-a-glance reading. Bottom relocation would compete with dataZoom slider + eat chart vertical budget. The 360px estimate covers the 6-button toolbar (~316px) + 44px buffer; flash msg overlap during 1.5s save is acceptable.
- **DataZoom slider sizing.** Compromise at h: 26 between original h: 20 (too thin to grab) and the user-rejected h: 32 (too thick). Cyan accent on handles is load-bearing — `borderEmphasis` (default) blended into chrome at low contrast. `handleSize: '120%'` + `moveHandleSize: 6` widens the grab target without a dedicated per-pixel hit-test. Slider-reserve at `sliderReserve = 14%` of canvas already budgets the area; size bump doesn't push price up.
- **ATR pane indentation root cause.** ECharts axisLabel min/max boundary labels echo whatever `baseAxis.min` / `baseAxis.max` are passed — for the auto-fit ATR subpane those were raw padded floats from `padBounds()` (e.g., `11.211409976946877`). 18-char strings → wide y-axis gutter → that pane's plot area starts further right than panes above. Fix: `showMinLabel: false, showMaxLabel: false` plus magnitude-aware formatter (`abs >= 100 → 0 dp`, `abs >= 10 → 1 dp`, else 2). Auto-step interval ticks (4 / 6 / 8 / 10) carry the y-axis story; boundary repeats are noise. Same pattern applies to any future auto-fit subpane indicator.
- **Subpane corner labels: β (top-left small badges) over α (centered watermarks).** User asked feasibility for "watermark Volume RSI and ATR charts." Honest argument made for β: subpanes are typically 50-80px tall — center watermarks either too small to read OR big enough to fight the data lines. Bloomberg / TradingView convention is exactly this asymmetry: big center-watermark on price, small corner-text on subpanes. Implementation via new `cornerLabelGraphic(text, grid)` helper; `graphic` changed from single object → array form `[watermark, ...cornerLabels]`. Label derivation: `ind.id.split('_')[0].toUpperCase()` works for `rsi_14 → RSI`, `atr_14 → ATR`. Future indicators with multi-word names will need a name-only field — punt on that.

### Chrome trimming
- **Liability footer nuke ("destructive" path) over conditional-render or CSS-tighten.** User explicit: "Nuke it reclaim the vertical space for the chart." Principle 9 ("don't suppress [community caveats] in UI") still satisfied because the Features-tab card (S19) carries the full SMMA scope caveat — that IS another UI surface. The chart no longer carries it as default chrome. Removed the JSX block at `TickerDashboard.tsx:417` AND the orphan `.feature-chart-pane__liability` CSS rule for cleanliness.
- **StatusBar — preserve content, tighten padding only.** User explicit: "This is BIG — it's why we're fucking building the app — nobody looks at the about in settings." Cross-promo to PrivateACB.com elevated to load-bearing brand identity. Padding `var(--space-xs) var(--space-sm)` (4px 8px) → `1px var(--space-sm)`; `line-height: 1.2` added to defeat browser-default ~1.5. Saves ~6-8px without shrinking font, letter-spacing, or copy. Re-establishes that compact-not-removed is the right answer for brand surfaces.
- **AppHeader 2-row → 1-row collapse.** New layout: title (left) · meta-block (path + size + series + bars, ellipses on overflow) · actions (`⌘K`, `⚙` right via `margin-left: auto`). Critical CSS: `.app-header__meta { flex: 1 1 0; min-width: 0; overflow: hidden }` so the meta block absorbs available space and clips. `.app-header__meta-item { flex-shrink: 0 }` so size/series/bars don't compress (path is the ONLY ellipsis target). Without `min-width: 0` the flex item refuses to shrink below content width and the row would wrap. Path's click-to-copy preserved via the existing `copyPath` handler. Backwards behavior on narrow widths: only path ellipses; size/series/bars stay legible.

### Pulse-specific
- **Banner tagline removal.** User: "the line your universe · right now vs the last 5 years is extra — we don't need it." Removed `<span class="pulse__banner-tagline">` plus orphan CSS rule.
- **TabIntro subtitle removal — generalized via optional prop.** User wanted to lose the always-visible explainer; collapsibles ("How to read this", "The math") preserved. Made `TabIntro.subtitle` optional (`subtitle?: string`) rather than ripping `<TabIntro>` out wholesale. Backwards-compatible — 7 Analysis tabs that pass subtitle keep working unchanged. Conditional render `{subtitle && <p>…</p>}`. The CLAUDE.md S17 HARD CONSTRAINT for Analysis tabs was for their consistent presentation pattern; Pulse is its own top-level surface (cross-section heatmap with banner), not strictly an Analysis tab — the pattern hard-rule doesn't apply.
- **"How to read this" copy rewrite found 3 stale bugs from S21 lineage drift.** User asked "Is there room for clarity here?" Listed all three honestly — (a) "Click a row to open" was wrong; design is **ticker-column-only click** per S21 (cell tooltips would be one accidental misclick from navigation). (b) "(Pending — wired in a follow-up)" parenthetical was stale; click navigation shipped in S21. (c) "Sortable by any column" was overstated; only AGE / LEVEL / RSI / ATR / VOL / DD have the `--sortable` class (TICKER and REGIME don't). Rewrite also tightened percentile-rank phrasing — "today's price is in the top 5% of the last 5 years" reads colloquially but is ambiguous (top-5%-of-time vs top-5%-of-values); replaced with "today's price is higher than 95% of the last 5 years' closes" for definitional precision. REGIME and AGE split into separate bullets for scannability. `10-` → `≤10`. 7 → 8 bullets, no length increase.

### Analysis section
- **Tab labels shortened over per-tab padding tightening.** Three labels renamed: `Recession Prob → Recession`, `Financial Conditions → FCI`, `Regime Quadrant → Regime`. Math: 7-tab strip ~1044px → ~750px estimated. Fits single row at tester's 880-908px content area. Padding tightening (alternative path) saves ~10-15px per tab × 7 = ~80px — would have helped but renames alone are sufficient. Reserved padding-tightening for follow-up if needed.
- **Migration via UPDATE statements at end of seed.sql.** `INSERT OR IGNORE` only seeds fresh DBs. Existing DBs at the tester's setup retain old display_names without migration. Pattern matched to existing `UPDATE sector_groups SET user_hidden = 1 WHERE id = 'scanner'` (S21) — idempotent UPDATE blocks at the bottom of seed.sql, run every boot. No schema change, no migration table needed.
- **`FCI` abbreviation precedent.** S17 PROGRESS.md already used `FCI` shorthand throughout (`Financial Conditions Index`). Industry-standard abbreviation. The tab label adopting it aligns the visible UI with the codebase / docs vocabulary.

### MarketHoursStrip
- **Time-only drop, accepted partial wrap.** User said "Maybe we lost the time only" → "Leave it" when I flagged the strip still wraps to 2 rows at 1128px width. Honest tradeoff stated up-front: dropping time alone shrinks each chip to ~135px (from ~150-160px) but doesn't tip 8 onto a single row at this width — needs full tightening pass (font + padding) on top, which user declined. Wrap state accepted; strip integrity (info density, brand aesthetic) preserved over flat reclaim.
- **Time stays in chip's hover tooltip.** The chip's `title` attribute already carries `${ex.name} · ${ex.tz} · ${lt.hhmm} local · OPEN/CLOSED · ticker pct` — full info preserved on hover. No regression.

### Phase 2 / Phase 3 deferred (load-bearing decision)
- **Phase 1 reclaim already exceeded design-doc estimate.** ~100-130px reclaimed app-wide for **everyone** (not just small screens). The case for Phase 2 (auto-detect `@media (max-height: 800px)` to hide MarketHoursStrip + StatusBar + trim Pulse rows) weakened materially — marginal gain of another ~50-70px only for users below threshold.
- **Phase 3 (Settings density toggle) carries ongoing tax.** Every future feature would need a "test at 3 densities" cycle. Doc explicitly carved out vertical-density as the case where this MIGHT be right answer if Phase 1+2 fail — but Phase 1 alone may have rendered both Phase 2 and Phase 3 unnecessary.
- **Wait for tester re-test signal before building either.** Build the installer with Phase 1 work, ship to tester, get fresh feedback. If still cramped → Phase 2. If satisfied → close project 04 entirely. Phase 3 stays parked indefinitely until proven necessary.

## Patterns established / reusable

- **`cornerLabelGraphic(text, grid)` helper** — pin small text to any pane's top-left via `left: grid.left + 6, top: ${parseFloat(grid.top) + 0.5}%`. Reusable for any future per-pane labeling need.
- **Idempotent display_name migration via UPDATE-at-bottom-of-seed.sql.** Standard pattern for evolving display labels of registry-row entries (analysis_tools, sector_groups, indicators, news_feeds). Don't add a migration framework yet — single-statement UPDATEs cover the cases we have.
- **TabIntro `subtitle?: string` precedent.** Optional-prop softening of S17 HARD CONSTRAINT — applies when a host surface (banner, page header) already carries the descriptive context that `subtitle` was meant to provide.
- **AppHeader 1-row flexbox shape** — `min-width: 0` + `overflow: hidden` on the flex-1 child + `flex-shrink: 0` on protected items is the universal recipe for "single row, one ellipsis target, others stay sized." Reuse for any future strip with mixed flexible / fixed-width content.

## Anti-patterns avoided

- **Did not destructively delete Scanner.tsx + scanner_snapshot IPC** — those are still preserved one-release-back per S21 revert-safety. v1.3 cleanup territory.
- **Did not refactor pane-index math** despite the multi-indicator crushing observation — fix would touch `layoutGrids` proportions + chart-container scroll behavior. Held until either (a) user prioritizes chart-pane crushing explicitly or (b) Phase 2 adds the @media block where the relevant CSS lives anyway.
- **Did not pre-build Phase 2 `@media` block speculatively.** Honest reassessment said "wait for tester re-test." If Phase 1 reclaim alone fixes the issue, Phase 2 work would be wasted complexity.
- **Did not build `cornerLabelGraphic` as a generic React component.** Stays as an option-builder helper inside FeatureChart.tsx. Reaches into `getChartTheme()` directly. Lifting to a shared component would be premature abstraction — only one chart uses it today.
