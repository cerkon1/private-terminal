---
description: Read project status, design, and memory to begin a development session
allowed-tools: Read, Glob, Grep
---

# Session Start

Read the following files in order to establish project context:

1. **`CLAUDE.md`** — Project rules, reuse checklists (PrivateACB + trendscope), extensibility-first principle, chart-library + indicator architecture decisions.

2. **`.projects/00_tracking/PROGRESS.md`** — Most recent session log. Find the current focus and the most recent milestone status.

3. **`.projects/01_initial_design/DESIGN.md`** — Active sketch: 7 sections, indicator framework, 10 features, schema, milestones.

4. **`.projects/00_tracking/memory/MEMORY.md`** — Saved context: user preferences, project-specific decisions, reference repo paths, resolved/open questions.

Also glance at blueprint images in `.projects/01_initial_design/images/` if visual reference is helpful:
- `bloomberg_killers_data_sources.png` — data-source inventory
- `urbankaoberg_reference_layout.png` — IA + aesthetic reference

After reading, provide a summary:
- **Current state:** What was completed in the last session
- **Next milestone:** Which M is next, its scope, and any open questions that need answering before starting
- **Ask before editing:** Confirm scope with the user before writing code — the user prefers tradeoff discussion before implementation

**Key rules to remember on every session:**
- Extensibility-first is a HARD CONSTRAINT — sectors, tickers, news feeds, indicators are data / registry entries, never hardcoded.
- Reuse PrivateACB infrastructure patterns (`E:\Users\PBL\Documents\Dev\PrivateACB_Tauri`) — SQLite+WAL, CoinGecko client, design tokens, serde/IPC rules.
- Port trendscope's indicator math verbatim (`E:\Users\PBL\Documents\Dev\trendscope\src\trendscope\indicators.py`). Don't re-tune without calibration data — read trendscope's "Tuning journey" section first.
- Apache ECharts for all charting. Don't swap without real evidence it's insufficient.
- Indicators use `f64` (display-only). Only quotes/FX use `rust_decimal`.
- Free-tier data sources only. No paid APIs until a real use case hits a wall.
- Ask before editing. Explain tradeoffs before proposing.
