export type MacroTileData = {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  category: string | null;
  latestValue: number | null;
  latestObsDate: string | null;
  yearAgoValue: number | null;
  yearAgoObsDate: string | null;
  lastFetched: string | null;
  fetchError: string | null;
};

export type FredObservation = { date: string; value: number };

export type FredHistory = {
  seriesId: string;
  title: string;
  units: string;
  observations: FredObservation[];
};

export type YoY = {
  /** Signed delta — absolute (pp) for Percent units, relative (%) otherwise. */
  value: number;
  kind: 'pp' | 'pct';
};

export function computeYoY(tile: MacroTileData): YoY | null {
  if (tile.latestValue === null || tile.yearAgoValue === null) return null;
  const isPercent = tile.units.toLowerCase().includes('percent');
  if (isPercent) {
    return { value: tile.latestValue - tile.yearAgoValue, kind: 'pp' };
  }
  if (tile.yearAgoValue === 0) return null;
  return {
    value: ((tile.latestValue - tile.yearAgoValue) / Math.abs(tile.yearAgoValue)) * 100,
    kind: 'pct',
  };
}

export function formatYoY(y: YoY): string {
  const sign = y.value > 0 ? '+' : '';
  return `${sign}${y.value.toFixed(2)}${y.kind === 'pp' ? 'pp' : '%'}`;
}
