import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import type {
  CrossSectionResponse,
  CrossSectionRow,
  CrossSectionSection,
  RegimeState,
} from '../../types/cross_section';
import { TabIntro } from '../analysis/TabIntro';

/// v1.2 Pulse — single-screen percentile cross-section heatmap. Calls
/// `compute_cross_section` on mount. Heavy compute (every ticker × 3
/// indicators against 5y of bars) so first paint can be ~1s on a large
/// universe; show a loading state until it lands.

type SortColumn = 'level' | 'rsi' | 'atr' | 'vol' | 'dd' | 'age' | null;
type SortDirection = 'asc' | 'desc';
type FilterScope = 'all' | 'bull' | 'bear' | 'extremes';

/// localStorage key for the ticker→TickerDashboard handoff. Written on
/// ticker click; consumed (and cleared) by TickerDashboard on mount once
/// tiles load. Matches the S17 Correlations→Pairs handoff pattern.
const PULSE_HANDOFF_KEY = 'session.pulse_feature_chart_target';

type Props = {
  /** Switches the active sidebar section. App passes its `setActiveSection`. */
  onSelectSection: (sectionId: string) => void;
};

/// Result shape from the `prime_scanner_histories` IPC. Inherited from M6's
/// scanner work — the IPC name stays "scanner_histories" for backwards compat
/// even though Scanner is no longer the caller; PRIME is now invoked from
/// PULSE when greyed (noBars) rows are visible.
type PrimeResult = {
  primed: number;
  failures: Array<{ ticker: string; error: string }>;
};

/** Map a percentile (0-100) to an inline `background` rgba string.
 *  Neutral-hold from 40-60 (low saturation), then ramps to full at the
 *  tails so extremes pop. Red side below 50, green side above 50. */
function pulseCellBg(percentile: number | null): string {
  if (percentile == null) return 'transparent';
  const d = Math.abs(percentile - 50);
  const HOLD_CEILING = 0.06;
  const RAMP_CEILING = 0.55;
  let alpha: number;
  if (d <= 10) {
    alpha = (d / 10) * HOLD_CEILING;
  } else {
    alpha = HOLD_CEILING + ((d - 10) / 40) * (RAMP_CEILING - HOLD_CEILING);
  }
  const rgb = percentile < 50 ? 'var(--status-down-rgb)' : 'var(--status-up-rgb)';
  return `rgba(${rgb}, ${alpha.toFixed(3)})`;
}

/** Drawdown cell background. Monotone red ramp; saturates at -40%. */
function ddCellBg(ddPct: number | null): string {
  if (ddPct == null) return 'transparent';
  const depth = Math.min(Math.abs(ddPct) / 40, 1);
  const alpha = depth * 0.55;
  return `rgba(var(--status-down-rgb), ${alpha.toFixed(3)})`;
}

function PulseRegimeChip({ regime }: { regime: RegimeState | null }) {
  if (regime == null) return <span className="pulse__em">—</span>;
  return (
    <span className={`pulse__chip pulse__chip--${regime.toLowerCase()}`}>{regime}</span>
  );
}

function PulseCell({
  value,
  partial,
}: {
  value: number | null;
  partial?: boolean;
}) {
  if (value == null) return <div className="pulse__cell pulse__cell--empty">—</div>;
  return (
    <div className="pulse__cell" style={{ background: pulseCellBg(value) }}>
      {Math.round(value)}
      {partial ? <span className="pulse__partial-mark">*</span> : null}
    </div>
  );
}

function PulseDDCell({ ddPct }: { ddPct: number | null }) {
  if (ddPct == null) return <div className="pulse__cell pulse__cell--empty">—</div>;
  return (
    <div className="pulse__cell pulse__cell--dd" style={{ background: ddCellBg(ddPct) }}>
      {ddPct.toFixed(1)}%
    </div>
  );
}

function rowHasExtremeCell(r: CrossSectionRow): boolean {
  const cells = [r.level, r.rsi, r.atr, r.vol];
  return cells.some(v => v != null && (v >= 80 || v <= 20));
}

function compareRows(
  a: CrossSectionRow,
  b: CrossSectionRow,
  col: Exclude<SortColumn, null>,
  dir: SortDirection,
) {
  const va = col === 'dd' ? a.ddPct : col === 'age' ? a.ageDays : a[col];
  const vb = col === 'dd' ? b.ddPct : col === 'age' ? b.ageDays : b[col];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return dir === 'desc' ? vb - va : va - vb;
}

type Counts = { bull: number; bear: number; neut: number; macro: number; total: number };

