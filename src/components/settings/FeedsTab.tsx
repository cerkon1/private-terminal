import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { CATEGORY_LABELS, NewsFeed } from '../../types/news';

const REFRESH_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: 'daily' },
];

const SEEDED_CATEGORIES = ['world', 'us', 'canada', 'central_bank'];

const ID_HELP =
  'Short internal name (lowercase letters / digits / underscore, e.g. "reuters_biz"). ' +
  'Used to dedupe articles and to recover the feed if you ever re-add it. ' +
  'Cannot be changed once created.';

export default function FeedsTab() {
  const [feeds, setFeeds] = useState<NewsFeed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<NewsFeed | null>(null);

  // Add form state — RSS only, per the v1 design.
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('world');
  const [newRefresh, setNewRefresh] = useState(30);

  const reload = async () => {
    try {
      const f = await invoke<NewsFeed[]>('list_news_feeds');
      setFeeds(f);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // Categories used in any current feed, plus the seeded set, deduped.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(SEEDED_CATEGORIES);
    for (const f of feeds ?? []) {
      if (f.category) set.add(f.category);
    }
    return Array.from(set).sort();
  }, [feeds]);

  const handleAdd = async () => {
    setError(null);
    if (!newId.trim() || !newName.trim() || !newUrl.trim()) {
      setError('ID, name, and URL are required.');
      return;
    }
    setBusy(true);
    try {
      await invoke('add_news_feed', {
        input: {
          id: newId.trim(),
          sourceType: 'rss',
          url: newUrl.trim(),
          displayName: newName.trim(),
          category: newCategory,
          refreshMinutes: newRefresh,
        },
      });
      setNewId('');
      setNewName('');
      setNewUrl('');
      setNewCategory('world');
      setNewRefresh(30);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (id: string, patch: Partial<Omit<NewsFeed, 'id'>>) => {
    setError(null);
    try {
      await invoke('update_news_feed', { input: { id, ...patch } });
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const confirmDeleteFeed = async () => {
    if (!confirmDelete) return;
    setError(null);
    try {
      await invoke('delete_news_feed', { id: confirmDelete.id });
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        RSS feeds power the News dashboard. Add feeds, change categories, or
        toggle them off without losing the configuration. Deleted feeds are
        soft-removed — historical articles age out within 30 days.
      </p>

      <div className="edit-panel__add edit-panel__add--stacked">
        <div className="edit-panel__add-row">
          <input
            type="text"
            className="edit-panel__input edit-panel__input--id"
            placeholder="short_name"
            value={newId}
            onChange={(e) => setNewId(e.target.value.toLowerCase())}
            maxLength={40}
            disabled={busy}
            title={ID_HELP}
          />
          <span className="edit-panel__hint" title={ID_HELP}>
            ⓘ
          </span>
          <input
            type="text"
            className="edit-panel__input edit-panel__input--wide"
            placeholder="Display name (e.g. Reuters Business)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            disabled={busy}
          />
        </div>
        <div className="edit-panel__add-row">
          <input
            type="text"
            className="edit-panel__input edit-panel__input--wide"
            placeholder="https://example.com/feed.xml"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            maxLength={500}
            disabled={busy}
          />
          <select
            className="edit-panel__select edit-panel__select--source"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            disabled={busy}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
          <select
            className="edit-panel__select edit-panel__select--source"
            value={newRefresh}
            onChange={(e) => setNewRefresh(Number(e.target.value))}
            disabled={busy}
          >
            {REFRESH_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="view-toggle"
            onClick={handleAdd}
            disabled={busy || !newId.trim() || !newName.trim() || !newUrl.trim()}
          >
            ADD
          </button>
        </div>
      </div>

      {error && <div className="edit-panel__error">{error}</div>}

      {!feeds ? (
        <div className="macro-tile__loading">Loading feeds…</div>
      ) : feeds.length === 0 ? (
        <div className="edit-panel__empty">No feeds yet. Add one above.</div>
      ) : (
        <table className="edit-panel__table">
          <thead>
            <tr>
              <th>Display Name</th>
              <th className="edit-panel__col-currency">Type</th>
              <th>URL</th>
              <th className="edit-panel__col-category">Category</th>
              <th className="edit-panel__col-refresh">Refresh</th>
              <th className="edit-panel__col-actions edit-panel__col-actions--wide">
                On / Delete
              </th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <FeedRow
                key={f.id}
                feed={f}
                categoryOptions={categoryOptions}
                onUpdate={updateField}
                onDelete={() => setConfirmDelete(f)}
              />
            ))}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Delete {confirmDelete.displayName}?</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setConfirmDelete(null)}
              >
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>
                Removes this feed from the dispatcher. Historical articles already
                fetched will age out within 30 days. To reactivate later, add a feed
                with the same id <code>{confirmDelete.id}</code>.
              </p>
            </div>
            <div className="modal__footer modal__footer--split">
              <button
                type="button"
                className="view-toggle"
                onClick={() => setConfirmDelete(null)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="view-toggle view-toggle--danger"
                onClick={confirmDeleteFeed}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type RowProps = {
  feed: NewsFeed;
  categoryOptions: string[];
  onUpdate: (id: string, patch: Partial<Omit<NewsFeed, 'id'>>) => Promise<void>;
  onDelete: () => void;
};

function FeedRow({ feed, categoryOptions, onUpdate, onDelete }: RowProps) {
  return (
    <tr className="edit-panel__row">
      <td className="edit-panel__cell-name">
        <InlineEdit
          value={feed.displayName}
          maxLength={80}
          onCommit={(v) => onUpdate(feed.id, { displayName: v })}
          renderDisplay={(v) => v}
          title="Click to rename"
        />
      </td>
      <td className="edit-panel__cell-currency">{feed.sourceType}</td>
      <td className="edit-panel__cell-url">
        <InlineEdit
          value={feed.url ?? ''}
          maxLength={500}
          onCommit={(v) => onUpdate(feed.id, { url: v })}
          renderDisplay={(v) =>
            v ? <span className="edit-panel__url-text">{v}</span> : <em>(empty)</em>
          }
          title="Click to edit URL"
        />
      </td>
      <td>
        <select
          className="edit-panel__select"
          value={feed.category ?? ''}
          onChange={(e) => onUpdate(feed.id, { category: e.target.value })}
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="edit-panel__select"
          value={feed.refreshMinutes}
          onChange={(e) =>
            onUpdate(feed.id, { refreshMinutes: Number(e.target.value) })
          }
        >
          {REFRESH_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          {!REFRESH_OPTIONS.some((r) => r.value === feed.refreshMinutes) && (
            <option value={feed.refreshMinutes}>{feed.refreshMinutes} min</option>
          )}
        </select>
      </td>
      <td className="edit-panel__cell-actions edit-panel__cell-actions--wide">
        <input
          type="checkbox"
          checked={feed.enabled}
          onChange={(e) => onUpdate(feed.id, { enabled: e.target.checked })}
          title={feed.enabled ? 'Disable feed (kept in list)' : 'Enable feed'}
        />
        <button
          type="button"
          className="edit-panel__delete"
          onClick={onDelete}
          title="Delete feed (soft — historical articles age out)"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function InlineEdit({
  value,
  maxLength,
  onCommit,
  renderDisplay,
  title,
}: {
  value: string;
  maxLength: number;
  onCommit: (next: string) => Promise<void>;
  renderDisplay: (v: string) => React.ReactNode;
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        type="text"
        className="edit-panel__input edit-panel__input--inline"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) await onCommit(trimmed);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        maxLength={maxLength}
      />
    );
  }

  return (
    <button
      type="button"
      className="edit-panel__name-btn"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title={title}
    >
      {renderDisplay(value)}
    </button>
  );
}
