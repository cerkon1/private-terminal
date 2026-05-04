import { useEffect, useRef } from 'react';

type Bar = {
  date: string;
  high: number | null;
  low: number | null;
  close: number;
};

type Props = {
  anchors: string[];
  /** Cap shown in the header — informational. Caller enforces by ignoring
   *  clicks beyond `cap`. */
  cap: number;
  /** Bars from the active ticker — used to compute typical_price (h+l+c)/3
   *  per anchor for the list display. Falls back to close if h/l null. */
  bars: Bar[];
  onRemove: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
};

/// Popover anchored beneath the AVWAP chip via CSS (parent is
/// `.indicator-chip-wrap` with position:relative; this is position:absolute).
/// Closes on click-outside via mousedown capture (matches TileContextMenu
/// pattern, S22 — capture phase ensures we close BEFORE any underlying click
/// triggers a different action).
export default function AvwapAnchorsPopover({
  anchors,
  cap,
  bars,
  onRemove,
  onClear,
  onClose,
}: Props) {
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const priceFor = (date: string): number | null => {
    const bar = bars.find((b) => b.date === date);
    if (!bar) return null;
    if (bar.high != null && bar.low != null) {
      return (bar.high + bar.low + bar.close) / 3;
    }
    return bar.close;
  };

  const fmtPrice = (v: number | null): string => {
    if (v === null) return '—';
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div ref={popRef} className="avwap-popover" role="dialog">
      <div className="avwap-popover__header">
        Anchors ({anchors.length}/{cap})
      </div>
      {anchors.length === 0 && (
        <div className="avwap-popover__empty">
          Click any bar on the chart to add an anchor.
        </div>
      )}
      {anchors.length > 0 && (
        <ul className="avwap-popover__list">
          {anchors.map((date) => (
            <li key={date} className="avwap-popover__row">
              <span className="avwap-popover__bullet" aria-hidden="true">●</span>
              <span className="avwap-popover__date">{date}</span>
              <span className="avwap-popover__price">${fmtPrice(priceFor(date))}</span>
              <button
                type="button"
                className="avwap-popover__remove"
                onClick={() => onRemove(date)}
                title="Remove this anchor"
                aria-label={`Remove anchor at ${date}`}
              >
                ×
              </button>
            </li>
          ))}
          {anchors.length < cap && (
            <li className="avwap-popover__hint">
              <span className="avwap-popover__bullet avwap-popover__bullet--dim" aria-hidden="true">○</span>
              <span>Click chart to add another</span>
            </li>
          )}
        </ul>
      )}
      {anchors.length > 0 && (
        <div className="avwap-popover__footer">
          <button
            type="button"
            className="avwap-popover__clear"
            onClick={onClear}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
