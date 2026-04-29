import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import FeedsTab from './settings/FeedsTab';
import TickerEditPanel from './TickerEditPanel';
import { usePersistedState } from '../hooks/usePersistedState';
import { SectorGroup, TickerTileData } from '../types/sector';

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

type TabId = 'tickers' | 'groups' | 'feeds';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'tickers', label: 'Tickers' },
  { id: 'groups', label: 'Groups' },
  { id: 'feeds', label: 'News Feeds' },
];

// Sources offered when creating a NEW group. Today only Yahoo has a working
// fetcher pipeline — CoinGecko is parked for v1.1 even though some seed
// rows (CRYPTO) carry `data_source='coingecko'` for historical reasons.
const NEW_GROUP_SOURCES = ['yahoo'];

// Sources counted as "user-editable" for the Groups table and Tickers picker.
// Includes 'coingecko' so existing groups still appear and remain manageable
// even though new ones can't be created with that source today.
const EDITABLE_SOURCE_SET = new Set(['yahoo', 'coingecko']);

const ID_HELP =
  'Short internal name (lowercase letters / digits / underscore, e.g. "ca_energy"). ' +
  'Used to organise the watchlist tree. Cannot be changed once created — ' +
  'tickers in this group are linked to it by id.';

export default function ManageWatchlistModal({ onClose, onChanged }: Props) {
  const [tab, setTab] = useState<TabId>('tickers');
  const [groups, setGroups] = useState<SectorGroup[]>([]);

  const reloadGroups = async () => {
    try {
      const g = await invoke<SectorGroup[]>('list_sector_groups');
      setGroups(g);
    } catch {
      // surface in subtabs via their own error handling
    }
  };

  useEffect(() => {
    reloadGroups();
  }, []);

  const handleChanged = () => {
    reloadGroups();
    onChanged();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Manage Watchlist</h2>
          <button type="button" className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tab-strip">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-strip__tab ${tab === t.id ? 'tab-strip__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal__body">
          {tab === 'tickers' && (
            <TickersTab groups={groups} onChanged={handleChanged} />
          )}
          {tab === 'groups' && (
            <GroupsTab groups={groups} onChanged={handleChanged} />
          )}
          {tab === 'feeds' && <FeedsTab />}
        </div>

        <div className="modal__footer">
          <button type="button" className="view-toggle" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────── Tickers tab ────────────

function TickersTab({
  groups,
  onChanged,
}: {
  groups: SectorGroup[];
  onChanged: () => void;
}) {
  // Eligible groups for ticker editing: leaves (no children), enabled,
  // ticker-shaped data source. Parent containers like CA EQUITIES don't
  // hold tickers themselves and are excluded.
  const tickerableGroups = useMemo(() => {
    const parentIdsWithChildren = new Set(
      groups.map((g) => g.parentId).filter((x): x is string => !!x),
    );
    return groups.filter(
      (g) =>
        g.enabled &&
        EDITABLE_SOURCE_SET.has(g.dataSource) &&
        !parentIdsWithChildren.has(g.id),
    );
  }, [groups]);

  // Sorted view of options (top-level first, then children indented under
  // their parent in label form "PARENT › Child").
  const sortedOptions = useMemo(() => {
    const tops = tickerableGroups
      .filter((g) => !g.parentId)
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const childrenByParent = new Map<string, SectorGroup[]>();
    for (const g of tickerableGroups) {
      if (!g.parentId) continue;
      const bucket = childrenByParent.get(g.parentId) ?? [];
      bucket.push(g);
      childrenByParent.set(g.parentId, bucket);
    }
    const result: SectorGroup[] = [];
    const seen = new Set<string>();
    for (const top of tops) {
      result.push(top);
      seen.add(top.id);
      const kids = (childrenByParent.get(top.id) ?? [])
        .slice()
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      for (const k of kids) {
        result.push(k);
        seen.add(k.id);
      }
    }
    // Orphaned children (parent filtered out) — append by displayOrder.
    for (const g of tickerableGroups) {
      if (!seen.has(g.id)) result.push(g);
    }
    return result;
  }, [tickerableGroups]);

  const labelFor = (g: SectorGroup) => {
    if (!g.parentId) return g.displayName;
    const parent = groups.find((p) => p.id === g.parentId);
    return parent ? `${parent.displayName} › ${g.displayName}` : g.displayName;
  };

  const [selectedId, setSelectedId] = usePersistedState<string>(
    'session.manage_watchlist_group',
    '',
  );

  // Once groups arrive, fall back to the first eligible group when the
  // persisted value is empty or no longer points to an editable group.
  useEffect(() => {
    if (tickerableGroups.length === 0) return;
    if (!selectedId || !tickerableGroups.some((g) => g.id === selectedId)) {
      setSelectedId(tickerableGroups[0].id);
    }
  }, [tickerableGroups, selectedId, setSelectedId]);

  const [tiles, setTiles] = useState<TickerTileData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchTiles = async (groupId: string) => {
    if (!groupId) {
      setTiles([]);
      return;
    }
    try {
      const data = await invoke<TickerTileData[]>('list_ticker_tiles', {
        sectorGroupId: groupId,
        force: false,
      });
      setTiles(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e));
    }
  };

  useEffect(() => {
    setTiles(null);
    fetchTiles(selectedId);
  }, [selectedId]);

  const reloadAfterEdit = () => {
    fetchTiles(selectedId);
    onChanged();
  };

  if (tickerableGroups.length === 0) {
    return (
      <div className="edit-panel__empty">
        No editable groups yet. Create one in the Groups tab first.
      </div>
    );
  }

  return (
    <div className="manage-watchlist__tickers">
      <div className="manage-watchlist__group-picker">
        <span className="manage-watchlist__picker-label">Group</span>
        <select
          className="edit-panel__select manage-watchlist__picker-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {sortedOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {labelFor(g)}
            </option>
          ))}
        </select>
      </div>
      {loadError && <div className="edit-panel__error">{loadError}</div>}
      {!tiles ? (
        <div className="macro-tile__loading">Loading tickers…</div>
      ) : (
        <TickerEditPanel
          sectorGroupId={selectedId}
          tiles={tiles}
          groups={groups}
          onChanged={reloadAfterEdit}
        />
      )}
    </div>
  );
}

