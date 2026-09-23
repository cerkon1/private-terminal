import { describe, expect, it } from 'vitest';
import {
  alignToCategories,
  CandleBar,
  computeAvwap,
  computeDrawdown,
  computeVrvpBins,
  formatVolume,
  layoutGrids,
  padBounds,
  priceLowHigh,
  sliceVisibleBars,
  visibleIndexRange,
} from './candleMath';

const bar = (close: number, volume: number | null = 100, high?: number, low?: number): CandleBar => ({
  date: `d${close}`,
  open: close,
  high: high ?? close,
  low: low ?? close,
  close,
  volume,
});

describe('computeDrawdown', () => {
  it('measures from the running peak', () => {
    expect(computeDrawdown([100, 120, 90, 130])).toEqual([0, 0, -25, 0]);
  });

  it('skips non-positive closes without resetting the peak', () => {
    expect(computeDrawdown([100, 0, 50])).toEqual([0, null, -50]);
  });

  it('full-history slice keeps the old peak (the zoomed-axis bug)', () => {
    // Peak 100 outside the visible window; visible window trades 45–55.
    const full = computeDrawdown([100, 55, 45, 50]);
    const [i0, i1] = visibleIndexRange(4, { start: 25, end: 100 });
    expect(Math.min(...(full.slice(i0, i1) as number[]))).toBeCloseTo(-55);
    // Recomputing on the slice alone would have reset the peak to 55.
    expect(Math.min(...(computeDrawdown([55, 45, 50]) as number[]))).toBeCloseTo(-18.18, 2);
  });
});

describe('computeAvwap', () => {
  it('is the volume-weighted typical price from the anchor', () => {
    const bars = [bar(10, 100), bar(20, 100, 22, 18), bar(30, 300, 33, 27)];
    const out = computeAvwap(bars, 1);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeCloseTo(20); // (22+18+20)/3
    expect(out[2]).toBeCloseTo((20 * 100 + 30 * 300) / 400);
  });

  it('carries forward across zero-volume bars and is null without volume', () => {
    const out = computeAvwap([bar(10, 100), bar(50, 0), bar(10, null)], 0);
    expect(out).toEqual([10, 10, 10]);
    expect(computeAvwap([bar(10, null), bar(11, 0)], 0)).toEqual([null, null]);
  });
});

describe('visible window', () => {
  it('maps dataZoom percents to [start, end) indices', () => {
    expect(visibleIndexRange(10, { start: 0, end: 100 })).toEqual([0, 10]);
    expect(visibleIndexRange(10, { start: 50, end: 100 })).toEqual([5, 10]);
    expect(visibleIndexRange(10, { start: 60, end: 60 })).toEqual([0, 0]);
  });

  it('slices the same bars', () => {
    const bars = [1, 2, 3, 4].map((c) => bar(c));
    expect(sliceVisibleBars(bars, { start: 50, end: 100 }).map((b) => b.close)).toEqual([3, 4]);
  });
});

describe('computeVrvpBins', () => {
  it('puts the point of control on the heaviest price bin', () => {
    const bars = [bar(10, 100), bar(11, 100), bar(15.5, 1000), bar(20, 100)];
    const vrvp = computeVrvpBins(bars, 10)!;
    expect(vrvp.bins).toHaveLength(10);
    expect(vrvp.maxVolume).toBe(1000);
    expect(vrvp.pocIndex).toBe(5); // 10 + 5×1.0 ≤ 15.5 < 16
    // The top-of-range close lands in the last bin (clamped), not off the end.
    expect(vrvp.bins[9].volume).toBe(100);
    expect(vrvp.bins.reduce((s, b) => s + b.volume, 0)).toBe(1300);
  });

  it('suppresses itself when there is no volume or no range', () => {
    expect(computeVrvpBins([bar(10, null), bar(11, 0)], 10)).toBeNull();
    expect(computeVrvpBins([bar(10), bar(10)], 10)).toBeNull();
    expect(computeVrvpBins([], 10)).toBeNull();
  });
});

describe('bounds', () => {
  it('uses high/low with close fallback', () => {
    expect(priceLowHigh([bar(10, 1, 12, 9), { ...bar(20), high: null, low: null }])).toEqual({ min: 9, max: 20 });
  });

  it('pads by a fraction of the range, with a floor for flat windows', () => {
    expect(padBounds({ min: 100, max: 200 }, 0.1)).toEqual({ min: 90, max: 210 });
    const flat = padBounds({ min: 50, max: 50 }, 0.5)!;
    expect(flat.min).toBeLessThan(50);
    expect(flat.max).toBeGreaterThan(50);
    expect(padBounds(null, 0.1)).toBeNull();
  });
});

describe('alignToCategories', () => {
  it('aligns indicator points to bar dates and fills gaps with null', () => {
    const bars = [bar(1), bar(2), bar(3)];
    expect(alignToCategories(bars, [{ date: 'd3', value: 30 }, { date: 'd1', value: 10 }])).toEqual([10, null, 30]);
  });
});

describe('layoutGrids', () => {
  it('gives price the remainder and every subpane the same slim height', () => {
    const grids = layoutGrids(3);
    expect(grids.map((g) => g.height)).toEqual(['58%', '12%', '12%']);
    expect(grids[0].top).toBe('4%');
  });
});

describe('formatVolume', () => {
  it('abbreviates', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.5B');
    expect(formatVolume(2_300_000)).toBe('2.3M');
    expect(formatVolume(45_000)).toBe('45K');
    expect(formatVolume(12.4)).toBe('12');
  });
});
