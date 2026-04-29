---
name: Indicator rename — Larsson Line → SMMA Ribbon
description: Why we renamed the quad-SMMA-state indicator and what the canonical id/display name/file/Rust struct are now
type: project
---

Renamed during M6 S7 (2026-04-24).

### Why
Per the indicator's originator (CTO Larsson himself, linked in trendscope/CLAUDE.md):
> "The principle behind the indicator is not new and not my invention"

The math is publicly reverse-engineered from the basnijholt gist
(https://gist.github.com/basnijholt/a78fe8deafe76bf3cc1f7e9817f9169e) and the
approach (four SMMAs on hl2 with an ordering-based state classifier) predates
his branding. Keeping "Larsson" in the codebase implied attribution that isn't
warranted, so we renamed.

### Canonical names (post-rename)
- **Display name:** `SMMA Ribbon`
- **Registry id (DB + Rust):** `smma_ribbon`
- **Rust module:** `src-tauri/src/indicators/smma_ribbon.rs`
- **Rust struct:** `SmmaRibbonIndicator`
- **Band stack group:** `smma_ribbon_band`

### Things that deliberately still say "Larsson"
- **trendscope (upstream reference repo)** uses the older name — it's a separate project and we don't modify it from here. The Python function name `larsson_state()` in `trendscope/src/trendscope/indicators.py` stays as-is; we just re-label it in this repo.
- **PROGRESS.md session logs for M6 (S7 and earlier)** reference the original "Larsson Line" name as a historical record (Option A of the rename scope) — preserving the why of the rename.

### Palette swap (S8, 2026-04-24)
Follow-up to the rename — the Larsson-standard gold/navy envelope colors were visually verbatim and read as a copy despite the name change. Swapped to **teal / fuchsia** (outside the red/green candle palette, distinct from any existing trading-indicator convention):
- Envelope fill (bull): `rgba(20, 184, 166, 0.55)` (teal-500)
- Envelope fill (bear): `rgba(217, 70, 239, 0.55)` (fuchsia-500)
- Flip marker (up): `#14B8A6`
- Flip marker (down): `#D946EF`
- Flip label: `"Bull Flip"` / `"Bear Flip"` / `"Neutral Flip"` (was "Gold Flip" / "Blue Flip" — decoupled from the color scheme so a future swap doesn't rename labels too)
- Scanner state-badges in `app.css` `.state-badge--bullish` / `--bearish` moved to the same palette.

Docs + comments touched: `smma_ribbon.rs` module header + FILL/FLIP constants, `LESSONS.md` (no entry needed — not a gotcha).

### If this rename needs to happen again (e.g. after more research)
- Rust: rename the file, struct, `id()`, `display_name()`, band stack group constant
- DB seed: add `DELETE FROM indicator_settings WHERE indicator_id='<old>'` + `DELETE FROM indicators WHERE id='<old>'` before the new INSERT
- Frontend: liability footer text, any hardcoded id references
- Docs: CLAUDE.md, DESIGN.md, MEMORY.md index + this file
