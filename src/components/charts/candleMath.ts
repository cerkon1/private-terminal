// Pure data + layout math for FeatureChart — no React, no ECharts, no theme.
// Split out so it can be unit-tested (candleMath.test.ts).
import type { IndicatorOutput, IndicatorSeriesPoint } from '../../types/indicator';

export type LineObservation = { date: string; value: number };
export type CandleBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export function layoutGrids(paneCount: number): { left: number; right: number; top: string; height: string }[] {
  // Vertical budget (percent of chart area; ~14% reserved at bottom for the
  // dataZoom slider). Non-price panes each get a fixed slim height; price
  // pane absorbs whatever's left. Toggling a pane off (e.g. VOL → hidden)
  // returns its full height to price rather than just freeing the inter-pane
  // gap. Keeps the price chart usable regardless of how many subpanes are on.
  const sliderReserve = 14;
  const usable = 100 - sliderReserve;
  const gapBetween = 2;
  const otherPaneCount = Math.max(0, paneCount - 1);
  const otherPaneHeight = 12; // slim, matches volume's typical ECharts proportions
  const totalGaps = gapBetween * Math.max(0, paneCount - 1);
  const priceHeight = Math.max(
    24, // floor — never starve price below readable
    usable - totalGaps - otherPaneHeight * otherPaneCount,
  );

  const grids: { left: number; right: number; top: string; height: string }[] = [];
  let cursor = 4; // percent from top (leaves space for legend)
  for (let i = 0; i < paneCount; i++) {
    const h = i === 0 ? priceHeight : otherPaneHeight;
    grids.push({
      left: 60,
      right: 24,
      top: `${cursor}%`,
      height: `${h}%`,
    });
    cursor += h + gapBetween;
  }
  return grids;
}

/** ECharts category axes match x by *index*, not by label. We map indicator
 *  series into an aligned Vec<Option<number>> by date so the lines render
 *  at the right x position for every bar. Missing dates become nulls. */
export function alignToCategories(bars: CandleBar[], pts: IndicatorSeriesPoint[]): (number | null)[] {
  const byDate = new Map<string, number | null>();
  for (const p of pts) byDate.set(p.date, p.value);
  return bars.map((b) => byDate.get(b.date) ?? null);
}

export function formatValue(v: number, units: string): string {
  const u = units.toLowerCase();
  if (u.includes('percent')) return `${v.toFixed(2)}%`;
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Decimal scaling for the candlestick tooltip — mirrors formatPrice() in
// types/sector.ts so chart hover matches tile precision. Applies to every
// numeric series in the candle chart (OHLC, indicators, volume), so the
// magnitude tiers fall through cleanly: large volume ints render with no
// decimals, RSI lands at 4dp (slightly noisier than 2dp but readable),
// sub-cent crypto gets 6dp.
export function formatTickerValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs >= 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs === 0) return '0';
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

/** Drawdown % from running peak. For each close[i], computes
 *  (close[i] / max(close[0..i]) - 1) * 100. Always ≤ 0. Skips
 *  non-positive closes (would invert the percent calculation). */
export function computeDrawdown(closes: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let peak = -Infinity;
  for (const c of closes) {
    if (!Number.isFinite(c) || c <= 0) {
      out.push(null);
      continue;
    }
    if (c > peak) peak = c;
    out.push(peak > 0 ? (c / peak - 1) * 100 : null);
  }
  return out;
}

/** Anchored VWAP from anchorIdx forward. Pre-anchor bars get null; from
 *  anchorIdx onward, AVWAP[i] = Σ(typical_price[j] × volume[j]) / Σ(volume[j])
 *  where typical_price = (h + l + c) / 3 and the sums run from anchor to i.
 *  Bars with missing OHLC or null/zero volume contribute nothing but don't
 *  break the cumulative state — line carries forward the last valid value.
 *  All-null result for tickers with no volume; caller skips series push. */
