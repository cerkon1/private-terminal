// Pulse "since the previous trading day" — pure helpers (unit-tested in
// pulseDelta.test.ts). The backend attaches the previous snapshot's values
// as `row.prev`; every threshold that decides what is shown lives here.
import type { CrossSectionRow, CrossSectionSection } from '../../types/cross_section';

/** Smallest percentile-point change drawn in a cell. Below this is noise. */
export const DELTA_SHOW_POINTS = 10;
/** Change that counts as a "big move" for the CHANGES filter and banner. */
export const BIG_MOVE_POINTS = 20;

const PERCENTILE_KEYS = ['level', 'rsi', 'atr', 'vol'] as const;
export type PercentileKey = (typeof PERCENTILE_KEYS)[number];

/** Percentile-point change, or null when either side is missing. */
export function delta(cur: number | null, prev: number | null | undefined): number | null {
  if (cur == null || prev == null) return null;
  return cur - prev;
}

/** The change to draw in a cell, or null when it's below the noise floor. */
export function shownDelta(cur: number | null, prev: number | null | undefined): number | null {
  const d = delta(cur, prev);
  return d != null && Math.abs(d) >= DELTA_SHOW_POINTS ? d : null;
}

export function regimeFlipped(row: CrossSectionRow): boolean {
  const before = row.prev?.regime;
  return before != null && row.regime != null && before !== row.regime;
}

export function bigMoveCount(row: CrossSectionRow): number {
  if (!row.prev) return 0;
  return PERCENTILE_KEYS.filter((k) => {
    const d = delta(row[k], row.prev?.[k]);
    return d != null && Math.abs(d) >= BIG_MOVE_POINTS;
  }).length;
}

/** CHANGES filter: a regime flip or at least one big percentile move. */
export function rowChanged(row: CrossSectionRow): boolean {
  return regimeFlipped(row) || bigMoveCount(row) > 0;
}

/** Banner tallies. A ticker listed in several groups is counted once. */
export function tallyChanges(sections: CrossSectionSection[]): { flips: number; bigMoves: number } {
  const seen = new Set<string>();
  let flips = 0;
  let bigMoves = 0;
  for (const s of sections) {
    for (const r of s.rows) {
      const key = `${r.ticker}:${r.dataSource}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (regimeFlipped(r)) flips++;
      if (bigMoveCount(r) > 0) bigMoves++;
    }
  }
  return { flips, bigMoves };
}

/** '2026-09-22' → 'Sep 22' (UTC-safe: parses the date parts, not a Date). */
export function formatSnapDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!m || !d || m < 1 || m > 12) return iso;
  return `${months[m - 1]} ${d}`;
}
