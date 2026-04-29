/// IPC contract for the v1.1 Analysis section. Field names match the Rust
/// structs in `src-tauri/src/analysis/` after `#[serde(rename_all = "camelCase")]`.
/// Dates are ISO 8601 strings (YYYY-MM-DD) — chrono's NaiveDate serde shape.

export type AnalysisScope = 'cross_asset' | 'macro' | 'sentiment';

export type TickerKey = {
  ticker: string;
  dataSource: string;
};

export type ExcludedTicker = {
  ticker: string;
  dataSource: string;
  barCount: number;
  reason: string;
};

export type AnalysisToolInfo = {
  id: string;
  displayName: string;
  scope: AnalysisScope;
  displayOrder: number;
  enabled: boolean;
  configJson: string | null;
};

// ────── Correlations ──────

export type CorrelationsRequest = {
  tickers: TickerKey[];
  lookbackDays: number;
};

export type CorrelationsResponse = {
  /** Tickers that participated, in the same order as matrix rows/cols. */
  tickers: TickerKey[];
  /** Square matrix; matrix[i][j] = corr(tickers[i], tickers[j]). */
  matrix: number[][];
  lookbackDaysRequested: number;
  /** Actual common-bar count after inner-join + window trim. */
  barCount: number;
  /** ISO date of first / last common bar (null when bar_count = 0). */
  startDate: string | null;
  endDate: string | null;
  excluded: ExcludedTicker[];
};

// ────── Yield Curve ──────

export type YieldCurveSpread = '2s10s' | '3m10y';

export type YieldCurveRequest = {
  /** ISO date or null for "use latest available". */
  snapshotDate: string | null;
  spread: YieldCurveSpread;
};

export type TenorPoint = {
  tenor: string;
  yieldPct: number | null;
};

export type CurveSnapshot = {
  label: string;
  date: string;
  points: TenorPoint[];
};

export type SpreadPoint = {
  date: string;
  value: number;
};

export type YieldCurveResponse = {
  termStructure: CurveSnapshot[];
  spreadLabel: string;
  spreadSeries: SpreadPoint[];
};

// ────── Coverage (chip picker) ──────

export type TickerCoverage = {
  ticker: string;
  dataSource: string;
  displayName: string | null;
  barCount: number;
  /** ISO date of earliest bar. Null when ticker has no bars yet. */
  earliestDate: string | null;
  latestDate: string | null;
};

// ────── Recession overlay ──────

export type RecessionSegment = {
  start: string;
  end: string;
};
