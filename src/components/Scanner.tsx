import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type ScannerRow = {
  ticker: string;
  sectorGroupId: string;
  displayName: string | null;
  displayCurrency: string | null;
  price: number | null;
  state: string | null;
  barsSinceFlip: number | null;
  rsi: number | null;
  atrPct: number | null;
  computeError: string | null;
};

type SortKey = 'ticker' | 'sectorGroupId' | 'state' | 'barsSinceFlip' | 'rsi' | 'atrPct';
type SortDir = 'asc' | 'desc';

const STATE_ORDER: Record<string, number> = {
  bullish: 0,
  bearish: 2,
  neutral: 1,
};

type PrimeResult = {
  primed: number;
  failures: Array<{ ticker: string; error: string }>;
};

export default function Scanner() {
  const [rows, setRows] = useState<ScannerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('state');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
  const [primeStatus, setPrimeStatus] = useState<string | null>(null);

  const load = () => {
    setIsRefreshing(true);
    invoke<ScannerRow[]>('scanner_snapshot')
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setIsRefreshing(false));
  };

  const prime = () => {
    setIsPriming(true);
    setPrimeStatus(null);
    invoke<PrimeResult>('prime_scanner_histories')
      .then((result) => {
        const parts = [`Primed ${result.primed}`];
        if (result.failures.length > 0) {
          parts.push(`${result.failures.length} failed`);
        }
        setPrimeStatus(parts.join(' · '));
        load();
      })
      .catch((e) => setPrimeStatus(`Prime failed: ${e}`))
      .finally(() => setIsPriming(false));
  };

  useEffect(() => {
    load();
  }, []);

  const emptyRowCount = useMemo(
    () => (rows ?? []).filter((r) => r.state === null).length,
    [rows],
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredSorted = useMemo(() => {
    if (!rows) return [];
    const filtered = stateFilter === 'all' ? rows : rows.filter((r) => r.state === stateFilter);
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = cellValue(a, sortKey);
      const bv = cellValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return -1 * sign;
      if (av > bv) return sign;
      return 0;
    });
  }, [rows, sortKey, sortDir, stateFilter]);

  if (error) {
    return <div className="macro-tile__error">Failed to load scanner: {error}</div>;
  }
  if (!rows) {
    return <div className="macro-tile__loading">Computing indicators across watchlist…</div>;
  }

  return (
    <div className="macro-dashboard">
      <div className="macro-dashboard__controls">
        <div className="macro-dashboard__section-label">
          SCANNER · {filteredSorted.length}/{rows.length} tickers
        </div>
        <div className="macro-dashboard__actions">
          <StateFilter value={stateFilter} onChange={setStateFilter} />
          {emptyRowCount > 0 && (
            <button
              type="button"
              className="view-toggle"
              onClick={prime}
              disabled={isPriming || isRefreshing}
              title="Fetch missing price history for every empty scanner row"
            >
              {isPriming ? 'PRIMING…' : `PRIME (${emptyRowCount})`}
            </button>
          )}
          <button
            type="button"
            className="view-toggle"
            onClick={load}
            disabled={isRefreshing || isPriming}
          >
            {isRefreshing ? 'COMPUTING…' : 'RECOMPUTE'}
          </button>
        </div>
      </div>
      {primeStatus && <div className="scanner-prime-status">{primeStatus}</div>}
      <div className="scanner-table-wrap">
        <table className="scanner-table">
          <thead>
            <tr>
              <HeadCell label="Ticker" active={sortKey === 'ticker'} dir={sortDir} onClick={() => toggleSort('ticker')} />
              <HeadCell label="Sector" active={sortKey === 'sectorGroupId'} dir={sortDir} onClick={() => toggleSort('sectorGroupId')} />
              <th>Name</th>
              <th className="ta-right">Price</th>
              <HeadCell label="State" active={sortKey === 'state'} dir={sortDir} onClick={() => toggleSort('state')} />
              <HeadCell label="Bars Since Flip" active={sortKey === 'barsSinceFlip'} dir={sortDir} onClick={() => toggleSort('barsSinceFlip')} right />
              <HeadCell label="RSI(14)" active={sortKey === 'rsi'} dir={sortDir} onClick={() => toggleSort('rsi')} right />
              <HeadCell label="ATR%" active={sortKey === 'atrPct'} dir={sortDir} onClick={() => toggleSort('atrPct')} right />
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((r) => (
              <tr key={`${r.sectorGroupId}:${r.ticker}`}>
                <td className="mono">{r.ticker}</td>
                <td className="mono dim">{r.sectorGroupId}</td>
                <td title={r.computeError ?? undefined}>
                  {r.displayName ?? r.ticker}
                  {r.computeError && <span className="macro-tile__error-dot"> ⚠</span>}
                </td>
                <td className="ta-right mono">
                  {r.price !== null
                    ? r.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })
                    : '—'}
                </td>
                <td>{r.state ? <StateBadge state={r.state} /> : '—'}</td>
                <td className="ta-right mono">{r.barsSinceFlip ?? '—'}</td>
                <td className="ta-right mono">{formatRsi(r.rsi)}</td>
                <td className="ta-right mono">
                  {r.atrPct !== null ? `${r.atrPct.toFixed(2)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeadCell({
  label,
  active,
  dir,
  onClick,
  right,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th
      className={`sortable ${active ? 'sorted' : ''} ${right ? 'ta-right' : ''}`}
      onClick={onClick}
    >
      {label}
      {active && <span className="sort-arrow">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

function StateBadge({ state }: { state: string }) {
  return <span className={`state-badge state-badge--${state}`}>{state}</span>;
}

function StateFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="state-filter">
      {['all', 'bullish', 'bearish', 'neutral'].map((opt) => (
        <button
          key={opt}
          type="button"
          className={`state-filter__btn ${opt === value ? 'state-filter__btn--active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function cellValue(r: ScannerRow, key: SortKey): number | string | null {
  switch (key) {
    case 'ticker':
      return r.ticker;
    case 'sectorGroupId':
      return r.sectorGroupId;
    case 'state':
      return r.state !== null ? STATE_ORDER[r.state] ?? 99 : null;
    case 'barsSinceFlip':
      return r.barsSinceFlip;
    case 'rsi':
      return r.rsi;
    case 'atrPct':
      return r.atrPct;
  }
}

function formatRsi(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1);
}
