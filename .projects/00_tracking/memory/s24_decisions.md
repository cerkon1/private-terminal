# S24 — UX honesty pass + indicator-surface reorganization

(2026-05-03) Same-day continuation of S23. 8 commits on master.

Tester confirmed satisfaction with S23's responsive-density Phase 1 work,
freeing this session to attack the next wave of chrome-pretense issues
the user surfaced as we worked. Theme: every commit removed something
that didn't earn its place, OR shipped something that should have always
been there. Mostly visual reorganization + UX honesty, plus the
multi-anchor AVWAP feature from the v1.2 priority queue.

## Scope guards

### MarketHoursStrip dropped (decorative globalism, zero user value)

User flagged the eight-exchange row at the top of every screen
("NYSE +0.29% TSX -0.22% LSE — TYO +0.38% HKG -1.28% SSE — ASX +0.74%
KRX -1.38%") as juvenile pretense. Honest accounting:

- 5 of 8 exchanges (LSE / TYO / HKG / SSE / KRX) carry zero watchlist
  tickers — pure decoration.
- Direction-since-close is *already shown* in INDICES tiles three
  rows below with full numbers + currency. The strip was a worse,
  smaller duplicate.
- Open/closed is one binary signal — doesn't justify 8 cells.

Only honest argument was branding ("looks Bloomberg-y"). Rejected:
Bloomberg has 8 exchanges because Bloomberg's customers actually
trade them. We had them as costume jewelry.

Removed end-to-end: `MarketHoursStrip.tsx`, App.tsx mount,
`EXCHANGE_INDEX_MAPPING` + `MarketIndexQuote` + `list_market_index_quotes`
IPC in `ticker_cmds.rs`, lib.rs handler entry, ~92 lines of
`.market-hours-strip` / `.market-chip*` CSS, FeaturesTab card.
DESIGN.md feature #2 marked DROPPED. Reclaim: ~34-40px vertical chrome
app-wide. **Bigger single win than any S23 reclaim.**

Pattern: feature #2 joins #5 (Watchlist Performance, S10), #8
(Keyboard shortcuts, S9), #10 (Scanner, S21) in the dropped column.
**Rule: any feature that can't justify its chrome cost gets killed.**
Don't preserve features for resume-padding ("the app does N things").

### Scanner physically deleted (S21 deferred cleanup)

S21 soft-deleted Scanner via `user_hidden=1` and unrouted from sidebar;
preserved code one release for revert safety. **rc.2 is that release.**
Files removed: `Scanner.tsx` (~248 LOC), `ScannerRow` struct +
`scanner_snapshot` IPC (~125 LOC) from `indicator_cmds.rs`, handler
from `lib.rs::generate_handler!`, Scanner-only CSS (`.scanner-prime-status`,
`.scanner-table*`, `.state-badge--*` variants, `.state-filter*`).

Preserved deliberately:
- `prime_scanner_histories` IPC — still used by Pulse banner. IPC name
  retained for backwards compat (per the comment in
  `PulseDashboard.tsx:33-35`).
- `.state-badge` base CSS — used by Settings → Appearance palette
  preview.
- Idempotent `UPDATE … user_hidden = 1 WHERE id = 'scanner'` in
  seed.sql — defensive on old DBs (pre-rc.1 installs may still carry
  the row; harmless on fresh DBs).

FeaturesTab "Scanner" about-card replaced with "Pulse" card. Pulse had
zero Features-tab coverage before — gap closes.

### Project 04 closed

Tester re-tested rc.2 build (carrying S23's responsive-density Phase 1
work) and confirmed satisfaction. Phase 2 (`@media (max-height)` density
rules) and Phase 3 (Settings → Density toggle) deferred indefinitely.
`.projects/04_responsive_density/design.md` status header set to CLOSED.

## Indicator-surface reorganization

User-driven design discussion. Two competing rows of "indicators" on
the FeatureChart confused things — the per-ticker `IndicatorPanel`
above the chart vs the `AUTO Y · VOL · VRVP · DD · AVWAP · PNG`
toolbar inside the chart. From the user's perspective, VRVP / DD /
AVWAP *are* indicators; the architectural divide (per-ticker Rust
compute vs app-wide frontend math) was real but invisible.

### Pattern survey — how others do it

| App | Approach |
|---|---|
| TradingView | `+ Indicators` modal picker + active-indicator chips inside chart legend. Drawing tools on left rail (~40px). |
| ThinkOrSwim | Right rail (~260px) with active "Studies" stack, per-row settings. Add via separate modal. |
| Bloomberg | Function-code commands, no visual browse. Not a useful template. |
| ECharts demos | Pill-row toggles (our current pattern). Caps at ~10 indicators. |

**Convergence point** for any app shipping >10 indicators: two surfaces,
not one. (a) Picker modal for browsing + adding. (b) Active strip /
panel for managing what's currently on with per-indicator gear popovers
for sub-state (multi-anchor, levels, alert thresholds).

### Two endgame layouts considered, ASCII-mocked

**Option 1 (chart-first):** Top chip strip with active indicators only;
`+ Add` modal picker for browsing; per-chip ⚙ gear popover for
sub-state. View toolbar shrinks to view-only buttons.

**Option 2 (workshop-first):** Right rail outside the chart (~240px)
with active-indicator stack always visible, per-row chrome for
sub-state. Picker as modal or inline panel.

Picked **Option 1** — chart real estate is the load-bearing constraint
on tester's 1128px effective width; sub-state visibility on a rail
mostly duplicates what's already drawn on the chart (anchor markers,
fib levels, alert threshold lines render visually). Burning ~28% of
chart width on a permanent sidebar would undo the S23 reclaim work.

