import { ReactNode } from 'react';

/// App-wide chart overlays — VRVP / DD / AVWAP. Distinct from per-ticker
/// `IndicatorPanel` (which is backed by `indicator_settings` SQLite rows
/// with default OFF per ticker); these toggles persist via `session.feature_chart_*`
/// KV keys and apply across all charts. Visual parity (same .indicator-chip
/// class) is intentional — user perceives all six as "things on the chart"
/// while the chip-strip separator hints at the state-shape difference.
///
/// Optional `onSettings` opens a popover anchored to the chip via CSS
/// (parent `.indicator-chip-wrap` is position:relative; the `popover`
/// React node is rendered inside the wrap and positioned absolute).
/// Used for AVWAP's multi-anchor list — extends to other indicators that
/// gain sub-state in future (M10).

export type Overlay = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** When set, renders a ⚙ gear button next to the chip; clicking it
   *  invokes this callback (caller flips popover-open state). */
  onSettings?: () => void;
  /** Popover content rendered inside the chip wrap. Typically gated by
   *  the caller on whether the popover is open. */
  popover?: ReactNode;
};

type Props = {
  overlays: Overlay[];
};

export default function OverlayChips({ overlays }: Props) {
  if (overlays.length === 0) return null;
  return (
    <div className="overlay-chips">
      {overlays.map((o) => (
        <div key={o.id} className="indicator-chip-wrap">
          <label
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
          {o.onSettings && (
            <button
              type="button"
              className="indicator-chip__gear"
              onClick={o.onSettings}
              title={`${o.label} settings`}
              aria-label={`${o.label} settings`}
            >
              ⚙
            </button>
          )}
          {o.popover}
        </div>
      ))}
    </div>
  );
}
