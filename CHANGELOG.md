# Changelog

All notable changes to Private Terminal. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [1.1.0] — Unreleased

Folds in the unreleased 1.0.3 hardening pass.

### Added
- **Pulse: what changed since the previous trading day.** ▲/▼ marks in
  cells for moves of 10+ percentile points, ↻ on regime chips that flipped,
  a banner tally, and a CHANGES filter. Each day's latest Pulse view is
  kept locally for 90 days.
- **Private ticker notes.** A NOTES panel beside the chart for your thesis
  or a dated journal; autosaves; tiles with a note show ✎. Stored only in
  the local database.
- **Economic calendar.** Upcoming FRED release dates (CPI, jobs, GDP,
  claims…) on each MACRO tile and in a CALENDAR view. Same FRED host and
  key as before — no new outbound destination.
- **Backtest tab (Analysis).** Long-only replay of the SMMA Ribbon's
  regime flips on one ticker versus buy-and-hold: returns, CAGR, drawdown,
  time in market, trade list, equity curves.

### Fixed
- **Tile "1D %" showed a ~5-day change** since 1.0.1. It now compares
  against the previous session's close.
- **Indicators no longer go blank after a single incomplete price bar.**
  SMMA Ribbon, RSI and ATR resume after a gap instead of stopping for the
  rest of the history.
- **RSI warm-up** now matches Wilder / TradingView (first value after
  `length` real price changes).
- **Regime Quadrant inflation** is a true year-over-year change. A missing
  month (FRED has no October 2025 CPI) previously turned every later point
  into a 13-month change.
- **Pulse "5y" baseline** is now five calendar years for every series. It
  was a fixed count of observations (≈3.5 years for crypto, decades for
  weekly/monthly macro series).
- **Drawdown pane** no longer clips its line when zoomed.
- **REFRESH stays available when a load fails** (e.g. no FRED key yet), and
  a failed refresh keeps the tiles already on screen.
- Switching sectors during a refresh can no longer show the previous
  sector's tiles.
- Charts open from cached history when Yahoo can't be reached.
- The About screen and status bar show the correct version.
- Backups and database moves are consistent snapshots (`VACUUM INTO`); the
  previous copy could miss recent changes.
- Restarting no longer re-enables a news feed you disabled or puts a moved
  ticker back in its original group.
- Settings toggled just before leaving a screen are saved.
- A failed startup shows a message instead of silently not opening; a moved
  database on a disconnected drive prompts instead of silently opening an
  older copy.
- Heavy operations (maintenance, backup, Pulse, Analysis) no longer freeze
  the window.
- Analysis tab labels are the short ones intended since 1.0 (Recession /
  FCI / Regime).

### Security & privacy
- API keys can no longer appear in error messages (tile hovers, news
  errors).
- The Privacy tab and README now list the Yahoo host the app actually
  calls (`query1.finance.yahoo.com`) and its real fetch cadence.
- The webview can only reach the app's own backend (CSP), and cannot read
  or overwrite stored API keys through the settings store.
- Network requests time out instead of hanging; RSS downloads are capped.
- Dependency updates clear all known advisories in shipped code.
- A second launch focuses the running window instead of opening a second
  database connection.

### Build & release
- Releases are built in CI with pinned actions and a read-only build job;
  only the publish step can attest and create the draft release. Installer
  only (no portable exe). `SHA256SUMS.txt` + build provenance as before.
- CI runs lint, frontend and Rust tests, clippy and a version check.
- Release binaries no longer embed source maps (smaller installer).
- The installer is unsigned by choice; verify releases with the published
  checksums and build-provenance attestations.

## [1.0.2] — 2026-06-11
### Added
- Verifiable releases: CI-built installer with `SHA256SUMS.txt` and GitHub
  build-provenance attestations.

## [1.0.1] — 2026-05-05
### Fixed
- REFRESH keeps price history in sync (previously only the live quote).
- Chart history staleness check is calendar-aware.

## [1.0.0] — 2026-05-04
First public release (MIT).

[1.1.0]: https://github.com/cerkon1/private-terminal/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/cerkon1/private-terminal/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/cerkon1/private-terminal/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cerkon1/private-terminal/releases/tag/v1.0.0
