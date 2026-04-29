import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { DbInfo, formatBytes, formatSignedBytes } from '../../types/system';

type StorageStats = {
  priceHistoryRows: number;
  quoteCacheRows: number;
  indicatorSettingsRows: number;
  newsItemsRows: number;
  watchlistVisible: number;
  watchlistHidden: number;
};

type MaintenanceResult = {
  beforeBytes: number;
  afterBytes: number;
  integrityOk: boolean;
  integrityMessage: string;
  walFramesCheckpointed: number;
  walCheckpointBlocked: boolean;
  durationMs: number;
};

type PurgeOrphansResult = {
  priceHistoryRows: number;
  quoteCacheRows: number;
  indicatorSettingsRows: number;
  newsItemsRows: number;
};

type BackupResult = {
  destinationPath: string;
  bytes: number;
};

type MoveResult = {
  newPath: string;
  oldPath: string;
  bytes: number;
};

export default function StorageTab() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maint, setMaint] = useState<MaintenanceResult | null>(null);
  const [purge, setPurge] = useState<PurgeOrphansResult | null>(null);
  const [maintBusy, setMaintBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [moveResult, setMoveResult] = useState<MoveResult | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [confirmMoveDest, setConfirmMoveDest] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [i, s] = await Promise.all([
        invoke<DbInfo>('get_db_info'),
        invoke<StorageStats>('get_storage_stats'),
      ]);
      setInfo(i);
      setStats(s);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const runMaintenance = async () => {
    setError(null);
    setMaint(null);
    setMaintBusy(true);
    try {
      const r = await invoke<MaintenanceResult>('db_maintenance');
      setMaint(r);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setMaintBusy(false);
    }
  };

  const runPurgeOrphans = async () => {
    setError(null);
    setPurge(null);
    setPurgeBusy(true);
    try {
      const r = await invoke<PurgeOrphansResult>('purge_orphaned_data');
      setPurge(r);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setPurgeBusy(false);
    }
  };

  const pickFolder = async (title: string): Promise<string | null> => {
    const sel = await open({ directory: true, multiple: false, title });
    if (!sel) return null;
    return Array.isArray(sel) ? sel[0] : sel;
  };

  const runBackup = async () => {
    setError(null);
    setBackupResult(null);
    try {
      const dest = await pickFolder('Choose a folder for the backup copy');
      if (!dest) return;
      setBackupBusy(true);
      const r = await invoke<BackupResult>('backup_database', {
        destination: dest,
      });
      setBackupResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBackupBusy(false);
    }
  };

  const requestMove = async () => {
    setError(null);
    setMoveResult(null);
    try {
      const dest = await pickFolder('Choose a new folder for the database');
      if (!dest) return;
      setConfirmMoveDest(dest);
    } catch (e) {
      setError(String(e));
    }
  };

  const confirmMove = async () => {
    if (!confirmMoveDest) return;
    setMoveBusy(true);
    setError(null);
    try {
      const r = await invoke<MoveResult>('move_database', {
        destination: confirmMoveDest,
      });
      setMoveResult(r);
      setConfirmMoveDest(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setMoveBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        Disk + maintenance for the local SQLite database. Run maintenance after
        heavy use or after deleting tickers / feeds. Sweep orphans to drop cached
        data for tickers that were hidden but never permanently deleted.
      </p>

      <div className="settings-subhead">Database</div>
      <div className="storage-grid">
        <StorageRow label="Path" value={info?.path ?? '—'} mono />
        <StorageRow
          label="Total on disk"
          value={
            info
              ? `${formatBytes(info.sizeBytes)} ` +
                `(main ${formatBytes(info.mainBytes)} · WAL ${formatBytes(info.walBytes)})`
              : '—'
          }
        />
        {stats && (
          <>
            <StorageRow
              label="Price-history rows"
              value={stats.priceHistoryRows.toLocaleString()}
            />
            <StorageRow
              label="Quote-cache rows"
              value={stats.quoteCacheRows.toLocaleString()}
            />
            <StorageRow
              label="News items"
              value={stats.newsItemsRows.toLocaleString()}
            />
            <StorageRow
              label="Indicator settings"
              value={stats.indicatorSettingsRows.toLocaleString()}
            />
            <StorageRow
              label="Watchlist (visible / hidden)"
              value={`${stats.watchlistVisible} / ${stats.watchlistHidden}`}
            />
          </>
        )}
      </div>

      <div className="settings-subhead">Database location</div>
      <p className="storage-help">
        SQLite stores this database as <strong>three</strong> files:{' '}
        <code>.db</code>, <code>.db-wal</code>, and <code>.db-shm</code>. To
        copy by hand, close the app, then either copy all three together — or
        run <strong>Backup copy</strong> below, which folds the WAL into the
        main file first and writes a single self-contained <code>.db</code> at
        the location you choose.
      </p>
      <div className="settings-actions storage-actions">
        <button
          type="button"
          className="view-toggle"
          onClick={runBackup}
          disabled={backupBusy || moveBusy}
        >
          {backupBusy ? 'COPYING…' : 'BACKUP COPY…'}
        </button>
        <button
          type="button"
          className="view-toggle"
          onClick={requestMove}
          disabled={backupBusy || moveBusy}
        >
          {moveBusy ? 'MOVING…' : 'CHANGE LOCATION…'}
        </button>
      </div>
      {backupResult && (
        <div className="storage-result">
          Backup written: <span className="mono">{backupResult.destinationPath}</span> ·{' '}
          {formatBytes(backupResult.bytes)}
        </div>
      )}
      {moveResult && (
        <div className="storage-result">
          Database now at <span className="mono">{moveResult.newPath}</span> ·{' '}
          {formatBytes(moveResult.bytes)}. Old files left at{' '}
          <span className="mono">{moveResult.oldPath}</span> — delete manually
          once you've verified the new location works.
        </div>
      )}

      <div className="settings-subhead">Run maintenance</div>
      <p className="storage-help">
        Runs <code>integrity_check</code>, <code>wal_checkpoint(TRUNCATE)</code>,
        and <code>VACUUM</code>. The total footprint only shrinks when you've
        actually deleted rows (purged tickers, swept orphans, news older than
        30 days). Otherwise the WAL just merges into the main file —{' '}
        <em>main grows, WAL drops, total stays the same</em>. The app briefly
        locks the database while it runs.
      </p>
      <div className="settings-actions">
        <button
          type="button"
          className="view-toggle"
          onClick={runMaintenance}
          disabled={maintBusy || purgeBusy}
        >
          {maintBusy ? 'RUNNING…' : 'RUN MAINTENANCE'}
        </button>
      </div>
      {maint && (
        <div className="storage-result">
          <strong>{maint.integrityOk ? 'Integrity ok' : 'Integrity FAIL'}</strong>
          {!maint.integrityOk && <> · {maint.integrityMessage}</>}
          <> · {formatBytes(maint.beforeBytes)} → {formatBytes(maint.afterBytes)}</>
          <> ({formatSignedBytes(maint.afterBytes - maint.beforeBytes)})</>
          <> · {maint.walFramesCheckpointed.toLocaleString()} WAL frames</>
          {maint.walCheckpointBlocked && <> · WAL truncate blocked by reader</>}
          <> · {maint.durationMs} ms</>
        </div>
      )}

      <div className="settings-subhead">Sweep orphaned data</div>
      <p className="storage-help">
        Deletes <code>price_history</code>, <code>quote_cache</code>,{' '}
        <code>indicator_settings</code>, and per-ticker <code>news_items</code>{' '}
        rows for tickers no longer in any visible watchlist. Use this after
        renaming groups or hiding tickers without using the 🗑 Permanent Delete
        action. Run maintenance after to reclaim the freed space.
      </p>
      <div className="settings-actions">
        <button
          type="button"
          className="view-toggle"
          onClick={runPurgeOrphans}
          disabled={maintBusy || purgeBusy}
        >
          {purgeBusy ? 'SWEEPING…' : 'SWEEP ORPHANS'}
        </button>
      </div>
      {purge && (
        <div className="storage-result">
          Removed{' '}
          <strong>{purge.priceHistoryRows.toLocaleString()}</strong> bars,{' '}
          <strong>{purge.quoteCacheRows.toLocaleString()}</strong> quotes,{' '}
          <strong>{purge.indicatorSettingsRows.toLocaleString()}</strong>{' '}
          indicator setting(s),{' '}
          <strong>{purge.newsItemsRows.toLocaleString()}</strong> news item(s).
        </div>
      )}

      {error && <div className="edit-panel__error">{error}</div>}

      {confirmMoveDest && (
        <div
          className="modal-backdrop"
          onClick={() => !moveBusy && setConfirmMoveDest(null)}
        >
          <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Move database?</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setConfirmMoveDest(null)}
                disabled={moveBusy}
              >
                ×
              </button>
            </div>
            <div className="modal__body">
              <p>
                The active database will switch to:
              </p>
              <p className="mono storage-result">{confirmMoveDest}</p>
              <p>
                Old files at <span className="mono">{info?.path ?? '(current)'}</span>{' '}
                will be <strong>left in place</strong>. Verify the new location
                works for a session, then delete the old files manually.
              </p>
              <p className="storage-help">
                A pointer file in your default app data folder remembers the new
                location across launches. Network drives are not recommended for
                SQLite.
              </p>
            </div>
            <div className="modal__footer modal__footer--split">
              <button
                type="button"
                className="view-toggle"
                onClick={() => setConfirmMoveDest(null)}
                disabled={moveBusy}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="view-toggle view-toggle--danger"
                onClick={confirmMove}
                disabled={moveBusy}
              >
                {moveBusy ? 'MOVING…' : 'MOVE DATABASE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StorageRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="storage-row">
      <span className="storage-row__label">{label}</span>
      <span className={`storage-row__value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}
