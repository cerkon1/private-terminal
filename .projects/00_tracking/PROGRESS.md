# Progress Log — Private Terminal

## Current Focus
**S22 (2026-05-03) — UX leverage week + installer pivot + screen-density project scoped.** 11 commits shipped on master. One bug fix (watermark horizontal centering on candlestick view), five user-facing features (MACRO-tile retrofit for RecProb + FCI with Analysis cross-link, Anchored VWAP overlay with click-to-anchor, persisted per-ticker `last_fetch_error`, Ctrl+K command palette with fuzzy search, right-click context menu on tiles for WATCHLIST + purge), two readability passes (sidebar tactical fix → app-wide token brightness bump), and the **NSIS installer pivot** (flipped `bundle.active: false → true`, authored free-personal-use LICENSE.txt, generated 164×314 sidebar + 150×57 header BMPs from the existing icon source, set `installerIcon` so the setup.exe itself uses our brand). Theme: every commit closed a known wart or shipped a "should have always been there" UX win. No backend architectural shifts; v1.2 now feels like a coherent product layer over the v1.0 / v1.1 core, AND the distribution shape moved from portable-exe-only to portable-exe + branded NSIS installer. Phase 4 Analysis tools (COT / AAII / VIX term) **explicitly deferred from v1.2** after user weighed COT against alternatives. End-of-session tester feedback flagged screen-density issues (Pulse table only ~25% vertical, dataZoom barely visible) → new project at `.projects/04_responsive_density/design.md` scoped with three-phase plan; **next session entry point: bring tester's screen resolution + Windows display scaling values + 2-3 screenshots** so Phase 1 can target precisely. v1.2 priority queue thinned: other highest-leverage items remain (Vol Cone / Return Distribution / Seasonality FeatureChart enhancements, CoinGecko fetcher, true log Y-axis), but project 04 takes priority because tester feedback is current and concrete. RC1 tester feedback on the rc.1 build itself still pending on the parallel track. See `memory/s22_decisions.md`.

**S21 (2026-05-02) — Pulse killer-feature implementation + Scanner deprecation, shipped on master.** Visual prototype → real backend (`cross_section/` Rust module + IPC + 9 unit tests) → ticker-column-click navigation with auto-open feature chart via localStorage handoff → Scanner subsumed by Pulse (PRIME button moved to Pulse banner contextually, RECOMPUTE killed as dead weight, Scanner soft-deleted via `user_hidden=1`). PRIME failures now surface inline below the banner with per-ticker error rows + exchange-suffix hint. Light theme considered + deferred (S15 token markers are structural readiness only; real light theme is a separate 2-session arc, no demand signal yet, dark "marketing-cool" identity preserved). Master ended at `654a0b4` after the session-end docs commit.

**S20 (2026-05-02) — v1.2 killer-feature design (Pulse) + database expansion shipped on master at `05416a0`.** Brainstorm + design + Phase-0 implementation arc covering three discrete pieces: (1) two new design docs under `.projects/03_cross_section_heatmap/` locking the Pulse percentile-cross-section heatmap concept (the "morning weird-detector" — every ticker + macro series expressed as percentile-rank vs its own 5y history, sortable, click-to-chart); (2) full reformulation of `db/seed.sql` from 72 tickers / 25 macro series to 176 tickers / 29 macro series with symmetric US ↔ CA sub-sectors (10 each), plus new top-level groups WATCHLIST (empty user slot) / COMMODITIES (sub-sectored) / FX / BONDS & RATES / VIX & RISK + PULSE pinned at sidebar position 0; (3) sidebar polish (180→220px width + indent bump + global themed thin scrollbar via `*` selector).

**S19 (2026-05-02) — first FeatureChart enhancement (drawdown subpane) + Features-tab full rewrite shipped on master at `7fd94ec`.** Adds the `DD` toggle in the candlestick toolbar producing a red filled-area subpane below price (% from running peak, max=0%, auto-fit floor). Same session pinned the chart watermark to the price grid centre (was sliding into subpanes when many were on) and rewrote Settings → Features tab from 7 cards to 19 cards across 4 section headers (Chart Overlays & Subpanes / Indicators / Analysis Section / Dashboard & Layout) — closing a months-long discoverability gap where the v1.1 Analysis surface had zero coverage. SMMA Ribbon card gains a Tip explaining the `AUTO Y off + click Base` interaction.

**v1.1 Analysis section Phase 3 fully shipped on master (2026-05-02, S18).** Master was `d471633` after S18. Seven Analysis tabs live: Correlations · Yield Curve · Pairs · RRG · Recession Prob · Financial Conditions · Regime Quadrant. The last Phase 3 tool (Macro Regime Quadrant) ships with INDPRO YoY (growth axis) × CPI YoY default + Core PCE toggle (inflation axis), 12/24/36/48-month trail picker, four-quadrant scatter with crosshairs anchored at long-run baselines, and the standard `<TabIntro>` pattern. Zero new FRED series — INDPRO + CPIAUCSL + PCEPILFE were already seeded since M2. 20/20 analysis math tests green (was 17/17 — three new YoY helper tests).

