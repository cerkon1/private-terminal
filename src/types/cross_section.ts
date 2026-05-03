/// IPC contract for the v1.2 Pulse cross-section heatmap. Mirrors the Rust
/// shapes in `src-tauri/src/cross_section/mod.rs`.

export type RegimeState = 'BULL' | 'BEAR' | 'NEUTRAL';

export interface CrossSectionRow {
  ticker: string;
  displayName: string | null;
  sectorGroupId: string;
  /** 'yahoo' / 'coingecko' / 'fred'. Used with `ticker` as the exact key when
   *  handing off to TickerDashboard for the auto-open feature chart. */
  dataSource: string;
  isMacro: boolean;
  /** True when bars/observations <30 — row greyed, all percentile cells em-dash. */
  noBars: boolean;
  /** True when bars <252 — percentile cells get a trailing asterisk. */
  partialHistory: boolean;
  regime: RegimeState | null;
  ageDays: number | null;
  level: number | null;
  rsi: number | null;
  atr: number | null;
  vol: number | null;
  /** Signed % drawdown (e.g. -22.4). 0 = at peak. Macro rows null. */
  ddPct: number | null;
  /** Persistent fetch-error message from `quote_cache.last_fetch_error`,
   *  surfaced inline next to greyed (noBars) rows. Macro rows always null
   *  (FRED has its own fetch_error path on `fred_series`). S22. */
  lastFetchError: string | null;
}

export interface CrossSectionSection {
  id: string;
  displayName: string;
  rows: CrossSectionRow[];
}

export interface CrossSectionResponse {
  sections: CrossSectionSection[];
  /** RFC 3339 UTC timestamp at the moment compute finished. */
  computedAt: string;
}

export interface CrossSectionRequest {
  lookbackYears?: number;
}
