---
name: M8 Polish decisions (S9)
description: Durable architectural choices from the M8 Polish session — keyring→SQLite KV pivot, user-customizable palette, tile range switch, dropped keyboard shortcuts.
type: project
---

## Context
S9 delivered the bulk of M8 Polish in one session: session persistence, scanner prime, TS cleanup, Settings modal (API keys + theme + about), tile range switch. Keyboard shortcuts (#8) intentionally dropped. See PROGRESS.md S9 entry for scope.

## Decisions

### API keys live in SQLite `config` KV, not OS keyring
**Why:** First attempt used `keyring` crate v3. On Windows it silently no-ops: `set_password` returns Ok AND `get_password` within the same Entry round-trips fine (read-back verification passed), but subsequent reads from a fresh `Entry::new()` return NoEntry, and `cmdkey /list` shows zero `personal-terminal*` entries in Windows Credential Manager. The crate falls back to a process-local store that doesn't persist. Diagnosing further was a rabbit hole (likely platform-specific Entry lifecycle issue or credential-target naming mismatch).
**How to apply:** Keys stored as `config[api_key.fred]` / `config[api_key.finnhub]`. DB file lives in user-dir (`%APPDATA%\personal-terminal\`), OS perms protect at rest. `.env` fallback preserved for dev/power-users. Source resolver in `config.rs` tries DB first, then env. `KeySource` enum is `Stored | Env | None`. UI's masked-value display (`••••74eb`) reads last-4 of stored value. For a giveaway app targeting free-tier APIs, this is the right trade — simpler + predictable, acceptable security posture. Revisit if paid APIs are added. Captured as LESSONS SEC-1.

### SMMA Ribbon palette is user-customizable, not developer-decided
**Why:** S8 went through 5 palette iterations (teal/fuchsia → sky/pink-500 → sky/pink-400 → cyan-600/rose-400 → "my wife doesn't like it") without landing on a winner. Strong signal that color preference is subjective and shouldn't be a build-time decision. Handing the choice to the user permanently resolves the question.
**How to apply:** Three state colors (`bull`, `bear`, `neutral`) persist under `session.palette` as `{bull, bear, neutral}` JSON. `useThemeColors()` hook sets CSS vars on `:root` (`--state-bull`, `--state-bull-rgb` + same for bear/neutral) via `document.documentElement.style.setProperty`. Everything consuming `var(--state-*)` auto-updates (state badges, news chips, anything CSS-driven). For ECharts-rendered SMMA Ribbon bands + flip markers, `applyThemeToIndicators(indicators, theme)` remaps `IndicatorSeries.color` by series-name (`Bull Band`/`Bear Band`/`Neutral Band`, with alphas 0.5/0.5/0.3 matching the Rust constants) and `IndicatorMarker.color` by label (`Bull Flip`/`Bear Flip`/`Neutral Flip`). Wired in `TickerDashboard` via `useMemo`. Rust constants in `smma_ribbon.rs` (FILL_BULL/FILL_BEAR/FILL_NEUTRAL/FLIP_*) remain as defaults only — they ship fresh users with Cyan/Rose. 5 preset pills in the UI (Gold/Navy, Teal/Fuchsia, Sky/Pink, Cyan/Rose, Emerald/Red) are one-click shortcuts; `<input type="color">` per state handles arbitrary hex.

### Keyboard shortcuts (feature #8) dropped — positional shortcuts conflict with user-editable groups
**Why:** The DESIGN.md spec for `Ctrl+1..9` was written before M8 Phase 1 made sector groups user-editable. Positional binding (Ctrl+N → N-th top-level section) means the meaning shifts when a user reorders, adds, or deletes a group — Ctrl+3 pointing at "the 3rd section" is a moving target. Hardcoded section slugs (e.g. Ctrl+1 = `macro`) violate the extensibility-first HARD CONSTRAINT and break if the user renames/deletes the group. User-assigned shortcuts per group adds a `shortcut` column + rebinding UI for a single-user tool — overkill.
**How to apply:** No positional shortcuts ship. Ctrl+K command palette in M9 (feature #3) is the correct extensible-native navigation shortcut — fuzzy-match by name, works regardless of position, count, or renames. Non-conflicting shortcuts (sidebar toggle, `?` help modal, `Esc` close-modal) deferred to M9 / post-v1. Session persistence (feature #7) covers the "pick up where you left off" use case that section-switch shortcuts would have served.

### Session persistence scope: section + sidebar only; feature charts always start closed
**Why:** The DESIGN.md spec for feature #7 included "last ticker, last timeframe, indicator toggles, sidebar state." Indicator toggles are already per-ticker via `indicator_settings` (M6), so that's a no-op. Timeframe doesn't have a selector — ECharts `dataZoom` is ephemeral. Last-viewed ticker: user explicitly chose NOT to auto-restore the feature chart — reopening a section to glance at tiles shouldn't drop them into the prior drill-down.
**How to apply:** Two keys persisted via `usePersistedState`: `session.active_section` (string) and `session.sidebar_expanded` (JSON array of expanded parent IDs). First-ever launch expands all parents (detected via `hadStoredValue === false`); subsequent launches respect the stored set verbatim. Feature charts are click-to-open from the tile grid, always.

### Tile range switch uses calendar lookbacks, not trading-day counts
**Why:** 7/30/365 day calendar offsets vs 5/21/252 trading-day counts: the calendar approach is simpler, doesn't require a trading calendar, and `close_at_or_before` naturally walks back to the nearest available bar (handles weekends + holidays automatically). The diff between calendar and trading-day lookback on annual-level ranges is <1%; for 1W/1M it's negligible.
**How to apply:** In `list_ticker_tiles` Phase 3: `today - 7d` for 1W, `today - 30d` for 1M, `today - 365d` for 1Y. YTD uses `{prior_year}-12-31` as the target — `close_at_or_before` finds the last trading day of the prior year. 1D stays on Yahoo's `change_pct_24h` from quote_cache (live intraday vs prior close — more accurate for the "today" question than any price_history lookback). Heatmap thresholds scale per range (1D=1%, 1W=3%, 1M=5%, YTD=15%, 1Y=20%) to prevent long ranges from painting the grid uniformly strong.

### usePersistedState hook exposes `{loaded, hadStoredValue}` for first-launch defaults
**Why:** A consumer that wants "default state on first launch, stored state otherwise" can't distinguish "empty stored value" (user deliberately cleared) from "no stored value" (first ever launch) without a separate signal. Critical for Sidebar's expand-all-on-first-launch behavior: without this distinction, a user who collapses all parents would see them re-expand every relaunch.
**How to apply:** Hook returns `[value, setValue, { loaded, hadStoredValue }]`. Consumers gate first-launch logic on `expandedStatus.hadStoredValue === false`. Most consumers can destructure only the first two and ignore the status (e.g. `const [activeSection, setActiveSection] = usePersistedState(...)`).

## Deferred to v1.1 / future polish

- **Icon swap** — still PrivateACB's `.ico` placeholder. Required before distribution.
- **Keyring re-attempt** — could try `tauri-plugin-stronghold` (encrypted local file, not OS credential store) if we want stronger protection than plaintext KV. Not urgent for free-tier API keys.
- **Tile range lookback tuning** — if calendar-vs-trading-day skew becomes noticeable on quarterly/YTD ranges, switch to bar-count lookback via `SELECT ... ORDER BY bar_date DESC LIMIT 1 OFFSET N`. Current calendar approach is fine.
- **Per-group tile range persistence** — today `session.tile_range` is global. If users want different defaults per sector (e.g. 1D for crypto, 1Y for macro), add `session.tile_range.<sector_group_id>` keys. Not requested yet.
