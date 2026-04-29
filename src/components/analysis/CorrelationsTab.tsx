import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePersistedState } from '../../hooks/usePersistedState';
import type {
  CorrelationsRequest,
  CorrelationsResponse,
  TickerKey,
} from '../../types/analysis';
import { TickerChipPicker } from './TickerChipPicker';

type StoredConfig = {
  tickers: TickerKey[];
  lookbackDays: number;
};

const DEFAULT_CONFIG: StoredConfig = {
  tickers: [],
  lookbackDays: 90,
};

const LOOKBACKS: { days: number; label: string }[] = [
  { days: 30, label: '30d' },
  { days: 60, label: '60d' },
  { days: 90, label: '90d' },
  { days: 180, label: '6mo' },
  { days: 365, label: '1y' },
];

/// Map a correlation value in [-1, 1] to a heatmap cell background. Strong
/// positive → green; strong negative → red; near-zero → faint neutral.
/// Uses the rgba(var(--token-rgb), α) pattern from chartTheme.
function cellStyle(r: number): CSSProperties {
  if (!Number.isFinite(r)) return {};
  const intensity = Math.min(1, Math.abs(r));
  const alpha = (0.15 + intensity * 0.55).toFixed(2);
  const rgbVar = r >= 0 ? '--status-up-rgb' : '--status-down-rgb';
  return { backgroundColor: `rgba(var(${rgbVar}), ${alpha})` };
}

function format2(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(2);
}

export function CorrelationsTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_correlation_matrix_config',
    DEFAULT_CONFIG,
  );

  const [result, setResult] = useState<CorrelationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minBars = useMemo(
    () => Math.max(2, Math.floor(config.lookbackDays / 2)),
    [config.lookbackDays],
  );

  // Recompute on selection or lookback change. Empty selection clears.
  useEffect(() => {
    if (config.tickers.length < 2) {
      setResult(null);
      setError(null);
      return;
    }
    const request: CorrelationsRequest = {
      tickers: config.tickers,
      lookbackDays: config.lookbackDays,
    };
    let active = true;
    setLoading(true);
    setError(null);
    invoke<CorrelationsResponse>('compute_correlations', { request })
      .then((r) => {
        if (!active) return;
        setResult(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(typeof e === 'string' ? e : String(e));
        setResult(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.tickers, config.lookbackDays]);

  const onTickersChange = (next: TickerKey[]) =>
    setConfig({ ...config, tickers: next });

  const onLookbackChange = (days: number) =>
    setConfig({ ...config, lookbackDays: days });

  return (
    <div className="analysis-tab analysis-correlations">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Lookback</label>
          <select
            className="analysis-tab__select"
            value={config.lookbackDays}
            onChange={(e) => onLookbackChange(Number(e.target.value))}
          >
            {LOOKBACKS.map((l) => (
              <option key={l.days} value={l.days}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="analysis-tab__control-group analysis-tab__control-group--grow">
          <label className="analysis-tab__label">Tickers</label>
          <TickerChipPicker
            selected={config.tickers}
            onChange={onTickersChange}
            minBarsRequired={minBars}
          />
        </div>
      </header>

      {config.tickers.length < 2 && (
        <div className="analysis-tab__placeholder">
          Add at least two tickers to compute correlations.
        </div>
      )}

      {loading && (
        <div className="analysis-tab__status">Computing…</div>
      )}

      {error && (
        <div className="analysis-tab__error">
          {error}
        </div>
      )}

      {result && result.tickers.length >= 2 && (
        <>
          <div className="corr-matrix-wrap">
            <table className="corr-matrix">
              <thead>
                <tr>
                  <th className="corr-matrix__corner" />
                  {result.tickers.map((t) => (
                    <th key={`h-${t.ticker}-${t.dataSource}`} className="corr-matrix__col-head">
                      {t.ticker}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.matrix.map((row, i) => (
                  <tr key={`r-${i}`}>
                    <th className="corr-matrix__row-head">{result.tickers[i].ticker}</th>
                    {row.map((v, j) => (
                      <td
                        key={`c-${i}-${j}`}
                        className="corr-matrix__cell"
                        style={cellStyle(v)}
                        title={`${result.tickers[i].ticker} × ${result.tickers[j].ticker} = ${format2(v)}`}
                      >
                        {format2(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="analysis-tab__footnote">
            <span>
              {result.barCount} common bars
              {result.startDate && result.endDate && (
                <> · {result.startDate} → {result.endDate}</>
              )}
              {' '}· {result.lookbackDaysRequested}d window
            </span>
            {result.excluded.length > 0 && (
              <span className="analysis-tab__excluded">
                {' '}· excluded: {result.excluded
                  .map((e) => `${e.ticker} (${e.barCount}b)`)
                  .join(', ')}
              </span>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
