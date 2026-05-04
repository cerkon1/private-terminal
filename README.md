# Private Terminal

A free, local-first desktop research dashboard. Macroeconomics, your
watchlist, and one screen that shows where everything stands today versus
the last five years.

No accounts. No telemetry. No cloud sync. Your data stays on your machine.

Built by the team behind [PrivateACB](https://privateacb.com).

---

## Why this exists

Most retail charting tools — TradingView, KOYFIN, the brokerage screens —
gate features behind accounts, sell behavioral data, or push toward an
upgrade tier. We build privacy-first software (PrivateACB is a desktop
crypto-tax calculator) and we wanted a research dashboard that followed the
same principles. So we built one and gave it away.

Private Terminal is what we'd want to use ourselves.

---

## What's inside

**Pulse — cross-section heatmap.** Every ticker in your watchlist plus 29
FRED macro series, expressed as percentile-rank versus that series' own
trailing 5-year window. One sortable, filterable screen with REGIME / AGE /
LEVEL / RSI / ATR / VOL / DD columns. Click any ticker to drop into a
chart.

**Macro dashboard.** 29 economic indicators from FRED with category tabs
(Rates · Inflation · Labor · Growth · Housing · Liquidity · Risk · Energy)
and a heatmap view by year-over-year delta.

**Multi-indicator charts.** Candlestick view with SMMA Ribbon (quad-MA
state), RSI(14), ATR(14), Volume Profile (VRVP), Drawdown subpane, and
multi-anchor Anchored VWAP. Click anywhere on the price pane to drop an
AVWAP anchor; up to five per ticker, persisted per-ticker.

**Analysis section — seven cross-asset tools.** Correlations, Pairs ratios,
Relative Rotation Graph (RRG), Yield Curve, Recession Probability,
Financial Conditions, Macro Regime Quadrant. Each tab includes
plain-language interpretation guidance and the underlying math.

**Watchlist + sectors.** 176 seed tickers across US/CA equities (ten
sub-sectors each), indices (Americas / Europe / Asia-Pacific), commodities,
FX, bonds, VIX. Add your own; restructure freely.

**Command palette (Ctrl+K).** Fuzzy-search across tickers, sectors, FRED
series, and Analysis tabs. Jump anywhere with two keystrokes.

---

## Privacy stance

The reason this app exists is to demonstrate that private free software is
real. Detailed list lives in the app at Settings → Privacy. Summary:

- **No accounts.** No login, no signup, no email collection.
- **No telemetry.** The app reports nothing back. Not usage, not errors,
  not performance.
- **No analytics.** No Google Analytics, no Mixpanel, no PostHog, no
  Segment, no Sentry.
- **No auto-update phone-home.** New versions are GitHub Releases you
  download by choice.
- **No cloud sync.** Your watchlist, indicator settings, AVWAP anchors,
  view preferences — all live in a single SQLite file on this machine.
- **No data selling.** We don't have any data to sell.

**Outbound network calls.** The only HTTP requests Private Terminal makes
are to the public data sources you choose to enable:

| Destination | Purpose |
|---|---|
| `api.stlouisfed.org` | FRED macroeconomic series |
| `query2.finance.yahoo.com` | Quotes and historical bars |
| `finnhub.io` | US-equity news (only if you supply a Finnhub API key) |
| News RSS feed publishers | Headlines from feeds you enable (BBC, CNBC, Fed, BoC, Financial Post, CBC, Al Jazeera) |

Plus `tauri-plugin-opener`, which launches URLs in your default browser
when you click a news headline or the PrivateACB cross-link. User-initiated
only — not background.

---

## Install

Download the latest installer or portable EXE from
[GitHub Releases](https://github.com/cerkon1/private-terminal/releases).

**Windows 10/11.** No code-signing certificate yet, so SmartScreen will
warn on first launch — click *More info* → *Run anyway*. The signing cost
is on the v1.x roadmap.

Mac and Linux builds are not currently provided. Tauri supports them; the
codebase is portable; we just haven't packaged for them. PRs welcome.

---

## Build from source

```sh
# Prerequisites: Node 20+, Rust stable, Tauri v2 system deps
# https://v2.tauri.app/start/prerequisites/

git clone https://github.com/cerkon1/private-terminal
cd private-terminal
npm install
npm run tauri:dev   # development with hot reload
npm run tauri:build # production build (NSIS installer + portable exe on Windows)
```

A FRED API key is required to populate the MACRO section (free signup at
<https://fred.stlouisfed.org/docs/api/api_key.html>). A Finnhub API key is
optional, used only for US ticker news (free signup at
<https://finnhub.io/>). Both are stored locally in your SQLite DB; neither
is required for the app to launch or for the rest of the sections to work.

---

## Project structure

```
src-tauri/        Rust backend — data fetchers, SQLite, indicator math, IPC
  src/sources/    Per-source HTTP clients (FRED / Yahoo / Finnhub / RSS)
  src/indicators/ Trait-based registry — SMMA Ribbon / RSI / ATR
  src/analysis/   Cross-asset analysis tools (Correlations / RRG / etc.)
  src/cross_section/ Pulse percentile-rank compute
  src/db/         SQLite schema + seed
src/              React + TypeScript frontend
  components/     Tickers / Pulse / Macro / News / Analysis / Settings / Charts
  styles/         Design tokens + theming
.projects/        Development log — design notes, session-by-session decisions, lessons
CLAUDE.md         Project rules (architecture constraints + reuse checklists)
```

The `.projects/` folder contains the full development log if you're
curious about how the app was built — design decisions, milestone notes,
and lessons learned across each session.

---

## Stack

- **Tauri v2** — desktop shell (Rust + WebView2)
- **Rust** — backend, data fetchers, SQLite, indicator computation
- **React + TypeScript + Vite** — frontend
- **Apache ECharts** — charting (MIT, ~1 MB gzipped)
- **SQLite** — local storage (WAL mode)

No SaaS dependencies. No cloud services. No external state.

---

## Status

Version 1.0.0 ships from this repo. Active development continues — see
the [GitHub Issues](https://github.com/cerkon1/private-terminal/issues) for
roadmap items and bug reports.

This is a personal-scale project, not a startup. Issue responses are
casual; PRs are welcome but not promised same-day merges.

---

## License

MIT. See [LICENSE](LICENSE).

Copyright © 2026 PrivateACB.
