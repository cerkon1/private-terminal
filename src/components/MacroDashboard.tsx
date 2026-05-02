import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import CategoryTabs, { ALL_TAB } from './CategoryTabs';
import FeatureChart from './charts/FeatureChart';
import MacroTile from './MacroTile';
import { FredHistory, MacroTileData } from '../types/macro';

type ViewMode = 'values' | 'heatmap';

type Props = {
  /** Called after any successful refresh so the status bar re-reads DB stats. */
  onDataChanged?: () => void;
  /** Cross-link out of MACRO into another section — used by the
   *  Recession Prob + FCI tile clicks to land on the matching Analysis tab. */
  onSelectSection?: (sectionId: string) => void;
};

// Tiles whose drill-down should route to an Analysis tab instead of the
// generic FRED line chart (S22). Both series are also kept in MACRO so
// the at-a-glance value is visible without leaving the dashboard; click
// then takes the user to the rich rendering (threshold lines / NBER bars
// / TabIntro) that already exists in the Analysis section.
const ANALYSIS_TILE_HANDOFF: Record<string, string> = {
  RECPROUSM156N: 'recession_prob',
  NFCI: 'financial_conditions',
};

export default function MacroDashboard({ onDataChanged, onSelectSection }: Props) {
  const [tiles, setTiles] = useState<MacroTileData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);
  const [viewMode, setViewMode] = useState<ViewMode>('values');
  const [selected, setSelected] = useState<MacroTileData | null>(null);
  const [history, setHistory] = useState<FredHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);

  const fetchTiles = async (force: boolean): Promise<MacroTileData[] | null> => {
    try {
      const data = await invoke<MacroTileData[]>('list_macro_tiles', { force });
      return data;
    } catch (err) {
      setLoadError(String(err));
      return null;
    }
  };

  // Initial load — honors the 12h cache (no FRED calls on warm reload).
  useEffect(() => {
    let cancelled = false;
    fetchTiles(false).then(data => {
      if (cancelled || !data) return;
      setTiles(data);
      onDataChanged?.();
    });
    return () => {
      cancelled = true;
    };
    // onDataChanged intentionally omitted — changes to it shouldn't trigger reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshSummary(null);
    const data = await fetchTiles(true);
    setIsRefreshing(false);
    if (!data) return;
    setTiles(data);
    const errCount = data.filter(t => t.fetchError).length;
    const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false });
    const summary =
      errCount === 0
        ? `Updated ${timestamp} · ${data.length}/${data.length} tiles`
        : `Updated ${timestamp} · ${data.length - errCount}/${data.length} · ${errCount} error${errCount > 1 ? 's' : ''}`;
    setRefreshSummary(summary);
    onDataChanged?.();
  };

  // Category tabs derived from the API response — never hardcoded.
  const categories = useMemo(() => {
    if (!tiles) return [];
    const set = new Set<string>();
    for (const t of tiles) if (t.category) set.add(t.category);
    return Array.from(set).sort();
  }, [tiles]);

  const visibleTiles = useMemo(() => {
    if (!tiles) return [];
    if (activeCategory === ALL_TAB) return tiles;
    return tiles.filter(t => t.category === activeCategory);
  }, [tiles, activeCategory]);

  const handleTileClick = (tile: MacroTileData) => {
    const target = ANALYSIS_TILE_HANDOFF[tile.seriesId];
    if (target && onSelectSection) {
      // localStorage handoff (NOT the SQLite-backed usePersistedState) —
      // AnalysisLayout consumes + clears it on mount once its own
      // persisted-state load resolves. Same shape as the S17 Correlations
      // → Pairs handoff and the S21 Pulse → TickerDashboard handoff.
      localStorage.setItem('session.analysis_handoff_tab', target);
      onSelectSection('analysis');
      return;
    }
    setSelected(tile);
  };

  // Fetch full history when a tile is selected.
  useEffect(() => {
    if (!selected) {
      setHistory(null);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setHistory(null);
    setHistoryError(null);
    invoke<FredHistory>('get_fred_history', { seriesId: selected.seriesId })
      .then(h => {
        if (!cancelled) setHistory(h);
      })
      .catch(err => {
        if (!cancelled) setHistoryError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.seriesId]);

  if (loadError) {
    return <div className="macro-tile__error">Failed to load: {loadError}</div>;
  }
  if (!tiles) {
    return <div className="macro-tile__loading">Loading macro dashboard…</div>;
  }

  if (selected) {
    return (
      <div className="feature-chart-pane">
        <div className="feature-chart-pane__header">
          <button
            type="button"
            className="feature-chart-pane__back"
            onClick={() => setSelected(null)}
          >
            ← Back
          </button>
          <div className="feature-chart-pane__title-block">
            <div className="macro-tile__series-id">{selected.seriesId}</div>
            <h2 className="feature-chart-pane__title">{selected.title}</h2>
          </div>
        </div>
        <div className="feature-chart-pane__chart">
          {historyError && <div className="macro-tile__error">{historyError}</div>}
          {!history && !historyError && (
            <div className="macro-tile__loading">Loading history…</div>
          )}
          {history && (
            <FeatureChart
              title={history.title}
              units={history.units}
              mode="line"
              observations={history.observations}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="macro-dashboard">
      <div className="macro-dashboard__controls">
        <CategoryTabs
          categories={categories}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
        <div className="macro-dashboard__actions">
          {refreshSummary && !isRefreshing && (
            <span className="refresh-summary">{refreshSummary}</span>
          )}
          <button
            type="button"
            className="view-toggle"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'REFRESHING…' : 'REFRESH'}
          </button>
          <button
            type="button"
            className="view-toggle"
            onClick={() => setViewMode(m => (m === 'values' ? 'heatmap' : 'values'))}
          >
            {viewMode === 'values' ? 'HEATMAP' : 'VALUES'}
          </button>
        </div>
      </div>
      <section className="tile-grid">
        {visibleTiles.map(t => (
          <MacroTile
            key={t.seriesId}
            tile={t}
            heatmap={viewMode === 'heatmap'}
            onClick={handleTileClick}
          />
        ))}
      </section>
    </div>
  );
}
