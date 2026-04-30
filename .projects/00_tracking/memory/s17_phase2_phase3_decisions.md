# S17 — v1.1 Analysis Phase 2 + Phase 3 (lean) decisions

2026-04-30. Single-day session covering Phase 2 (Pairs + RRG) + Phase 3 lean (Recession Prob + FCI) + the cross-cutting `<TabIntro>` UX pattern. 5 commits across 2 feature branches; both fast-forwarded to master and deleted. End state: master at `d2e9a30`.

---

## Phase 2 design lock-ins (resolved before code)

1. **RRG math choice.** Weekly resampling (last close per ISO week, Bloomberg convention), 14-week RS-Ratio lookback, 5-week RS-Momentum lookback. Formula:
   ```
   RS_t        = ticker_t / benchmark_t
   RS_Ratio_t  = 100 × RS_t / SMA(RS, 14w)_t
   RS_Mom_t    = 100 × RS_Ratio_t / SMA(RS_Ratio, 5w)_t
   ```
   Both stats are dimensionless ratios anchored at 100 — "indexed deviation from the trailing mean." Approximates JdK's proprietary z-score-of-z-score with a simpler SMA-anchored-at-100 formulation. Drift vs Bloomberg accepted because the four-quadrant interpretation is preserved and the formula stays explainable. Surface this caveat in TabIntro "How to read this."

2. **Pairs log/linear toggle dropped.** Same S11 finding as v1.0 — ECharts' default log axis ticks at `base^k` only, which squashes sub-decade ranges, exactly where ratios live. Path (a) manual `log10()` transform tracked as a separate task that pays for both Pairs and FeatureChart at once.

3. **Cross-tab navigation (Correlations cell → Pairs).** S15 Q1 locked the destination. Implementation: `localStorage['session.analysis_pairs_handoff']` (`{numerator, denominator}` JSON) + `window.dispatchEvent(new CustomEvent('analysis-set-active-tab', {detail: 'pairs_ratio'}))`. PairsTab reads + clears the handoff on mount; AnalysisLayout listens for the event and calls `setActiveId(detail)`. Cheap, no new abstraction.
   - localStorage chosen over `usePersistedState` (which is SQLite-backed via session_cmds) because the handoff is ephemeral and must survive the tab swap (PairsTab unmounts/mounts as part of the dispatch). `usePersistedState` debounces writes through SQLite IPC; if Correlations writes the config and PairsTab reads it during the tab switch, the SQLite write may not have flushed yet.

4. **Pairs picker shape: TickerChipPicker `maxChips=1`.** Added `maxChips?: number` + `placeholder?: string` props. When `selected.length >= maxChips`, the input + dropdown auto-hide. Backwards-compatible (undefined = no cap). Reuses the existing chip-greying + autocomplete behavior; user removes the chip with × to swap, identical to multi-select shape.

---

## TabIntro pattern (HARD RULE, codified in design doc)

Triggered by RRG smoke-test feedback: quadrant labels like "Leading" sound like trade recommendations, but no tab explained itself. User flagged this as a strategy gap across all tabs.

**Component:** `src/components/analysis/TabIntro.tsx` (~48 LOC). Props:
```ts
type Props = {
  subtitle: string;       // always-visible, ~1 sentence
  howToRead: ReactNode;   // collapsible body
  math?: ReactNode;       // optional collapsible body
  liabilityNote?: string; // override the default
};
```

**Three layers (top → bottom):**
1. Subtitle — always visible, plain English, no jargon.
2. "How to read this" — collapsible (`<details>`, default-closed). Bullet list of how to read the visual elements + paragraph on context-sensitivity. Always closes with the standard liability footer.
3. "The math" — collapsible, default-closed, **optional but recommended**. Power-user formula reference.

**Standard liability copy (default):**
> "Decision support, not investment advice. Patterns are descriptive, not predictive."

**Native `<details>`** (no JS) for accessibility-by-default. Custom caret `▸ → 90°-rotated on open` via CSS. Cyan left-border + faint surface — sits between controls and chart without competing.

**Codified in:** `.projects/02_v1_1_analysis/v11_analysis_design.md` "Tab presentation pattern (S17, 2026-04-30) — applies to ALL Analysis tabs" section. Rule: Phase 3 + Phase 4 + future tools must ship with `<TabIntro>` filled in. Phase 1 retrofit (Correlations + Yield Curve) shipped same commit as Phase 2 (Pairs + RRG) so the section was uniform from the user's perspective.

---

## Copy register: plain-language for users, technical for math

First TabIntro draft was quant-jargon-heavy ("Pearson correlation of log returns over the chosen lookback…", "rolling z-score showing when the ratio is stretched relative to its trailing window…"). User asked for a less-technical rewrite.

**Process:** side-by-side comparison in chat (current vs rewritten) for all four tabs before code edit. User read through, approved all four. Second edit pass swapped each `<TabIntro>` body to plain-language form. Math sections kept technical.

