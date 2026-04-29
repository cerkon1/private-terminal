import {
  TickerTileData,
  TileRange,
  formatChange,
  formatPrice,
  pickChangePct,
} from '../types/sector';

type Props = {
  tile: TickerTileData;
  heatmap?: boolean;
  activeRange?: TileRange;
  onClick?: (tile: TickerTileData) => void;
};

export default function TickerTile({
  tile,
  heatmap = false,
  activeRange = '1D',
  onClick,
}: Props) {
  // 1D keeps the abs + pct format (driven by Yahoo's quote_cache). Non-1D
  // ranges are derived from price_history pct-only; show just the percent.
  const pct = pickChangePct(tile, activeRange);
  const change =
    activeRange === '1D'
      ? formatChange(tile.changeAbs24h, tile.changePct24h)
      : formatPctOnly(pct);
  const changeClass =
    change.sign > 0 ? 'yoy-up' : change.sign < 0 ? 'yoy-down' : '';
  const heatmapClass = heatmap ? heatmapBucket(pct, activeRange) : '';

  return (
    <button
      type="button"
      className={`macro-tile macro-tile--button ${heatmapClass}`}
      onClick={() => onClick?.(tile)}
    >
      <div className="macro-tile__series-id">
        {tile.ticker}
        {tile.fetchError && (
          <span className="macro-tile__error-dot" title={tile.fetchError}>
            ⚠
          </span>
        )}
      </div>
      <h2 className="macro-tile__title" title={tile.displayName ?? tile.ticker}>
        {tile.displayName ?? tile.ticker}
      </h2>
      <div className="macro-tile__value">
        {formatPrice(tile.price, tile.displayCurrency)}
      </div>
      <div className="macro-tile__meta">
        <span className={changeClass}>
          {change.text}
          <span className="macro-tile__range-tag"> {activeRange}</span>
        </span>
        <span>{tile.displayCurrency ?? ''}</span>
      </div>
    </button>
  );
}

function formatPctOnly(pct: number | null): { text: string; sign: 0 | 1 | -1 } {
  if (pct === null) return { text: '—', sign: 0 };
  const sign = pct > 0 ? 1 : pct < 0 ? -1 : 0;
  const pctStr = pct.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  });
  return { text: `${pctStr}%`, sign };
}

/** Heatmap tiers scale per range — a 1% day is a strong move, but a 1% year
 *  is nothing. Thresholds here are rough calibrations for typical asset
 *  behavior; tune later if whole grids start looking uniformly strong. */
function heatmapBucket(pct: number | null, range: TileRange): string {
  if (pct === null) return 'heatmap-neutral';
  const strong =
    range === '1D'
      ? 1.0
      : range === '1W'
        ? 3.0
        : range === '1M'
          ? 5.0
          : range === 'YTD'
            ? 15.0
            : 20.0; // 1Y
  if (pct >= strong) return 'heatmap-strong-up';
  if (pct > 0) return 'heatmap-soft-up';
  if (pct <= -strong) return 'heatmap-strong-down';
  if (pct < 0) return 'heatmap-soft-down';
  return 'heatmap-neutral';
}
