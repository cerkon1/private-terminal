import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { DbInfo, formatBytes } from '../types/system';

type Props = {
  /** Incremented by the app after a data refresh so we re-read DB stats. */
  refreshTrigger: number;
  onSettingsOpen: () => void;
  /** Opens the Ctrl+K command palette (S22). Same modal that the
   *  global keybinding triggers — exposes it visually for users who
   *  haven't picked up the shortcut yet. */
  onPaletteOpen: () => void;
};

export default function AppHeader({ refreshTrigger, onSettingsOpen, onPaletteOpen }: Props) {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<DbInfo>('get_db_info')
      .then((i) => {
        if (!cancelled) setInfo(i);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const copyPath = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked in some WebView contexts */
    }
  };

  return (
    <header className="app-header">
      <div className="app-header__top-row">
        <h1 className="app-title">PRIVATE TERMINAL</h1>
        <div className="app-header__actions">
          <button
            type="button"
            className="app-header__icon-btn app-header__icon-btn--palette"
            onClick={onPaletteOpen}
            title="Search across the app (Ctrl+K)"
          >
            ⌘K
          </button>
          <button
            type="button"
            className="app-header__icon-btn"
            onClick={onSettingsOpen}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>
      <div className="app-header__sub-row">
        {info ? (
          <>
            <button
              type="button"
              className="app-header__path"
              onClick={copyPath}
              title={`Click to copy: ${info.path}`}
            >
              {info.path}
            </button>
            <span className="app-header__sep">·</span>
            <span>{formatBytes(info.sizeBytes)}</span>
            <span className="app-header__sep">·</span>
            <span>{info.seriesCount} series</span>
            <span className="app-header__sep">·</span>
            <span>{info.observationCount.toLocaleString()} bars</span>
            {copied && <span className="app-header__copied">copied</span>}
          </>
        ) : (
          <span className="app-header__loading">locating database…</span>
        )}
      </div>
    </header>
  );
}