### Phased path over full path

Full Option 1 (chip strip + picker modal + M10 gear popovers across
all indicators + multi-anchor AVWAP) sized at 4-5 sessions. Phased
path:

- **Phase 1 (½ session):** Merge VRVP / DD / AVWAP into IndicatorPanel
  as second chip group with separator. Toolbar shrinks to
  `AUTO Y · VOL · PNG`. Hover tips via native `title=`. Always-visible
  chips (no picker yet — works fine at 6 indicators).
- **Phase 2 (1 session):** Multi-anchor AVWAP. Anchor list managed via
  ⚙ chevron popover on the AVWAP chip. Establishes the popover
  mechanism for M10.
- **Phase 3 (later, v1.3 or when library ≥10 indicators):** Modal
  picker + active-only chip display. Defer until the library grows
  enough to justify it. Building it now is engineering for hypothetical
  future scale (we have 6 indicators today).

Phase 1 + Phase 2 both shipped this session. Phase 3 explicitly
deferred. **Rule: don't build picker / right-rail UX until the
indicator library hits ~10 active categories.**

### Phase 1 — chip strip merge

Lifted `showVrvp` / `showDrawdown` / `showAvwap` `usePersistedState`
calls from `FeatureChart` up to `TickerDashboard`. Same KV keys
(`session.feature_chart_show_*`) — existing user persistence carries
through without migration. New `OverlayChips.tsx` (~50 LOC) renders the
three frontend-overlay chips with same `.indicator-chip` styling for
visual parity. Both groups (Rust-backed per-ticker indicators +
frontend app-wide overlays) live inside a new `.chip-strip` wrapper
with thin vertical separator. Native `title=` hover tips per chip —
descriptions lifted from FeaturesTab card copy. Behavior parity —
every toggle works identically. Toolbar shrinks to AUTO Y · VOL · PNG.

### Phase 2 — multi-anchor AVWAP

S22's single-anchor AVWAP was *transient by design* ("exploratory").
Multi-anchor flips the use case: 2-3 anchors at meaningful events
(earnings / ATH / news pivots) are tracked positions worth keeping
across sessions, not exploratory state.

Six decisions locked from the design discussion:

