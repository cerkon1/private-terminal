---
name: S18 Regime Quadrant decisions
description: Phase 3 finish — Macro Regime Quadrant build decisions, including baseline-anchored crosshairs, RRG/Regime parity rules, and the deliberate divergences.
type: project
---

# S18 — Macro Regime Quadrant decisions

S18 closed out v1.1 Analysis Phase 3 by shipping the last tool — the Macro Regime
Quadrant. Master at `d471633` after S18.

## Decisions locked

### Growth axis: INDPRO YoY (vs NAPM)
- **Why:** INDPRO has clean continuous monthly history; NAPM publication has
  historical gaps that would force empty-state handling and break the
  trail rendering. NAPM is forward-looking but the data hygiene cost
  outweighs that benefit at v1.1 scope.
- **How to apply:** Default growth axis is FRED `INDPRO`. NAPM toggle
  deferred to v1.2 — would land as a per-request enum like the inflation
  proxy. Watch FRED's NAPM publication timing if/when this is revisited.

### Inflation axis: CPI YoY default + Core PCE toggle
- **Why:** CPI is the headline-news number users will recognize; Core PCE
  is what the Fed actually targets. Both already seeded since M2
  (`CPIAUCSL` + `PCEPILFE`). Toggle is cheap (per-request `inflation_proxy`
  field, "cpi" | "pce"). Both are monthly index series so the YoY math
  is identical.
- **How to apply:** Default to CPI; expose a dropdown in the toolbar.
  Core PCE selection persists per-session via `usePersistedState`.

### Crosshairs anchored at long-run baselines (NOT at 0/0)
- **Why:** US inflation has been positive for 50+ years. A 0/0 crosshair
  split would put the entire trail in the upper half of the chart —
  non-informative. Long-run mean baselines (computed from the full
  joined history) anchor the quadrant split at "above-trend vs
  below-trend." The chart now reads as a regime classifier rather than
  an absolute-level scatter.
- **How to apply:** Backend computes `growth_baseline` + `inflation_baseline`
  as arithmetic means of the full joined YoY history. Frontend places
  crosshair `markLine` at both baselines. `axis_bounds` expand to include
  baselines (so the crosshairs always sit inside the plot area).

### Crosshair styling — Regime explicit, RRG implicit (deliberate divergence)
- **Why:** RRG's quadrant boundary at x=100 / y=100 lands on a regular
  gridline that the dashed `splitLine` happens to render anyway, so the
  split is visible without an explicit `markLine`. Regime baselines fall
  at non-round values (~2.74 / 3.52) that don't coincide with gridlines,
  so the boundary needs an explicit cue. Three styling iterations during
  smoke test confirmed this — `markerLine`/solid (correct intent),
  `borderSubtle`/dashed (too subtle, "the white line no longer appears"),
  back to `markerLine`/solid + width 1 with a code comment documenting
  why RRG and Regime intentionally differ here.
- **How to apply:** Regime gets `markLine` with `theme.markerLine` solid
  width 1. RRG stays without an explicit crosshair. Don't force them to
  match where the data shape doesn't allow it.

### Calendar-month inner-join for series alignment
- **Why:** INDPRO and CPI/PCE observation dates within a month don't
  always coincide (INDPRO publishes mid-month, CPI publishes early-month).
  Exact-date inner-join would drop most pairs. Joining on `(year, month)`
  with a `BTreeMap` key preserves all valid pairs.
- **How to apply:** In `regime_quadrant.rs`, build the join via
  `BTreeMap<(i32, u32), MacroPoint>` keyed on `(year, month)` from
  `chrono::Datelike`. Use the later of the two observation dates as the
  pair's representative date.

### YoY helper math (`yoy_pct_change` in `analysis/mod.rs`)
- **Why:** Multiple Phase 3+ tools may need 12-month percent change on
  monthly level series. Centralizing avoids re-deriving the formula
  per tool and keeps the NaN guards consistent.
- **How to apply:** `yoy_pct_change(points, months) -> Vec<MacroPoint>`.
  Operates on row offsets (input must be regular monthly series). NaN
  for the first `months` entries (warm-up) and for entries where the
  prior reference is non-positive (avoids div-by-zero / sign-flip).

### Quadrant labels: in-place fontSize bump (NOT watermark-style)
- **Why:** First draft fontSize 10 was too small to read. User considered
  the watermark-behind-data pattern (mirroring `FeatureChart.tsx:769-787`)
  but rejected it as too complex for the value — 4 graphic entries
  instead of 1, dynamic positioning required for Regime (quadrants split
  at runtime baselines), color/alpha tradeoffs. Picked the simpler
  in-place fix: bump fontSize and apply consistently across both charts.
- **How to apply:** fontSize 16 + `left: 80` (was 60) for left-side
  labels in both RRG and Regime. The `left` move was driven by RRG's
  longer y-axis tick labels ("115.0" — 4 chars) clipping the leading
  letter of LAGGING. Regime didn't strictly need the move (its tick
  labels are 1-3 chars) but applied for visual symmetry per "ensure
  both RRG and RQ get the same treatment."

### Option α scope (Quadrant only, NO shared `<MacroSeriesView>` retrofit)
- **Why:** S15 Q4 spec'd that Recession Prob + FCI should appear as
  BOTH MACRO tiles AND Analysis tabs, ideally via a shared component.
  S17 lean path shipped Analysis-only. S18 considered landing the
  shared `<MacroSeriesView mode="tile" | "chart">` component alongside
  Regime Quadrant (Option β). Picked Option α (Quadrant only) — Phase 3
  lean was the right call last time, and shipping Quadrant alone
  validates the trail-rendering reuse before introducing a shared
  abstraction. ~6-8 hr vs ~10-12 hr.
- **How to apply:** MACRO-tile retrofit stays deferred. If/when it
  lands, the shared component would absorb RecProb + FCI + potentially
  a future RegimeQuadrant tile representation.

## Quadrant naming convention (Regime Quadrant)

- **TR — Reflation** (above-trend growth + above-trend inflation, green)
- **BR — Goldilocks** (above-trend growth + below-trend inflation, blue)
- **BL — Disinflation** (below-trend growth + below-trend inflation, gray)
- **TL — Stagflation** (below-trend growth + above-trend inflation, red)

Standard macro-quadrant convention (Bridgewater "All Weather" style).
Quadrant fills use the same color tokens as the labels for visual
consistency. Stagflation/Disinflation alphas at 0.09 (bumped from
0.06/0.07 first draft) for stronger left-half contrast.

## Smoke-test outputs

Four screenshots in `.projects/01_initial_design/screenshots/`:
- `Screenshot 2026-05-02 072116.png` — CPI YoY 24mo, head in DISINFLATION
- `Screenshot 2026-05-02 072205.png` — Core PCE 24mo, head near baseline
- `Screenshot 2026-05-02 072336.png` — Core PCE 48mo, COVID-era spike visible
- `Screenshot 2026-05-02 074346.png` — RRG with fontSize 13 showing the
  LAGGING-clip issue that drove the `left: 80` fix.