**Specific rewrites that stuck:**
- Correlations subtitle: "Pearson correlation of log returns…" → "How closely two assets' daily moves track each other over the chosen window. Strong green = move together. Faint = unrelated. Strong red = move opposite."
- Yield Curve: "term structure" → "lines by loan length"; explained 10y/2y inversion lead time without using the word "tenor."
- Pairs: "stretched relative to its trailing window" → "unusually high or low compared to its recent average." Mean reversion warning shifted from "Mean reversion can take longer than a position can survive" to "Markets can stay one-sided longer than is comfortable. Z-scores are a way to surface candidates worth a second look, not a timing signal."
- RRG: removed "JdK," "indexed at 100," and the proprietary normalization caveat from the bullets (kept it in "The math"). Quadrant rows now describe state in 1-2 plain sentences each, with explicit action-vs-description disclaimer at the bottom.

**Pattern for future tabs:** if first draft is technical, do the rewrite in chat first. Cheap to iterate before code lands.

---

## Phase 2 frontend implementation notes

- **PairsTab dual-pane.** ECharts grid with two y-axes — ratio top (~52%), z-score bottom (~28%) — when z-score data exists; collapses to single pane when window > bar count (z-score series is empty). Z-score pane has dashed ±2σ markLines and a solid zero baseline. Magnitude-scaled `formatRatio` for tooltips (`a >= 1000 → 1dp; a >= 10 → 2dp; a >= 1 → 3dp; a >= 0.01 → 4dp; else 6dp`).
- **RrgTab quadrant fills.** A single hidden helper `scatter` series carries four `markArea` rectangles (TR/BR/BL/TL), each with a quadrant-tinted color (status-up / accent-amber / status-down / accent-blue, all alpha 0.07). Per-ticker tail = one `line` series with linear opacity gradient via per-point `itemStyle.opacity` (0.2 oldest → 1.0 head); separate `scatter` series for the head dot with backed label. Quadrant text labels rendered via `graphic` array in absolute pixel positioning.
- **RRG benchmark Apply button (S15 Q3).** Plain text input + Apply button — re-normalization is too costly per-keystroke. Apply button is `disabled` when input matches current. Resolves dataSource by checking `list_tickers_with_coverage` for a matching ticker; falls back to `'yahoo'` for new tickers (the only equity-like data source today).
- **TickerChipPicker `maxChips` impl.** When `maxChips !== undefined && selected.length >= maxChips`, hide the entire `.chip-picker__input-wrap` block (input + dropdown). Clean way to communicate the cap visually (you can see chips but can't add more). Removing the lone chip via × restores the input.

---

## Smoke-test fixes (caught + fixed pre-merge)

### EC-15: Chart container `display: none` at first mount

**Symptom:** Pairs and RRG tabs showed populated footers but invisible charts. Confirmed both with screenshots `Screenshot 2026-04-30 102436.png` (Pairs) + `102520.png` (RRG).

**Root cause:** First Phase 2 frontend draft used `style={{ display: data ? 'block' : 'none' }}` on the ECharts container. On first render, `data === null` → `display: 'none'` → `echarts.init(container)` saw a 0×0 div and cached that size. When data arrived, display flipped to `'block'` — but ECharts never re-measured the container, so it rendered into a 0×0 area above the visible footer.

**Fix:** Drop the `display` toggle. Container is unconditionally laid out at `minHeight: 480/520`; loading + placeholder UI sits ABOVE the chart, not inside it. Matches the YieldCurveTab pattern that worked. Screenshot `103125.png` confirmed the fix on RRG (BTC-USD vs ^GSPC, full Improving → Lagging → Leading tail visible).

**Generalization:** never gate an ECharts container's layout-affecting style on render-time data. If you need to hide it, init it visible first and toggle later.

### EC-14: ECharts `visualMap` + multi-segment `markArea` + multi-thousand-point series → webview crash

**Symptom:** Clicking the Financial Conditions tab caused the entire webview to go black. Deterministic, reproducible.

**Root cause:** Initial FCI draft used ECharts `visualMap` with two `pieces` to color the line amber-above-zero and cyan-below:
```ts
visualMap: {
  show: false,
  pieces: [
    { gt: 0, color: amber },
    { lte: 0, color: cyan },
  ],
  outOfRange: { color: theme.textTertiary },
}
```
Combined with the 35-segment NBER recession `markArea` overlay and 2,800+ weekly observations from `NFCI`, this hit a pathological ECharts render path. Crash, not just a render glitch.

**Fix:** Strip the visualMap entirely. Single accent-cyan line + zero baseline + recession bars. The amber/cyan zero-crossing visual cue moves into the description (still useful) — the chart just gets one accent-cyan line. TabIntro copy adjusted to remove amber/cyan-color references.

**Generalization:** don't combine `visualMap.pieces` with multi-segment `markArea` on long line series. Single-color line + description-driven narrative is the safer baseline.

---

## Phase 3 scope decision (mid-session)

User asked about continuing into Phase 3. Three open items flagged before code:

1. **Growth-axis for Regime Quadrant: NAPM vs INDPRO.** Real differences:
   - NAPM/PMI: forward-looking, what financial media references, but FRED's NAPM has had spotty updates since ISM tightened licensing — data gap risk.
   - INDPRO YoY: backward-looking, rigorous, decades of clean monthly data, already in our MACRO seed. No data risk, less narrative resonance.
   - Recommendation: INDPRO (data hygiene). NAPM toggle as a v1.2 escalation if the narrative-mismatch becomes an issue.

2. **MACRO tile vs Analysis-only for RecProb + FCI.** S15 Q4 locked "both surfaces." Lean path = Analysis-only first. Recommended lean.

3. **`RECPROUSM156N` data freshness.** NY Fed has paused publication in past periods. FRED's website blocks WebFetch (403 from `fred.stlouisfed.org` page + CSV endpoints). Couldn't verify mid-session.
   - Recommended trust + ship with graceful empty-state handling. Worst case: one empty tab to swap for an alternative (`USRECPNAW` / `USRECP`) in a follow-up.

**User chose option B:** ship just Recession Prob + FCI this session, defer Regime Quadrant. Recession Prob built with empty-state placeholder + external FRED link in case the series turns out to be stale.

---

## Phase 3 backend implementation notes

- **`MacroPoint` shared type.** Both single-FRED-series tools return `Vec<MacroPoint>` (`{ date: NaiveDate, value: f64 }`). Declared in `analysis/mod.rs` to avoid duplication. Per-tool response wrappers add tool-specific metadata: `RecessionProbResponse { points, current, thresholds, units, series_id, latest_date, observation_count }`; `FinancialConditionsResponse { points, current, min_value, max_value, ... }`.
- **No new compute math.** Both tools are direct FRED-series passthrough: `db.all_fred_observations(SERIES_ID)` → parse dates → return points. No unit tests beyond what's already in `analysis/tests.rs`. New macro tools that just plot one FRED series should follow this pattern; tools with derivable math (rolling stats, scatter projections) declare their own modules.
- **Threshold metadata, not computed.** Recession Prob's 30% / 50% reference lines are conventional NY Fed levels — emit them as metadata in the response (`RecessionThresholds { warn_pct, imminent_pct }`), not derived. Frontend renders as `markLine` with color tokens.
- **FCI single-color rendering (post-EC-14 fix).** No visualMap. Single accent-cyan line + solid zero `markLine` labeled "long-run avg" + NBER `markArea`. Footer surfaces full-series min/max range so the user has a sense of where current sits relative to history.
- **Empty-state UX.** RecessionProbTab placeholder includes an external FRED link (`https://fred.stlouisfed.org/series/RECPROUSM156N`) so the user can verify upstream status if observations are absent.

---

## Commits (5 total, 2 feature branches)

**`feature/v1.1-analysis-phase-2`:**
- `61a107b` feat(analysis): Phase 2 backend — Pairs + RRG compute, IPC, registry, math tests (9 files, 708/-1)
- `7683c3f` feat(analysis): Phase 2 frontend — PairsTab, RrgTab, cell-click cross-link, TabIntro retrofit (9 files, 1541/-12)
- `8760606` docs(analysis): codify TabIntro pattern + Phase 2 smoke-test screenshots (4 files, 56/0)

**`feature/v1.1-analysis-phase-3`:**
- `1d29223` feat(analysis): Phase 3 backend (lean) — Recession Prob + FCI compute, IPC, FRED seed (8 files, 252/-6)
- `d2e9a30` feat(analysis): Phase 3 frontend — RecessionProbTab + FinancialConditionsTab (3 files, 511/0)

Both branches fast-forwarded to master and deleted post-merge.

---

## Things to remember next session

- **`<TabIntro>` is mandatory** for every Analysis tab. New tools (Macro Regime Quadrant, COT, AAII, VIX term, etc.) ship with subtitle + How to read this + The math + standard liability footer. Pattern documented in design doc.
- **Smoke-test every new tab in the actual webview before committing.** `npm run build` + `tsc --noEmit` don't catch ECharts render-time issues like EC-14 (visualMap + markArea crash) and EC-15 (display:none init). Open the app, click the new tab, watch.
- **localStorage handoff + CustomEvent** is the established pattern for cross-tab navigation in the Analysis section. Apply the same shape if RRG → some-future-tab cross-link lands.
- **Don't use `visualMap.pieces` on long line series with overlays.** EC-14 generalization: stick to single-color lines + description-driven semantics.
- **Don't gate ECharts container layout on render-time data.** EC-15 generalization: container always laid out, loading/placeholder UI sits above.
- **MacroPoint** is the shared shape for single-FRED-series passthrough tools.
