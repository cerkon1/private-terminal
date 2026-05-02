import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import FeatureChart from './charts/FeatureChart';
import IndicatorPanel from './IndicatorPanel';
import RangeSwitch from './RangeSwitch';
import TickerTile from './TickerTile';
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

  const [history, setHistory] = useState<TickerHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [availableIndicators, setAvailableIndicators] = useState<IndicatorRegistration[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [indicatorOutputs, setIndicatorOutputs] = useState<IndicatorOutput[]>([]);

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

  const chartBars = useMemo(() => history?.bars ?? [], [history]);
  const themedIndicators = useMemo(
    () => applyThemeToIndicators(indicatorOutputs, themeColors),
    [indicatorOutputs, themeColors],
  );

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
          <IndicatorPanel
            indicators={availableIndicators}
            enabledIds={enabledIds}
            onToggle={toggleIndicator}
          />
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
            />
          )}
        </div>
        <div className="feature-chart-pane__liability">
          Decision support, not investment advice. The SMMA Ribbon indicator
          works best on tech/crypto at 4h–monthly timeframes; daily data is in
          scope but commodities/indices sit outside the original design intent.
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
          />
        ))}
      </section>
    </div>
  );
}
