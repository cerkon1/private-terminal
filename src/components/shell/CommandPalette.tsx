import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse, { type FuseResult } from 'fuse.js';

import type { Searchable, SearchableCategory } from '../../types/palette';

type Props = {
  open: boolean;
  onClose: () => void;
  searchables: Searchable[];
};

const CATEGORY_LABEL: Record<SearchableCategory, string> = {
  ticker: 'TICKERS',
  sector: 'SECTORS',
  fred: 'FRED SERIES',
  analysis: 'ANALYSIS',
};

const CATEGORY_ORDER: SearchableCategory[] = ['ticker', 'sector', 'fred', 'analysis'];

/// Top-level Ctrl+K command palette modal. Renders a search input + ranked
/// fuzzy-matched results grouped by category. ↑↓ moves the cursor; ↵
/// invokes the selected item's action; Esc closes. Empty query renders a
/// short prompt rather than a list of all targets — keeps the modal calm
/// until the user types. (S22)
export default function CommandPalette({ open, onClose, searchables }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset query + cursor when the palette opens. Auto-focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    // Focus on the next tick so React's render commits before .focus().
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Fuse instance — rebuild when the searchables list changes (groups
  // edited / new tickers added). For ~250 items the rebuild is sub-ms.
  const fuse = useMemo(
    () =>
      new Fuse(searchables, {
        keys: [
          { name: 'primary', weight: 0.7 },
          { name: 'secondary', weight: 0.3 },
        ],
        threshold: 0.4, // moderate fuzziness; "btif" still matches "BITF.TO"
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 1,
      }),
    [searchables],
  );

  // Ranked results. Empty query → empty list (we render a prompt instead).
  // With query → top 30 fuse matches grouped by category in fixed order.
  const grouped = useMemo<{ category: SearchableCategory; items: Searchable[] }[]>(() => {
    const q = query.trim();
    if (q === '') return [];
    const results = fuse.search(q, { limit: 30 }) as FuseResult<Searchable>[];
    const byCategory = new Map<SearchableCategory, Searchable[]>();
    for (const r of results) {
      const list = byCategory.get(r.item.category) ?? [];
      list.push(r.item);
      byCategory.set(r.item.category, list);
    }
    const out: { category: SearchableCategory; items: Searchable[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = byCategory.get(cat);
      if (items && items.length > 0) out.push({ category: cat, items });
    }
    return out;
  }, [fuse, query]);

  // Flat list of items in display order — used by ↑↓ and ↵.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Clamp cursor when the result set shrinks.
  useEffect(() => {
    if (cursor >= flat.length) setCursor(Math.max(0, flat.length - 1));
  }, [flat.length, cursor]);

  // Scroll the active row into view as the cursor moves.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeRow = list.querySelector<HTMLElement>('[data-cmd-active="true"]');
    activeRow?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[cursor];
      if (item) {
        item.action();
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="cmdp-backdrop" onMouseDown={onClose}>
      <div
        className="cmdp"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="cmdp__input-wrap">
          <span className="cmdp__icon" aria-hidden>⌘K</span>
          <input
            ref={inputRef}
            className="cmdp__input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search tickers, sectors, FRED series, analysis tabs…"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="cmdp__results" ref={listRef}>
          {query.trim() === '' ? (
            <div className="cmdp__hint">
              Type to search across the app — tickers, sectors, FRED series, analysis tabs.
            </div>
          ) : flat.length === 0 ? (
            <div className="cmdp__hint">No matches.</div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="cmdp__group">
                <div className="cmdp__group-label">{CATEGORY_LABEL[group.category]}</div>
                {group.items.map((item) => {
                  const flatIdx = flat.indexOf(item);
                  const active = flatIdx === cursor;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`cmdp__row ${active ? 'cmdp__row--active' : ''}`}
                      data-cmd-active={active ? 'true' : undefined}
                      onMouseEnter={() => setCursor(flatIdx)}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                    >
                      <span className="cmdp__primary">{item.primary}</span>
                      {item.secondary && (
                        <span className="cmdp__secondary">{item.secondary}</span>
                      )}
                      {item.tertiary && (
                        <span className="cmdp__tertiary">{item.tertiary}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmdp__footer">
          <kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