**Phase 3 still-deferred:** MACRO-tile retrofit for Recession Prob + FCI (S15 Q4 spec'd "both surfaces"; lean path shipped Analysis-only). A shared `<MacroSeriesView mode="tile" | "chart">` component would land the tile twins cheaply; not blocking.

**Awaiting cold-eye tester feedback on v1.0.0-rc.1** (parallel track, unchanged). Remaining before `1.0.0` final:
1. Tester feedback round (cold-eye review). No code commitments until feedback lands.
2. After verification, bump `1.0.0-rc.1` → `1.0.0` in 4 places (`package.json`, `Cargo.toml`, `tauri.conf.json`, `version.ts`) + rebuild.

**v1.2 priority queue (post-S22):** FeatureChart enhancements still standing — Vol Cone / Return Distribution / Seasonality heatmap (each ~1 evening) → multi-anchor AVWAP (extend single-anchor S22 work) → CoinGecko fetcher → bull/bear VRVP split → true log mode (Path a — manual `log10()`) → multi-ticker overlay chart (M9 feature #1, only M9 carry-over still standing — Ctrl+K shipped S22) → light theme (2-session arc; queue post-RC1 only if feedback surfaces it) → code signing → Scanner.tsx + scanner_snapshot IPC deletion (v1.3 cleanup). **Phase 4 Analysis tools (COT / AAII / VIX term) deferred from v1.2** — user weighed COT (the strongest of the three) and dropped: weekend of fetcher / parser / schema / scheduler for a signal that applies to 5 of ~200 tickers; lopsided ratio against cheaper alternatives. Don't re-propose without a fresh user signal. **Shipped this session and crossed off the queue:** MACRO-tile retrofit for RecProb/FCI (cross-link path, not shared component), persisted `last_fetch_error`, Anchored VWAP, Ctrl+K palette, right-click context menu on tiles, sidebar + token readability passes.

**Indicator naming note:** the quad-SMMA-state indicator was originally seeded as "Larsson Line" (trendscope's label). During S7 we renamed to **SMMA Ribbon** after confirming from the originator's own Medium post that the math is derivative of public community work, not his invention. Session logs below keep the original "Larsson" references as a historical record — code, DB seed, UI text, and `CLAUDE.md`/`DESIGN.md` use "SMMA Ribbon" going forward. See `memory/m6_indicator_rename.md`.

### S22 — UX leverage week (2026-05-03)

Single-day session, eight commits on master. One bug fix, five user-facing features, two readability passes. No backend architectural shifts. Decisions captured in `memory/s22_decisions.md`.

**Master timeline.**

| Commit | Topic |
|---|---|
| `1cdafcf` | fix(charts): center watermark horizontally on candlestick view |
| `0922f85` | feat(macro): RecProb + FCI tile retrofit with Analysis cross-link |
| `39b9f20` | feat(charts): Anchored VWAP overlay with click-to-anchor |
| `8004deb` | feat(db): persisted per-ticker last_fetch_error across sessions |
| `ea8de9b` | feat(shell): Ctrl+K command palette with fuzzy search |
| `4301295` | feat(tiles): right-click context menu for watchlist + purge |
| `74f0b92` | style(sidebar): readability pass — brighter, bolder, less tracked |
| `22525e9` | style(tokens): brighten text-secondary + text-tertiary app-wide |
| `f198d1e` | feat(installer): NSIS bundle config + LICENSE + branded BMPs + setup-exe icon |
| `dd5c4c7` | docs: session-end S22 — UX leverage week + installer pivot recap |
| `741cdbc` | docs: scope screen-density adaptation as new project (04) |

**(1) Watermark horizontal-center fix (`1cdafcf`).** S19 pinned the watermark vertically to the price grid but used numeric `left: '50%'` for horizontal — anchors the bounding box's left edge, not its center. Visible as the ticker name appearing right of center on every candlestick chart. Line-mode used the keyword `'center'` and worked correctly. Drop `leftPct` from `gridCenter` interface, use `'center'` keyword for horizontal, keep numeric `topPct` for the price-pane vertical pin. Captured as **EC-17** in LESSONS.

**(2) MACRO-tile retrofit (`0922f85`).** Closes the S15 Q4 "both surfaces" deferral. Three options (just flip `tile_visible` / flip + cross-link click / build shared `<MacroSeriesView>`). Picked B (cross-link) — minimal-flag-flip loses threshold lines + recession bars on click; shared component is yak-shaving for two series. New localStorage handoff `session.analysis_handoff_tab` consumed by AnalysisLayout on mount once `usePersistedState.loaded` resolves (gating prevents async load race). Seed flip idempotent: drops `RECPROUSM156N` / `NFCI` from the v1.1 Analysis-only UPDATE list AND adds an explicit `tile_visible = 1` UPDATE for v1.1 → v1.2 upgrade path. Known wart accepted: NFCI's `units = 'Index'` makes `computeYoY` produce a percent-change reading that's misleading near zero — defer fix until annoying.

**(3) Anchored VWAP overlay (`39b9f20`).** First **interactive** chart element in the app. Standard VWAP with `typical_price = (h+l+c)/3`, click-to-anchor, downward triangle marker at the anchor bar. Decisions: anchor transient (lost on toggle-off + bar change — exploratory by design); whole price pane via ZRender (`chart.getZr().on('click')` filtered through `chart.containPixel({gridIndex:0}, [x,y])`); zero-volume tickers auto-suppressed (cumulative volume 0 → all-null result → series skip); accent-amber color (new `accentAmber` token in chartTheme). ZRender click handler attached **once** with empty deps; refs feed latest state — re-attach on every render races ECharts pointer state during drag-pan. Captured as **FE-6** in LESSONS. Bug caught at smoke-test: `convertFromPixel({xAxisIndex: 0}, [x,y])` returns NaN — finder shape expects single number for `{xAxisIndex}`, 2D pair for `{gridIndex}`. Fix: use `{gridIndex: 0}` for both `containPixel` and `convertFromPixel`. **EC-16** in LESSONS.

**(4) Persisted last_fetch_error (`8004deb`).** Closes the S21 PRIME-failure UX wart. New `quote_cache.last_fetch_error TEXT` column with idempotent migration. Schema decision: `quote_cache` (per `(ticker, data_source)`) NOT `watchlist_tickers` (per `(ticker, sector_group_id)`) — fetch state is per-source, not per-group. Written on PRIME / quote-refresh failures; cleared on either path's success. New `Db::set_quote_fetch_error` upserts a row if absent so first-ever-failure for new tickers gets diagnosed; doesn't touch `last_fetched` so freshness check keeps treating row as stale. Pulse no-bars rows with errors render `⚠ <message>` spanning percentile cells with amber left-border accent.

**(5) Ctrl+K command palette (`ea8de9b`).** Spotlight-style modal triggered globally (works inside form inputs per VS Code / Linear convention). Fuse.js@7.3.0 (12KB gzipped). Searches four navigation surfaces: tickers (one entry per `(ticker, sector_group_id)`), sectors, FRED series, Analysis tabs. New IPC `list_palette_tickers` returns one row per ticker × sector — separate from `list_tickers_with_coverage` which DISTINCTs across sectors and is the wrong shape for navigation. Action wiring reuses three existing handoff patterns: tickers → S21 `session.pulse_feature_chart_target`; FRED → new `session.macro_chart_handoff` consumed by MacroDashboard on initial tile load; Analysis → S22 `session.analysis_handoff_tab`. Discoverability: visible `⌘K` button in AppHeader next to gear, refactored both into shared `.app-header__icon-btn` class. Modal styling iterated at user feedback: `--bg-elevated` background, 0.78 backdrop opacity + 3px blur, drop shadow + cyan ring, hint text from `text-tertiary` to `text-secondary`. Settings sections + Pulse cells deliberately NOT indexed for v1.2.

**(6) Right-click context menu on tiles (`4301295`).** Three-item contextual menu: Add to / Remove from WATCHLIST (mutually exclusive based on live membership lookup), Purge from database (always available, confirm dialog reuses `.modal--narrow` pattern with new `.view-toggle--destructive` red-bordered button). Backend: `AddTickerInput` extended with optional `data_source` override — WATCHLIST is seeded `data_source = 'mixed'` (routing label, not a fetcher key); right-click flow passes the tile's actual source so quote/history fetches work. Backwards-compatible — `TickerEditPanel` calls without `dataSource` and continues to inherit. New `TileContextMenu.tsx` (~80 LOC) positioned at clientX/clientY, clamped to viewport, click-outside via `mousedown` capture so the menu closes BEFORE the underlying tile click fires (otherwise dismiss-click would also open the feature chart). Transient action toast bottom-right reports outcome. WATCHLIST membership tracked as `Set<string>` via S22 `list_palette_tickers`, refetched after any add/remove/purge.

**(7) Sidebar readability pass — Level 1 (`74f0b92`).** User flagged sidebar text as hard to read, especially for mild visual impairment. Diagnosis: previous values stacked **three** accessibility taxes — `text-secondary` mono items at 14px with 0.08em tracking, plus parent labels in dim `text-tertiary` at 12px ALL CAPS with 0.15em tracking. ALL CAPS strips silhouettes, monospace disables word-recognition, tight tracking spreads letters. Three-level fix proposed; user picked tactical sidebar-only first. Items: `text-secondary` → `text-primary`, `fs-sm` → `fs-md` (14→15px), weight 400 → 500, tracking 0.08em → 0.02em. Parents: `text-tertiary` → `text-secondary`, `fs-xs` → `fs-sm`, weight 500, tracking 0.15em → 0.06em (ALL CAPS preserved — the tax was the stack, not caps alone). Disabled opacity 0.35 → 0.45.

**(8) Token brightness pass — Level 2 (`22525e9`).** App-wide brighten of the two dim text tokens. `--text-secondary`: `#9ca3af` → `#b8bdc7` (6.7:1 → ~9.4:1, AAA on bg-base). `--text-tertiary`: `#6b7280` → `#8a91a0` (4.4:1 → ~6.0:1, AA-large). No hue shift — same gray family. RGB companions updated in lockstep. Affects every "lower-priority context" surface: VRVP volume bars, Pulse partial-history asterisks, FRED tile metadata, ECharts axis labels, news timestamps, modal subtitles, footer caveats. Deliberately untouched: `--status-neutral` (market-hours dot — muted intentional), `--state-neutral` (SMMA palette), hexToRgb fallback in theme.ts. Level 3 (Settings → Comfortable mode toggle) deferred — adds ongoing complexity tax to every future feature.

**(9) Phase 4 deferred — user call.** User considered COT (Commitments of Traders) as a single high-value Phase 4 tool, then weighed cost against alternatives in the v1.2 queue and dropped: "the amount of work for the value — I don't think it is there." All three Phase 4 tools (COT / AAII / VIX term) now formally deferred from v1.2; updated `v11_analysis_design.md` Phase 4 section to reflect the deferral. Don't re-propose without a fresh user signal.

**(10) NSIS installer pivot.** Distribution shape was portable-exe-only since S12 (`bundle.active: false`). Studied PrivateACB's installer setup at `E:\Users\PBL\Documents\Dev\PrivateACB_Tauri` — Tauri owns the NSIS template; configuration is entirely declarative via `bundle.windows.nsis.*`. Three-phase pivot: (a) authored `src-tauri/LICENSE.txt` — free personal-use shape, ~55 lines, mirrors PrivateACB's structural style but rewrites for free-software framing (no license keys, no trial, no per-device cap, "decision support not investment advice" load-bearing clause from CLAUDE.md principle 9, governing law Canada, contact via PrivateACB.com); (b) flipped `bundle.active: false → true`, set `targets: "nsis"` (not `"all"` — restrict to NSIS-only, skip MSI to halve bundle time), populated `bundle.icon` array against existing `src-tauri/icons/` set, added `licenseFile: "LICENSE.txt"`; (c) generated 164×314 sidebar + 150×57 header BMPs at 24-bit format via PowerShell System.Drawing — dark `#0a0e14` bg matching app chrome, octagonal candlestick icon downscaled with HighQualityBicubic, "PRIVATE / TERMINAL" stacked wordmark in cyan Consolas Bold, italic "Personal market research" tagline + "by PrivateACB.com" byline on sidebar; (d) set `installerIcon: "icons/icon.ico"` so the setup.exe itself shows our brand instead of the default NSIS cyan-frame logo. Tauri schema does NOT expose `uninstallerIcon` (verified against `node_modules/@tauri-apps/cli/config.schema.json`); uninstaller inherits from the same .ico. First build produced 6.4 MB NSIS installer (LZMA-compressed; vs 19.4 MB portable exe — installer is ~1/3 the size). Tauri builds installer + portable exe additively; both ship from the same `tauri build` invocation.

**Distribution model now.** `target/release/personal-terminal.exe` (19.4 MB portable, unchanged) + `target/release/bundle/nsis/Private Terminal_1.0.0-rc.1_x64-setup.exe` (6.4 MB installer, branded). Both produced by `npm run tauri:build`. AppData path `%APPDATA%\Roaming\personal-terminal\` deliberately preserved across the rename (S11 decision) so existing user data survives switching from portable to installer-distributed builds.

**Windows Explorer icon-cache gotcha.** Setup.exe icon is correctly embedded in the binary (verified via `Icon.ExtractAssociatedIcon` — returned the octagonal candlestick), but Windows Explorer aggressively caches per-file icons by path; rebuilding `setup.exe` at the same path keeps showing the OLD cached icon until renamed or `ie4uinit.exe -show` runs. Invisible to anyone receiving the installer fresh on their own machine. Subsequent versioned releases (1.0.0-rc.2, 1.0.0, etc.) dodge this naturally because Tauri stamps the version into the filename.

**(11) Screen-density adaptation — new project (04) scoped.** End-of-session tester feedback: app works correctly but doesn't display well on smaller / scaled screens. Two examples flagged non-exhaustively: Pulse showing only ~25% of vertical for the actual ticker table; FeatureChart dataZoom slider barely visible / hard to grab. Honest diagnosis logged: developed on a higher-res display, fixed-pixel chrome accumulates to ~290-350px and proportionally consumes 40-49% of vertical on 720px-effective screens (1080p × 150% Windows scaling, common on consumer laptops). New project at `.projects/04_responsive_density/design.md` scopes a three-phase plan and lists diagnostic info needed (tester's resolution + display scaling + 2-3 screenshots) before any code edits. Phase 1 (no diagnostic needed, ~half session) — dataZoom slider bigger + brighter handles, FeatureChart liability footer collapsed to one line, Pulse banner vertical compaction. Phase 2 (after diagnostics, ~session) — `@media (max-height)` rules in `app.css`. Phase 3 (only if needed, ~session) — Settings → Density preference toggle (Compact / Default / Comfortable). Anti-patterns documented: don't replace fixed pixels with `vh` globally (fights tile-grid LESSONS FL-2), don't add component-level density branches, don't over-engineer Phase 3 ahead of need. Memory index entry added. Awaiting tester diagnostics + screenshots in next session.

**Course corrections in-session.**

- **AVWAP convertFromPixel finder.** First impl used `{xAxisIndex: 0}` with 2D pixel input, returns NaN. Fix: `{gridIndex: 0}` for round-tripping 2D pixel → 2D coord. Bug caught at first smoke; user reported "clicking does nothing." LESSONS EC-16.
- **AVWAP toggle-off behavior.** Original design: toggle on/off preserves anchor (sticky within session). User reported as bug: "re-toggling brings back the previous line." Fixed with a useEffect watching `showAvwap` that clears the anchor on toggle-off. Re-toggling now starts fresh with the click-to-anchor hint.
- **Palette modal readability.** First palette pass used `--bg-surface` + 0.55 backdrop opacity. Modal blended into the chart underneath. User flagged "not very readable." Bumped backdrop to 0.78 + 3px blur, modal `--bg-surface` → `--bg-elevated`, brightened hint copy from text-tertiary to text-secondary, added subtle cyan ring on modal border.
- **Sidebar readability — picked tactical first.** Three levels (sidebar-only / token bump app-wide / Settings density toggle) laid out with tradeoffs. User picked Level 1 first to evaluate; after validation, asked for Level 2 on top. Level 3 (Comfortable mode toggle) explicitly NOT taken — acknowledged ongoing tax cost.
- **COT scope reversal.** User initially approved COT after I outlined trade-offs and confirmed it as the strongest of Phase 4. Five-decision plan surfaced (CFTC report variant / contracts to track / viz shape / Pulse integration / backfill depth). User then reversed — "the amount of work for the value isn't there." Healthy reversal; stayed in flux until the cost reality landed.
- **Day-of-week returns Analysis tool.** User considered, then dropped ("really only added value for crypto, but for now we pass"). Surfaced TradingView / Quantpedia precedent + my honest critique of DOW effects (small, noisy, fade out-of-sample). Could revisit if crypto-specific seasonality becomes interesting.

**Build artifacts.**

- 8 commits on master (full table at top).
- All gates clean across every commit: `cargo check` clean, 9/9 cross_section + 20/20 analysis math tests green, `tsc --noEmit` clean, `npm run build` ~3.8–5.0s.
- Bundle grew ~30KB / +11KB gzipped from Fuse.js dep; rest of additions are CSS / TS code at expected scale.
- Two smoke screenshots committed: watermark-bug evidence (drove the centering fix) and palette-readability feedback (drove the modal styling pass).

**Next session entry point.**

- **Tester diagnostics for screen-density project (04).** Bring tester's screen resolution + Windows display scaling values + 2-3 screenshots (Pulse, a FeatureChart in candlestick mode, MACRO dashboard). Project at `.projects/04_responsive_density/design.md` has the full triage plan ready.
- If diagnostics not yet available, ship Phase 1 quick wins (dataZoom slider bigger/brighter, liability footer trim, Pulse banner compact) — they're no-regret regardless of resolution.
- Other v1.2 queue items below remain available; project 04 takes priority because tester feedback is current and concrete.
- v1.2 priority queue thinned considerably — see updated queue at top.
- Other highest-leverage items: Vol Cone subpane (~1 evening, FeatureChart enhancement following S19/S22 AVWAP precedent).
- RC1 tester feedback on the rc.1 build itself still pending on parallel track.
- Phase 4 Analysis tools deferred — don't re-propose without fresh user signal.

---

### S21 — Pulse implementation + Scanner deprecation (2026-05-02)

Build session for the v1.2 Pulse killer feature designed in S20. Uncommitted at session-end. 7 modified + 7 new files; `cargo check` clean, 9/9 cross_section + 20/20 analysis math tests green, `npm run build` 3.80s. Decisions captured in `memory/s21_pulse_implementation_decisions.md`.

**(1) Pulse visual design lock (3 rounds of ASCII mocking + screenshot iteration).**
- **Style C cell rendering** — saturated colored block ~96px × 26px with number inside (15px monospace, 600 weight). No internal cell border; 1px column-gap as the only separator. ASCII-bar glyph (▰▰▰▰▱) considered + dropped (5 quanta too coarse). Number-on-tint without block frame (Style B) considered + dropped (reads as "data table" not "heatmap").
- **Palette 1 R→Y→G** — visceral / Bloomberg-y. Palette 2 (cyan/amber non-judgmental) considered for honesty, rejected — TabIntro absorbs the value-judgment caveat the same way every Bloomberg/TradingView heatmap does.
- **Neutral-hold saturation curve** — 40-60 alpha ramps 0 → 0.06, then ramps to 0.55 at the tails. `pulseCellBg(percentile)` function. DD column = monotone red, depth-saturated, saturating at -40%.
- **Heavy section header** — flat `--bg-elevated` background. Cyan-fade gradient was first attempt, dropped after smoke-test feedback "too elegant for marketing-cool." Row count + regime split inline.
- **Top banner** — PULSE title (cyan, fs-xl, letter-spacing 0.18em) + tagline + total counts split (BULL/BEAR/NEUT/macro/EXTREMES) + filter chips. Tight 26px rows fit ~25 above fold on 1080p.

**(2) REGIME chip palette decision — two distinct color axes, intentionally.** User flagged real visual disconnect: BULL chip = cyan (SMMA palette), heatmap "high" cell = green (status-up). Considered (A) repaint chips to R/Y/G, (B) repaint heatmap to cyan/rose, (C) keep both with beefier chips. Picked C: REGIME = categorical state via SMMA palette tokens (user-customizable via Settings → Appearance per S9), heatmap = continuous percentile via fixed Palette 1. Different semantic roles, don't have to match. Mitigation: chip `min-width: 84px`, alpha 0.28 background, border-color alpha 0.7 — reads as a self-anchored "regime indicator" not competing with cells. Option A was actually wrong (would silently override the user's customization).

**(3) Copy: "your watchlist" → "your universe".** User caught semantic clash with the WATCHLIST sector_group (one of many; empty by default). Pulse iterates EVERY ticker across EVERY group + every FRED series, not just the WATCHLIST slot. Renamed in banner tagline + TabIntro subtitle + first bullet.

**(4) Backend `cross_section/` module.**
- Top-level Rust module (not under `analysis/`) — Pulse's distinct sidebar placement + likely growth of percentile-related compute justifies separation.
- Files: `mod.rs` (types `CrossSectionRequest/Response`, `CrossSectionRow`, `CrossSectionSection`, `RegimeState`), `compute.rs` (~280 LOC), `percentile.rs` (CDF rank, NaN-safe, neutral-50 fallback), `tests.rs` (9 unit tests covering percentile edge cases + rolling-volume warmup/missing-volume).
- IPC wrapper `commands/cross_section_cmds.rs::compute_cross_section`; registered in `lib.rs::generate_handler`.
- `analysis_tools` registry row for `pulse` added to `seed.sql` (`display_order: 0`, `config_json: '{"lookbackYears":5}'`).
- **Universal indicator compute path** — SMMA Ribbon / RSI / ATR run with default params for every ticker via `find_indicator(id).compute(&bars, &json!({...defaults}))`, ignoring `indicator_settings.enabled` and per-ticker params. Cross-section reads break if half the rows use different SMMA confirm_bars or RSI lengths.
- Coverage gates: `<30 bars` → `no_bars: true` greyed row; `<252 bars` → `partial_history: true` asterisk on percentile cells; macro `<60 obs` → partial.
- Section ordering bug caught at smoke-test: top-level leaves with no parent collapsed to sort-key `(0, ...)`, sorting them BEFORE sub-sectors. Fix: `match parent { Some(p) => (p.display_order, g.display_order), None => (g.display_order, 0) }`. See LESSONS DB-11.

**(5) Frontend (`PulseDashboard.tsx`, ~430 LOC).** Single-file Pulse view. Ships with `<TabIntro>` per S17-mandatory pattern. Banner + TabIntro + sticky column header + section-grouped body. Filter chips ALL/BULL/BEAR/EXTREMES (always-grouped sort within sections, no auto-flatten). Sort indicators ▼/▲ on column headers, click-cycle through desc → asc → off. Always-clear-on-mount handoff consumption pattern. `pulseSampleData.ts` (visual prototype's hardcoded data) deleted.

**(6) Ticker-column click → auto-open feature chart.** Picked **ticker column only** over whole-row click — Pulse's design doc promises hover-on-cell tooltips (raw value + percentile + lookback + last-fetched), so whole-row click would put every cell hover one accidental misclick from navigation. Bloomberg HRH / TradingView convention treats ticker as a hyperlink, cells as read-only data.
- localStorage handoff `session.pulse_feature_chart_target = { ticker, dataSource }` matches S17 Correlations→Pairs pattern.
- TickerDashboard reads + clears handoff after tiles load (always-clear, even on mismatch — prevents stale handoffs hijacking later manual navigation), `setSelected(matchingTile)` opens the inline feature chart.
- `data_source` field added to `CrossSectionRow` so the handoff has an exact key (same ticker can exist under different sources).
- App.tsx fallback: invalid persisted `active_section` (e.g. legacy 'scanner', user-deleted custom group) → redirect to 'pulse' once `groups` loads.
- `setActiveSection` prop drilled from App through SectionView → PulseDashboard.

**(7) Scanner deprecation.** Honest assessment: Pulse subsumes Scanner's analytical content. Scanner's unique value reduced to PRIME (critical, needs new home), RECOMPUTE (dead weight — both already recompute on mount), raw RSI/ATR/price (debatable; percentile lens more useful for cross-asset comparison).
- **PRIME moved to Pulse banner** — amber chip in filter row, only renders when `noBarsCount > 0`. Calls `prime_scanner_histories`, refetches `compute_cross_section` after success. Contextual UX done right.
- **RECOMPUTE killed** — pure muscle-memory bait, never produced new state.
- **Scanner unrouted** — dropped from `PINNED_IDS` in Sidebar.tsx, dropped from App.tsx SectionView, import removed.
- **Soft-deleted in seed** — `UPDATE sector_groups SET user_hidden = 1 WHERE id = 'scanner'` for existing DBs; row removed from `INSERT OR IGNORE` for fresh installs.
- **Files preserved one release** — `Scanner.tsx`, IndicatorScanner component, `scanner_snapshot` IPC. Easy revert. Delete in v1.3.
- DESIGN.md feature #10 ("Multi-ticker scanner") superseded — same rationale that killed feature #5 (Watchlist Performance) in S10.

**(8) PRIME failure surfacing.** Old: `Primed 0 · 1 failed` was silent about which ticker. Tooltip lied — promised "fetch missing history" but PRIME can't help when symbol is invalid (e.g. user's seed has HIVE.TO but the actual listing is HIVE.V on TSX-V). Fix:
- `result.failures` rendered as a list under the prime-status strip — one row per failure with monospace ticker + error message + hint about exchange-suffix mismatch.
- Tooltip rewritten: "Fetch missing price history. Tickers that fail (typically because the symbol isn't on the data source) are listed below the banner."
- Option 3 (persisted `last_fetch_error TEXT` column on `watchlist_tickers`) considered for v1.3 — would survive across sessions, no re-PRIME needed. Schema work + fetcher modifications kept it out of v1.2.

**(9) Light theme considered + deferred.** S15 `[L]` token markers are *structural* readiness, not designed light palette. Real light theme = 2-session arc: design palette + per-component audit + ECharts re-tuning + heatmap saturation re-tuning for white backplate. Identity tradeoff (dark Bloomberg-y aesthetic just polished for marketing-cool Pulse), no demand signal (RC1 cold-eye feedback hasn't landed). Better next-session targets: Vol Cone / Return Distribution / Seasonality / Anchored VWAP / MACRO-tile retrofit / CoinGecko fetcher / M9 features.

**Course corrections in-session.**
- **Initial sort key collapsed top-level leaves to `(0, ...)`.** Caught at smoke-test when CRYPTO appeared above INDICES_AMERICAS. Fixed inline; captured as a durable LESSONS pattern (DB-11).
- **REGIME chip "make it match" instinct.** First reflex was option A (repaint chips R/Y/G). User's smart question about respecting the SMMA palette customization (S9) caught the override. Settled on option C (two distinct color axes intentionally) — durable principle for future visual decisions.
- **PRIME tooltip dishonesty.** First impl said "Fetch missing price history for greyed rows" — fine when PRIME succeeds, lying when symbols are invalid. User's HIVE.TO observation surfaced the gap. Fix landed in same session.
- **Whole-row click instinct.** User asked the question; ticker-column-only is the right answer once you account for cell tooltips being a load-bearing UX feature. Committed.
- **Light theme "is this a good time?"** Easy yes-instinct given prior token prep (S15). Resisted — proper light theme is a real arc, not a session-end polish pass.

**Discussions parked / scope deferred.**
- **Persisted per-ticker `last_fetch_error`** (option 3 from PRIME-failure work). Better diagnostic surface than the inline list — survives across sessions. Schema + fetcher work, queue v1.3.
- **Light theme**. 2-session arc, queued for post-RC1 if feedback surfaces it.
- **Scanner.tsx + scanner_snapshot IPC deletion.** Files preserved one release for revert-safety. Delete in v1.3 cleanup pass.
- **Vol Cone / Return Distribution / Seasonality / Anchored VWAP** — each ~1 evening, FeatureChart enhancements queued from S19 precedent.
- **Compute caching** — Pulse recomputes on every open. ~1s on 200 rows post-PRIME. If sluggish, design doc has `cross_section_cache` table option ready to deploy.

**Build artifacts.**
- 7 modified + 7 new files. Diff hand-tracked (no commit yet).
- 9/9 cross_section unit tests + 20/20 analysis math tests green.
- `cargo check` clean. `tsc --noEmit` clean. `npm run build` 3.80s, 664 modules (one less than mid-session due to `pulseSampleData.ts` deletion + Scanner import removal).
- Smoke screenshots: `Screenshot 2026-05-02 183733.png` (early PULSE — uncovered REGIME-chip-vs-heatmap palette disconnect), `200600.png` (post-section-fix live data — saturation curve + heavy section headers + REGIME chips beefed up).

**Next session entry point.**
- Commit S21's work (`cargo check` clean, all gates pass, 7 + 7 files ready). User trusts the wrap-up; commit + push pending.
- Then: highest-value next-session targets in priority order — (a) Vol Cone subpane (~1 evening, FeatureChart enhancement following S19 drawdown precedent), (b) MACRO-tile retrofit for RecProb/FCI via shared `<MacroSeriesView>` (~half session, closes a known design-doc gap), (c) v1.3 cleanup pass (delete Scanner.tsx + scanner_snapshot, persist last_fetch_error per ticker), (d) Phase 4 Analysis tools (COT/AAII/VIX term — real new fetchers, larger).
- RC1 tester feedback still pending — no code commitments on that track.

---

### S20 — v1.2 killer-feature design (Pulse) + database reformulation (2026-05-02)

Three-arc session: (1) brainstorm conversation that landed on **Pulse** as the v1.2 killer feature; (2) full DB seed reformulation (Phase 0 of the Pulse build); (3) sidebar polish + global scrollbar theming. Four commits on `feature/v1.2-database-reformulation`, fast-forwarded to master at `05416a0`. Pure design + frontend + DB seed; no backend code, no Rust changes, no schema mutation.

**(1) Killer-feature brainstorm.** Open-ended conversation explicitly framed by the user as wanting the unbiased pick. Three concepts evaluated:
- **Conviction Forge** (proposed by an external AI in `.projects/01_initial_design/potential_killer_feature.mb`) — Monte Carlo trade-idea simulator with a "Narrative Resonance Score" 0-100 gauge. **Rejected** for violating principle 9 of `CLAUDE.md` ("decision support, not investment advice") — a probability-fan + conviction gauge is a trade signal regardless of disclaimer wording. Also flagged: numerology (5 weighted inputs that double-count correlated features), curve-fit calibration claim, dependency on data the app doesn't have (news sentiment, fundamentals, real-time order flow), wrong framing for a personal-use tool with no growth metrics.
- **Time Machine** (proposed by me) — single date picker that snaps the entire dashboard to any past date. **Killed** by the 5-year ticker-history limit: the demo wow ("show 2008 GFC") doesn't work because Yahoo's `/v8/chart` only serves ~5y back. Macro-only time machine (FRED has decades) was technically viable but loses the whole-dashboard punch.
- **Pulse — percentile cross-section heatmap** (proposed by me, locked) — single screen showing every ticker + every macro series as percentile-rank vs its own 5y history across REGIME / AGE / LEVEL / RSI / ATR / VOL / DD columns (NEWS dropped — too ephemeral). Sortable, filterable (ALL / BULL / BEAR / EXTREMES), click-cell-to-chart. The "morning weird-detector." Honest by construction (descriptive, not predictive) and uniquely powered by the local-first architecture (Bloomberg can't show a personal universe; TradingView can't cross-section).

**(2) Pulse design doc + database expansion proposal — locked, written, committed.** Two long-form design docs saved under new `.projects/03_cross_section_heatmap/`:
- `pulse_design.md` (~370 lines) — TL;DR, goal, non-goals, why-killer-for-this-app, naming (PULSE), sidebar placement (pinned position 0), 7 columns locked with detailed semantics + compute model + macro-row treatment, color/visual design, interactivity, full TabIntro copy, architectural placement (top-level `cross_section/` Rust module + `PulseDashboard` React component + new IPC), persistence, performance considerations, implementation phases, file touch-list, smoke-test checklist, risks, 7 open questions to lock at build time.
- `database_expansion.md` (~430 lines) — full Phase-0 spec covering the structural reformulation rationale ("mirror" over "extension"), 12 locked decisions (incl. drop BRK-B, move GLXY/WULF to US, keep CRYPTO flat + drop stablecoins, accept Telecom/Healthcare asymmetries, sub-sector INDICES + COMMODITIES, add WATCHLIST top-level), specific ticker populations per sub-sector, scale check (199 Pulse rows in the 100-200 sweet spot), rate-limit assessment (LOW risk + batched-prime mitigation), DB size estimate (55-65 MB post-expansion), pre-ship full-reset workflow.

**(3) Pulse killer-feature concept — full column inventory.**
| Column | Type | Source |
|---|---|---|
| REGIME | chip (BULL/BEAR/NEUTRAL/—) | SMMA Ribbon current state |
| AGE | days | bars since last regime flip |
| LEVEL | percentile | current value vs 5y own-history |
| RSI | percentile | current RSI(14) vs 5y own-history |
| ATR | percentile | current ATR(14) vs 5y own-history |
| VOL | percentile | trailing-5d-avg volume vs 5y own-history |
| DD | signed % | `(close / running_max - 1) × 100` |

Universal indicator compute: cross-section ignores per-ticker `indicator_settings` enable flags — runs SMMA/RSI/ATR with default params for every watchlist ticker so every row gets every column. Macro rows get LEVEL only (em-dash everywhere else).

**(4) Database reformulation — symmetric US ↔ CA sub-sectors + new top-level groups.** Full seed rewrite (commit `cabfe89`):
- US EQUITIES gains 10 sub-sectors (Tech / Banking / Energy / Telecom / Crypto Miners / Metal Miners / Healthcare / Consumer Staples / Utilities / REITs) — exact mirror of CA EQUITIES which gains 5 new sub-sectors (Tech + Healthcare + Staples + Utilities + REITs) on top of the existing 5.
- INDICES sub-sectored by region (Americas / Europe / Asia-Pacific) — 15 existing indices regrouped, no new tickers.
- Old `futures_fx` mixed group split into:
  - **COMMODITIES** sub-sectored (Energy / Metals / Agriculturals) — 11 commodity futures
  - **FX** flat — DXY + 5 currency pairs (`EURUSD=X` `GBPUSD=X` `USDJPY=X` `USDCAD=X` `AUDUSD=X`)
- New top-level groups: **WATCHLIST** (empty by default — personal-additions slot at top of user-managed sidebar), **BONDS & RATES** (TLT/IEF/SHY/HYG/LQD/TIP), **VIX & RISK** (^VIX). PULSE pinned at sidebar position 0 (registry row only — frontend wiring lands with Pulse implementation).
- Drops: BRK-B (conglomerate doesn't fit any sub-sector), USDT-USD + USDC-USD (stablecoins are permanent flat rows = Pulse noise).
- Moves: GLXY + WULF from `ca_crypto_miners` to `us_crypto_miners` (US-listed; geographic placement aligns with listing exchange).
- 4 new FRED series: **M2SL** (money supply), **DTWEXBGS** (trade-weighted dollar), **BAMLH0A0HYM2** (HY credit spread), **DCOILWTICO** (WTI from FRED — deeper history than `CL=F`). All MACRO-visible — gain new categories Liquidity / Risk / Energy in the dashboard.
- Final counts: 176 tickers (was 72, +104) + 29 FRED series (was 25, +4) = **205 Pulse rows total** (within 100-200 sweet spot, by 5).

**(5) Sidebar layout polish (commit `05416a0`).** Smoke-test of the new sidebar revealed the 180px width felt cramped with the deeper sub-sector tree. Two changes:
- Width 180 → **220px** (+22%); `.sidebar__item--child` left-padding bumped from `var(--space-xl)` to `calc(var(--space-xl) + var(--space-xs))` for sharper parent/child hierarchy.
- **Themed scrollbars applied app-wide** via `*` selector at the top of `app.css`. Single source of truth — every scrollable element (sidebar, main content, modals, tables, dropdowns) inherits a 6px thin bar with `--border-emphasis` thumb on transparent track, hover-brightens to `--text-tertiary`. Replaces the default Windows scrollbar (white-ish track that fought the dark theme) with a dim-tone bar matching the FeatureChart dataZoom slider styling. New scroll surfaces inherit automatically — no per-element styling required.

**(6) FeatureChart Tip — `Base` toggle interaction documented.** SMMA Ribbon Features card (already updated S19) gained a Tip explaining the AUTO-Y-off + click-Base interaction so the state-coloured hills/valleys behavior is reachable for users who want it. WATCHLIST tip + reset-workflow tip added to FeaturesTab Tips section (commit `a043ce9`).

**(7) Refresh / Prime gap diagnosed during smoke test.** User reported "not all tickers have data" after the seed re-ran on top of the existing DB. Investigation:
- REFRESH button (per-section) only fetches QUOTES → `quote_cache` (current price + change %). Does NOT fetch HISTORICAL bars.
- New tickers from the reformulated seed have zero rows in `price_history` → all the change_pct_1w/1m/ytd/1y calculations return None → tiles show price but `—` for change columns + no charts available without per-tile click.
- **Resolution:** SCANNER → PRIME button (S9 feature, `prime_scanner_histories`) batch-fetches historical bars for any ticker with zero bars in `price_history`. Function correctly handles the new parent/child sub-sector structure (iterates leaf groups, skips parents). One click; ~2-3 minutes for 100+ new tickers given the semaphore concurrency cap. No code change needed — feature already shipped.

**Course corrections in-session.**
- **Time Machine concept killed by data-window constraint.** First proposal sounded great until the user pointed out we only have 5y of ticker history (Yahoo cap). Shouldn't have proposed before checking data availability.
- **Watermark fontSize discussion (S19 carry-over context).** User considered + rejected the watermark-style quadrant labels for Pulse rows. In-place fontSize bump is the established pattern for Pulse's column headers.
- **Refresh-button confusion misread initially.** Almost dove into modifying the refresh path before tracing the architecture — the missing-data symptom was about HISTORY not QUOTES, and the existing PRIME button already solves it.
- **Per-element scrollbar styling refactored to global.** First pass styled `.sidebar__scroll` then `.scanner-table-wrap` then `.app-main` separately. User asked for app-wide consistency; collapsed to a single `*` selector at the top of `app.css`. Removed the three per-element duplicates.

**Discussions parked / scope deferred.**
- **Pulse implementation** — design locked but blocked on user executing the manual DB reset workflow so Pulse v1 ships against a clean reformulated universe (no leftover `futures_fx` orphans). Reset = backup → close app → rename DB file → reopen.
- **Old futures_fx group cleanup.** Smoke-test screenshot showed `FUTURES & FX` still present alongside the new structure because `INSERT OR IGNORE` left the old rows. Disappears on full reset. Documented in the design doc + the new Tip in FeaturesTab.
- **Optional batched-prime extension (Phase 0d).** Original design considered extending prime to stage in batches of 30-50 with inter-batch delays as a Yahoo-throttle defense. Skipped — current PRIME path with semaphore=5 already handled the user's smoke-test fetch fine. Add only if Yahoo throttling is observed.
- **MOVE bond-vol index** for VIX & RISK group — Yahoo coverage unreliable; skipped for v1.2. Add post-ship if Yahoo serves it.
- **Pulse build session itself** — implementation pending. Spec is locked in `pulse_design.md`; the build session reads that doc top-to-bottom.

**Build artifacts.**
- 4 commits on `feature/v1.2-database-reformulation`, all fast-forwarded to master:
  - `6aa0c89` docs(v1.2): Pulse design + database expansion proposal
  - `cabfe89` feat(db): reformulated v1.2 seed — symmetric US/CA + 176 tickers + 29 FRED
  - `a043ce9` docs(settings): FeaturesTab tips for WATCHLIST + reset workflow
  - `05416a0` style(sidebar): wider sidebar + themed scrollbars app-wide
- Net additions: ~1,400 lines / 7 files (4 new + 3 modified). All build gates clean: `cargo check` + `cargo test` (20/20 analysis math tests still passing) + `tsc --noEmit` + `npm run build` 3.78s.
- Smoke screenshot committed: `Screenshot 2026-05-02 104449.png` showing the post-seed-upgrade sidebar in mid-migration state (FUTURES & FX leftover from the upgrade-without-reset path).

**Next session entry point.**
- **If user has done the DB reset:** verify clean state then begin Pulse implementation per `pulse_design.md`. Single weekend feature build.
- **If user hasn't reset yet:** continue smoke-testing the reformulated seed against the current upgrade-state DB; flag any remaining data issues for fixes before Pulse work.
- **If user wants something else:** other FeatureChart enhancements (Vol Cone, Return Dist, Seasonality, Anchored VWAP) following the S19 drawdown-subpane precedent are next-cheapest each ~1 evening.

---

### S19 — Drawdown subpane + watermark pin + Features-tab rewrite (2026-05-02)

Single-session arc — first FeatureChart enhancement on the v1.1 priority queue, plus two pieces of incidental polish surfaced during the smoke test. Two commits on `feature/v1.1-drawdown-subpane`, fast-forwarded to master at `7fd94ec`. Pure frontend; no backend, no FRED series, no schema.

**(1) Drawdown subpane (commit `90c4705`).**
- New `DD` toggle in the candlestick toolbar alongside AUTO Y / VOL / VRVP. Default off; persisted at `session.feature_chart_show_drawdown`.
- Subpane sits **directly below price** (above volume + indicator subpanes per the user's preferred placement — drawdown is conceptually about price, not about volume or indicators).
- **Pane-index math refactored** from per-toggle conditional offsets (`volumePaneIndex = showVolume ? 1 : -1; subpaneStartIndex = showVolume ? 2 : 1`) to a sequential `nextPaneIdx++` accumulator. Adding a future fixed subpane (Vol Cone, Return Distribution) drops in without per-toggle reshuffling — just one new `const x = showX ? nextPaneIdx++ : -1` line.
- Y-axis: max anchored at 0% (drawdowns are always ≤ 0 by construction), min auto-fits to the visible window's deepest drawdown with 5% padding below. Formatter renders `${v.toFixed(0)}%`. Drawdown computed on the FULL bar series so the running peak survives across the dataZoom window; the y-min is taken from the visible slice so the floor reads at full pane height.
- Series: red line + filled area via new `theme.statusDownFill` (`--status-down-rgb @ 0.18`) added to chartTheme.
- `computeDrawdown(closes)` helper: ~12 LOC. `(close[i] / running_max - 1) × 100`. Skips non-positive closes (would invert the percent calculation).
- Decision: **kept DD in the toolbar (Option α) instead of moving to IndicatorPanel.** Considered the conceptual case for grouping with RSI/ATR (all are "subpane series computed from price"), but the persistence + compute shape don't fit cleanly: indicators are Rust-computed + per-ticker; drawdown is TS-computed + global. Forcing it into the indicator framework would add a Rust module that just delegates running-max math (dumb). Cost-benefit favored toolbar placement.

**(2) Watermark pinned to price grid (same commit `90c4705`).**
- Was: `top: 'middle', left: 'center'` — chart-container geometric centre. With multiple subpanes on (drawdown + volume + RSI + ATR), the chart's centre slides DOWN into the indicator stack. Result: "Microsoft" bisecting RSI lines instead of sitting behind the candles.
- Now: `watermarkGraphic(text, fontSize, gridCenter?)` — extracts `grids[0].top + grids[0].height/2` (price pane vertical centre) and pins the watermark there via percentage coords. Horizontal centre kept at 50% — `left:60 / right:24` (px) are tiny relative to typical chart widths so the bias is negligible.
- Line mode (single pane) keeps the original chart-centre default — no regression for FRED feature charts.
- VRVP (EC-11/EC-12) untouched: dedicated value-axis, `clip:false`, `tooltip:{show:false}`, `z:15`. None of the changes touched the VRVP series push or its axis wiring. Verified before commit.

**(3) Y-axis name labels — tried + reverted.** Spec'd as "subpane labeling" via ECharts native `yAxis.name` (rotated text in the gutter, ~5 LOC × 3-4 panes). User feedback after first render: "looks odd I don't like it." Reverted same session. Concluded the Features tab + toolbar tooltips already cover the discoverability gap; no labeling needed in-chart. Corner-graphic alternative (small "DRAWDOWN" text in pane corner via `graphic`, like RRG quadrant labels) discussed and deferred.

**(4) Features-tab full rewrite (commit `7fd94ec`).** Closed a months-long discoverability gap. Was 7 cards (VRVP / SMMA Ribbon / RSI+ATR / Scanner / Market-hours / Tile range / Indicator framework) + 3 outdated tips. Now 19 cards under 4 section headers + 3 refreshed tips:
- **CHART OVERLAYS & SUBPANES (6):** Volume Profile (VRVP), Volume pane, Drawdown subpane, Auto-fit Y axis, Linked cursor, PNG save
- **INDICATORS (3):** Indicator framework, SMMA Ribbon (with new AUTO-Y-off Tip — see §5), RSI (14) and ATR (14)
- **ANALYSIS SECTION (9):** Overview + TabIntro pattern, Correlations, Yield Curve, Pairs / Ratio, RRG, Recession Probability, Financial Conditions Index, Regime Quadrant, NBER recession bar overlay
- **DASHBOARD & LAYOUT (3):** Scanner, Market-hours strip, Tile range switch
- **Tips refresh:** dropped obsolete "EDIT inside ticker dashboard" tip (S13 deprecated the inline EDIT toggle); renamed "Manage Groups" → "Manage Watchlist" (S13); added Correlations cell-click → Pairs cross-link tip (S17).
- Section headers use existing `.settings-subhead` class — no new CSS.
- Analysis-section cards kept succinct since each tab carries its own `<TabIntro>` disclosures (subtitle + How to read + The math). The Features tab is the discovery surface; the in-tab disclosures are the reference.
- Card content style guideline established: `What` mandatory, `Where` mandatory, `Caveat / Liability / Origin / Tip` when meaningful — don't pad short cards just to match long ones.

**(5) SMMA Ribbon "Base" toggle — diagnosed + documented.** User reported a regression: clicking "Base" in the chart legend used to drop the SMMA Ribbon to the x-axis as state-coloured hills/valleys; now it disappears. Investigation:
- SMMA Ribbon emits 4 stacked series from Rust: `Base` (= `min(v1, v2)`, transparent fill, lifts the bands up to where v1/v2 actually live) + `Bull Band` / `Bear Band` / `Neutral Band` (= `|v1-v2|` on bars matching state, else 0).
- Stacked rendering on MSFT (~$300-500 candles): Base ≈ $300 lifts the bands to $305 region, visible alongside candles.
- Click Base off: stack collapses → bands stack from y=0 → bands at y=0-5 are FAR below AUTO Y's price range ($290-520) → invisible.
- **Not a regression from this session** — my changes (drawdown / watermark / FeaturesTab) don't touch the SMMA series push, the legend, the VRVP wiring, or the price y-axis bounds. Confirmed via `git diff master --stat` before commit. The interaction is intrinsic to ECharts stacking + the AUTO Y bounds added in S11.
- User verified: toggling AUTO Y off + click Base = bands appear at chart bottom (screenshot `Screenshot 2026-05-02 085740.png`). Behavior is working-as-designed.
- **Resolution:** added a Tip line to the SMMA Ribbon Features card explaining the interaction. No code fix; the dead-end click isn't actually a dead end — it's a feature that requires AUTO Y off.

**Course corrections in-session.**
- **Drawdown placement decision (toolbar vs IndicatorPanel).** Quick discussion at smoke-test time. Picked toolbar after laying out the persistence-shape mismatch — moving to IndicatorPanel would be conceptually consistent but require an indicator-framework adapter for what's really just frontend math. Documented as a future option if the chart toolbar gets crowded.
- **Y-axis labels reverted.** First-attempt `yAxis.name` rotated labels read poorly in the slim gutter. Reverted same session. Lesson: when adding labels to an already-tight pane gutter, eyeball the visual before committing — `nameGap` math doesn't always preview cleanly.
- **Watermark pinning logic simplified.** First draft tried to derive horizontal centre from `(left - right) / 2 / containerWidth` — overengineered. Container width isn't known at option-build time and the bias from `left:60 / right:24` is tiny. Simplified to `leftPct: 50` with a comment noting the negligible asymmetry.
- **SMMA Base "regression" was UX, not code.** Initial reflex was to investigate the SMMA series push for changes. Trace through the code + the AUTO Y bounds math showed it's been this way since S11 (M8.6) when AUTO Y was added. The user was likely remembering the behavior from a small-priced ticker (where y=0 was inside the visible range) or a session where AUTO Y was off. Documented + tipped instead of patching code.
- **Features-tab structural decision.** Considered (a) flat list of 19 cards vs (b) sectioned under headers. Picked (b) — at 19 cards a flat scroll was visibly long during smoke. Section headers use the existing `.settings-subhead` class (no new CSS).

**Discussions parked / scope deferred.**
- **Per-pane corner-graphic labels** (small "DRAWDOWN" / "VOLUME" / "RSI" text in pane corners via ECharts `graphic`, like the RRG quadrant labels). Considered as the alternative to the rejected `yAxis.name` approach. Deferred — Features tab + toolbar tooltips cover the discoverability need; in-chart labels would add visual weight without proportional value.
- **Watermark fontSize auto-scaling** based on price pane height. With multiple subpanes the price pane shrinks; fontSize 96 may dwarf a small price pane. Not addressed this session — pinning to the price-pane centre solved the visible bug; auto-scaling is a v1.2 polish.
- **DD button promotion to IndicatorPanel.** Considered (Option β in the placement discussion). Deferred. If chart toolbar gets crowded with future "subpane" toggles (Vol Cone / Return Distribution), revisit.
- **Other FeatureChart enhancements** (Vol Cone, Return Distribution, Seasonality heatmap, Anchored VWAP per design doc). Drawdown sets the precedent; each subsequent one is ~1 evening using the same sequential `nextPaneIdx++` pattern.

**Build artifacts.**
- 2 commits on `feature/v1.1-drawdown-subpane`, both fast-forwarded to master:
  - `90c4705` feat(charts): drawdown subpane + watermark pin to price grid
  - `7fd94ec` docs(settings): expand Features tab — subpanes + Analysis section coverage
- Net additions: ~310 lines / 3 files (+ 3 smoke screenshots). `tsc --noEmit` clean. `npm run build` 4.26s.
- Smoke screenshots committed to `01_initial_design/screenshots/`:
  - `Screenshot 2026-05-02 081808.png` — drawdown subpane on MSFT, toolbar showing DD active.
  - `082036.png` — MSFT with VOL + VRVP + DD + RSI + ATR all on. Captured the watermark drift problem that drove the price-grid pinning.
  - `085740.png` — SMMA Ribbon Base toggled off with AUTO Y off, state-coloured hills/valleys at chart bottom.

**Next session entry point.**
- Conversation incoming on a "potential new feature that will knock socks off for new users — something nobody else thought of, since we have all this data." Brainstorm posture, not code-first.
- If continuing the FeatureChart-enhancement track: Vol Cone is the next cheapest (~1 evening), then Return Distribution / Seasonality / Anchored VWAP.
- RC1 tester feedback still pending; no code commitments on that track.

---

### S18 — v1.1 Analysis Phase 3 finish: Macro Regime Quadrant (2026-05-02)

Single-tool session closing out Phase 3. Two commits on `feature/v1.1-regime-quadrant`, fast-forwarded to master at `d471633`. Zero new FRED series.

**(1) Pre-build decisions locked.** Four open items resolved up front before any code:
- **Growth axis: INDPRO YoY (vs NAPM).** INDPRO has clean continuous monthly history; NAPM publication has historical gaps. NAPM toggle deferred to v1.2.
- **Inflation axis: CPI YoY default with Core PCE toggle.** Both already seeded — `CPIAUCSL` (headline) and `PCEPILFE` (Core PCE — what the Fed actually targets). Per-request dropdown.
- **Scope: Option α (Quadrant only).** Skipped the shared `<MacroSeriesView>` retrofit for Recession Prob + FCI MACRO tiles — that's a separate session if/when it lands. Phase 3 lean → Phase 3 complete in this session, no extra abstraction.
- **Trail: 24mo default with 12/24/36/48 picker.** Configurable; the 48-month view shows the full COVID-era inflation spike trailing through Stagflation back to current readings.

**(2) Backend — `analysis/regime_quadrant.rs` (commit `613e3f3`, ~210 LOC).**
- `compute_regime_quadrant(req)` pulls `INDPRO` + (`CPIAUCSL` or `PCEPILFE` per `inflation_proxy`) via existing `db.all_fred_observations`. Both monthly index series.
- Shared `yoy_pct_change(points, months)` helper added to `analysis/mod.rs` alongside new `RegimePoint { date, growth_yoy, inflation_yoy }` shape. Single 12-month-offset percent-change formula with NaN guards on warm-up (first 12 entries) and non-positive priors (avoids div-by-zero / sign-flip).
- Inner-join on `(year, month)` rather than exact date — INDPRO and CPI observation dates don't always coincide within a month, so calendar-month keying preserves all valid pairs.
- Long-run baselines (arithmetic means of the full joined history) returned for crosshair placement. Critical detail: US inflation has been positive for 50+ years, so 0/0 quadrant split would put the entire trail in the upper half. Anchoring at long-run means turns the chart into "above-trend vs below-trend" — economically informative.
- `axis_bounds` expand to include both trail min/max AND the baselines, padded ±1.5pp. Symmetric-around-zero falls back only when the trail is empty.
- 3 new unit tests (`yoy_basic_12_month_pct_change`, `yoy_warmup_first_n_are_nan`, `yoy_skips_nonpositive_prior`) → 20/20 total green.
- Registry: `regime_quadrant` (display_order 7, scope `macro`, default config_json `{"inflationProxy":"cpi","trailMonths":24}`).
- IPC: `compute_regime_quadrant` command + `lib.rs::tauri::generate_handler!` registration.

**(3) Frontend — `RegimeQuadrantTab.tsx` (commit `d471633`, ~330 LOC).**
- Toolbar: inflation-proxy dropdown (CPI YoY headline / Core PCE YoY) + trail-length picker (12/24/36/48). Persisted via `usePersistedState('session.analysis_regime_quadrant_config')`.
- ECharts scatter with four `markArea` quadrant fills split at the baselines: TR Reflation (green), BR Goldilocks (blue), BL Disinflation (gray), TL Stagflation (red). Stagflation/Disinflation alphas at 0.09 (bumped from 0.06/0.07 first draft for stronger left-half contrast).
- Single trail line with per-point opacity gradient (0.2 oldest → 1.0 head) + scatter head dot with `position: 'right'` label showing the current observation date. Tooltip per-point shows date + growth/inflation YoY.
- Crosshair `markLine` at both baselines, `theme.markerLine` solid width 1. **Deliberate divergence from RRG** — RRG has no explicit crosshair because its quadrant boundary lands on x=100 / y=100 where the splitLine grid happens to render. Regime baselines fall at non-round values (~2.74 / 3.52) that don't coincide with gridlines, so the boundary needs an explicit cue.
- TabIntro filled in per the S17-mandatory pattern. Subtitle reads in plain language; "How to read this" walks through each quadrant with the regime-color mapping; "The math" gives the YoY formula + the calendar-month inner-join note + the baseline-as-mean note.
- Always-visible chart container with `minHeight: 520` (EC-15 lesson — never `display: data ? 'block' : 'none'`).
- Footer: `current <date> · growth X% · inflation Y% · baselines G% / I% · trail N months · series INDPRO × CPIAUCSL`.

**(4) Layout polish — RRG + Regime in lockstep.** Three iterations during smoke test:
- **Quadrant-label readability.** First draft fontSize 10 was too small to read. Bumped 10 → 13 → 16 across two iterations; same change applied to RRG for visual parity.
- **Left-side label collision (RRG only).** "LAGGING" was clipping behind the y-axis tick label area — RRG's tick labels like "115.0" (4 chars wide) collided with the `left: 60` graphic position. Moved `left: 60 → 80` for the IMPROVING/LAGGING pair (and the symmetric STAGFLATION/DISINFLATION pair on Regime) so both charts stay aligned. Regime's tick labels are short (1-3 chars) so it didn't actually need the move, but applied for symmetry.
- **Crosshair iteration on Regime.** First draft used `theme.markerLine` solid (correct intent). User flagged it was more distinct than RRG's. Tried `borderSubtle` dashed (matches gridlines) — too subtle, the user noted "the white quadrant separation line no longer appears." Restored to original `theme.markerLine` solid + width 1 with a comment explaining the deliberate divergence (see decision above). Captured as a non-bug — RRG and Regime intentionally differ here.

**(5) Watermark-style quadrant labels considered + rejected.** During the readability iteration the user asked whether ECharts could render the quadrant names as faint backgrounds behind the data, like FeatureChart's terminal-style ticker watermark (pattern at `FeatureChart.tsx:769-787` — single centered `graphic` text, `fill: theme.watermarkFill` = `text-primary @ 0.05`, `z: 0`, `silent: true`). For a 4-quadrant chart the implementation diverges: 4 entries, dynamic positioning (Regime quadrants are anchored at runtime baselines, not fixed coords), color/alpha tradeoffs (semantic colors faded vs neutral). User picked the simpler path — bump the existing corner labels' fontSize and leave them in place. Pattern noted as a future enhancement option.

**(6) Smoke-test outputs.** Four screenshots committed under `01_initial_design/screenshots/`:
- `Screenshot 2026-05-02 072116.png` — CPI YoY, 24-month trail. Head at 2026-03-01 in DISINFLATION (growth 0.74% < baseline 2.74%; inflation 3.32% < baseline 3.52%) — economically plausible (cooling inflation off 2022 spike + below-trend industrial production).
- `072205.png` — Core PCE toggle, 24mo. Same head positioning, slightly different y-axis range.
- `072336.png` — Core PCE, 48-month trail. Full COVID-era inflation spike visible in upper portion (4-5%+ inflation, weak growth in 2022-23) trailing back down to current near-baseline reading.
- `074346.png` — RRG with bumped fontSize 13 showing the LAGGING-clip issue that drove the `left: 80` fix.

**Course corrections in-session.**
- **0/0 vs baseline crosshair.** Initial axis-bounds compute centered the chart at 0/0. Realized US inflation has been positive for 50+ years so the trail would sit entirely in the upper half — non-informative. Refactored backend to compute long-run mean baselines and expand axis bounds to include them. Quadrant interpretation shifted from "absolute level" to "above-trend vs below-trend."
- **Crosshair styling oscillation.** Three styling iterations driven by smoke test (markerLine-solid → borderSubtle-dashed → back to markerLine-solid). The lesson: RRG and Regime intentionally diverge here — RRG's split coincides with grid; Regime's doesn't. Don't force them to match where the data shape doesn't allow it.
- **Quadrant-label fontSize.** Three rounds (10 → 13 → 16). 16 is readable at the four corners without dominating; the watermark-behind-data alternative was deferred as future work.
- **`left: 60` vs `left: 80` for left-side labels.** Driven by RRG's longer y-axis tick labels. Both charts now use `left: 80` for visual symmetry.

**Discussions parked / scope deferred.**
- **Watermark-style quadrant labels.** User-considered, deferred. Would replace the small corner labels with large faint quadrant names rendered behind the trail data, mirroring `FeatureChart.tsx`'s ticker watermark. Implementation has tradeoffs (4 entries, dynamic positioning for Regime's runtime baselines, color choice) — user picked the simpler "bump fontSize in place" fix this session.
- **MACRO-tile retrofit for Recession Prob + FCI** (S15 Q4 "both surfaces"). Still deferred. Shared `<MacroSeriesView mode="tile" | "chart">` component would land cheaply; useful when daily-glance value is desired.
- **NAPM toggle for Regime Quadrant.** v1.2 escalation if INDPRO YoY's backward-looking nature becomes an issue.
- **Path (a) manual `log10()` transform** for Pairs + FeatureChart. Carry-over from S11/S17.
- **Bulk-add modal on TickerChipPicker.** Carry-over from S16/S17.

**Build artifacts.**
- 2 commits on `feature/v1.1-regime-quadrant`, both fast-forwarded to master:
  - `613e3f3` feat(analysis): regime quadrant backend — INDPRO/CPI(PCE) YoY compute + IPC
  - `d471633` feat(analysis): RegimeQuadrantTab — quadrant scatter with trail + RRG label parity
- Net additions: ~830 lines / 11 files. 20/20 analysis math tests green. `tsc --noEmit` clean. `npm run build` 3.91s, 664 modules.

**Next session entry point.**
- **If RC1 feedback lands:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump 4 files `1.0.0-rc.1` → `1.0.0`; rebuild; ship final.
- **If continuing v1.1:** options are (a) MACRO-tile retrofit for RecProb/FCI via shared `<MacroSeriesView>` (small, closes a known design-doc gap), (b) Phase 4 (COT/AAII/VIX term — real new fetchers, larger), (c) FeatureChart enhancements (drawdown subpane is the cheapest first ship), (d) the watermark-style quadrant labels as a polish round on RRG + Regime.

---

### S17 — v1.1 Analysis Phase 2 + Phase 3 (lean) + TabIntro pattern (2026-04-30)

Single-day arc covering two phases of v1.1 Analysis plus a cross-cutting UX retrofit. 5 commits across 2 feature branches; both fast-forwarded to master and deleted. End state: master at `d2e9a30`.

**(1) Phase 2 design lock-in (4 open items resolved up front).**
- **RRG math choice.** Spec mentioned "JdK normalization, 14-day default" — picked weekly sampling (last close per ISO week, Bloomberg convention), 14-week RS-Ratio lookback, 5-week RS-Momentum. Math: `RS = ticker/benchmark; RS_Ratio = 100 × RS / SMA(RS, 14w); RS_Momentum = 100 × RS_Ratio / SMA(RS_Ratio, 5w)`. Drift vs Bloomberg's proprietary z-score-of-z-score accepted — quadrant interpretation preserved, formula explainable.
- **Pairs log/linear toggle.** Dropped — same S11 ECharts log-axis finding (default tick generation broken for sub-decade ranges, exactly where ratios live). Path (a) manual `log10()` transform tracked as a separate v1.1+ task for both Pairs and FeatureChart.
- **Cross-tab navigation (Correlations cell → Pairs).** S15 Q1 locked the destination. Implementation: localStorage handoff key `session.analysis_pairs_handoff` + `analysis-set-active-tab` `CustomEvent`. PairsTab reads + clears handoff on mount; AnalysisLayout listens for the event and calls `setActiveId(detail)`. Cheap, no new abstraction. localStorage chosen over `usePersistedState` (which is SQLite-backed via session_cmds) because the handoff is ephemeral and must survive the tab swap (PairsTab unmounts/mounts as part of the dispatch).
- **Pairs picker shape.** New `maxChips?: number` + `placeholder?: string` props on `TickerChipPicker`. `maxChips=1` clamps to single-select; the input + dropdown auto-hide once at the cap. Backwards-compatible (undefined = no cap).

**(2) Phase 2 backend (commit `61a107b`).**
- `analysis/pairs.rs` (~210 LOC) — `compute_pair_ratio` + `rolling_zscore` over aligned closes. Uses existing `align_close_prices`. Returns ratio series, z-score series, summary stats (current, μ, σ, min, max), excluded list. Sample stdev (n−1 denominator) per finance convention. NaN guard on zero/negative denominator.
- `analysis/rrg.rs` (~290 LOC) — `compute_rrg` with `weekly_close_resample` (last close per ISO week via `(year, week)` BTreeMap key — `chrono::Datelike::iso_week()`), `rolling_sma`, `rolling_sma_skip_nan` (handles warm-up NaNs from chained passes). Inner-join on ISO week between ticker and benchmark; drops below `rs_period + momentum_period` joined weeks. Tail trimmed to last `tail_length` valid (RS-Ratio, RS-Momentum) pairs.
- `analysis/registry.rs` — added `pairs_ratio` (cross_asset, default config_json with quick-picks) + `rrg` (cross_asset, default benchmark/periods/tail).
- `db/seed.sql` — 2 new `analysis_tools` rows with same default configs.
- `commands/analysis_cmds.rs` + `lib.rs` — `compute_pair_ratio` + `compute_rrg` IPC commands.
- `analysis/tests.rs` — 7 new unit tests covering `rolling_zscore` (4: too-short, constant-window, basic-step, centered-zero), `weekly_close_resample` (1: takes-last-per-iso-week), `rolling_sma` (1: warmup-then-steady), `rolling_sma_skip_nan` (1: requires-n-finite). 17/17 total green.
- `types/analysis.ts` — `PairsRequest/Response`, `PairsHandoff`, `RrgRequest/Response`, `RrgTail`, `RrgPoint`. camelCase.

**(3) Phase 2 frontend (commit `7683c3f`).**
- `PairsTab.tsx` — two single-pickers (chip-picker `maxChips=1`), lookback 90/180/365/730/1825d, z-window 20/60/90/120, ECharts dual-pane (ratio top + z-score bottom with ±2σ dashed markLines), quick-picks button row pulled from `analysis_tools.config_json`. Magnitude-scaled `formatRatio` for tooltips.
- `RrgTab.tsx` — benchmark text input + Apply button (S15 Q3 — re-normalization too costly per-keystroke), ticker chip-picker, tail-length picker (4/8/12 wk), ECharts scatter with quadrant fills via `markArea` (TR green / BR amber / BL red / TL blue, all alpha 0.07), per-ticker tail with linear opacity gradient (0.2 oldest → 1.0 head), head dot with backed label, four `graphic` text quadrant labels (LEADING / WEAKENING / LAGGING / IMPROVING), ticker palette cycles 5 colors.
- `CorrelationsTab.tsx` — non-diagonal cells now have `corr-matrix__cell--clickable` class + onClick that writes `session.analysis_pairs_handoff` to localStorage + dispatches `analysis-set-active-tab` event. Diagonal cells unchanged.
- `AnalysisLayout.tsx` — listens for `analysis-set-active-tab` CustomEvent and calls `setActiveId(detail)`.
- `TickerChipPicker.tsx` — `maxChips`/`placeholder` props.
- `registry.ts` — adds `pairs_ratio: PairsTab`, `rrg: RrgTab`.
- `app.css` — `.corr-matrix__cell--clickable` (cyan outline on hover), `.analysis-pairs__quickpicks/__quickpick`, `.analysis-rrg__benchmark-row/__benchmark-input/__apply`, `.tab-intro` and 8 sub-classes (added later in the TabIntro retrofit).

**(4) Phase 2 smoke-test fix — chart-init zero-size bug.** First Phase 2 run (screenshots `Screenshot 2026-04-30 102436.png` + `102520.png`) showed footer-populated, chart-blank state on both Pairs and RRG. Both tabs hid the chart container with `style={{ display: data ? 'block' : 'none' }}` on first render — `echarts.init(container)` fired against a 0×0 div and cached that size; when data arrived and display flipped to `'block'`, ECharts never re-measured and rendered into nothing. Fix: drop the `display` toggle entirely; let the container be unconditionally laid out at `minHeight: 480/520`; loading + placeholder states sit above. Matches the YieldCurveTab pattern that worked. Captured as **EC-15** in LESSONS. Post-fix screenshot `103125.png` shows BTC-USD vs ^GSPC RRG with the full Improving → Lagging → Leading tail visible.

**(5) TabIntro pattern (S17-new) + retrofit (commit `7683c3f`).** RRG smoke-test surfaced the gap directly: quadrant labels like "Leading" sound like trade recommendations, but no tab explained itself. The user flagged that this needs strategizing across all tabs, not just RRG.
- **Three-layer pattern:** subtitle (always-visible, ~1 sentence, plain English) + collapsible "How to read this" (interpretation guide as `<ul>` + paragraph + standard liability close) + optional collapsible "The math" (formula reference for power users). Standard liability copy: *"Decision support, not investment advice. Patterns are descriptive, not predictive."*
- `components/analysis/TabIntro.tsx` (~48 LOC) — props: `subtitle: string` + `howToRead: ReactNode` + `math?: ReactNode` + `liabilityNote?: string`. Native `<details>` for accessibility-by-default; custom caret `▸ → 90°-rotated on open`. Cyan left-border + faint surface — sits visually between controls and chart without competing.
- Retrofit in same commit: Correlations, Yield Curve (Phase 1) + Pairs, RRG (Phase 2) all gain `<TabIntro>` between header controls and content area.
- **Copy iteration.** Initial draft was technical ("Pearson correlation of log returns over the chosen lookback…"). User asked for a less-technical rewrite ("Math stays as-is. Provide implemented text, then re-written text so I can compare. No code yet."). Side-by-side comparison shipped in chat for all four tabs; user approved all rewrites; second edit pass swapped each `<TabIntro>` body to plain-language form. Math sections kept technical (purpose: power-user transparency).

**(6) Design doc codification (commit `8760606`).** New "Tab presentation pattern (S17, 2026-04-30) — applies to ALL Analysis tabs" section in `.projects/02_v1_1_analysis/v11_analysis_design.md`, before "Risks". Documents the three-layer pattern, the standard liability copy, the component signature, the rule that Phase 3 + Phase 4 tools ship with `TabIntro` filled in (no merge to master without it), and the Phase 1 retrofit-alongside-Phase 2 note. Pattern is now a hard requirement, not a soft preference.

**(7) Phase 2 commit/merge.** Three commits on `feature/v1.1-analysis-phase-2`:
- `61a107b` feat(analysis): Phase 2 backend — Pairs + RRG compute, IPC, registry, math tests
- `7683c3f` feat(analysis): Phase 2 frontend — PairsTab, RrgTab, cell-click cross-link, TabIntro retrofit
- `8760606` docs(analysis): codify TabIntro pattern + Phase 2 smoke-test screenshots

Fast-forward merge to master; branch deleted.

**(8) Phase 3 scope decision (mid-session).** User asked about continuing into Phase 3. Three open items flagged before commit: (a) NAPM vs INDPRO for the Regime Quadrant growth axis (NAPM = forward-looking but FRED data has gaps; INDPRO = clean monthly history but backward-looking), (b) S15 Q4 "MACRO tile AND Analysis tab" — leaner path is Analysis-only first, (c) RECPROUSM156N data freshness (NY Fed has paused publication in past periods; FRED website blocks WebFetch so couldn't verify mid-session). User chose **option B** — ship just Recession Prob + FCI this session, defer Regime Quadrant. Recession Prob built with graceful empty-state handling (placeholder text + FRED link) in case the series turns out to be stale.

**(9) Phase 3 backend (commit `1d29223`).** Lean path — 2 simpler tools, no shared compute logic.
- `analysis/recession_prob.rs` (~80 LOC) — pulls `RECPROUSM156N` via `db.all_fred_observations`, returns points (`Vec<MacroPoint>`) + `RecessionThresholds { warn_pct: 30.0, imminent_pct: 50.0 }` + current value + units + observation count. Single-FRED-series passthrough; no derivable math, no unit tests.
- `analysis/financial_conditions.rs` (~90 LOC) — pulls `NFCI` similarly, returns points + current + min/max range + units + observation count. Same shape.
- `analysis/mod.rs` — shared `MacroPoint { date: NaiveDate, value: f64 }` type for both single-FRED-series tools. Inline-defined rather than per-module to avoid duplication.
- `analysis/registry.rs` — register `recession_prob` (display_order 5) + `financial_conditions` (display_order 6), both `scope: "macro"`, no default config.
- `db/seed.sql` — `RECPROUSM156N` (Percent, Monthly, category=Recession) + `NFCI` (Index, Weekly, category=Conditions) added to `fred_series` block; both flipped to `tile_visible=0` in the existing UPDATE. 2 new `analysis_tools` rows.
- `commands/analysis_cmds.rs` + `lib.rs` — `compute_recession_prob` + `compute_financial_conditions` IPC commands.
- `types/analysis.ts` — `MacroPoint`, `RecessionProbRequest/Response`, `RecessionThresholds`, `FinancialConditionsRequest/Response`. Empty-object request types via `Record<string, never>`.

**(10) Phase 3 frontend (commit `d2e9a30`).** Both tabs are simple ECharts line + NBER bars + TabIntro.
- `RecessionProbTab.tsx` (~255 LOC) — single line plot with `markLine` at 30% (amber dashed) + 50% (red dashed) + NBER `markArea` overlay. Empty-state placeholder includes external FRED link to verify series status. Footer surfaces current value + date + observation count + series id. Cyan accent fill matches existing chart aesthetic.
- `FinancialConditionsTab.tsx` (~250 LOC) — single line + zero baseline `markLine` labeled "long-run avg" + NBER overlay. Footer adds full-series min/max range. **Note:** initial draft used ECharts `visualMap` with two `pieces` to color the line amber-above-zero and cyan-below — caused immediate webview crash on first click. Crash was deterministic and reproducible. Suspect: `visualMap.pieces` + 35-segment `markArea` + 2,800-point weekly series hit a pathological ECharts render path. Stripped the `visualMap`; single accent-cyan line + zero baseline carries the narrative through the description and zero crossings. Captured as **EC-14** in LESSONS. TabIntro copy adjusted accordingly ("Above the solid zero line" / "Below the zero line", removed amber/cyan-color references).
- `registry.ts` — adds both tabs.

**(11) Phase 3 commit/merge.** Two commits on `feature/v1.1-analysis-phase-3`:
- `1d29223` feat(analysis): Phase 3 backend (lean) — Recession Prob + FCI compute, IPC, FRED seed
- `d2e9a30` feat(analysis): Phase 3 frontend — RecessionProbTab + FinancialConditionsTab

Fast-forward merge; branch deleted. User confirmed both tabs render correctly: "both work great - smoke tests passed."

**Course corrections in-session.**
- **Display:none chart-init.** Hiding the ECharts container on first render with a conditional `display` style = caches 0×0 at init. Caught by smoke-test, fixed by always-visible container + placeholder-above pattern. EC-15.
- **visualMap + long-series + multi-segment markArea.** ECharts pathological path → webview crash. Caught by smoke-test on first FCI click. Fixed by stripping visualMap. EC-14.
- **TabIntro copy register.** First draft was quant-jargon-heavy; user explicitly asked for plain-language version. Pattern: side-by-side comparison in chat before code edit, especially for user-facing prose. Cheap to do, prevents wasted PR-style cycles.
- **FRED bot-blocking on WebFetch.** `fred.stlouisfed.org` returns 403 on Claude Code's WebFetch (both page and CSV endpoints). Pragmatic posture: ship with graceful empty-state handling instead of trying to verify mid-session. Empty-state UI explains and links out so the user can verify themselves.
- **Recursive ECharts overlap risks.** Both EC-14 and EC-15 surfaced from "natural" ECharts patterns that don't error, just silently misbehave or crash. New rule of thumb: smoke-test every new tab in the actual webview before committing — `npm run build` + `tsc` doesn't catch render-time issues.

**Discussions parked / scope deferred.**
- **Macro Regime Quadrant.** 4-quadrant scatter (growth × inflation, 24-month trail). Held pending the NAPM-vs-INDPRO decision and a fresh look at MACRO-tile coupling. Reuses RRG's tail-rendering pattern when it lands.
- **MACRO-tile retrofit for RecProb + FCI** (S15 Q4 "both surfaces" intent). Both tools currently Analysis-only. If a `<MacroSeriesView mode="tile" | "chart">` shared component lands in the future, it makes the tile addition cheap.
- **`RECPROUSM156N` upstream verification.** Couldn't WebFetch FRED mid-session (403). Tab ships with empty-state placeholder + external link; user will see the latest observation date in the footer and can swap to `USRECP` if needed.
- **Bulk-add modal on TickerChipPicker** (carry-over from S16 — still deferred).

**Build artifacts.**
- 5 commits this session (3 Phase 2 + 2 Phase 3), all fast-forwarded to master:
  - `61a107b` Phase 2 backend
  - `7683c3f` Phase 2 frontend (incl. TabIntro retrofit)
  - `8760606` TabIntro pattern docs + Phase 2 smoke screenshots
  - `1d29223` Phase 3 backend (lean)
  - `d2e9a30` Phase 3 frontend
- Net additions: ~3,070 lines / 33 files. 17/17 analysis math tests green. `tsc --noEmit` clean. `npm run build` 3.84s, 663 modules.
- Screenshots committed: `Screenshot 2026-04-30 102436.png` (Pairs pre-fix, chart blank), `102520.png` (RRG pre-fix, chart blank), `103125.png` (RRG post-fix, BTC-USD tail rendering correctly).

**Next session entry point.**
- **If continuing v1.1:** Macro Regime Quadrant. Decide growth-axis (suggested INDPRO YoY for data hygiene; NAPM toggle as v1.2 escalation). Decide whether RecProb + FCI MACRO tiles land alongside (recommended: shared `<MacroSeriesView>` component). Add 1-3 FRED series to seed; new `analysis/regime_quadrant.rs` reusing RRG's tail-rendering pattern; `RegimeQuadrantTab.tsx` with TabIntro per the now-mandatory pattern.
- **If RC1 feedback lands:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump 4 files `1.0.0-rc.1` → `1.0.0`; rebuild; ship final.

---

### S16 — Git init + repo reorganization + PROGRESS prune + v1.1 Analysis Phase 1 (2026-04-29)

Largest single session of the project. Three discrete arcs in one sitting: (1) infrastructure (git + reorg + archive), (2) v1.1 Phase 1 build (backend + frontend), (3) two rounds of smoke-test fixes. Final state: 9 new commits + 4 prior + 1 inherited = master at `ef12190`.

**(1) Git initialization at v1.0.0-rc.1.**
- Reviewed pre-existing 327-byte `.gitignore` + drafted robust replacement covering node deps, Vite/dist, Rust target/ (8.2 GB), env + SQLite + IDE/OS, `release/` (27 MB), `infrastructure/`, `.claude/settings.local.json`, Windows `nul`. `Cargo.lock` kept tracked (binary-app convention; PrivateACB pattern).
- `git init` + first commit `1b9c85e` (chore: initial commit at v1.0.0-rc.1) — 198 files, 25,020 insertions.
- Verified ignores at commit time: `.env` (FRED + Finnhub keys), 8.2 GB target/, 27 MB release/ all correctly excluded.

**(2) Repo reorganization — `.projects/` structure.**
- Convention: `00_*` = pinned/cross-cutting; `NN_<name>/` = sequential feature projects, numbered for findability. Screenshots live inside their project folder.
- Skeleton: `.projects/00_bugs/`, `.projects/00_tracking/{archive,memory}/`, `.projects/01_initial_design/{images,icon_design,screenshots}/`, `.projects/02_v1_1_analysis/`.
- Moves: PROGRESS.md + LESSONS.md + memory/ → 00_tracking/; DESIGN.md + docs/images/ + .corel_draw/ → 01_initial_design/; v11_analysis_design.md → 02_v1_1_analysis/; root screenshots/*.png → 01_initial_design/screenshots/. `Analaysis_review/` (typo'd) deleted; `screenshots/finnhub_stuff.md` (live API key + webhook secret scratchpad) moved to `infrastructure/` (gitignored sibling, never crosses into git).
- `CLAUDE.md` path references rewritten + new "Project Organization" section documenting the convention. `.claude/commands/session-start.md` + `session-end.md` paths updated. Historical references inside PROGRESS/DESIGN/decision files left untouched (they record what paths were at the time — don't rewrite history).

**(3) PROGRESS prune + archive convention.**
- `archive/README.md` documents convention: filename `YYYY-MM-DD_<slug>.md`, immutable once written, prune triggers (major release OR >30 sessions OR >1000 lines), header schema (archived date + source commit + sessions covered + time span + reason + where-live-resumes), Python single-pass recipe with sanity-assert anchors before mutating.
- First archive `archive/2026-04-29_v1_0_build_arc.md` carries S1–S13 verbatim (project inception → v1.0.0-rc.1 ship).
- Pruned PROGRESS.md from 784 → 168 lines via single Python pass after a first-attempt false-start: initial mechanism did chunked Read + reconstructed Write (re-shipped ~25K tokens through the LLM); user flagged the inefficiency. Second-pass Python script slices `lines[:115] + POINTER + lines[737:]` in <1s.
- Title refreshed `Personal Terminal → Private Terminal` (post-S11 user-visible rename).
- Commit `866a338` (docs: prune PROGRESS.md and establish archive convention).

**(4) Feature branch `feature/v1.1-analysis-phase-1`.**
Branched from `master` at `866a338` for the Phase 1 build. Local-only (no remote yet). Merged back via fast-forward at session end; branch deleted post-merge.

**(5) v1.1 Analysis Phase 1 — backend.**
- **Pre-build verifications.** Confirmed `Db::seed()` location (`db/mod.rs:87`). Discovered S15 plan mis-flagged `tile_visible` migration as the project's first column-add — the existing migrations slice in `db/mod.rs:50-82` has 3 user_hidden migrations from M8.5 with the same error-swallow pattern (no `PRAGMA table_info` guard needed).
- **DB layer (commit `71f3a34`):** `schema.sql` adds `tile_visible INTEGER NOT NULL DEFAULT 1` to fred_series + new `analysis_tools` table (id / display_name / scope / display_order / enabled / config_json). `seed.sql` adds USREC + DGS3MO/DGS2/DGS5/DGS30 (all `tile_visible=0`) + 2 analysis_tools rows (`correlation_matrix` cross_asset / `yield_curve` macro) + new `('analysis', NULL, 'ANALYSIS', 'virtual', 1, 1)` sector_groups row + display_order shifts. Migrations slice gets the fred_series.tile_visible row.
- **Analysis module (`src-tauri/src/analysis/`, 7 files, ~540 LOC):** `mod.rs` (TickerKey, ExcludedTicker), `registry.rs` (`ANALYSIS_TOOLS` const + `AnalysisToolInfo` IPC shape), `align.rs` (align_close_prices with calendar-day window via `chrono::Duration` + 50%-coverage gate, log_returns, pearson with diagonal-pin), `correlations.rs` (compute_correlations + req/resp), `yield_curve.rs` (compute_yield_curve, 3 snapshots × 5 tenors + spread series 2s10s/3m10y), `coverage.rs` (list_tickers_with_coverage joining watchlist visibility with bar coverage), `macro_overlays.rs` (list_recession_segments run-length-encoded from USREC monthly 0/1). No trait per S15 Q2 — heterogeneous output shapes (matrix vs curve vs segment list) make a trait costlier than valuable.
- **Math unit tests (`analysis/tests.rs`, 10, all pass):** pearson perfect ±, constant-y zero-var, short-input; log_returns basic + edges; align inner-join, exclusion-below-min, calendar-day trim, empty-input.
- **DB helpers added (db/mod.rs):** `close_history(ticker, data_source)` → tighter shape than `all_price_bars_ohlcv` for analysis paths that only need closes. `ticker_coverage(ticker, data_source)` → bar count + earliest/latest dates for the chip-picker greyed-chip path.
- **IPC layer (commit `9081acb`):** `commands/analysis_cmds.rs` with 5 `#[tauri::command]` wrappers (`list_analysis_tools` merging const registry + DB enabled/config_json; `compute_correlations`, `compute_yield_curve`, `list_recession_segments`, `list_tickers_with_coverage`); registered in `lib.rs::tauri::generate_handler!`. Dead-code warnings from previous commit cleared once IPC referenced all the analysis functions.

**(6) v1.1 Analysis Phase 1 — frontend.**
- **TS types (commit `bdb6492`):** `src/types/analysis.ts` mirroring the IPC contract — TickerKey, ExcludedTicker, AnalysisToolInfo, Correlations{Request,Response}, YieldCurve{Request,Response} + nested TenorPoint/CurveSnapshot/SpreadPoint, TickerCoverage, RecessionSegment. NaiveDate → ISO date string.
- **CSS rename `.settings-tabs` → `.tab-strip`** across `app.css` + `SettingsModal.tsx` + `ManageWatchlistModal.tsx` (S15 Q7.B). Generic horizontal-tab pattern reused by Settings + Manage Watchlist + new Analysis layout. Class name shifts: `.settings-tab` → `.tab-strip__tab`, `--active` → `.tab-strip__tab--active`. No visual change.
- **`useRecessionBars` hook:** module-level cache (`cachedSegments` + in-flight `Promise` dedup); one fetch per session shared across all consumers. Returns raw segments + ECharts `markArea`-shaped data array (`MarkAreaPair[]`).
- **Components (commits `5aed75a`, `d58daa0`):**
  - `TickerChipPicker` — chip + autocomplete (case-insensitive prefix on ticker, substring on display name) + greyed-chip rendering when `bar_count < lookback × 0.5` + bar-count tooltip (Q2 + Q6). Click-outside dismiss for dropdown. Stateless; selection lives in parent for `usePersistedState` per-tool persistence.
  - `CorrelationsTab` — lookback dropdown 30/60/90/180/365, sticky-header heatmap table (no chart-lib dep — HTML table). Cell color via `rgba(var(--status-up-rgb), α)` / `--status-down-rgb` with α scaling 0.15..0.70 by |r|. Diagonal pinned to 1.0 in Rust compute. Footer shows bar count + date range + excluded-ticker list (in `--accent-amber`).
  - `YieldCurveTab` — ECharts dual-pane (term-structure on category x-axis + spread on time x-axis with `markArea` recession overlay). Uses `getChartTheme()` from `chartTheme.ts`. Spread toggle 2s10s/3m10y. Snapshot anchor defaults to "latest" (snapshotDate: null on IPC).
  - `AnalysisLayout` — tab strip dispatch via `ANALYSIS_TAB_REGISTRY` (id → ComponentType); persists `session.analysis_active_tab`; falls back to first visible tool when stored active id no longer enabled.
- **Wire-up:** Sidebar `PINNED_IDS` extended to `['scanner', 'analysis', 'macro', 'news']`; App.tsx adds `case 'analysis'` → `<AnalysisLayout />`.

**(7) First smoke test caught two issues** (screenshots `02_v1_1_analysis/screenshots/Screenshot 2026-04-29 19{0508,0603}.png`).
- **Picker capped at 12 candidates regardless of query** — alphabetically-late tickers (BTC, SPY, etc.) invisible without typing on long watchlists. Fix in `TickerChipPicker.tsx`: cap only when query non-empty; with empty query return full list, dropdown's existing max-height + overflow-y handles scroll.
- **Yield curve rendered with only DGS10 data, spread 0 observations** — `WHERE tile_visible=1` filter on `list_fred_series` cut hidden series out of the FRED fetch enumeration (`list_macro_tiles` Phase 1 used the same helper). USREC + 4 treasury tenors had zero observations because they were never fetched.
  - Fix: revert SQL filter on `list_fred_series` (return all rows), add `tile_visible: bool` to `FredSeriesRow`, filter at tile-build time in `list_macro_tiles` Phase 3 (skip rows where `!row.tile_visible`). After fix + manual MACRO refresh: 11,162 spread observations + full yield curve rendered. Captured as **DB-10** in LESSONS (filter at display layer, not enumeration layer).
- Commit `e5bb299` (fix: fetch hidden FRED series + uncap picker dropdown).

**(8) Second smoke caught recession-bar visibility** (screenshot `Screenshot 2026-04-29 191205.png` showed term structure populated but no NBER bars on spread).
- markArea was rendering correctly but `α=0.18 + rgb(150,150,150)` fell below visual noise floor against dark background. Bumped α=0.18→0.30 + swapped hardcoded rgb for `rgba(var(--text-tertiary-rgb), 0.30)` token. Footer rewritten to always show segment count for diagnosability ("35 NBER recession segments" — full USREC history goes back to 1854; ~5 visible in the spread chart's 1982+ date range).
- Commit `ef12190` (fix: bump recession-bar visibility + diagnostic footer). Screenshot `Screenshot 2026-04-29 191752.png` confirms bars visible over 1981-82, ~1990, ~2001, 2008-09, 2020.

**(9) Merge to master + branch cleanup.**
- All gates green: `cargo check --no-default-features` clean (zero warnings on master); `cargo test --lib analysis::tests` 10/10; `tsc --noEmit` clean; `npm run build` 4.31s, 658 modules (chunk-size warning carries from S9).
- Fast-forward merge `master → ef12190` (31 files changed, 2,225+/30-). `feature/v1.1-analysis-phase-1` branch deleted.

**Course corrections in-session.**
- **`tile_visible` filter location** — initially put it in `list_fred_series` SQL, which silently broke the FRED fetch for hidden series. Lesson: separate "what to enumerate" from "what to display." See LESSONS DB-10.
- **Picker cap** — autocomplete-style cap-at-12 was right impulse but hostile UX with empty query. Cap conditional on query presence is the cleaner contract.
- **PROGRESS prune mechanism** — first attempt did chunked Read + reconstructed Write; user flagged the LLM-token cost of re-shipping ~25K tokens. Second pass used single Python pass + sanity-assert anchors. Pattern captured as the canonical recipe in `archive/README.md`.
- **MSVC incremental cache corruption** during long-running tauri:dev session — known issue (LESSONS TB-2). Cleared `target/debug/incremental/` (1.9 GB) without touching dependency builds; resolved on restart.
- **Cargo.lock** initially gitignored from the original `.gitignore`; corrected during git-init pass (binary app, not library — Cargo.lock should track per PrivateACB pattern).

**Discussions parked / scope deferred.**
- **Bulk-modal ticker selection** (S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"). Shipped chip + autocomplete only; bulk-add modal can land if user feedback shows it's needed. Clear extension point in `TickerChipPicker.tsx`.
- Smoke-test items not literally cross-checked: SPY×SPY=1.000 (verified via AEM×AEM=1.00 and BTC×BTC=1.00, same diagonal-pin property), GLD×SPY mildly negative, FRED published-value cross-check on yield curve, 2s10s↔3m10y toggle exercise, lookback 90d→365d switch, greyed-chip tooltip text. None blocking; all paper checks against published values.

**Build artifacts.**
- 9 commits on feature branch, fast-forwarded to master:
  - `71f3a34` feat(analysis): scaffold v1.1 Analysis section — schema, registry, math primitives
  - `9081acb` feat(analysis): IPC layer — 5 Tauri commands wrapping the analysis module
  - `bdb6492` feat(analysis): TS types, CSS tab-strip rename, useRecessionBars hook
  - `5aed75a` feat(analysis): TickerChipPicker + CorrelationsTab + heatmap CSS
  - `d58daa0` feat(analysis): YieldCurveTab + AnalysisLayout + sidebar/router wire-up
  - `e5bb299` fix(analysis): fetch hidden FRED series + uncap picker dropdown
  - `ef12190` fix(analysis): bump recession-bar visibility + diagnostic footer
- Plus 2 infrastructure commits: `1b9c85e` initial git, `866a338` PROGRESS prune.

**Next session entry point.**
- **If tester feedback lands on RC1:** triage bugs/polish/discoverability/v1.1; fix in-scope items; bump `1.0.0-rc.1` → `1.0.0` in 4 files; rebuild; ship final.
- **If proceeding to v1.1 Phase 2:** Pairs + RRG (zero new data, registry-driven additions only). Mirrors Phase 1 pattern — new `analysis/pairs.rs` + `analysis/rrg.rs` Rust modules + `PairsTab.tsx` + `RrgTab.tsx` components + 2 rows in `analysis_tools` seed + 2 entries in `ANALYSIS_TAB_REGISTRY`. RRG benchmark needs an explicit Apply button (S15 Q3 — JdK normalization too costly per-keystroke). Phase 1's chip-picker bulk-modal can land alongside if feedback warrants.

---

### S15 — Analysis design walkthrough + tokens audit + chartTheme extraction (2026-04-28)

Two-track session. (1) Walked through and locked all six pre-Phase-1 open questions on `docs/v11_analysis_design.md`; (2) tokens-system audit + `chartTheme.ts` extraction + `app.css` rgba consolidation. Design + cleanup; no functional changes shipped.

**(1) Analysis-section open questions — all six resolved.**
1. **Correlation cell click → navigate to Pairs tab pre-loaded with the pair.** Loses the Correlations view in exchange for full Pairs analysis depth. Inline cell-hopping (popover preview) is the v1.2 escalation if cell-hopping becomes the dominant usage pattern.
2. **Ticker multi-select → chip picker with autocomplete + modal for bulk.** Most-expressive shape; matches the cross-asset nature of the tools. Picked over inline checklist (vertical-space cost on 60-ticker watchlist) and group-only dropdown (loses ad-hoc combos).
3. **RRG benchmark → per-session selector in the RRG toolbar.** Persisted via `session.analysis_rrg_benchmark`. Friction-free switching between US/Canadian/crypto rotations.
4. **Recession Prob / FCI → both MACRO tile AND Analysis tab.** Same FRED series, two surfaces — daily glance from MACRO, in-context regime read from Analysis. Shared view component to keep them visually consistent.
5. **NBER recession bars → shared `useRecessionBars()` hook.** ~30 LOC; charts that want recession bars import the hook. Pays for itself the first time a "hide recession bars" toggle lands.
6. **Alignment dropouts → greyed chips in picker + result footnote.** Belt-and-suspenders. Chip greys with bar-count tooltip; post-compute footnote names what was excluded. Prevention + verification.

Pattern: all six picks landed on the most-expressive option — even where the sketch leaned leaner (Q5, Q6). Phase 1 effort revised ~30% over the sketch's lean-default estimate; closer to one weekend + one evening than one weekend.

**Knock-on notes (captured in design doc).**
- Q2 + Q6 are coupled — chip-picker IPC must return `{ ticker, bar_count, earliest_date, latest_date }` to support greyed-chip rendering. Day-1 IPC shape, not retrofit. Likely a new `list_tickers_with_coverage()` command alongside `list_ticker_tiles()`.
- Q3 needs an explicit `Apply` button next to the benchmark dropdown (full JdK re-normalization is too costly to fire on every keystroke).
- Q4 needs a shared `<MacroSeriesView>` component (or two siblings sharing a hook) to keep MACRO tile + Analysis chart formatting/threshold logic in one place.

**(2) Tokens audit + cleanup.**
- **Audit findings.** S12's "~80 scattered hex codes" guess overcounted. Reality: `app.css` had ~30 `rgba()` literals where the underlying RGB triplets matched already-defined tokens (accent-cyan, status-up/down, bg-surface) — devs bypassed the var system because those tokens lacked `-rgb` companions. `FeatureChart.tsx` had ~25 inline hex/rgba literals because ECharts options is a JS object — CSS `var()` doesn't resolve there. `theme.ts` SMMA palette presets are intentionally raw hex (user-selectable) — left alone. Two truly-untokenized colors found: `#f59e0b` (amber, on API-key warning badge + 1 site of `--accent-amber` reuse) and `#4b5563` (gray-600, single RSI threshold dashed-line site).
- **`tokens.css` extended.** Added `-rgb` triplet companions for `bg-base`, `bg-surface`, `text-primary/secondary/tertiary`, `accent-cyan`, `status-up/down/neutral`. Three new accent tokens for v1.1 Analysis prep: `--accent-amber` (scanner flip + future Yield Curve thresholds + RRG "improving" quadrant), `--accent-yellow` (VRVP POC + emphasis), `--accent-blue` (RRG "weakening" quadrant; distinct from accent-cyan so a future light theme can re-tune them independently). Each new token also defines a `-rgb` companion. `/* [L] */` comment markers added to every token that would need a counterpart on a white background — structural prep only, no light theme committed.
- **`app.css` rgba consolidation.** 19 unique `rgba(R, G, B, α)` patterns rewritten to `rgba(var(--*-rgb), α)` form via `replace_all` Edits across ~30 sites. Two `#f59e0b` hex literals on `.api-key__badge--warn` tokenized to `var(--accent-amber)`. `rgba(0,0,0,X)` (modal backdrop, shadow) and `rgba(255,255,255,X)` (subtle row hover) intentionally left as raw — semantically distinct from any color token.
- **`src/styles/chartTheme.ts` (new, ~98 LOC).** Runtime mirror module. Reads computed CSS vars via `getComputedStyle(document.documentElement).getPropertyValue('--token')` and exports a typed `ChartTheme` object with 21 fields (bg/border/text/accent/status/vrvp/zoom/watermark/marker). Cached on first read; `refreshChartTheme()` clears the cache for future light/dark toggle. Captured as **EC-13** in LESSONS.
- **`FeatureChart.tsx` refactored.** Module-level `CANDLE_UP/CANDLE_DOWN/VOL_UP/VOL_DOWN` constants deleted. Five functions get `const theme = getChartTheme();` at the top: the `saveImage` closure, `buildLineOption`, `buildCandlestickOption`, `buildMarkPoint`, `watermarkGraphic`. All 25+ inline hex/rgba literals replaced with `theme.X` references.
- **Two near-identical color substitutions** (verified visually, accepted):
  - VRVP bar gray `rgb(148,163,184)@0.32` → `text-secondary-rgb (156,163,175)@0.32`. Indistinguishable at α=0.32 — confirmed no visible change.
  - RSI threshold dashed line `#4b5563` (gray-600) → `var(--text-tertiary)` (`#6b7280`, gray-500). User confirmed the slightly-lighter dashed line is "perfectly ok" — no dedicated `--marker-line` token needed.
- **Verification.** `npx tsc --noEmit` clean. Final grep confirms only intentional hex remains: `theme.ts` (palette presets, raw-by-design) and `tokens.css` itself. Visual smoke-test passed end of S15 — no other visible changes from the consolidation.

**What this unlocks.**
- Phase 1 Analysis components reach for `var(--accent-amber-rgb)` etc. instead of inventing values.
- New ECharts components do `import { getChartTheme }` instead of re-discovering hex strings.
- Light theme is now ~30 lines in `tokens.css` (the `/* [L] */`-marked entries) + a `refreshChartTheme()` call on toggle. Zero chart-component edits.

**(3) Phase 1 implementation plan — nine-step planning walkthrough.**
- Same one-question-at-a-time format as the (1) open-questions arc. Goal: produce a self-contained spec the next coding session can read top-to-bottom without re-deriving choices.
- **Decisions locked (one per step, sometimes more):**
  1. **DB layer** — Q1.A: keep `analysis_tools.scope` column as designed (free extensibility for Phase 3+). Q1.B: add `tile_visible INTEGER NOT NULL DEFAULT 1` column to `fred_series`; USREC seeded with `tile_visible=0`; MACRO dashboard query filters `WHERE tile_visible=1`. Future-proofs Phase 3 auxiliary FRED series.
  2. **Rust pattern** — **No trait.** Const registry (`ANALYSIS_TOOLS: &[AnalysisToolMeta]`) + per-tool typed compute free functions. Indicator trait works because compute output is uniform; analysis-tool output is heterogeneous (matrix vs curve vs scatter), so a trait would only cost type safety with no rendering benefit.
  3. **Compute I/O** — Q3.A: typed `TickerKey { ticker, data_source }` in requests (frontend chip picker carries the source). Q3.B: Yield Curve missing data → partial response (`Option<f64>` per tenor). Q3.C: recession segments via separate `list_recession_segments()` IPC + `useRecessionBars()` hook owns cache; compute responses don't carry segments.
  4. **Alignment helper** — Q4.A: exclusion rule `bar_count >= lookback_days × 0.5`, applied identically in chip picker and align helper. Q4.B: helper queries `price_history` internally (self-contained per registry pattern). Q4.C: separate `list_tickers_with_coverage()` IPC for picker — independent SQL from alignment.
  5. **IPC commands** — single `src-tauri/src/commands/analysis_cmds.rs`, five commands: `list_analysis_tools`, `compute_correlations`, `compute_yield_curve`, `list_recession_segments`, `list_tickers_with_coverage`. Per-tool typed (forced by step 2). Persistence via existing `get_config`/`set_config`.
  6. **TS types** — single `src/types/analysis.ts`, camelCase fields (matches IPC-1), no invoke wrapper layer (matches existing per-component convention).
  7. **Frontend tree** — Q7.A: `TickerChipPicker` lives in `src/components/analysis/` (analysis-scoped; refactor up if M9 needs it). Q7.B: refactor `.settings-tabs` → generic `.tab-strip` in one pass (3 consumer files). Other shapes forced: `AnalysisLayout` owns active-tab state, registry as `Record<string, ComponentType>`, `useRecessionBars` hook in `src/hooks/`.
  8. **Routing/persistence** — Q8.B: per-tool `usePersistedState` keys (`session.analysis_<tool_id>_config`) — registry-aligned, each tool independent. `PINNED_IDS` extends to `['scanner', 'analysis', 'macro', 'news']`.
  9. **Verification** — Q9.A: minimal Rust unit tests in `src-tauri/src/analysis/tests.rs` covering Pearson, log_returns, align inner-join (~50 LOC). Build gates + manual smoke-test checklist (SPY×SPY=1.0 sanity, BTC×ETH ≈ 0.7-0.9, today's yield curve matches FRED published values, COVID + GFC recession bars visible) baked into the plan section.
- **Effort estimate**: ~12-14 hours total ≈ one weekend + one evening. Matches the post-decisions revised estimate from the open-questions session arc.
- **Two flagged items for the build session:** (a) confirm exact location of `Db::seed()` before adding `seed_analysis_tools()` call (not pre-read this session); (b) `tile_visible` column migration needs `PRAGMA table_info` guard before `ALTER TABLE ADD COLUMN` — first column-add migration in this project's history.

**Files touched.**
- `docs/v11_analysis_design.md` — "Open questions" replaced with "Resolved (S15, 2026-04-28)" + new "Implementation notes (knock-on from S15 decisions)" subsection + new "Phase 1 implementation plan (S15, 2026-04-28)" subsection (decision summary table, file touch-list, Rust struct shapes, suggested implementation order, smoke-test checklist, effort estimate).
- `src/styles/tokens.css` — RGB-variant additions + 3 new accent tokens + `[L]` light-theme readiness markers + comment header rewritten.
- `src/styles/app.css` — 19 rgba consolidations + 1 hex-pair tokenization. Net reduction: ~33 hardcoded color literals → 0.
- `src/styles/chartTheme.ts` — **NEW**, ~98 LOC.
- `src/components/charts/FeatureChart.tsx` — module constants deleted; 25+ inline literals replaced with `theme.X`.
- `LESSONS.md` — new EC-13 entry covering the runtime-mirror pattern.

**Aside (mid-session, non-project).**
- User added some HK stocks to the watchlist for personal use (Mexan Ltd `0022.HK`, Jinhai International `2225.HK`, Hang Seng S&P 500 ETF `3195.HK`, JPMorgan US Equity ETF `3476.HK`) and asked for chart reads to share with friends. Confirmed CCY column is the 3-letter ISO display currency (HKD for HK listings) — not the ticker number. Indicator reads given with CLAUDE.md principle 9 framing (decision support, not advice). User-flagged that two of the four are sub-dollar HK micro-caps where the SMMA Ribbon's design intent (tech / crypto, 4h–monthly) doesn't apply — Ribbon signals on those should be treated with extreme skepticism. Reads then translated into spoken Cantonese in 繁體 characters at user request (one-off override of the standing Jyutping-only preference; not changing the default).

**Next session entry point.**
- Still tester-feedback wait. When feedback lands: triage into bugs/polish/discoverability/v1.1, fix in-scope items, bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
- Visual smoke-test of the tokens cleanup passed end of S15. No further visual verification needed.
- v1.1 priority queue: **Analysis section Phase 1 (Correlations + Yield Curve) is fully planned** — design-locked + tokens-ready + implementation plan written into `docs/v11_analysis_design.md`. Build session reads the "Phase 1 implementation plan" section top-to-bottom; suggested ordering is in there. Two pre-build verifications flagged: (a) confirm `Db::seed()` location in `src-tauri/src/db/`, (b) `tile_visible` migration needs `PRAGMA table_info` guard pattern.
- Other v1.1 queue items: CoinGecko fetcher, bull/bear VRVP split, true log mode, M9 features (overlay + Ctrl+K palette), code signing.

---

### S14 — FeatureChart tooltip decimal scaling + v1.1 Analysis design sketch (2026-04-27)

Small tooltip precision fix while waiting on tester feedback + exploratory v1.1 design doc (no code commitment).

**(1) FeatureChart candlestick tooltip — magnitude-scaled decimals.**
- Problem: candlestick hover rendered raw `toLocaleString` output (e.g. `123.45678901`) for OHLC + indicator values. Line-mode chart (FRED) was already fine via existing `formatValue`; only the candlestick path lacked a `valueFormatter`.
- Fix: added `valueFormatter` to the candlestick `tooltip` block (`src/components/charts/FeatureChart.tsx:614`) calling new `formatTickerValue` helper at line ~745.
- Tier rule mirrors `formatPrice` in `src/types/sector.ts:67` for tile/chart consistency: `|v| ≥ 1000 → 2dp`, `|v| ≥ 1 → 4dp`, `|v| ≥ 0.01 → 4dp`, `0 → '0'`, `else → 6dp` (covers SHIB-class sub-cent crypto).
- **Tooltip-level, not per-series.** Applies to OHLC, SMMA Ribbon overlay, RSI subpane, ATR subpane, volume bar — all numeric. RSI lands at 4dp instead of an ideal 2dp; volume shows raw int. User accepted the tradeoff up front (single edit vs 4 series-touches). Escalation path: per-series `tooltip.valueFormatter` if RSI/volume noise becomes a complaint.
- `npx tsc --noEmit` clean. Visual end-to-end exercise not done — user runs `tauri:dev` themselves.

**(2) v1.1 Analysis-section design sketch.**
- New file `docs/v11_analysis_design.md` (~250 lines, sibling to `DESIGN.md`). **Design-only — zero code commitment**, awaiting v1.0 final + tester feedback before any of this lands.
- **Architectural split locked:** Analysis section = cross-asset (correlations, yield curve, pairs, RRG, regime quadrant); FeatureChart enhancements = per-ticker (drawdown, vol cone, return dist, seasonality, AVWAP). Different mental models, different surfaces — resist mixing.
- **Sidebar slot:** pinned trio becomes quartet — `PINNED_IDS = ['scanner', 'analysis', 'macro', 'news']`. Analysis lands second.
- **Registry-driven tabs** via new `analysis_tools` table mirroring the M6 indicator registry (id / display_name / scope / display_order / enabled / config_json).
- **Compute model:** Rust-side, on-demand, f64, not persisted — same rule as indicators. Shared `src-tauri/src/analysis/align.rs` handles cross-asset date alignment (crypto 7d vs equity 5d vs FRED weekday-with-lag is the real gotcha).
- **4-phase plan:** Phase 1 (Correlations + Yield Curve, +1 FRED series `USREC`), Phase 2 (Pairs + RRG, zero new data), Phase 3 (regime quadrant + recession prob + FCI, +3 FRED series), Phase 4 (COT + AAII + VIX term, real new fetchers). FeatureChart enhancements run in parallel.
- **Six open questions flagged** for pre-Phase-1 resolution: cell-click navigation between Correlations and Pairs · ticker multi-select UX (modal vs inline) · RRG benchmark scope · whether macro tools live as MACRO tiles, Analysis tabs, or both · shared NBER recession-bar overlay helper · alignment-dropout surfacing.

**Discussions parked.**
- "Crypto-only Private Terminal fork" — high-level human-curiosity discussion. Recommendation: stay single-app, treat crypto as a richer asset-class profile via the existing extensibility-first pipes (new fetchers + sector inserts, no fork). Real fork rationale would be branding/positioning, not technical. Not pursuing.

**Clean-up.**
- Glob for `*.bak` / `*.tmp` / `scratch.*` — none.
- Grep `console.log` / `TODO: remove` / `FIXME: delete` in touched files — none.
- No git initialized; no commit step.

**Next session entry point.**
- Still tester feedback triage (carry over from S13). When feedback lands: categorize bugs/polish/discoverability/v1.1, fix in-scope items, bump 4 files `1.0.0-rc.1` → `1.0.0`, rebuild, ship final.
- v1.1 priority queue (existing): CoinGecko fetcher (`NEW_GROUP_SOURCES` extension point already carved), bull/bear VRVP split, true log mode, M9 features, code signing — and now Analysis section per `docs/v11_analysis_design.md` Phase 1 (Correlations + Yield Curve).

---

## Archived

Sessions S1–S13 — the entire v1.0 build arc from project inception through the v1.0.0-rc.1 ship — live in [`archive/2026-04-29_v1_0_build_arc.md`](archive/2026-04-29_v1_0_build_arc.md). See [`archive/README.md`](archive/README.md) for the archive convention.

---

## Discovered (future tasks)

- Explore additional news feeds post-v1 — NewsData.io, Benzinga, MarketAux
- Yahoo TSX after-hours cadence — defer to M3
- Currency display split (US=USD, CA=CAD) — defer to M3/M4
- Indicator confirm_bars UI — per-ticker slider vs global default
- Future indicators (post-v1) — MACD, Bollinger Bands, Ichimoku, Volume Profile, candlestick patterns. All plug into the same trait.
- v1.1 feature candidates (from brainstorm): seasonality heatmap, correlation heatmap, yield curve viz, earnings/economic calendar, backtesting module
- Backtesting module (trendscope's own "Discovered" gap — "we've never measured whether flips are profitable")
- **v1.1 Analysis section design sketch** (`.projects/02_v1_1_analysis/v11_analysis_design.md`, S14) — 4-phase plan for cross-asset analysis tools. **Phase 1 (Correlations + Yield Curve) shipped 2026-04-29 (S16). Phase 2 (Pairs + RRG) shipped 2026-04-30 (S17). Phase 3 lean (Recession Prob + FCI) shipped 2026-04-30 (S17). Phase 3 finish (Macro Regime Quadrant) shipped 2026-05-02 (S18).** Phase 4 (COT + AAII + VIX term — real new fetchers) follows.

### Deferred from v1.1 Phase 3 finish (2026-05-02, S18)
- **Watermark-style quadrant labels for RRG + Regime Quadrant.** User-considered during the S18 polish round. Would replace the corner labels (currently fontSize 16 with low opacity) with large faint labels rendered BEHIND the trail data — mirroring the `FeatureChart.tsx:769-787` ticker watermark pattern (single centered text, `text-primary @ 0.05`, `z: 0`, `silent: true`). For a 4-quadrant chart the implementation diverges: 4 graphic entries instead of 1; positioning is dynamic on Regime (quadrants split at runtime baselines), static on RRG (always 100/100); color choice between semantic-faint (~0.10 alpha on each quadrant's color) vs neutral-faint. User picked the simpler in-place fontSize fix this session. Can land in a future polish round if the corner layout starts to feel cramped.
- **NAPM toggle for the Regime Quadrant** — v1.2 escalation if INDPRO YoY's backward-looking nature creates a financial-media-narrative mismatch. Watch for FRED's NAPM publication gaps before implementing.

### Deferred from v1.1 Phase 2 + Phase 3 lean (2026-04-30, S17)
- **MACRO-tile retrofit for Recession Prob + FCI.** S15 Q4 locked "both MACRO tile AND Analysis tab"; lean Phase 3 path shipped Analysis-only. Add when there's clear daily-glance value, ideally alongside the Macro Regime Quadrant build so the shared view component lands once.
- **`RECPROUSM156N` upstream verification.** FRED's website 403'd Claude Code's WebFetch mid-session, so the series' current publication status couldn't be confirmed before commit. Tab ships with empty-state placeholder + external FRED link. If the user's smoke-test post-MACRO-refresh shows zero observations, swap to `USRECP` or another alternative in a follow-up commit.
- **Path (a) manual `log10()` transform** (carry-over from S11) — for Pairs ratio chart AND FeatureChart price pane. ECharts default log axis is broken on sub-decade ranges (which is exactly where ratios live), so Pairs shipped without a log toggle. Pays for both surfaces at once when prioritized; ~2-3 hours.
- **NAPM toggle for the Regime Quadrant** — once Regime Quadrant ships with INDPRO YoY, a v1.2 toggle to switch to NAPM/PMI for the growth axis would catch users who want the financial-media narrative match. Watch for FRED's NAPM publication gaps before implementing.
- **`list_recession_segments` cross-consumer test** (carry-over from S16) — hook is wired with module-level cache + Promise dedup. Phase 3 added two more consumers (`RecessionProbTab`, `FinancialConditionsTab`) on top of `YieldCurveTab` from Phase 1. Verify in DevTools that all three share a single fetch.
- **Bulk-add modal on TickerChipPicker** (still deferred from S16) — S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"; chip + autocomplete shipped Phase 1, single-pickers via `maxChips=1` shipped Phase 2. Bulk modal still pending. Extension point clear.

### Deferred from v1.1 Phase 1 (2026-04-29, S16)
- **Bulk-modal ticker selection on TickerChipPicker.** S15 Q2 spec'd "chip picker with autocomplete + modal for bulk"; shipped chip + autocomplete only. Add a `+ Bulk` button on the picker that opens a checklist-modal grouped by sector_group when feedback shows users want to add 5+ tickers at once. Extension point clear in `TickerChipPicker.tsx`.
- **Smoke-test items not literally cross-checked.** SPY×SPY=1.000 (verified via AEM×AEM and BTC×BTC, same diagonal-pin property), GLD×SPY mildly negative, FRED published-value cross-check on yield curve, 2s10s↔3m10y toggle exercise, lookback 90d→365d switch, greyed-chip tooltip text. None blocking; paper checks against published values.
- **`list_recession_segments` single-fetch verification via DevTools.** Hook is wired with module-level cache + Promise dedup so it should fire once per session, but only one consumer (YieldCurveTab) in Phase 1. Verify behavior is correct when Phase 3 adds a second consumer.
- **Per-series tooltip valueFormatter on candlestick chart** (S14) — current tooltip-level formatter applies one decimal-tier rule to all series (OHLC, SMMA, RSI, ATR, volume). RSI lands at 4dp instead of ideal 2dp; volume shows raw int instead of K/M/B. Escalate to per-series formatters if noise becomes a complaint.

### Deferred during M8.6 polish (2026-04-25, S11) — VRVP since shipped (S12)
- ~~**Volume Profile / VRVP overlay.**~~ **SHIPPED in S12 (Approach B — translucent overlay in price pane, frontend-only, no IPC).** Different shape than what S11 spec'd: chose `custom` series over side-grid `bar` series, frontend bin computation (not Rust IPC), close-bucketed (not honest proportional). 180 bins default. POC highlight only (no HVN/LVN multi-tier in v1). Auto-suppress when no volume in visible window. See S12 entry above.
- **Proper log mode (Path (a)).** Manual `Math.log10()` transform on data points + linear y-axis with custom `axisLabel.formatter` showing `10^value`. Gives TradingView-style round-number ticks at log-spaced positions. Need to also transform SMMA Ribbon band data (filter zeros) and candle OHLC arrays. ~2-3 hours when prioritized. **Stays v1.1** — log is nice-to-have, VRVP is the feature that pulls weight.
- **Bull/bear color split on VRVP.** TradingView-style two-color rendering — green for `close >= open` bar volume, red for `close < open`. Stacked horizontally per bin. ~30 LOC. Honest caveat: OHLCV can't actually distinguish aggressor; this is a heuristic, not a measurement.
- **VRVP per-bar hover tooltip** (price range / volume / % of POC). Custom tooltip formatter that splits axis-tooltip vs item-tooltip. ~30 LOC.
- **Tier 2 ECharts polish.** NBER recession bands on MACRO line charts via `markArea` (hardcoded recession dates ~12 since 1948). ATH/ATL `markPoint` on ticker charts. Both ~15-25 LOC each, deferred for post-v1 cycle.
- **`reset_database_location` UI surface** (still deferred — backend exists since S10).
- **Backup-restore command + dialog file-filter** (still deferred since S10).

### Deferred during M8.5 (2026-04-25, S10)
- **`reset_database_location` UI surface.** Backend command exists; no frontend trigger. Manual revert path documented in S10 ("delete the new copy + delete db_location.txt"). Add a "Reset to default location" button under Storage tab if a user reports needing it.
- **Backup-restore command.** We can backup but not restore from a backup file. Restore is just a copy + relaunch, but a one-click "Open backup" button would close the loop. Defer until requested.
- **Network-drive detection.** Storage-tab move modal warns "network drives are not recommended" via copy. No programmatic UNC-path or remote-drive check. Add when a user actually trips the issue.
- **Cross-volume move atomicity.** Currently uses `std::fs::copy` (works across volumes); old files left untouched per design. If a user later wants "move and clean up source", add a `delete_old_database(path)` command — must validate the path is an old DB location (matches stored or default).
- **`tauri-plugin-dialog` filter for backup file restore.** When restore lands, the picker should filter to `.db` files; currently we use folder picker only.

### Deferred during M7 planning (2026-04-24, S8)
Tracked in `memory/m7_news_decisions.md`. Summary:
- **Finnhub `/company-news?symbol=X` per-ticker news** — deferred to M8 alongside ticker-editing script. Architectural payoff: watchlist row = news subscription (no second edit needed).
- **News search + unread/read state** — post-M8. `news_items` schema is already sufficient; frontend work.
- **Geopolitics chip** — deferred. ME feeds folded into `world` for v1. Revisit if the category count grows enough to blur.
- **SMMA Ribbon palette — await visual review.** Iterated through 5 candidates (teal/fuchsia, sky/pink-500, sky/pink-400, cyan-600/rose-400, plus the original Larsson gold/navy). None landed. Centralized palette refactor landed (CSS vars in `tokens.css` + Rust constants in `smma_ribbon.rs` — one file each, cross-referenced). Currently cyan-600/rose-400 in place as working default. Future swap: edit 3 vars in `tokens.css` + 4 constants in `smma_ribbon.rs`.

### Deferred during M3 planning (2026-04-24, S4)
Tracked in `memory/m3_ticker_decisions.md`. Summary for quick-scan:
- **Sparklines on ticker tiles** — revisit when a batch chart-fetch path exists (after INDICES + US EQUITIES land clean)
- **Adaptive quote TTL** (5m market-hours / 1h off-hours) — revisit once `MarketHoursStrip` timezone logic is promoted to Rust
- **INDICES region tabs** (Americas / Europe / Asia-Pacific) — revisit if flat grid gets dense
- **US EQUITIES sub-sector grouping** — if watchlist extends beyond mega-cap
- **Time-range switch on ticker tiles** (1D / 1W / 1M / YTD / 1Y) — user-requested during S4 after 24h heatmap landed. Drives both heatmap color AND change text. Target milestone: M5 (CRYPTO) or M9 (watchlist-performance) where the pattern repeats. Needs Rust `get_change_for_range(ticker, range)` and a `RangeSwitch` component.
- **CoinGecko integration for CRYPTO live quotes** — DESIGN.md originally spec'd CoinGecko for crypto quotes (with Yahoo for deep history). Deferred during M5 S6 in favor of Yahoo-for-everything pragmatic path. Buys richer crypto-specific metadata (proper market cap, 24h volume in USD) when the tile grows those fields. Target: post-M7, alongside `market_cap` on tile display.
- **Dynamic top-10 crypto auto-discovery** — DESIGN.md spec'd a per-refresh call to `/coins/markets` to rebuild the watchlist from current market cap ranking. Deferred during M5 S6 (fixed watchlist of 10 seeded cryptos used instead). Target: same milestone as CoinGecko integration above — they're the same HTTP call.
- **FRED incremental fetch** (`observation_start=<last_date>`) — FRED has no delta endpoint; the ~200KB/series refetch is acceptable
- **Cross-platform icons** (Mac/Linux) — beyond M8; Windows placeholder from PrivateACB still in place
