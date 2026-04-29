import { MacroTileData, computeYoY, formatYoY } from '../types/macro';

type Props = {
  tile: MacroTileData;
  heatmap?: boolean;
  onClick?: (tile: MacroTileData) => void;
};

export default function MacroTile({ tile, heatmap = false, onClick }: Props) {
  const yoy = computeYoY(tile);
  const heatmapClass = heatmap ? heatmapBucket(yoy) : '';

  return (
    <button
      type="button"
      className={`macro-tile macro-tile--button ${heatmapClass}`}
      onClick={() => onClick?.(tile)}
    >
      <div className="macro-tile__series-id">
        {tile.seriesId}
        {tile.fetchError && (
          <span className="macro-tile__error-dot" title={tile.fetchError}>
            ⚠
          </span>
        )}
      </div>
      <h2 className="macro-tile__title" title={tile.title || tile.seriesId}>
        {tile.title || tile.seriesId}
      </h2>
      <div className="macro-tile__value">
        {tile.latestValue !== null ? formatValue(tile.latestValue, tile.units) : '—'}
      </div>
      <div className="macro-tile__meta">
        <span>{tile.latestObsDate ?? '—'}</span>
        <span className={yoy ? (yoy.value >= 0 ? 'yoy-up' : 'yoy-down') : ''}>
          {yoy ? `YoY ${formatYoY(yoy)}` : tile.units}
        </span>
      </div>
    </button>
  );
}

function formatValue(v: number, units: string): string {
  const u = units.toLowerCase();
  if (u.includes('percent')) return `${v.toFixed(2)}%`;
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Tiered sign+magnitude coloring. Thresholds chosen for rough visual parity
 *  across Percent (pp) and Index (%) series — 2% / 0.5pp reads as "meaningful
 *  but not extreme". Not per-series calibrated; acceptable for at-a-glance. */
function heatmapBucket(yoy: ReturnType<typeof computeYoY>): string {
  if (!yoy) return 'heatmap-neutral';
  const threshold = yoy.kind === 'pp' ? 0.5 : 2;
  if (yoy.value >= threshold) return 'heatmap-strong-up';
  if (yoy.value > 0) return 'heatmap-soft-up';
  if (yoy.value <= -threshold) return 'heatmap-strong-down';
  if (yoy.value < 0) return 'heatmap-soft-down';
  return 'heatmap-neutral';
}
