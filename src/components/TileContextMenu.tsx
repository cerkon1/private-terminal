import { useEffect, useRef } from 'react';

export type TileMenuItem = {
  label: string;
  /** Used for keyed rendering and as a hint for destructive styling. */
  variant?: 'default' | 'destructive';
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  /** Click coordinates (clientX/clientY) — menu is positioned at these
   *  pixels with a small offset so the cursor isn't covering the first
   *  item. Re-clamped against the viewport to keep the menu fully visible
   *  near edges. */
  x: number;
  y: number;
  items: TileMenuItem[];
  onClose: () => void;
};

/// Right-click context menu (S22). Closes on click-outside, Escape, or
/// after any item runs. Items render in order; a `destructive` variant
/// applies a red accent for purge-style actions.
export default function TileContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use mousedown so we close BEFORE the underlying click fires —
    // prevents the dashboard tile's onClick from opening the feature
    // chart when the user is just dismissing the menu.
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Clamp position so the menu doesn't render off-screen near the right
  // or bottom edges. Approximate sizes — exact would require post-render
  // measurement which adds a frame of layout shift.
  const APPROX_W = 240;
  const APPROX_H = items.length * 32 + 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const left = Math.min(x, vw - APPROX_W - 8);
  const top = Math.min(y, vh - APPROX_H - 8);

  return (
    <div
      ref={menuRef}
      className="tile-ctx-menu"
      style={{ left: `${left}px`, top: `${top}px` }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`tile-ctx-menu__item ${
            item.variant === 'destructive' ? 'tile-ctx-menu__item--destructive' : ''
          }`}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
