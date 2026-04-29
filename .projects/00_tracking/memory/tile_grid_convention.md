---
name: Tile grid sizing convention
description: Fixed-row-height grid + 2-line title clamp + hover-tooltip pattern for all tile sections (MACRO, INDICES, CRYPTO, equities, futures)
type: feedback
---

Tile grids use fixed row height (currently `grid-auto-rows: 150px`) + 2-line title clamp (`-webkit-line-clamp: 2`) + `title` attribute on the heading for full-text hover tooltip. Validated on MACRO during M2 S3.

**Why:** FRED series have wildly varying title lengths (e.g. DGS10's "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity…" vs UNRATE's "Unemployment Rate"). Content-sized rows made the whole row stretch to match the tallest tile, and values/metas across rows stopped lining up visually. Fixed height + truncation restores Bloomberg-terminal grid consistency.

**How to apply:** Reuse the same CSS chain for M3 ticker tiles, M5 futures tiles, and any future tile grid. Don't switch to content-sized rows without a concrete reason — it breaks the at-a-glance scan. If 150px proves too tall for denser sections, tune per-section via a class override rather than abandoning the fixed-row pattern.