// ──────────── Groups tab ────────────

function GroupsTab({
  groups,
  onChanged,
}: {
  groups: SectorGroup[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('yahoo');
  const [newParent, setNewParent] = useState<string>('');

  // Eligible parents for the Add form and for reparent dropdowns:
  // ticker-source top-level groups only (2-level cap).
  const parentOptions = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.parentId === null &&
          g.enabled &&
          EDITABLE_SOURCE_SET.has(g.dataSource),
      ),
    [groups],
  );

  // Tree-flatten the editable subset for table display (infrastructure
  // groups are hidden — they ship pinned at the sidebar top, not editable).
  const orderedRows = useMemo(() => {
    const editable = groups.filter((g) =>
      EDITABLE_SOURCE_SET.has(g.dataSource),
    );
    const byParent = new Map<string | null, SectorGroup[]>();
    for (const g of editable) {
      const bucket = byParent.get(g.parentId) ?? [];
      bucket.push(g);
      byParent.set(g.parentId, bucket);
    }
    const sortByOrder = (a: SectorGroup, b: SectorGroup) =>
      (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    const tops = (byParent.get(null) ?? []).slice().sort(sortByOrder);
    const rows: Array<SectorGroup & { depth: number }> = [];
    for (const t of tops) {
      rows.push({ ...t, depth: 0 });
      const kids = (byParent.get(t.id) ?? []).slice().sort(sortByOrder);
      for (const k of kids) rows.push({ ...k, depth: 1 });
    }
    return rows;
  }, [groups]);

  // Per-parent sibling order, used to compute boundary disable for ↑/↓.
  const siblingsOrderByParent = useMemo(() => {
    const map = new Map<string | null, string[]>();
    const groupedSiblings = new Map<string | null, SectorGroup[]>();
    for (const g of orderedRows) {
      const bucket = groupedSiblings.get(g.parentId) ?? [];
      bucket.push(g);
      groupedSiblings.set(g.parentId, bucket);
    }
    for (const [k, v] of groupedSiblings.entries()) {
      v.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      map.set(k, v.map((g) => g.id));
    }
    return map;
  }, [orderedRows]);

  const handleAdd = async () => {
    setError(null);
    if (!newId.trim() || !newName.trim()) {
      setError('ID and display name required.');
      return;
    }
    setBusy(true);
    try {
      await invoke('create_sector_group', {
        input: {
          id: newId.trim(),
          parentId: newParent || null,
          displayName: newName.trim(),
          dataSource: newSource,
        },
      });
      setNewId('');
      setNewName('');
      setNewParent('');
      setNewSource('yahoo');
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string, displayName: string) => {
    setError(null);
    try {
      await invoke('update_sector_group', { input: { id, displayName } });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await invoke('delete_sector_group', { id });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReparent = async (id: string, newParentId: string | null) => {
    setError(null);
    try {
      await invoke('update_sector_group', {
        input: { id, newParentId },
      });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const row = groups.find((g) => g.id === id);
    if (!row) return;
    const siblings = groups
      .filter((g) => g.parentId === row.parentId)
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const idx = siblings.findIndex((g) => g.id === id);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= siblings.length) return;
    const neighbor = siblings[neighborIdx];
    const a = row.displayOrder ?? idx;
    const b = neighbor.displayOrder ?? neighborIdx;
    setError(null);
    try {
      await invoke('reorder_sector_groups', {
        entries: [
          { id: row.id, displayOrder: b },
          { id: neighbor.id, displayOrder: a },
        ],
      });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="manage-watchlist__groups">
      <div className="edit-panel__add">
        <input
          type="text"
          className="edit-panel__input edit-panel__input--id"
          placeholder="short_name"
          value={newId}
          onChange={(e) => setNewId(e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={40}
          disabled={busy}
          title={ID_HELP}
        />
        <span className="edit-panel__hint" title={ID_HELP}>
          ⓘ
        </span>
        <input
          type="text"
          className="edit-panel__input"
          placeholder="Display Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={80}
          disabled={busy}
        />
        <select
          className="edit-panel__select edit-panel__select--source"
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
          disabled={busy}
        >
          {NEW_GROUP_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="edit-panel__select edit-panel__select--parent"
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
          disabled={busy}
        >
          <option value="">— top level —</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              under {p.displayName}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="view-toggle"
          onClick={handleAdd}
          disabled={busy || !newId.trim() || !newName.trim()}
        >
          ADD
        </button>
      </div>

      {error && <div className="edit-panel__error">{error}</div>}

      {orderedRows.length === 0 ? (
        <div className="edit-panel__empty">No editable groups yet.</div>
      ) : (
        <table className="edit-panel__table">
          <thead>
            <tr>
              <th>Display Name</th>
              <th className="edit-panel__col-ticker">ID</th>
              <th className="edit-panel__col-currency">Source</th>
              <th className="edit-panel__col-move">Move Under</th>
              <th className="edit-panel__col-actions edit-panel__col-actions--wide"></th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((g) => {
              const siblings = siblingsOrderByParent.get(g.parentId) ?? [];
              const idx = siblings.indexOf(g.id);
              const atTop = idx <= 0;
              const atBottom = idx >= siblings.length - 1;
              const moveTargets = parentOptions.filter((p) => p.id !== g.id);
              return (
                <GroupRow
                  key={g.id}
                  group={g}
                  moveTargets={moveTargets}
                  atTop={atTop}
                  atBottom={atBottom}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onReparent={handleReparent}
                  onMove={handleMove}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

type GroupRowProps = {
  group: SectorGroup & { depth: number };
  moveTargets: SectorGroup[];
  atTop: boolean;
  atBottom: boolean;
  onRename: (id: string, displayName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReparent: (id: string, newParentId: string | null) => Promise<void>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>;
};

function GroupRow({
  group,
  moveTargets,
  atTop,
  atBottom,
  onRename,
  onDelete,
  onReparent,
  onMove,
}: GroupRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.displayName);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === group.displayName) {
      setEditing(false);
      setDraft(group.displayName);
      return;
    }
    await onRename(group.id, trimmed);
    setEditing(false);
  };

  const indent =
    group.depth > 0 ? { paddingLeft: 'calc(var(--space-lg) * 2)' } : {};

  const reparentValue = group.parentId ?? '';

  return (
    <tr className="edit-panel__row">
      <td style={indent}>
        {editing ? (
          <input
            type="text"
            className="edit-panel__input edit-panel__input--inline"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(group.displayName);
                setEditing(false);
              }
            }}
            maxLength={80}
          />
        ) : (
          <button
            type="button"
            className="edit-panel__name-btn"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {group.depth > 0 ? '↳ ' : ''}
            {group.displayName}
          </button>
        )}
      </td>
      <td className="edit-panel__cell-ticker">{group.id}</td>
      <td className="edit-panel__cell-currency">{group.dataSource}</td>
      <td className="edit-panel__cell-move">
        <select
          className="edit-panel__select"
          value={reparentValue}
          onChange={(e) =>
            onReparent(group.id, e.target.value === '' ? null : e.target.value)
          }
          title="Move this group under another top-level group, or back to top level"
        >
          <option value="">— top level —</option>
          {moveTargets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </td>
      <td className="edit-panel__cell-actions edit-panel__cell-actions--wide">
        <button
          type="button"
          className="edit-panel__delete"
          onClick={() => onMove(group.id, 'up')}
          disabled={atTop}
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          className="edit-panel__delete"
          onClick={() => onMove(group.id, 'down')}
          disabled={atBottom}
          title="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          className="edit-panel__delete"
          onClick={() => onDelete(group.id)}
          title="Delete group (must have no tickers and no children)"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
