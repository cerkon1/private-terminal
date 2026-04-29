import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../hooks/usePersistedState';
import { SectorGroup } from '../types/sector';

type Props = {
  activeId: string;
  onSelect: (sectorGroupId: string) => void;
  onManage?: () => void;
  /** Bumps when groups change elsewhere (add/remove/rename) so we re-fetch. */
  groupsVersion?: number;
};

// Sections that ship as infrastructure — always visible, always at the top,
// never user-managed. Order here is the rendered order regardless of
// each row's `display_order` in the DB.
const PINNED_IDS = ['scanner', 'analysis', 'macro', 'news'];

export default function Sidebar({ activeId, onSelect, onManage, groupsVersion }: Props) {
  const [groups, setGroups] = useState<SectorGroup[] | null>(null);
  // Expanded parent ids, persisted across sessions. `hadStoredValue=false`
  // on first-ever launch → default to expanding every parent.
  const [expanded, setExpanded, expandedStatus] = usePersistedState<Set<string>>(
    'session.sidebar_expanded',
    new Set<string>(),
    {
      serialize: (s) => JSON.stringify(Array.from(s)),
      parse: (raw) => new Set<string>(JSON.parse(raw) as string[]),
    },
  );

  useEffect(() => {
    let cancelled = false;
    invoke<SectorGroup[]>('list_sector_groups').then(g => {
      if (cancelled) return;
      setGroups(g);
    });
    return () => {
      cancelled = true;
    };
  }, [groupsVersion]);

  // First-ever launch (no stored value yet): expand every parent. Subsequent
  // launches respect the stored set verbatim — newly-created parents stay
  // collapsed until the user clicks them.
  useEffect(() => {
    if (!groups || !expandedStatus.loaded || expandedStatus.hadStoredValue) return;
    const parentIds = new Set(
      groups.filter((x) => x.parentId !== null).map((x) => x.parentId!),
    );
    setExpanded(parentIds);
  }, [groups, expandedStatus.loaded, expandedStatus.hadStoredValue, setExpanded]);

  const { pinnedRoots, userRoots, childrenByParent } = useMemo(() => {
    const pinnedRoots: SectorGroup[] = [];
    const userRoots: SectorGroup[] = [];
    const childrenByParent = new Map<string, SectorGroup[]>();
    if (!groups) return { pinnedRoots, userRoots, childrenByParent };
    const byId = new Map(groups.map((g) => [g.id, g] as const));
    for (const g of groups) {
      if (g.parentId !== null) {
        const bucket = childrenByParent.get(g.parentId) ?? [];
        bucket.push(g);
        childrenByParent.set(g.parentId, bucket);
      }
    }
    // Pinned first, in PINNED_IDS order. Skip any pinned id that doesn't
    // exist in the current group set (e.g. user soft-deleted it from DB).
    for (const id of PINNED_IDS) {
      const g = byId.get(id);
      if (g && g.parentId === null) pinnedRoots.push(g);
    }
    // User-managed roots: any other top-level group, sorted by displayOrder.
    const pinnedSet = new Set(PINNED_IDS);
    for (const g of groups) {
      if (g.parentId === null && !pinnedSet.has(g.id)) userRoots.push(g);
    }
    userRoots.sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
    return { pinnedRoots, userRoots, childrenByParent };
  }, [groups]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRoot = (g: SectorGroup) => {
    const children = childrenByParent.get(g.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(g.id);

    if (hasChildren && g.enabled) {
      return (
        <div key={g.id}>
          <button
            type="button"
            className="sidebar__item sidebar__item--parent"
            onClick={() => toggleExpand(g.id)}
          >
            <span className="sidebar__item-name">{g.displayName}</span>
            <span className="sidebar__chevron">{isExpanded ? '▾' : '▸'}</span>
          </button>
          {isExpanded &&
            children.map(c => (
              <button
                key={c.id}
                type="button"
                className={`sidebar__item sidebar__item--child ${c.id === activeId ? 'sidebar__item--active' : ''} ${c.enabled ? '' : 'sidebar__item--disabled'}`}
                onClick={() => c.enabled && onSelect(c.id)}
                disabled={!c.enabled}
              >
                <span className="sidebar__item-name">{c.displayName}</span>
              </button>
            ))}
        </div>
      );
    }

    return (
      <button
        key={g.id}
        type="button"
        className={`sidebar__item ${g.id === activeId ? 'sidebar__item--active' : ''} ${g.enabled ? '' : 'sidebar__item--disabled'}`}
        onClick={() => g.enabled && onSelect(g.id)}
        disabled={!g.enabled}
        title={g.enabled ? g.displayName : `${g.displayName} — coming in a later milestone`}
      >
        <span className="sidebar__item-name">{g.displayName}</span>
        {!g.enabled && <span className="sidebar__item-badge">soon</span>}
      </button>
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar__scroll">
        {pinnedRoots.map(renderRoot)}
        {pinnedRoots.length > 0 && userRoots.length > 0 && (
          <hr className="sidebar__separator" />
        )}
        {userRoots.map(renderRoot)}
      </div>
      {onManage && (
        <button
          type="button"
          className="sidebar__manage"
          onClick={onManage}
          title="Add / rename / delete tickers, groups, and news feeds"
        >
          <span className="sidebar__manage-icon">⚙</span>
          <span className="sidebar__item-name">Manage Watchlist</span>
        </button>
      )}
    </nav>
  );
}
