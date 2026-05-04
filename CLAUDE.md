# CLAUDE.md — Personal Terminal

Rules and context for Claude Code on this personal project.

---

## Start of Session

1. Read this file.
2. Read `.projects/00_tracking/PROGRESS.md` for the most recent session log.
3. Read `.projects/01_initial_design/DESIGN.md` for the active sketch.
4. Read `.projects/00_tracking/memory/MEMORY.md` for saved context.

Blueprint reference images live in `.projects/01_initial_design/images/`:
- `bloomberg_killers_data_sources.png` — 25 free/cheap financial-data providers (Market Sentiment)
- `urbankaoberg_reference_layout.png` — IA, tile density, aesthetic reference

Reference repos:
- **PrivateACB** (sibling Tauri repo on the dev machine) — infrastructure reuse source
- **trendscope** (sibling Python repo on the dev machine) — SMMA Ribbon / RSI / ATR indicator math (`src/trendscope/indicators.py` is the Rust port target; trendscope's code still uses the older "Larsson Line" label — we renamed to SMMA Ribbon in S7 after learning the math is derivative of public community work)

---

## Project Purpose

A Bloomberg-terminal-style personal desktop dashboard focused on the user's specific asset universe:
- Macroeconomic KPIs (~18 FRED tiles)
- Major world indices (15 majors, local currency)
- Top 10 crypto (CoinGecko live + Yahoo deep history)
- Top 10 US equities
- Canadian sector watchlists — Energy, Banking, Telecom, Crypto Miners, Metal Miners
- Commodity futures (Crude, Gold, Silver, Nat Gas, Copper) + DXY
- Multi-source news (Finnhub + RSS, pluggable)
- Pluggable technical indicators (SMMA Ribbon + RSI + ATR in v1, more later)

Strictly personal use — no sharing, no licensing, no auth, no multi-user, no cloud.

---

## Core Principles

1. **Personal-use only** — no auth, no sharing, no SaaS patterns.
2. **Extensibility-first (HARD CONSTRAINT)** — sectors, tickers, news feeds, AND technical indicators are all extensible. New sector/ticker/feed = INSERT. New indicator = one Rust module implementing `Indicator` trait + INSERT. Never hardcode sector names, ticker lists, or indicator identifiers in UI or fetcher code.
3. **Reuse PrivateACB patterns** — SQLite+WAL, CoinGecko client, design tokens, Tauri v2 IPC, decimal precision.
4. **Port trendscope math verbatim** — SMMA Ribbon (quad-SMMA state) / RSI / ATR / SMMA are already figured out. Don't re-tune without calibration data. Read `trendscope/CLAUDE.md` "Tuning journey" section before touching confirm_bars or SMMA lengths.
5. **Simplicity first** — every tile and every line of code earns its place.
6. **Free-tier first** — FRED, CoinGecko, Yahoo Finance, Finnhub, RSS.
7. **Honest collaboration** — don't agree automatically. Flag weaknesses. Explain tradeoffs before proposing.
8. **Ask before editing** — describe the change, wait for approval.
9. **Decision support, not investment advice.** Indicator output is a personal tool. The community caveats that originally accompanied this indicator family (best on tech/crypto, 4h-to-monthly timeframes) apply — don't suppress them in UI. Same liability framing as trendscope.

---

## Stack

| Layer | Tech |
|-------|------|
| Shell | Tauri v2 |
| Backend | Rust (tokio async, rust_decimal, rusqlite + WAL) |
| Frontend | React + TypeScript + Vite |
| Charts | **Apache ECharts** (MIT, ~1 MB gzipped — chosen for multi-pane + fill-between-two-lines + custom-series extensibility) |
| Storage | Local SQLite (Tauri app data dir) |
| Styling | CSS Modules + design tokens lifted from PrivateACB |

### Data sources

| Source | Use |
|--------|-----|
| FRED | US macro series (~18 tiles) |
| CoinGecko | Crypto top-10 discovery + live (~30/min; 1Y historical — use Yahoo for deeper) |
| Yahoo Finance | US + TSX equities, futures, DXY/FX, world indices, crypto historical. Unofficial, no key, batch quote endpoint. |
| Finnhub | US ticker news + general news (60/min) |
| RSS | Canadian sources (pluggable) |

---

## Architectural Rules

- **Extensibility-first.** Sectors, tickers, news feeds = data in SQLite. Indicators = Rust trait implementations + SQLite `indicators` registry + per-ticker `indicator_settings`.
- **Fetchers write, frontend reads.** No direct network calls from frontend.
- **Indicator compute is Rust-side, on-demand, not persisted.** Bars are persisted in `price_history`; indicators are recomputed when a feature chart opens. Recompute is fast (~ms for 1250 daily bars).
- **Indicators use f64, not rust_decimal.** Display-only, not tax-grade.
- **Chart component is indicator-agnostic.** Reads `IndicatorOutput` + `render_spec`, draws via ECharts. Adding a new indicator doesn't touch chart code.
- **Per-source fetch cadence.** FRED daily; Yahoo quotes 5 min (market hours) / 1 hour (off-hours); CoinGecko 5 min; Finnhub 15 min; RSS 30 min. Yahoo historical on-demand when feature chart opens.
- **News dispatcher by `source_type`.** One fetcher module per type (`finnhub`, `rss`, future `newsapi`).
- **Unified quote cache.** All equity-like sources write to `quote_cache` keyed by (ticker, data_source).
- **Serde/IPC rules apply** (from PrivateACB):
  - `#[serde(rename_all = "camelCase")]` on every struct crossing IPC (including nested)
  - `#[serde(default)]` on `Option<T>` fields
  - Frontend parameter key must match Rust parameter name
- **API keys** via Tauri keyring or local encrypted config. Never committed.

---

## PrivateACB Reuse Checklist

| Area | PrivateACB Path | Reuse Strategy |
|------|-----------------|----------------|
| SQLite+WAL setup | `src-tauri/src/db/` | Copy schema init + migration pattern |
| CoinGecko client | `src-tauri/src/currency/crypto/` | Copy, strip tax-specific pieces |
| Symbol mappings | `src-tauri/src/currency/crypto/mappings.rs` | Direct copy |
| Design tokens | `src/styles/system/tokens.css` | Direct copy |
| Dark-theme primitives | `src/styles/primitives.css`, `tables.css` | Direct copy |
| Decimal precision | rust_decimal usage (quotes/FX only — NOT indicators) | Same crate |
| Tauri IPC helpers | `src/utils/tauri-api/` | Simplified |
| Serde/IPC rules | `.claude/rules/serde-ipc.md` | Obey verbatim |

## trendscope Reuse Checklist (indicator math)

| Function | trendscope path | Rust destination |
|----------|-----------------|------------------|
| `smma(src, length)` | `src/trendscope/indicators.py` | `src-tauri/src/indicators/smma.rs` |
| `larsson_state()` + `confirm_state()` + `state_flips()` | same file | `src-tauri/src/indicators/smma_ribbon.rs` |
| `rsi(close, length)` | same file | `src-tauri/src/indicators/rsi.rs` |
| `atr(high, low, close, length)` | same file | `src-tauri/src/indicators/atr.rs` |

---

## Scope Guard

**Do NOT:**
- Add auth / user accounts — single-user local
- Add cloud sync — desktop-only (user declined Cloudflare)
- Pay for a data source before a real use case hits a free-tier wall
- Build features "for future use"
- Integrate with PrivateACB's tax logic — separate tool
- Hardcode sector lists, ticker lists, or indicator identifiers
- Swap chart library without real evidence ECharts is insufficient
- Re-tune SMMA Ribbon defaults (15/19/25/29, confirm=3) without calibration data — trendscope already chased this rabbit hole

**If scope creep tempts you:** document in `.projects/00_tracking/PROGRESS.md` → "Discovered" and move on.

---

## Project Organization

All non-code artifacts live under `.projects/`. Convention:

- **`00_*`** — cross-cutting / pinned (never archived):
  - `00_bugs/` — bug intake
  - `00_tracking/` — `PROGRESS.md`, `LESSONS.md`, `memory/` (MEMORY.md + per-decision rationale files), and `archive/` (pruned PROGRESS sections when the live log gets too long)
- **`NN_<feature_name>/`** (01, 02, …) — sequential feature/work projects, numbered for findability:
  - `01_initial_design/` — v1.0 build arc: DESIGN.md, blueprint images, icon source, build screenshots
  - `02_v1_1_analysis/` — v1.1 Analysis section design + Phase 1 plan
- **Screenshots** for a specific project belong inside that project's folder, not at root.
- **New features** get the next `NN_<name>/` folder. Don't reuse numbers; don't renumber existing ones.

Code stays at root: `src/`, `src-tauri/`, `package.json`, etc. Anchor docs that need to be discoverable from the repo root stay at root: `CLAUDE.md`, `README.md`.

**`infrastructure/`** is a sibling folder for **credential scratchpads, API keys, webhook secrets, and local-only operational notes**. It is gitignored in full — never commit anything from this folder. The `.env` file at repo root is the source of truth for runtime API keys; `infrastructure/` holds raw vendor copy-paste material, backup secrets, and other items that should not enter git history.

---

## Commit Guidelines

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.

---

## Reference

| Topic | Location |
|-------|----------|
| Design sketch | `.projects/01_initial_design/DESIGN.md` |
| Progress log | `.projects/00_tracking/PROGRESS.md` |
| Saved context | `.projects/00_tracking/memory/MEMORY.md` |
| Lessons (gotchas) | `.projects/00_tracking/LESSONS.md` |
| Blueprint images | `.projects/01_initial_design/images/` |
| v1.1 Analysis design | `.projects/02_v1_1_analysis/v11_analysis_design.md` |
| PrivateACB (infra reuse) | sibling Tauri repo on the dev machine |
| trendscope (indicator math) | sibling Python repo on the dev machine |
