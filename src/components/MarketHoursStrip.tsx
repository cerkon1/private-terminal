import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

/** Regular-hours trading windows in local time for the 8 tracked exchanges.
 *  Simplification: does not model market holidays, half-days, or pre/post
 *  sessions. Pure clock-in-tz math is enough for the at-a-glance strip. */
type Exchange = {
  code: string;
  name: string;
  tz: string;
  openHhmm: [number, number];
  closeHhmm: [number, number];
};

const EXCHANGES: Exchange[] = [
  { code: 'NYSE', name: 'New York',  tz: 'America/New_York',  openHhmm: [9, 30],  closeHhmm: [16, 0] },
  { code: 'TSX',  name: 'Toronto',   tz: 'America/Toronto',   openHhmm: [9, 30],  closeHhmm: [16, 0] },
  { code: 'LSE',  name: 'London',    tz: 'Europe/London',     openHhmm: [8, 0],   closeHhmm: [16, 30] },
  { code: 'TYO',  name: 'Tokyo',     tz: 'Asia/Tokyo',        openHhmm: [9, 0],   closeHhmm: [15, 0] },
  { code: 'HKG',  name: 'Hong Kong', tz: 'Asia/Hong_Kong',    openHhmm: [9, 30],  closeHhmm: [16, 0] },
  { code: 'SSE',  name: 'Shanghai',  tz: 'Asia/Shanghai',     openHhmm: [9, 30],  closeHhmm: [15, 0] },
  { code: 'ASX',  name: 'Sydney',    tz: 'Australia/Sydney',  openHhmm: [10, 0],  closeHhmm: [16, 0] },
  { code: 'KRX',  name: 'Seoul',     tz: 'Asia/Seoul',        openHhmm: [9, 0],   closeHhmm: [15, 30] },
];

type LocalTime = { weekday: number; hour: number; minute: number; hhmm: string };

type MarketIndexQuote = {
  exchangeCode: string;
  ticker: string;
  changePct24h: number | null;
  lastFetched: string | null;
};

function getLocalTime(tz: string): LocalTime {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  return {
    weekday: weekdayMap[get('weekday')] ?? 0,
    hour,
    minute,
    hhmm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function isOpen(ex: Exchange, lt: LocalTime): boolean {
  if (lt.weekday === 0 || lt.weekday === 6) return false;
  const cur = lt.hour * 60 + lt.minute;
  const openM = ex.openHhmm[0] * 60 + ex.openHhmm[1];
  const closeM = ex.closeHhmm[0] * 60 + ex.closeHhmm[1];
  return cur >= openM && cur < closeM;
}

function directionClass(pct: number | null): string {
  if (pct === null) return 'market-chip--flat';
  if (pct > 0.05) return 'market-chip--up';
  if (pct < -0.05) return 'market-chip--down';
  return 'market-chip--flat';
}

export default function MarketHoursStrip() {
  const [tick, setTick] = useState(0);
  const [quotes, setQuotes] = useState<Map<string, MarketIndexQuote>>(new Map());

  // Re-render once a minute so the open/closed state and local times stay live.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Pull index quotes on mount and every 5 minutes — same cadence as the
  // Yahoo-quote refresh path. Read-only against the cache; doesn't fetch.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await invoke<MarketIndexQuote[]>('list_market_index_quotes');
        if (cancelled) return;
        const map = new Map<string, MarketIndexQuote>();
        for (const r of rows) map.set(r.exchangeCode, r);
        setQuotes(map);
      } catch {
        // Silent — strip falls back to neutral coloring.
      }
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="market-hours-strip" data-tick={tick}>
      {EXCHANGES.map(ex => {
        const lt = getLocalTime(ex.tz);
        const open = isOpen(ex, lt);
        const q = quotes.get(ex.code);
        const pct = q?.changePct24h ?? null;
        const dirClass = directionClass(pct);
        const pctText =
          pct === null
            ? '—'
            : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
        return (
          <div
            key={ex.code}
            className={`market-chip ${open ? 'market-chip--open' : 'market-chip--closed'} ${dirClass}`}
            title={
              `${ex.name} · ${ex.tz} · ${lt.hhmm} local · ` +
              (open ? 'OPEN' : 'CLOSED') +
              (q ? ` · ${q.ticker} ${pctText}` : '')
            }
          >
            <span className="market-chip__dot" />
            <span className="market-chip__code">{ex.code}</span>
            <span className="market-chip__pct">{pctText}</span>
          </div>
        );
      })}
    </div>
  );
}