export function computeAvwap(bars: CandleBar[], anchorIdx: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPv = 0;
  let cumV = 0;
  for (let i = anchorIdx; i < bars.length; i++) {
    const b = bars[i];
    const v = b.volume ?? 0;
    const h = b.high ?? b.close;
    const l = b.low ?? b.close;
    const c = b.close;
    if (Number.isFinite(c) && v > 0 && Number.isFinite(h) && Number.isFinite(l)) {
      const tp = (h + l + c) / 3;
      cumPv += tp * v;
      cumV += v;
    }
    out[i] = cumV > 0 ? cumPv / cumV : null;
  }
  return out;
}

/** [start, end) bar indices covered by the dataZoom percent range. */
export function visibleIndexRange(length: number, range: { start: number; end: number }): [number, number] {
  const i0 = Math.max(0, Math.floor((range.start / 100) * length));
  const i1 = Math.min(length, Math.ceil((range.end / 100) * length));
  return i1 <= i0 ? [0, 0] : [i0, i1];
}

/** Bars currently visible per the dataZoom start/end percent. */
export function sliceVisibleBars(bars: CandleBar[], range: { start: number; end: number }): CandleBar[] {
  if (bars.length === 0) return bars;
  const [i0, i1] = visibleIndexRange(bars.length, range);
  return bars.slice(i0, i1);
}

export function priceLowHigh(bars: CandleBar[]): { min: number; max: number } | null {
  if (bars.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const b of bars) {
    const lo = b.low ?? b.close;
    const hi = b.high ?? b.close;
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min, max };
}

export function subpaneSeriesLowHigh(
  bars: CandleBar[],
  ind: IndicatorOutput,
): { min: number; max: number } | null {
  if (bars.length === 0) return null;
  const dateSet = new Set(bars.map((b) => b.date));
  let min = Infinity;
  let max = -Infinity;
  for (const s of ind.series) {
    for (const p of s.data) {
      if (!dateSet.has(p.date)) continue;
      if (p.value === null) continue;
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min, max };
}

// Volume Profile bin computation. Buckets total volume by close-price into
// N equal-width bins across the visible price range. Returns null when the
// visible window has no volume (e.g. DXY / FX) so the caller auto-suppresses
// the overlay regardless of the toggle state.
export type VrvpBin = { priceLow: number; priceHigh: number; midPrice: number; volume: number; barCount: number };

export type VrvpData = { bins: VrvpBin[]; pocIndex: number; maxVolume: number; binWidth: number };

export function computeVrvpBins(visibleBars: CandleBar[], binCount: number): VrvpData | null {
  if (visibleBars.length === 0) return null;
  const bounds = priceLowHigh(visibleBars);
  if (!bounds) return null;
  const { min, max } = bounds;
  const range = max - min;
  if (range <= 0) return null;
  const binWidth = range / binCount;
  const bins: VrvpBin[] = Array.from({ length: binCount }, (_, i) => ({
    priceLow: min + i * binWidth,
    priceHigh: min + (i + 1) * binWidth,
    midPrice: min + (i + 0.5) * binWidth,
    volume: 0,
    barCount: 0,
  }));
  for (const bar of visibleBars) {
    const v = bar.volume ?? 0;
    if (v <= 0) continue;
    let idx = Math.floor((bar.close - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].volume += v;
    bins[idx].barCount += 1;
  }
  let maxVolume = 0;
  let pocIndex = 0;
  bins.forEach((b, i) => {
    if (b.volume > maxVolume) {
      maxVolume = b.volume;
      pocIndex = i;
    }
  });
  if (maxVolume <= 0) return null; // no volume in visible window — auto-suppress
  return { bins, pocIndex, maxVolume, binWidth };
}

/** Add headroom above/below the data extent so candles/lines don't kiss the
 *  pane edges. Padding is a fraction of the range, with a small floor so
 *  flat windows still get visible breathing room. */
export function padBounds(
  bounds: { min: number; max: number } | null,
  padFraction: number,
): { min: number; max: number } | null {
  if (!bounds) return null;
  const { min, max } = bounds;
  const range = Math.max(max - min, Math.abs(max) * 0.001);
  const pad = range * padFraction;
  return { min: min - pad, max: max + pad };
}
