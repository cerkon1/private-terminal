import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import AvwapAnchorsPopover from './AvwapAnchorsPopover';
import FeatureChart from './charts/FeatureChart';
import IndicatorPanel from './IndicatorPanel';
import OverlayChips from './OverlayChips';
import RangeSwitch from './RangeSwitch';
import TickerTile from './TickerTile';
import TileContextMenu, { type TileMenuItem } from './TileContextMenu';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  IndicatorOutput,
  IndicatorRegistration,
  IndicatorSetting,
} from '../types/indicator';
import { TickerHistory, TickerTileData, TileRange } from '../types/sector';
import { ThemeColors } from '../types/theme';
import { applyThemeToIndicators } from '../utils/applyThemeToIndicators';

type Props = {
  sectorGroupId: string;
  sectorName: string;
  themeColors: ThemeColors;
  onDataChanged?: () => void;
};

type ViewMode = 'values' | 'heatmap';

/// localStorage key written by Pulse when a ticker is clicked. Consumed +
/// cleared once tiles load — auto-opens the feature chart for that ticker.
/// Matches the S17 Correlations→Pairs handoff pattern.
const PULSE_HANDOFF_KEY = 'session.pulse_feature_chart_target';

type PulseHandoff = { ticker: string; dataSource: string };

export default function TickerDashboard({
  sectorGroupId,
  sectorName,
  themeColors,
  onDataChanged,
}: Props) {
  const [tiles, setTiles] = useState<TickerTileData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('values');
  const [selected, setSelected] = useState<TickerTileData | null>(null);
  const [activeRange, setActiveRange] = usePersistedState<TileRange>(
    'session.tile_range',
    '1D',
  );

  // App-wide chart-overlay toggles. Lifted from FeatureChart so the chip strip
  // (sibling to FeatureChart) can render them as toggles. Same KV keys as
  // before — existing user persistence carries over without migration.
  const [showVrvp, setShowVrvp] = usePersistedState<boolean>(
    'session.feature_chart_show_vrvp',
    true,
  );
  const [showDrawdown, setShowDrawdown] = usePersistedState<boolean>(
    'session.feature_chart_show_drawdown',
    false,
  );
  const [showAvwap, setShowAvwap] = usePersistedState<boolean>(
    'session.feature_chart_show_avwap',
    false,
  );

  // Per-ticker AVWAP anchors. Single global dict keyed by `<ticker>:<dataSource>`
  // — `usePersistedState` is designed for stable keys, so we don't pass the
  // dynamic ticker key directly. The dict approach has one load on mount,
  // predictable persistence, and trivial memory footprint (a few KB even at
  // hundreds of tickers).
  const [avwapAnchorsAll, setAvwapAnchorsAll] = usePersistedState<
    Record<string, string[]>
  >('session.feature_chart_avwap_anchors', {});
  const [avwapPopoverOpen, setAvwapPopoverOpen] = useState(false);
  const ANCHOR_CAP = 5;

  const [history, setHistory] = useState<TickerHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [availableIndicators, setAvailableIndicators] = useState<IndicatorRegistration[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [indicatorOutputs, setIndicatorOutputs] = useState<IndicatorOutput[]>([]);

  // Right-click context menu state (S22). Coordinates come from the tile's
  // onContextMenu event; ticker is the row the menu is acting on.
  const [ctxMenu, setCtxMenu] = useState<{
    tile: TickerTileData;
    x: number;
    y: number;
  } | null>(null);
  const [purgeCandidate, setPurgeCandidate] = useState<TickerTileData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // WATCHLIST membership — Set of ticker symbols currently in the
  // 'watchlist' top-level group. Drives the Add/Remove menu item swap.
  // Refetched on mount + after any successful add/remove/purge so the
  // menu always reflects current state.
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set());
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const bumpWatchlist = () => setWatchlistVersion((v) => v + 1);
  useEffect(() => {
    let cancelled = false;
    // Reuse list_palette_tickers (S22 Ctrl+K palette) — flat (ticker,
    // sectorGroupId) rows are exactly the shape needed for membership
    // testing. One IPC, no new backend.
    invoke<Array<{ ticker: string; sectorGroupId: string }>>('list_palette_tickers')
      .then((rows) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const r of rows) {
          if (r.sectorGroupId === 'watchlist') set.add(r.ticker);
        }
        setWatchlistTickers(set);
      })
      .catch(() => {
        if (!cancelled) setWatchlistTickers(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [watchlistVersion]);

  const fetchTiles = async (force: boolean): Promise<TickerTileData[] | null> => {
    try {
      return await invoke<TickerTileData[]>('list_ticker_tiles', {
        sectorGroupId,
        force,
      });
    } catch (err) {
      setLoadError(String(err));
      return null;
    }
  };

  useEffect(() => {
    setTiles(null);
    setLoadError(null);
    setRefreshSummary(null);
    setSelected(null);
    let cancelled = false;
    fetchTiles(false).then((data) => {
      if (cancelled || !data) return;
      setTiles(data);
      onDataChanged?.();

      // Pulse handoff: if the user just clicked a ticker on PULSE, the
      // target sits in localStorage. Consume it and auto-open the feature
      // chart for that ticker. Always clear so a stale handoff doesn't
      // hijack a later manual navigation.
      try {
        const raw = localStorage.getItem(PULSE_HANDOFF_KEY);
        if (raw) {
          localStorage.removeItem(PULSE_HANDOFF_KEY);
          const parsed = JSON.parse(raw) as PulseHandoff;
          const target = data.find(
            (t) => t.ticker === parsed.ticker && t.dataSource === parsed.dataSource,
          );
          if (target) setSelected(target);
        }
      } catch {
        // Malformed handoff — clear and ignore.
        localStorage.removeItem(PULSE_HANDOFF_KEY);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorGroupId]);

  // Load the indicator registry once (used by every ticker feature chart).
  useEffect(() => {
    invoke<IndicatorRegistration[]>('list_indicators').then(setAvailableIndicators);
  }, []);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshSummary(null);
    const data = await fetchTiles(true);
    setIsRefreshing(false);
    if (!data) return;
    setTiles(data);
    const errCount = data.filter((t) => t.fetchError).length;
    const timestamp = new Date().toLocaleTimeString(undefined, { hour12: false });
    const summary =
      errCount === 0
        ? `Updated ${timestamp} · ${data.length}/${data.length} tiles`
        : `Updated ${timestamp} · ${data.length - errCount}/${data.length} · ${errCount} error${errCount > 1 ? 's' : ''}`;
    setRefreshSummary(summary);
    onDataChanged?.();
  };

  // ── Feature-chart selection: fetch history + indicator settings + compute. ──

  useEffect(() => {
    if (!selected) {
      setHistory(null);
      setHistoryError(null);
      setEnabledIds(new Set());
      setIndicatorOutputs([]);
      return;
    }
    let cancelled = false;
    setHistory(null);
    setHistoryError(null);
    setIndicatorOutputs([]);
    Promise.all([
      invoke<TickerHistory>('get_ticker_history', {
        ticker: selected.ticker,
        dataSource: selected.dataSource,
      }),
      invoke<IndicatorSetting[]>('get_indicator_settings', { ticker: selected.ticker }),
    ])
      .then(([h, settings]) => {
        if (cancelled) return;
        setHistory(h);
        setEnabledIds(new Set(settings.filter((s) => s.enabled).map((s) => s.indicatorId)));
        onDataChanged?.();
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(String(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.ticker, selected?.dataSource]);

  // Recompute indicators whenever the enabled set or selected ticker changes.
  useEffect(() => {
    if (!selected || !history) {
      setIndicatorOutputs([]);
      return;
    }
    const ids = Array.from(enabledIds);
    if (ids.length === 0) {
      setIndicatorOutputs([]);
      return;
    }
    let cancelled = false;
    invoke<IndicatorOutput[]>('compute_indicators', {
      request: {
        ticker: selected.ticker,
        dataSource: selected.dataSource,
        indicatorIds: ids,
      },
    })
      .then((out) => {
        if (!cancelled) setIndicatorOutputs(out);
      })
      .catch(() => {
        if (!cancelled) setIndicatorOutputs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, history, enabledIds]);

  const toggleIndicator = async (indicatorId: string, enabled: boolean) => {
    if (!selected) return;
    // Optimistic local update.
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(indicatorId);
      else next.delete(indicatorId);
      return next;
    });
    try {
      await invoke('set_indicator_setting', {
        ticker: selected.ticker,
        indicatorId,
        enabled,
        paramsJson: null,
      });
    } catch (e) {
      // Roll back on failure.
      setEnabledIds((prev) => {
        const next = new Set(prev);
        if (enabled) next.delete(indicatorId);
        else next.add(indicatorId);
        return next;
      });
    }
  };

  // ── Right-click context menu actions (S22) ──────────────────────────

  const flashStatus = (msg: string) => {
    setActionError(null);
    setActionStatus(msg);
    setTimeout(() => setActionStatus(null), 2400);
  };

  const handleAddToWatchlist = async (tile: TickerTileData) => {
    try {
      await invoke('add_ticker', {
        input: {
          ticker: tile.ticker,
          sectorGroupId: 'watchlist',
          dataSource: tile.dataSource,
          displayName: tile.displayName ?? null,
          displayCurrency: tile.displayCurrency ?? null,
        },
      });
      flashStatus(`Added ${tile.ticker} to WATCHLIST`);
      bumpWatchlist();
      onDataChanged?.();
    } catch (e) {
      setActionError(String(e));
    }
  };

  const handleRemoveFromWatchlist = async (tile: TickerTileData) => {
    try {
      await invoke('remove_ticker', {
        ticker: tile.ticker,
        sectorGroupId: 'watchlist',
      });
      flashStatus(`Removed ${tile.ticker} from WATCHLIST`);
      bumpWatchlist();
      onDataChanged?.();
      // If we're currently VIEWING the WATCHLIST sector, the tile just
      // disappeared from it — refetch so the grid reflects the change.
      if (sectorGroupId === 'watchlist') {
        const data = await fetchTiles(false);
        if (data) setTiles(data);
      }
    } catch (e) {
      setActionError(String(e));
    }
  };

  const confirmPurge = async () => {
    if (!purgeCandidate) return;
    try {
      const r = await invoke<{
        cascaded: boolean;
        barsDeleted: number;
        quoteDeleted: boolean;
        indicatorSettingsDeleted: number;
        newsItemsDeleted: number;
      }>('purge_ticker', {
        ticker: purgeCandidate.ticker,
        sectorGroupId: purgeCandidate.sectorGroupId,
        dataSource: purgeCandidate.dataSource,
      });
      const sym = purgeCandidate.ticker;
      if (r.cascaded) {
        const parts = [`${r.barsDeleted} bars`];
        if (r.quoteDeleted) parts.push('quote');
        if (r.indicatorSettingsDeleted > 0)
          parts.push(`${r.indicatorSettingsDeleted} indicator setting(s)`);
        flashStatus(`Purged ${sym} · ${parts.join(' · ')}`);
      } else {
        flashStatus(`Removed ${sym} from this group · cached data kept`);
      }
      setPurgeCandidate(null);
      bumpWatchlist();
      onDataChanged?.();
      const data = await fetchTiles(false);
      if (data) setTiles(data);
    } catch (e) {
      setActionError(String(e));
    }
  };

  const buildMenuItems = (tile: TickerTileData): TileMenuItem[] => {
    const inWatchlist = watchlistTickers.has(tile.ticker);
    const items: TileMenuItem[] = [];
    if (inWatchlist) {
      items.push({
        label: 'Remove from WATCHLIST',
        onClick: () => handleRemoveFromWatchlist(tile),
      });
    } else {
      items.push({
        label: 'Add to WATCHLIST',
        onClick: () => handleAddToWatchlist(tile),
      });
    }
    items.push({
      label: 'Purge from database…',
      variant: 'destructive',
      onClick: () => setPurgeCandidate(tile),
    });
    return items;
  };

  const chartBars = useMemo(() => history?.bars ?? [], [history]);
  const themedIndicators = useMemo(
    () => applyThemeToIndicators(indicatorOutputs, themeColors),
    [indicatorOutputs, themeColors],
  );

  // Per-ticker AVWAP anchor management. Key built from the active selection;
  // empty string when no tile is selected (callbacks no-op in that case).
  const avwapKey = selected ? `${selected.ticker}:${selected.dataSource}` : '';
  const avwapAnchors = avwapKey ? (avwapAnchorsAll[avwapKey] ?? []) : [];

  const addAvwapAnchor = (date: string) => {
    if (!avwapKey) return;
    setAvwapAnchorsAll((prev) => {
      const current = prev[avwapKey] ?? [];
      if (current.length >= ANCHOR_CAP) return prev; // soft cap (5)
      if (current.includes(date)) return prev; // idempotent — duplicate clicks ignored
      return { ...prev, [avwapKey]: [...current, date].sort() };
    });
  };
  const removeAvwapAnchor = (date: string) => {
    if (!avwapKey) return;
    setAvwapAnchorsAll((prev) => ({
      ...prev,
      [avwapKey]: (prev[avwapKey] ?? []).filter((d) => d !== date),
    }));
  };
  const clearAvwapAnchors = () => {
    if (!avwapKey) return;
    setAvwapAnchorsAll((prev) => ({ ...prev, [avwapKey]: [] }));
    // "Clear all" is the exit ramp — user is done with this anchor set.
    // Disable the indicator so the chart returns to a clean state with no
    // dangling "Click any bar to anchor" hint. Re-toggling AVWAP later
    // starts a fresh anchor session. The existing effect closes the popover
    // automatically on `showAvwap=false`.
    setShowAvwap(false);
  };

  // Close the AVWAP popover whenever the selection or AVWAP toggle state
  // makes it irrelevant. Avoids stale popover hanging across ticker swaps.
  useEffect(() => {
    setAvwapPopoverOpen(false);
  }, [selected?.ticker, selected?.dataSource, showAvwap]);

  if (loadError) {
    return <div className="macro-tile__error">Failed to load: {loadError}</div>;
  }
  if (!tiles) {
    return <div className="macro-tile__loading">Loading {sectorName}…</div>;
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
            <div className="macro-tile__series-id">{selected.ticker}</div>
            <h2 className="feature-chart-pane__title">
              {selected.displayName ?? selected.ticker}
            </h2>
          </div>
          <div className="chip-strip">
            <IndicatorPanel
              indicators={availableIndicators}
              enabledIds={enabledIds}
              onToggle={toggleIndicator}
            />
            {availableIndicators.length > 0 && (
              <div className="chip-strip__separator" aria-hidden="true" />
            )}
            <OverlayChips
              overlays={[
                {
                  id: 'vrvp',
                  label: 'VRVP',
                  description:
                    'Volume Profile — translucent right-side histogram of total volume by price level. POC bin (heaviest volume) in yellow. Auto-suppresses for zero-volume tickers.',
                  enabled: showVrvp,
                  onToggle: setShowVrvp,
                },
                {
                  id: 'drawdown',
                  label: 'DD',
                  description:
                    'Drawdown — subpane below price showing % decline from the running peak. Floor = max drawdown over the visible window.',
                  enabled: showDrawdown,
                  onToggle: setShowDrawdown,
                },
                {
                  id: 'avwap',
                  label: 'AVWAP',
                  description:
                    'Anchored VWAP — click any bar to anchor; line shows the volume-weighted average price from that date forward. Multi-anchor: click ⚙ to manage. Auto-suppresses for tickers with no volume.',
                  enabled: showAvwap,
                  onToggle: setShowAvwap,
                  onSettings: showAvwap
                    ? () => setAvwapPopoverOpen((v) => !v)
                    : undefined,
                  popover: avwapPopoverOpen && showAvwap && (
                    <AvwapAnchorsPopover
                      anchors={avwapAnchors}
                      cap={ANCHOR_CAP}
                      bars={chartBars}
                      onRemove={removeAvwapAnchor}
                      onClear={clearAvwapAnchors}
                      onClose={() => setAvwapPopoverOpen(false)}
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>
        <div className="feature-chart-pane__chart">
          {historyError && <div className="macro-tile__error">{historyError}</div>}
          {!history && !historyError && (
            <div className="macro-tile__loading">Loading history…</div>
          )}
          {history && (
            <FeatureChart
              title={selected.displayName ?? selected.ticker}
              units={history.displayCurrency ?? ''}
              mode="candlestick"
              bars={chartBars}
              indicators={themedIndicators}
              showVrvp={showVrvp}
              showDrawdown={showDrawdown}
              showAvwap={showAvwap}
              avwapAnchors={avwapAnchors}
              onAvwapAnchorClick={addAvwapAnchor}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="macro-dashboard">
      <div className="macro-dashboard__controls">
        <div className="macro-dashboard__section-label">{sectorName}</div>
        <div className="macro-dashboard__actions">
          {refreshSummary && !isRefreshing && (
            <span className="refresh-summary">{refreshSummary}</span>
          )}
          <RangeSwitch value={activeRange} onChange={setActiveRange} />
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
            onClick={() => setViewMode((m) => (m === 'values' ? 'heatmap' : 'values'))}
          >
            {viewMode === 'values' ? 'HEATMAP' : 'VALUES'}
          </button>
        </div>
      </div>
      <section className="tile-grid">
        {tiles.map((t) => (
          <TickerTile
            key={t.ticker}
            tile={t}
            heatmap={viewMode === 'heatmap'}
            activeRange={activeRange}
            onClick={setSelected}
            onContextMenu={(tile, e) =>
              setCtxMenu({ tile, x: e.clientX, y: e.clientY })
            }
          />
        ))}
      </section>
      {ctxMenu && (
        <TileContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildMenuItems(ctxMenu.tile)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {purgeCandidate && (
        <div className="modal-backdrop" onClick={() => setPurgeCandidate(null)}>
          <div
            className="modal modal--narrow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <h2 className="modal__title">Purge from database?</h2>
            </div>
            <div className="modal__body">
              <p>
                This will hard-delete <code>{purgeCandidate.ticker}</code> from
                the current group. If this is the last visible occurrence of
                this ticker anywhere, cached bars + indicator settings will
                cascade-drop too.
              </p>
              <p style={{ color: 'var(--text-tertiary)' }}>
                Cannot be undone. The ticker can be re-added via Manage
                Watchlist or by right-clicking a tile in another group.
              </p>
            </div>
            <div className="modal__footer">
              <button
                type="button"
                className="view-toggle"
                onClick={() => setPurgeCandidate(null)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="view-toggle view-toggle--destructive"
                onClick={confirmPurge}
              >
                PURGE
              </button>
            </div>
          </div>
        </div>
      )}
      {(actionStatus || actionError) && (
        <div
          className={`tile-action-toast ${actionError ? 'tile-action-toast--error' : ''}`}
          onClick={() => {
            setActionStatus(null);
            setActionError(null);
          }}
        >
          {actionError ?? actionStatus}
        </div>
      )}
    </div>
  );
}