function tallyCounts(sections: CrossSectionSection[]): Counts {
  let bull = 0,
    bear = 0,
    neut = 0,
    macro = 0;
  for (const s of sections) {
    for (const r of s.rows) {
      if (r.isMacro) {
        macro++;
        continue;
      }
      if (r.regime === 'BULL') bull++;
      else if (r.regime === 'BEAR') bear++;
      else if (r.regime === 'NEUTRAL') neut++;
    }
  }
  return { bull, bear, neut, macro, total: bull + bear + neut + macro };
}

function tallyExtremes(sections: CrossSectionSection[]): number {
  let n = 0;
  for (const s of sections) {
    for (const r of s.rows) {
      if (r.isMacro) {
        if (r.level != null && (r.level >= 80 || r.level <= 20)) n++;
      } else if (rowHasExtremeCell(r)) n++;
    }
  }
  return n;
}

export default function PulseDashboard({ onSelectSection }: Props) {
  const [response, setResponse] = useState<CrossSectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPriming, setIsPriming] = useState(false);
  const [primeStatus, setPrimeStatus] = useState<string | null>(null);
  const [primeFailures, setPrimeFailures] = useState<PrimeResult['failures']>([]);

  const [sortCol, setSortCol] = usePersistedState<SortColumn>(
    'session.pulse_sort_column',
    null,
  );
  const [sortDir, setSortDir] = usePersistedState<SortDirection>(
    'session.pulse_sort_direction',
    'desc',
  );
  const [filter, setFilter] = useState<FilterScope>('all');

  const fetchCrossSection = (): Promise<CrossSectionResponse> =>
    invoke<CrossSectionResponse>('compute_cross_section', {
      request: { lookbackYears: 5 },
    });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCrossSection()
      .then(r => {
        if (cancelled) return;
        setResponse(r);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(typeof e === 'string' ? e : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prime = async () => {
    if (isPriming) return;
    setIsPriming(true);
    setPrimeStatus(null);
    setPrimeFailures([]);
    try {
      const result = await invoke<PrimeResult>('prime_scanner_histories');
      const parts = [`Primed ${result.primed}`];
      if (result.failures.length > 0) parts.push(`${result.failures.length} failed`);
      setPrimeStatus(parts.join(' · '));
      setPrimeFailures(result.failures);
      const fresh = await fetchCrossSection();
      setResponse(fresh);
    } catch (e) {
      setPrimeStatus(`Prime failed: ${typeof e === 'string' ? e : String(e)}`);
    } finally {
      setIsPriming(false);
    }
  };

  const sections = response?.sections ?? [];
  const counts = useMemo(() => tallyCounts(sections), [sections]);
  const extremes = useMemo(() => tallyExtremes(sections), [sections]);
  const noBarsCount = useMemo(
    () =>
      sections.reduce(
        (acc, s) => acc + s.rows.filter(r => r.noBars && !r.isMacro).length,
        0,
      ),
    [sections],
  );

  const visibleSections: CrossSectionSection[] = useMemo(() => {
    const filtered = sections.map(section => {
      let rows = section.rows;
      if (filter === 'bull') rows = rows.filter(r => r.regime === 'BULL');
      else if (filter === 'bear') rows = rows.filter(r => r.regime === 'BEAR');
      else if (filter === 'extremes') {
        rows = rows.filter(r => {
          if (r.isMacro) return r.level != null && (r.level >= 80 || r.level <= 20);
          return rowHasExtremeCell(r);
        });
      }
      if (sortCol) {
        rows = rows.slice().sort((a, b) => compareRows(a, b, sortCol, sortDir));
      }
      return { ...section, rows };
    });
    return filtered.filter(s => s.rows.length > 0);
  }, [sections, filter, sortCol, sortDir]);

  const handleHeaderClick = (col: Exclude<SortColumn, null>) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else {
      setSortCol(null);
      setSortDir('desc');
    }
  };

  const sortMark = (col: Exclude<SortColumn, null>) => {
    if (sortCol !== col) return <span className="pulse__sort-mark"> </span>;
    return (
      <span className="pulse__sort-mark pulse__sort-mark--active">
        {sortDir === 'desc' ? '▼' : '▲'}
      </span>
    );
  };

  const handleTickerClick = (row: CrossSectionRow) => {
    // Macro rows don't have a feature-chart equivalent in TickerDashboard.
    // Greyed (no-bars) rows have nothing to chart yet either — silently ignore.
    if (row.isMacro || row.noBars) return;
    localStorage.setItem(
      PULSE_HANDOFF_KEY,
      JSON.stringify({ ticker: row.ticker, dataSource: row.dataSource }),
    );
    onSelectSection(row.sectorGroupId);
  };

  return (
    <div className="pulse">
      {/* Top banner — title block + counts + filter chips */}
      <div className="pulse__banner">
        <div className="pulse__banner-title">
          <span className="pulse__banner-name">PULSE</span>
          <span className="pulse__banner-tagline">your universe · right now vs the last 5 years</span>
        </div>
        <div className="pulse__banner-stats">
          <span><strong>{counts.total + counts.macro}</strong> rows</span>
          <span className="pulse__sep">·</span>
          <span className="pulse__stat pulse__stat--bull"><strong>{counts.bull}</strong> BULL</span>
          <span className="pulse__stat pulse__stat--bear"><strong>{counts.bear}</strong> BEAR</span>
          <span className="pulse__stat pulse__stat--neut"><strong>{counts.neut}</strong> NEUT</span>
          <span><strong>{counts.macro}</strong> macro</span>
          <span className="pulse__sep">·</span>
          <span className="pulse__stat pulse__stat--ext"><strong>{extremes}</strong> EXTREMES</span>
        </div>
        <div className="pulse__banner-filters">
          {(['all', 'bull', 'bear', 'extremes'] as FilterScope[]).map(scope => (
            <button
              key={scope}
              type="button"
              className={`pulse__filter-chip ${filter === scope ? 'pulse__filter-chip--active' : ''}`}
              onClick={() => setFilter(scope)}
            >
              {scope.toUpperCase()}
            </button>
          ))}
          {noBarsCount > 0 && (
            <button
              type="button"
              className="pulse__filter-chip pulse__filter-chip--prime"
              onClick={prime}
              disabled={isPriming}
              title="Fetch missing price history. Tickers that fail (typically because the symbol isn't on the data source) are listed below the banner."
            >
              {isPriming ? 'PRIMING…' : `PRIME (${noBarsCount})`}
            </button>
          )}
        </div>
      </div>
      {primeStatus && <div className="pulse__prime-status">{primeStatus}</div>}
      {primeFailures.length > 0 && (
        <div className="pulse__prime-failures">
          <div className="pulse__prime-failures-label">Failed:</div>
          <ul className="pulse__prime-failures-list">
            {primeFailures.map(f => (
              <li key={f.ticker} className="pulse__prime-failure">
                <span className="pulse__prime-failure-ticker">{f.ticker}</span>
                <span className="pulse__prime-failure-error" title={f.error}>{f.error}</span>
              </li>
            ))}
          </ul>
          <div className="pulse__prime-failures-hint">
            Symbols that consistently fail are likely listed on a different exchange than the seeded suffix indicates — fix via Manage Watchlist.
          </div>
        </div>
      )}

      <div className="pulse__intro">
        <TabIntro
          subtitle="Where each ticker and macro series in your universe sits today vs its own 5-year range, expressed as percentile-rank cells. Greens mean &ldquo;high vs history,&rdquo; reds mean &ldquo;low,&rdquo; middle values mean &ldquo;normal.&rdquo;"
          howToRead={
            <>
              <ul>
                <li>Each cell shows the current value's percentile rank within the last five years of that ticker's own history. A green LEVEL cell at 95 means today's price is in the top 5% of the last five years; a red RSI cell at 12 means RSI is in the bottom 12%.</li>
                <li>REGIME = SMMA Ribbon current state (the chip color follows your Settings → Appearance palette). AGE = days since the most recent regime flip — long age = mature trend, short = fresh.</li>
                <li>DD is a signed % drawdown from the 5-year running peak — not a percentile. -22% means the asset is 22% below its 5-year high.</li>
                <li>Rows tagged with <span className="pulse__partial-mark">*</span> have less than a year of history; the percentile is computed against the available range. Rows greyed out have no bars yet — refresh that section.</li>
                <li>Scan for cells at saturation. Greens at 90+ or reds at 10- are where stories develop.</li>
                <li>Universe-wide patterns matter. If half the RSI column is red, that's a market-wide cool-off, not a ticker-specific signal.</li>
                <li>Sortable by any column. Click a row to open that ticker's chart. (Pending — wired in a follow-up.)</li>
              </ul>
            </>
          }
          math={
            <>
              <p>
                For each (ticker, dimension): <code>percentile = (count of historical values ≤ current_value) / total_count × 100</code>. Baseline window: trailing 5 years from the most recent observation in the cache.
              </p>
              <ul>
                <li><strong>LEVEL</strong> — percentile of <code>close</code> (equities) or observation <code>value</code> (macro).</li>
                <li><strong>RSI</strong> — 14-period Wilder RSI percentile vs 5y of historical RSI values.</li>
                <li><strong>ATR</strong> — 14-period Wilder ATR percentile vs 5y of historical ATR values.</li>
                <li><strong>VOL</strong> — trailing 5-day average volume percentile vs 5y of 5d-avg volumes.</li>
                <li><strong>DD</strong> — <code>(close / running_max − 1) × 100</code>, signed. Trailing 5y running peak.</li>
                <li><strong>REGIME</strong> — SMMA Ribbon state (quad-SMMA classifier, 3-bar confirmation, default params universally — Pulse intentionally bypasses per-ticker overrides). <strong>AGE</strong> — calendar days since most recent confirmed flip.</li>
              </ul>
            </>
          }
        />
      </div>

      <div className="pulse__head-row">
        <div className="pulse__head-cell pulse__head-cell--ticker">TICKER</div>
        <div className="pulse__head-cell pulse__head-cell--regime">REGIME</div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'age' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('age')}
        >
          AGE{sortMark('age')}
        </div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'level' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('level')}
        >
          LEVEL{sortMark('level')}
        </div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'rsi' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('rsi')}
        >
          RSI{sortMark('rsi')}
        </div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'atr' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('atr')}
        >
          ATR{sortMark('atr')}
        </div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'vol' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('vol')}
        >
          VOL{sortMark('vol')}
        </div>
        <div
          className={`pulse__head-cell pulse__head-cell--num pulse__head-cell--sortable ${sortCol === 'dd' ? 'pulse__head-cell--sorted' : ''}`}
          onClick={() => handleHeaderClick('dd')}
        >
          DD{sortMark('dd')}
        </div>
      </div>

      <div className="pulse__body">
        {loading && (
          <div className="pulse__placeholder">Computing cross-section…</div>
        )}
        {error && (
          <div className="pulse__placeholder pulse__placeholder--error">
            Pulse compute failed: {error}
          </div>
        )}
        {!loading && !error && visibleSections.length === 0 && (
          <div className="pulse__placeholder">
            No rows match the current filter.
          </div>
        )}
        {!loading && !error &&
          visibleSections.map(section => {
            const isMacroSection = section.rows.every(r => r.isMacro);
            const regimeMix = section.rows.reduce(
              (acc, r) => {
                if (r.regime === 'BULL') acc.bull++;
                else if (r.regime === 'BEAR') acc.bear++;
                else if (r.regime === 'NEUTRAL') acc.neut++;
                return acc;
              },
              { bull: 0, bear: 0, neut: 0 },
            );
            return (
              <div key={section.id} className="pulse__section">
                <div className="pulse__section-header">
                  <span className="pulse__section-name">{section.displayName}</span>
                  <span className="pulse__section-meta">
                    {section.rows.length} {section.rows.length === 1 ? 'row' : 'rows'}
                    {!isMacroSection && (
                      <>
                        {' · '}
                        {regimeMix.bull > 0 && (
                          <span className="pulse__stat pulse__stat--bull">{regimeMix.bull} BULL</span>
                        )}
                        {regimeMix.bear > 0 && (
                          <span className="pulse__stat pulse__stat--bear"> · {regimeMix.bear} BEAR</span>
                        )}
                        {regimeMix.neut > 0 && (
                          <span className="pulse__stat pulse__stat--neut"> · {regimeMix.neut} NEUT</span>
                        )}
                      </>
                    )}
                  </span>
                </div>
                {section.rows.map(row => {
                  const clickable = !row.isMacro && !row.noBars;
                  return (
                  <div
                    key={`${section.id}-${row.ticker}`}
                    className={`pulse__row ${row.noBars ? 'pulse__row--no-bars' : ''} ${row.partialHistory ? 'pulse__row--partial' : ''}`}
                    title={
                      row.noBars
                        ? `${row.ticker} — bars not yet fetched (refresh this section or use SCANNER → PRIME)`
                        : row.partialHistory
                          ? `${row.ticker} — partial history; percentiles vs available range`
                          : (row.displayName ?? row.ticker)
                    }
                  >
                    {clickable ? (
                      <button
                        type="button"
                        className="pulse__ticker pulse__ticker--clickable"
                        onClick={() => handleTickerClick(row)}
                        title={`Open ${row.displayName ?? row.ticker} feature chart`}
                      >
                        {row.ticker}
                      </button>
                    ) : (
                      <div className="pulse__ticker">{row.ticker}</div>
                    )}
                    <div className="pulse__regime-cell">
                      <PulseRegimeChip regime={row.regime} />
                    </div>
                    <div className="pulse__age-cell">
                      {row.ageDays != null ? `${row.ageDays}d` : <span className="pulse__em">—</span>}
                    </div>
                    <PulseCell value={row.level} partial={row.partialHistory} />
                    <PulseCell value={row.rsi} partial={row.partialHistory} />
                    <PulseCell value={row.atr} partial={row.partialHistory} />
                    <PulseCell value={row.vol} partial={row.partialHistory} />
                    <PulseDDCell ddPct={row.ddPct} />
                  </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    </div>
  );
}
