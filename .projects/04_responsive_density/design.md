# Screen-density adaptation — v1.2 follow-up

Status: **CLOSED.** Phase 1 shipped S23 (12 edits across 8 files, ~100–130px reclaimed app-wide). Tester re-tested rc.2 build and confirmed satisfaction with the viewing-element changes. Phase 2 (`@media (max-height)` density rules) and Phase 3 (Settings → Density toggle) deferred indefinitely — no remaining user signal. Re-open the project only if a future tester surfaces concrete cramping that Phase 1 didn't already address.

## Origin

Tester feedback at end of S22 (2026-05-03). App works correctly on the
tester's machine but doesn't display well. User flagged two examples
explicitly, framed as a non-exhaustive sample:

1. **Pulse** — only ~25% of vertical screen shows the actual ticker
   table; the rest is consumed by app chrome (header, market-hours
   strip, section controls, banner, TabIntro, sticky column header)
2. **FeatureChart** — the dataZoom slider at the bottom is barely
   visible and difficult to grab/adjust

User: "these were just two examples — so somehow we have to adjust for
screen resolution."

## Honest diagnosis

Private Terminal was developed on a higher-resolution display
(developer machine 2560×1600 native; Tauri webview at default 100%
scaling). The CSS uses fixed pixel sizes for most chrome elements —
header heights, banner heights, slider heights, padding. When run on
common consumer laptops at Windows display scaling 125% or 150%, the
**effective resolution drops** (1920×1080 at 150% reports as
1280×720 to the app), and the fixed-pixel chrome stays the same size
in CSS pixels — proportionally consuming a much larger fraction of
the screen.

This is a real blind spot in our existing development methodology. We
have not historically tested at 125%/150% scaling or at 1366×768
(common budget-laptop native). The Bloomberg-y aesthetic is
inherently information-dense; combined with our current chrome
budget, we're effectively user-hostile on common consumer setups.

## Diagnostic info needed before coding

To target fixes precisely without throwing darts:

1. **Tester's screen resolution** — Right-click desktop → Display
   Settings → "Display resolution"
2. **Tester's Windows display scaling** — Same panel → "Scale" — the
   load-bearing variable here. 100% / 125% / 150% / 175% are the
   common values.
3. **Screenshots** of:
   - Pulse with its typical scroll-state visible
   - A FeatureChart in candlestick mode (any ticker, with VOL on so
     the dataZoom slider shows in its full context)
   - One MACRO tile dashboard
4. **Optional** — Tauri webview zoom level, if they've adjusted it
   (Ctrl+0 resets to 100%)

The screenshots tell us **which surfaces are the worst offenders at
this user's setup**, so Phase 1 can target the highest-leverage
fixes first.

## Chrome inventory — vertical space accounting

Approximate fixed-pixel heights consumed before user content starts.
Numbers from CSS inspection of `app.css`; each is a CSS-pixel cost
that scales 1:1 with the user's display scaling.

| Layer | Height | Source | Notes |
|---|---|---|---|
| AppHeader (title row + path/size/series row) | ~60px | `.app-header` | Fixed; the path+stats row is the most-trimmable |
| MarketHoursStrip | ~28px | `.market-hours-strip` | Fixed; could be hidden below a height threshold |
| StatusBar (bottom, cross-promo) | ~24px | `.status-bar` | Fixed; could be hidden below threshold |
| Section controls row (REFRESH / HEATMAP / range pills) | ~50px | `.macro-dashboard__controls` | Fixed |
| Pulse banner (PULSE title + tagline + stats + filter chips) | ~100-120px | `.pulse__banner-*` | **Biggest single offender on Pulse**; verbose stack |
| Pulse TabIntro (subtitle + collapsibles) | ~30-200px | `.tab-intro` | Variable; collapsed default ~30px |
| Pulse sticky column header | ~40px | `.pulse__head-row` | Fixed; needed |
| FeatureChart toolbar (AUTO Y / VOL / VRVP / DD / AVWAP / PNG) | ~36px | `.feature-chart__toolbar` | Fixed |
| FeatureChart liability footer | ~30-50px | `.feature-chart-pane__liability` | **Three lines of disclaimer copy**; big trim candidate |
| ECharts dataZoom slider | ~30px default | ECharts inline | Slim handles especially hard at low contrast |

**Aggregate chrome before content:** ~290-350px on a typical Pulse or
FeatureChart view. On 720px effective height, that's 40-49% chrome
before any user data renders. On 1080p native (no scaling), it's
27-32% — comfortable. The squeeze is non-linear in scaling.

## Phased plan

### Phase 1 — Quick wins (no diagnostic needed; ~half session)

These help every user regardless of resolution; ship before the
diagnostic round-trip if we want immediate progress.

1. **DataZoom slider: bigger + brighter handles**
   - File: `src/components/charts/FeatureChart.tsx`
   - Increase `dataZoom.height` from default ~30 to ~50
   - Tint `dataZoom.handleStyle.color` to `theme.accentCyan` (currently
     uses muted `theme.zoomBg`)
   - Bump `dataZoom.handleSize` so the grab area is larger
   - Verify `dataZoom.brushSelect: false` (avoid accidental brush mode)
2. **FeatureChart liability footer: collapse to one line**
   - File: `src/components/TickerDashboard.tsx`
     `feature-chart-pane__liability` div
   - Currently three sentences; trim to a single short line "Decision
     support, not investment advice." Move the SMMA-Ribbon scope
     caveat into the SMMA Ribbon Features card (already documented
     there per S19) so the footer doesn't carry it.
   - Saves ~20-30px on every feature-chart view
