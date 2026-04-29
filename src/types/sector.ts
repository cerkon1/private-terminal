export type SectorGroup = {
  id: string;
  parentId: string | null;
  displayName: string;
  dataSource: string;
  displayOrder: number | null;
  enabled: boolean;
};

export type TickerTileData = {
  ticker: string;
  sectorGroupId: string;
  dataSource: string;
  displayName: string | null;
  displayCurrency: string | null;
  price: number | null;
  changePct24h: number | null;
  changeAbs24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  lastFetched: string | null;
  /** Percent change over N lookback windows, from price_history. Null when
   *  the lookback bar isn't cached — user can prime history via the Scanner. */
  changePct1w: number | null;
  changePct1m: number | null;
  changePctYtd: number | null;
  changePct1y: number | null;
  fetchError: string | null;
};

export type TileRange = '1D' | '1W' | '1M' | 'YTD' | '1Y';

export const TILE_RANGES: TileRange[] = ['1D', '1W', '1M', 'YTD', '1Y'];

export function pickChangePct(tile: TickerTileData, range: TileRange): number | null {
  switch (range) {
    case '1D':
      return tile.changePct24h;
    case '1W':
      return tile.changePct1w;
    case '1M':
      return tile.changePct1m;
    case 'YTD':
      return tile.changePctYtd;
    case '1Y':
      return tile.changePct1y;
  }
}

export type TickerBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type TickerHistory = {
  ticker: string;
  dataSource: string;
  displayName: string | null;
  displayCurrency: string | null;
  bars: TickerBar[];
};

export function formatPrice(
  v: number | null,
  currency: string | null,
): string {
  if (v === null) return '—';
  const digits = Math.abs(v) >= 1000 ? 2 : 4;
  const formatted = v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency ? `${formatted}` : formatted;
}

export function formatChange(
  abs: number | null,
  pct: number | null,
): { text: string; sign: 0 | 1 | -1 } {
  if (abs === null || pct === null) return { text: '—', sign: 0 };
  const sign = pct > 0 ? 1 : pct < 0 ? -1 : 0;
  const absStr =
    Math.abs(abs) >= 1000
      ? abs.toLocaleString(undefined, { maximumFractionDigits: 2, signDisplay: 'always' })
      : abs.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          signDisplay: 'always',
        });
  const pctStr = pct.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  });
  return { text: `${absStr} (${pctStr}%)`, sign };
}
