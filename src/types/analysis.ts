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

// ────── Pairs / Ratio (Phase 2) ──────

export type PairsRequest = {
  numerator: TickerKey;
  denominator: TickerKey;
  lookbackDays: number;
  zScoreWindow: number;
};

export type PairsPoint = {
  date: string;
  ratio: number;
  /** Null until the rolling window has filled. */
  zScore: number | null;
};

export type PairsStats = {
  currentRatio: number | null;
  currentZ: number | null;
  mean: number | null;
  stdev: number | null;
  min: number | null;
  max: number | null;
};

export type PairsResponse = {
  numerator: TickerKey;
  denominator: TickerKey;
  lookbackDaysRequested: number;
  zScoreWindow: number;
  barCount: number;
  startDate: string | null;
  endDate: string | null;
  points: PairsPoint[];
  stats: PairsStats;
  excluded: ExcludedTicker[];
};

/** Pre-loaded pair coming from a Correlations cell click — read once then
 *  cleared by the consumer (see PairsTab). */
export type PairsHandoff = {
  numerator: TickerKey;
  denominator: TickerKey;
};

// ────── RRG (Phase 2) ──────

export type RrgRequest = {
  benchmark: TickerKey;
  tickers: TickerKey[];
  rsPeriod: number;
  momentumPeriod: number;
  tailLength: number;
};

export type RrgPoint = {
  date: string;
  rsRatio: number;
  rsMomentum: number;
};

export type RrgTail = {
  ticker: TickerKey;
  /** Chronological; last entry is the current head dot. */
  points: RrgPoint[];
};

export type RrgResponse = {
  benchmark: TickerKey;
  rsPeriod: number;
  momentumPeriod: number;
  tailLength: number;
  tails: RrgTail[];
  excluded: ExcludedTicker[];
  weeklyBars: number;
};

// ────── Macro line tools (Phase 3) — Recession Prob + FCI ──────

export type MacroPoint = {
  date: string;
  value: number;
};

export type RecessionProbRequest = Record<string, never>;

export type RecessionThresholds = {
  warnPct: number;
  imminentPct: number;
};

export type RecessionProbResponse = {
  points: MacroPoint[];
  current: MacroPoint | null;
  thresholds: RecessionThresholds;
  units: string;
  seriesId: string;
  latestDate: string | null;
  observationCount: number;
};

export type FinancialConditionsRequest = Record<string, never>;

export type FinancialConditionsResponse = {
  points: MacroPoint[];
  current: MacroPoint | null;
  minValue: number | null;
  maxValue: number | null;
  units: string;
  seriesId: string;
  latestDate: string | null;
  observationCount: number;
};

// ────── Regime Quadrant (Phase 3) — INDPRO YoY × CPI/PCE YoY ──────

export type RegimePoint = {
  date: string;
  growthYoy: number;
  inflationYoy: number;
};

export type RegimeAxisBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type RegimeQuadrantRequest = {
  /** "cpi" → CPIAUCSL (default). "pce" → PCEPILFE (Core PCE). */
  inflationProxy?: 'cpi' | 'pce';
  /** 12 / 24 / 36 / 48; defaults to 24 backend-side. */
  trailMonths?: number;
};

export type RegimeQuadrantResponse = {
  /** Chronological; last entry is the current head dot. */
  trail: RegimePoint[];
  current: RegimePoint | null;
  /** Long-run mean across the full available joined history. */
  growthBaseline: number | null;
  inflationBaseline: number | null;
  axisBounds: RegimeAxisBounds;
  growthSeriesId: string;
  inflationSeriesId: string;
  growthLabel: string;
  inflationLabel: string;
  trailMonthsRequested: number;
  observationCount: number;
};