3. **Pulse banner: vertical compaction**
   - File: `src/components/pulse/PulseDashboard.tsx`
     `pulse__banner` block + `app.css` `.pulse__banner-*` rules
   - Move filter chips into the same row as the stats split (currently
     stacked); collapse the verbose tagline; keep PULSE title prominent
   - Target: ~120px → ~60px (-60px)

Cumulative Phase 1 saving: ~110-130px back to the user.

### Phase 2 — Density-aware layout (after diagnostics; ~session)

Conditional CSS based on viewport height; targets the worst-off
configurations without affecting good-screen users.

1. **`@media (max-height: 800px)` rule block** in `app.css`
   - Trim `app-header__sub-row` padding (path/size row gets tighter)
   - Hide `market-hours-strip` entirely below threshold (or make it
     a collapsible)
   - Hide `status-bar` cross-promo footer below threshold
   - Reduce padding on section controls row
2. **Pulse row height reduction** at small viewports
   - Currently 26px per row — tight already; could go to 22px below
     threshold
3. **Sidebar auto-collapse below width threshold** (already partially
   exists; verify behavior at small widths)

Total Phase 2 saving: another ~80-100px on constrained machines.
Zero impact on full-resolution users.

### Phase 3 — Settings → "Density" preference (only if Phase 1+2 not enough; ~session)

Add a user-controlled density preference under Settings → Appearance.
Three modes:

- **Compact** — current chrome trimmed maximally; for 720p effective
- **Default** — current behavior at 1080p+ effective
- **Comfortable** — bumped paddings + bigger fonts; for users who
  want readability over density

I argued AGAINST a density toggle in S22 (Level 3 of the readability
work) on grounds of ongoing complexity tax — every new feature
needs to look right at all three densities. That argument still
holds for **horizontal/text density**.

For **vertical density specifically**, where one user's monitor
config flatly differs from another's at the OS level, this is the
right answer if Phase 1 + Phase 2 don't get us there. The toggle
becomes a one-time tax, not a per-feature one — the modes are pure
CSS variable overrides on chrome heights, no component-level
branching.

Defer Phase 3 unless the diagnostic round shows that no single
chrome budget works for the population.

## Open questions to resolve once screenshots arrive

1. **What's the tester's actual effective resolution?** Determines
   the threshold for `@media (max-height: …)` rules. Likely either
   720px (1080p × 150%) or 768px (1366×768 native) given the
   reported severity.
2. **Is the issue ONLY vertical, or also horizontal?** The user
   flagged vertical examples; horizontal cramping is possible too.
   Sidebar collapse + content-width overflow are separate
   considerations.
3. **Does the dataZoom slider improvement need ECharts-side work,
   or is CSS enough?** The slider is rendered by ECharts; some
   styling is via JS option, some via CSS theme. Prefer the JS
   option for portability.
4. **Pulse banner: how compact is acceptable visually?** The PULSE
   branding moment is part of the v1.2 marketing identity (S21).
   Trimming too aggressively undermines that. Need user signoff on
   the proposed trim shape.
5. **Liability footer: is the SMMA-scope caveat load-bearing on the
   feature chart itself, or is the Features-tab card sufficient?**
   Legal-flavored decision; user judgment.

## Files likely touched

**Phase 1:**
- `src/components/charts/FeatureChart.tsx` (dataZoom config)
- `src/components/TickerDashboard.tsx` (liability footer)
- `src/components/pulse/PulseDashboard.tsx` (banner restructure)
- `src/styles/app.css` (related selectors)

**Phase 2:**
- `src/styles/app.css` (`@media` rules)
- Possibly `src/styles/tokens.css` (new tokens for compact-mode
  paddings if we go that route)

**Phase 3:**
- `src/styles/tokens.css` (density token tiers)
- `src/styles/app.css` (consume density tokens)
- `src/components/SettingsModal.tsx` Appearance tab
- `src/hooks/usePersistedState.ts` consumer for `session.density`

## Effort summary

| Phase | Time | Diagnostic dependency |
|---|---|---|
| 1 — Quick wins | ~half session | None |
| 2 — Density-aware layout | ~session | Need tester's effective resolution to set threshold |
| 3 — Density preference toggle | ~session | Only if Phase 1+2 don't suffice |

## Anti-patterns to avoid

- **Don't replace fixed pixels with `vh` units globally.** `vh`
  fights tile-grid layout (which deliberately uses fixed `grid-auto-rows`
  for tile consistency, see LESSONS FL-2). Apply density-aware
  heights only to chrome layers (header / banner / footer / slider),
  not to data tiles.
- **Don't add component-level density branches.** Render a single
  React tree; let CSS handle density. Otherwise every feature pays
  the test-at-three-densities tax.
- **Don't over-engineer Phase 3 ahead of need.** The user might be
  satisfied after Phase 1 alone.

## Reference

- S22 readability passes (commits `74f0b92` sidebar, `22525e9` token
  bump) — adjacent territory; the readability work was about
  contrast/legibility, this work is about vertical density. Some of
  the same files touched.
- LESSONS FL-1 — the original `flex: 1 needs definite parent height`
  gotcha that drives our app-shell layout shape. Constrains how we
  can compress chrome without breaking flex propagation.
- LESSONS FL-2 — fixed tile-grid row heights. Don't violate this in
  any density work; tile sizes are intentional.

## Next session entry point

Tester provides:
- Screen resolution + Windows display scaling values
- 2-3 screenshots (Pulse, a FeatureChart, MACRO dashboard) at their
  typical zoom/use

I will:
- Calculate exact effective resolution + chrome cost on their setup
- Pick the highest-leverage Phase 1 win to ship first
- Set the `@media` threshold for Phase 2 based on actual measurement
- Defer Phase 3 unless 1+2 don't get there
