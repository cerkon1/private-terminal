import { describe, expect, it } from 'vitest';
import type { CrossSectionRow } from '../../types/cross_section';
import {
  bigMoveCount,
  delta,
  formatSnapDate,
  regimeFlipped,
  rowChanged,
  shownDelta,
  tallyChanges,
} from './pulseDelta';

const row = (over: Partial<CrossSectionRow> = {}): CrossSectionRow => ({
  ticker: 'SPY',
  displayName: null,
  sectorGroupId: 'g',
  dataSource: 'yahoo',
  isMacro: false,
  noBars: false,
  partialHistory: false,
  regime: 'BULL',
  ageDays: 10,
  level: 50,
  rsi: 50,
  atr: 50,
  vol: 50,
  ddPct: -5,
  lastFetchError: null,
  prev: null,
  ...over,
});

describe('delta', () => {
  it('is null when either side is missing', () => {
    expect(delta(null, 10)).toBeNull();
    expect(delta(10, null)).toBeNull();
    expect(delta(10, undefined)).toBeNull();
    expect(delta(60, 45)).toBe(15);
  });

  it('only shows changes at or above the noise floor', () => {
    expect(shownDelta(59, 50)).toBeNull();
    expect(shownDelta(60, 50)).toBe(10);
    expect(shownDelta(40, 50)).toBe(-10);
  });
});

describe('regime flips and big moves', () => {
  it('detects a flip only when both regimes are known and differ', () => {
    expect(regimeFlipped(row({ prev: { regime: 'BEAR' } }))).toBe(true);
    expect(regimeFlipped(row({ prev: { regime: 'BULL' } }))).toBe(false);
    expect(regimeFlipped(row({ prev: null }))).toBe(false);
    expect(regimeFlipped(row({ regime: null, prev: { regime: 'BEAR' } }))).toBe(false);
  });

  it('counts big moves across the percentile columns', () => {
    const r = row({ level: 90, rsi: 30, prev: { level: 60, rsi: 45, atr: 50, vol: null } });
    expect(bigMoveCount(r)).toBe(1); // level +30; rsi −15 is below the big-move bar
    expect(rowChanged(r)).toBe(true);
    expect(rowChanged(row({ prev: { level: 45, rsi: 55, regime: 'BULL' } }))).toBe(false);
  });

  it('tallies each ticker once even when listed in two groups', () => {
    const changed = row({ prev: { regime: 'BEAR', level: 10 } });
    const sections = [
      { id: 'a', displayName: 'A', rows: [changed] },
      { id: 'b', displayName: 'B', rows: [changed, row({ ticker: 'QQQ' })] },
    ];
    expect(tallyChanges(sections)).toEqual({ flips: 1, bigMoves: 1 });
  });
});

describe('formatSnapDate', () => {
  it('formats without timezone drift', () => {
    expect(formatSnapDate('2026-09-22')).toBe('Sep 22');
    expect(formatSnapDate('2027-01-04')).toBe('Jan 4');
    expect(formatSnapDate('garbage')).toBe('garbage');
  });
});
