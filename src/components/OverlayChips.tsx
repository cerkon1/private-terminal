/// App-wide chart overlays — VRVP / DD / AVWAP. Distinct from per-ticker
/// `IndicatorPanel` (which is backed by `indicator_settings` SQLite rows
/// with default OFF per ticker); these toggles persist via `session.feature_chart_*`
/// KV keys and apply across all charts. Visual parity (same .indicator-chip
/// class) is intentional — user perceives all six as "things on the chart"
/// while the chip-strip separator hints at the state-shape difference.

export type Overlay = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
};

type Props = {
  overlays: Overlay[];
};

export default function OverlayChips({ overlays }: Props) {
  if (overlays.length === 0) return null;
  return (
    <div className="overlay-chips">
      {overlays.map((o) => (
        <label
          key={o.id}
          className={`indicator-chip ${o.enabled ? 'indicator-chip--on' : ''}`}
          title={o.description}
        >
          <input
            type="checkbox"
            checked={o.enabled}
            onChange={(e) => o.onToggle(e.target.checked)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
