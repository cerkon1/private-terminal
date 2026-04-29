import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TickerCoverage, TickerKey } from '../../types/analysis';

type Props = {
  selected: TickerKey[];
  onChange: (next: TickerKey[]) => void;
  /** Tickers with bar_count strictly below this render greyed and carry a
   *  bar-count tooltip. Pass 0 to disable greying. */
  minBarsRequired: number;
};

/// Chip-based multi-select for analysis tickers. Autocomplete via prefix
/// match on the ticker symbol (case-insensitive). Greyed chips reflect
/// insufficient bar coverage for the current lookback (Q4.A + Q6).
///
/// State scope: chip selection is owned by the parent (typically a
/// CorrelationsTab) so it can be persisted under session.* keys per Q8.B.
/// This component is stateless w.r.t. the selection itself.
export function TickerChipPicker({ selected, onChange, minBarsRequired }: Props) {
  const [available, setAvailable] = useState<TickerCoverage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    invoke<TickerCoverage[]>('list_tickers_with_coverage')
      .then((r) => {
        if (!active) return;
        setAvailable(r);
        setLoaded(true);
      })
      .catch((e) => {
        if (!active) return;
        setError(typeof e === 'string' ? e : String(e));
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fast lookup of coverage info for already-selected chips.
  const coverageMap = useMemo(() => {
    const m = new Map<string, TickerCoverage>();
    for (const c of available) m.set(`${c.ticker}::${c.dataSource}`, c);
    return m;
  }, [available]);

  // Autocomplete candidates: prefix-match (case-insensitive) on ticker, not
  // already selected. Limit to 12 results so the dropdown stays scannable.
  const candidates = useMemo(() => {
    const q = query.trim().toUpperCase();
    const selectedSet = new Set(selected.map((s) => `${s.ticker}::${s.dataSource}`));
    const all = available.filter(
      (c) => !selectedSet.has(`${c.ticker}::${c.dataSource}`),
    );
    const filtered = q
      ? all.filter(
          (c) =>
            c.ticker.toUpperCase().startsWith(q) ||
            (c.displayName?.toUpperCase().includes(q) ?? false),
        )
      : all;
    return filtered.slice(0, 12);
  }, [available, query, selected]);

  // Click-outside dismiss for the dropdown.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const addChip = (c: TickerCoverage) => {
    onChange([...selected, { ticker: c.ticker, dataSource: c.dataSource }]);
    setQuery('');
    setOpen(false);
  };

  const removeChip = (key: TickerKey) => {
    onChange(
      selected.filter(
        (s) => !(s.ticker === key.ticker && s.dataSource === key.dataSource),
      ),
    );
  };

  return (
    <div className="chip-picker" ref={wrapRef}>
      <div className="chip-picker__chips">
        {selected.map((s) => {
          const cov = coverageMap.get(`${s.ticker}::${s.dataSource}`);
          const insufficient =
            minBarsRequired > 0 && cov !== undefined && cov.barCount < minBarsRequired;
          const tooltip = insufficient
            ? `${cov!.barCount} of ${minBarsRequired} bars needed`
            : cov?.displayName
              ? `${cov.displayName} · ${cov.barCount} bars`
              : `${cov?.barCount ?? 0} bars`;
          return (
            <span
              key={`${s.ticker}::${s.dataSource}`}
              className={`chip-picker__chip ${insufficient ? 'chip-picker__chip--greyed' : ''}`}
              title={tooltip}
            >
              <span className="chip-picker__chip-symbol">{s.ticker}</span>
              <button
                type="button"
                className="chip-picker__chip-remove"
                onClick={() => removeChip(s)}
                aria-label={`Remove ${s.ticker}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <div className="chip-picker__input-wrap">
          <input
            type="text"
            className="chip-picker__input"
            placeholder={selected.length === 0 ? 'add ticker…' : '+'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && loaded && (
            <ul className="chip-picker__dropdown">
              {candidates.length === 0 ? (
                <li className="chip-picker__candidate chip-picker__candidate--empty">
                  {available.length === 0 ? 'no tickers in watchlist' : 'no matches'}
                </li>
              ) : (
                candidates.map((c) => {
                  const insufficient =
                    minBarsRequired > 0 && c.barCount < minBarsRequired;
                  return (
                    <li
                      key={`${c.ticker}::${c.dataSource}`}
                      className={`chip-picker__candidate ${insufficient ? 'chip-picker__candidate--greyed' : ''}`}
                      onClick={() => addChip(c)}
                      title={
                        insufficient
                          ? `${c.barCount} of ${minBarsRequired} bars needed`
                          : `${c.barCount} bars`
                      }
                    >
                      <span className="chip-picker__candidate-symbol">{c.ticker}</span>
                      {c.displayName && (
                        <span className="chip-picker__candidate-name">{c.displayName}</span>
                      )}
                      <span className="chip-picker__candidate-bars">{c.barCount}b</span>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </div>
      {error && <div className="chip-picker__error">{error}</div>}
    </div>
  );
}
