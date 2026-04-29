import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { SectorGroup, TickerTileData } from '../types/sector';

type Props = {
  sectorGroupId: string;
  tiles: TickerTileData[];
  groups: SectorGroup[];
  onChanged: () => void;
};

type PurgeResult = {
  cascaded: boolean;
  barsDeleted: number;
  quoteDeleted: boolean;
  indicatorSettingsDeleted: number;
  newsItemsDeleted: number;
};

export default function TickerEditPanel({
  sectorGroupId,
  tiles,
  groups,
  onChanged,
}: Props) {
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [purgeCandidate, setPurgeCandidate] = useState<TickerTileData | null>(null);
  const [purging, setPurging] = useState(false);

  // Target groups for "Move to" — leaf groups (no children), enabled, not this one.
  // Parent groups aren't valid ticker homes; they collapse/expand only.
  const parentIdsWithChildren = new Set(
    groups.map((g) => g.parentId).filter((x): x is string => !!x),
  );
  const moveTargets = groups.filter(
    (g) =>
      g.enabled &&
      g.id !== sectorGroupId &&
      g.dataSource !== 'virtual' &&
      g.dataSource !== 'fred' &&
      g.dataSource !== 'mixed' &&
      !parentIdsWithChildren.has(g.id),
  );

  const handleAdd = async () => {
    setError(null);
    if (!newTicker.trim()) {
      setError('Ticker required.');
      return;
    }
    setBusy(true);
    try {
      await invoke('add_ticker', {
        input: {
          ticker: newTicker.trim(),
          sectorGroupId,
          displayName: newName.trim() || null,
          displayCurrency: newCurrency.trim() || null,
        },
      });
      setNewTicker('');
      setNewName('');
      setNewCurrency('');
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setError(null);
    setStatus(null);
    try {
      await invoke('remove_ticker', { ticker, sectorGroupId });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const confirmPurge = async () => {
    if (!purgeCandidate) return;
    setError(null);
    setStatus(null);
    setPurging(true);
    try {
      const r = await invoke<PurgeResult>('purge_ticker', {
        ticker: purgeCandidate.ticker,
        sectorGroupId,
        dataSource: purgeCandidate.dataSource,
      });
      const sym = purgeCandidate.ticker;
      if (r.cascaded) {
        const parts = [`${r.barsDeleted} bars`];
        if (r.quoteDeleted) parts.push('quote');
        if (r.indicatorSettingsDeleted > 0)
          parts.push(`${r.indicatorSettingsDeleted} indicator setting(s)`);
        if (r.newsItemsDeleted > 0) parts.push(`${r.newsItemsDeleted} news item(s)`);
        setStatus(`Purged ${sym} · ${parts.join(' · ')}`);
      } else {
        setStatus(`Removed ${sym} from this group · cached data kept (still in another group)`);
      }
      setPurgeCandidate(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setPurging(false);
    }
  };

  const handleRename = async (ticker: string, displayName: string) => {
    setError(null);
    try {
      await invoke('update_ticker', {
        input: { ticker, sectorGroupId, displayName },
      });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMove = async (ticker: string, newSectorGroupId: string) => {
    setError(null);
    try {
      await invoke('update_ticker', {
        input: { ticker, sectorGroupId, newSectorGroupId },
      });
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="edit-panel">
      <div className="edit-panel__add">
        <input
          type="text"
          className="edit-panel__input"
          placeholder="Ticker (e.g. NFLX)"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={15}
          disabled={busy}
        />
        <input
          type="text"
          className="edit-panel__input edit-panel__input--wide"
          placeholder="Display name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={80}
          disabled={busy}
        />
        <input
          type="text"
          className="edit-panel__input edit-panel__input--narrow"
          placeholder="CCY"
          value={newCurrency}
          onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={3}
          disabled={busy}
        />
        <button
          type="button"
          className="view-toggle"
          onClick={handleAdd}
          disabled={busy || !newTicker.trim()}
        >
          ADD
        </button>
      </div>
      {error && <div className="edit-panel__error">{error}</div>}
      {status && <div className="edit-panel__status">{status}</div>}
      {tiles.length === 0 ? (
        <div className="edit-panel__empty">No tickers yet. Add one above.</div>
      ) : (
        <table className="edit-panel__table">
          <thead>
            <tr>
              <th className="edit-panel__col-ticker">Symbol</th>
              <th>Display Name</th>
              <th className="edit-panel__col-currency">CCY</th>
              <th className="edit-panel__col-move">Move to</th>
              <th className="edit-panel__col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {tiles.map((t) => (
              <EditRow
                key={t.ticker}
                tile={t}
                moveTargets={moveTargets}
                onRemove={handleRemove}
                onRename={handleRename}
                onMove={handleMove}
                onPurgeRequest={(tile) => {
                  setError(null);
                  setStatus(null);
                  setPurgeCandidate(tile);
                }}
              />
            ))}
          </tbody>
        </table>
      )}
      {purgeCandidate && (
        <div
          className="modal-backdrop"
          onClick={() => !purging && setPurgeCandidate(null)}
        >
          <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Permanently delete {purgeCandidate.ticker}?</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setPurgeCandidate(null)}
                disabled={purging}
              >
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>
                This removes <strong>{purgeCandidate.ticker}</strong> from this group
                permanently. If it isn't in any other group, all of its cached data will
                be deleted too:
              </p>
              <ul className="modal__list">
                <li>Price history bars</li>
                <li>Latest quote cache</li>
                <li>Indicator settings (when no group references the ticker)</li>
                <li>Per-ticker Finnhub news (when no group references the ticker)</li>
              </ul>
              <p className="modal__danger">
                This cannot be undone. To hide the ticker without deleting its data, use
                the × button instead.
              </p>
            </div>
            <div className="modal__footer modal__footer--split">
              <button
                type="button"
                className="view-toggle"
                onClick={() => setPurgeCandidate(null)}
                disabled={purging}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="view-toggle view-toggle--danger"
                onClick={confirmPurge}
                disabled={purging}
              >
                {purging ? 'PURGING…' : 'PURGE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type RowProps = {
  tile: TickerTileData;
  moveTargets: SectorGroup[];
  onRemove: (ticker: string) => Promise<void>;
  onRename: (ticker: string, displayName: string) => Promise<void>;
  onMove: (ticker: string, newSectorGroupId: string) => Promise<void>;
  onPurgeRequest: (tile: TickerTileData) => void;
};

function EditRow({ tile, moveTargets, onRemove, onRename, onMove, onPurgeRequest }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tile.displayName ?? '');

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === tile.displayName) {
      setEditing(false);
      setDraft(tile.displayName ?? '');
      return;
    }
    await onRename(tile.ticker, trimmed);
    setEditing(false);
  };

  return (
    <tr className="edit-panel__row">
      <td
        className="edit-panel__cell-ticker"
        title="Ticker symbol can't be edited — purge and re-add to change it"
      >
        {tile.ticker}
      </td>
      <td className="edit-panel__cell-name">
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
                setDraft(tile.displayName ?? '');
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
            {tile.displayName ?? <em className="edit-panel__placeholder">(unnamed)</em>}
          </button>
        )}
      </td>
      <td
        className="edit-panel__cell-currency"
        title="Currency can't be edited after add — purge and re-add to change it"
      >
        {tile.displayCurrency ?? <span className="edit-panel__placeholder">—</span>}
      </td>
      <td className="edit-panel__cell-move">
        <select
          className="edit-panel__select"
          value=""
          onChange={(e) => {
            if (e.target.value) onMove(tile.ticker, e.target.value);
          }}
          disabled={moveTargets.length === 0}
        >
          <option value="">—</option>
          {moveTargets.map((g) => (
            <option key={g.id} value={g.id}>
              {g.displayName}
            </option>
          ))}
        </select>
      </td>
      <td className="edit-panel__cell-actions">
        <button
          type="button"
          className="edit-panel__delete"
          onClick={() => onRemove(tile.ticker)}
          title="Hide ticker from this group (cached data preserved; re-add to restore)"
        >
          ×
        </button>
        <button
          type="button"
          className="edit-panel__delete edit-panel__delete--purge"
          onClick={() => onPurgeRequest(tile)}
          title="Permanently delete ticker and (when no other group references it) all its cached data"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}