| # | Decision | Reasoning |
|---|---|---|
| 1 | **Per-ticker persisted.** Storage = single global dict at config KV `session.feature_chart_avwap_anchors`, keyed by `<ticker>:<dataSource>`, values are sorted ISO date arrays. | Single load on mount; trivial memory footprint at hundreds of tickers. **Avoids the dynamic-key race in `usePersistedState`** (the hook resets state-load on key change but `loadedRef.current` doesn't reset — second useEffect can write the OLD value to the NEW key during the load window). LESSONS FE-9. |
| 2 | **Soft cap of 5 anchors.** Clicks past cap silently ignored. Popover header shows `(N/5)`. | Visual noise scales fast — five lines plus markers fight for attention even when they share color. |
| 3 | **Same accent-amber color for all anchors.** Identification via popover anchor list + ECharts tooltip names each line series `AVWAP @ <date>`. | Per-anchor distinct colors compound chart noise (5 lines, 5 colors, busy). The popover *is* the legend. |
| 4 | **Toggle-off persists anchors.** Toggle becomes show/hide layer rather than enable/disable feature. | Anchors are tracked assets, not exploratory state. Re-toggling AVWAP back on restores all anchors. |
| 5 | **Click-on-existing-anchor is idempotent.** Duplicate dates ignored. | Click-to-remove is surprising and undocumented. Explicit `×` in popover is the canonical remove path. |
| 6 | **Clear all disables AVWAP.** `clearAvwapAnchors` flips `setShowAvwap(false)` in addition to emptying the dict entry. | "Clear all" is the exit ramp — user is done with this anchor set. Leaving AVWAP toggled on with empty list dangles a "Click any bar to anchor" hint at the bottom of the chart. **One click to redo:** toggle AVWAP on. |

Popover anchor pattern: parent `.indicator-chip-wrap` is
`position: relative`; popover is `position: absolute, top: 100%,
right: 0`. CSS-only — no measurement, no ref dance. Closes on
click-outside via `mousedown` capture (matches TileContextMenu pattern,
S22 LESSONS FE-7) or Escape. **Generalizes for M10:** when per-indicator
parameter popover lands (post-v1), it slots into the same
`.indicator-chip-wrap` mechanism.

### Chip + gear visual refinement

User flagged checkbox redundancy and gear hover as flakey. Diagnosed
two stacked issues:

(a) **Checkboxes inside chips were redundant** with the chip's
cyan-on/dim-off color signal. Same state encoded twice. Fix: convert
`<label>` + `<input type="checkbox">` to `<button aria-pressed>`
(canonical toggle-button a11y pattern). Same hit area, same toggle
semantics, no double-encoding. CSS dropped the
`.indicator-chip input[type='checkbox']` rule; added
`background: transparent` to `.indicator-chip` (button has UA bg that
needs explicit override); added `.indicator-chip--on:hover` so on-state
hover keeps cyan instead of falling back to the base
`text-primary` gray.

**Pattern: button + aria-pressed > label + checkbox for toggle chips.**
The chip's color/border state is the visual signal; the input is
redundant ornament.

(b) **Gear button rebuilt for visual continuity.** Previously: gray
border + tertiary text at rest, hover to cyan border + cyan text. Two
problems — visible seam between the chip (cyan border on) and gear
(gray border at rest); two color jumps on hover (color + border).
Now: gear ALWAYS uses cyan border + cyan text + tinted bg. Caller gates
`onSettings`, so gear is only ever shown adjacent to a cyan chip —
guaranteed visual match. Resting opacity 0.55, hover opacity 1.0.
**Pure brightness shift, no color transitions.** Chip + gear read as
one continuous element.

`.indicator-chip-wrap:has(.indicator-chip__gear) > .indicator-chip {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}` squares off the chip's right corners when a gear is attached so the
pair has no notch. `:has()` is supported in all modern browsers
(WebView2 / Chromium since 2023). No alternative needed.

**Pattern: `opacity` over `color` for hover transitions on elements
adjacent to colored siblings.** Color transitions read as personality
changes; opacity reads as activation.

### ⚙ → ▾ glyph swap

Unicode gear glyph `⚙` rendered chunky on Windows system fonts (Tauri
WebView2 picks up Segoe UI Symbol fallback). Swapped to `▾` (small
down chevron). Reads universally as "open more details", matches
dropdown caret convention, renders cleanly across OS fonts at 11px.

## Bonus: single-line ticker + title

User flagged `^GSPC` stacked over `S&P 500` even with horizontal room
in the feature-chart header. Root cause:
`.feature-chart-pane__title-block { flex-direction: column }`. Flipped
to `row + align-items: baseline + gap: var(--space-sm)`. Added
`min-width: 0` so the title-block flex-shrinks past its intrinsic
content width when the chip strip is wide; `white-space: nowrap +
text-overflow: ellipsis` on the h2 truncates over-long display names
rather than wrap or push the chip strip off-row at constrained widths
(tester ~880px content area). Reclaim: ~22-26px per opened chart.

## Course corrections in-session

- **Right-rail vs chip-strip survey before ASCII mockups.** User asked
  for industry pattern survey before deciding; surveyed TV / TOS /
  Bloomberg / ECharts demos. Right rail rejected because its main
  advantage (persistent sub-state visibility) duplicates what's
  already drawn on the chart.
- **Phased path over full path.** Full path ships nothing for 4-5
  sessions; phased path lands the user-visible win in one.
- **MarketHoursStrip — agreed on first proposal** because the
  steel-man fell apart immediately. Eight-exchange decoration on a
  three-exchange app is dishonest UX.
- **Clear all behavior bug** caught by user in smoke test. Fixed in
  follow-up commit (`afb6040`).
- **Gear hover flakiness + checkbox redundancy** diagnosed as two
  stacked issues, fixed in same commit (`833a667`).
- **Ticker + title stacking** — vertical chrome elimination continued
  from S23. Tiny commit, real reclaim.

## What didn't ship (for honesty)

- **Modal picker + active-only display** — Phase 3, deferred to v1.3
  or post-10-indicators threshold. No code touched.
- **M10 per-indicator parameter popover** — only AVWAP got a popover;
  RSI / ATR / SMMA still use defaults. M10 is post-v1 anyway. The
  popover *mechanism* (`.indicator-chip-wrap` + position:absolute) is
  in place for them to slot into when M10 lands.
- **NSIS rebuild for tester** — recommended at session-end but not
  executed; user signaled wanting strategic conversation before more
  code. Next session will likely build + ship.
- **Strategic "overall purpose" conversation** — user signaled this
  as the next agenda item. Not started in this session.
