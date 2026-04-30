import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import { getChartTheme } from '../../styles/chartTheme';
import type {
  AnalysisToolInfo,
  PairsHandoff,
  PairsRequest,
  PairsResponse,
  TickerKey,
} from '../../types/analysis';
import { TabIntro } from './TabIntro';
import { TickerChipPicker } from './TickerChipPicker';

type StoredConfig = {
  numerator: TickerKey | null;
  denominator: TickerKey | null;
  lookbackDays: number;
  zScoreWindow: number;
};

const DEFAULT_CONFIG: StoredConfig = {
  numerator: null,
  denominator: null,
  lookbackDays: 365,
  zScoreWindow: 60,
};

const LOOKBACKS: { days: number; label: string }[] = [
  { days: 90, label: '90d' },
  { days: 180, label: '6mo' },
  { days: 365, label: '1y' },
  { days: 730, label: '2y' },
  { days: 1825, label: '5y' },
];

const Z_WINDOWS: { value: number; label: string }[] = [
  { value: 20, label: '20' },
  { value: 60, label: '60' },
  { value: 90, label: '90' },
  { value: 120, label: '120' },
];

type QuickPick = [string, string];
type ToolConfig = { quickPicks?: QuickPick[] };

/// ECharts dual-pane: ratio on top, z-score below with ±2σ markLines and a
/// zero baseline. Hides the z-score pane when the response has no z values
/// (window > bar count). Token-driven via chartTheme.
function buildOption(data: PairsResponse): echarts.EChartsCoreOption {
  const theme = getChartTheme();
  const num = data.numerator.ticker;
  const den = data.denominator.ticker;

  const ratioPoints: [string, number][] = data.points.map((p) => [
    p.date,
    p.ratio,
  ]);
  const zPoints: [string, number][] = data.points
    .filter((p) => p.zScore !== null && Number.isFinite(p.zScore))
    .map((p) => [p.date, p.zScore as number]);

  const showZ = zPoints.length > 0;

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: showZ
      ? [
          { left: 64, right: 24, top: 32, height: '52%', containLabel: false },
          { left: 64, right: 24, top: '66%', bottom: 36, containLabel: false },
        ]
      : [{ left: 64, right: 24, top: 32, bottom: 36, containLabel: false }],
    xAxis: showZ
      ? [
          {
            type: 'time',
            gridIndex: 0,
            axisLine: { lineStyle: { color: theme.borderSubtle } },
            axisLabel: { color: theme.textTertiary, fontSize: 10 },
          },
          {
            type: 'time',
            gridIndex: 1,
            axisLine: { lineStyle: { color: theme.borderSubtle } },
            axisLabel: { color: theme.textTertiary, fontSize: 10 },
          },
        ]
      : [
          {
            type: 'time',
            gridIndex: 0,
            axisLine: { lineStyle: { color: theme.borderSubtle } },
            axisLabel: { color: theme.textTertiary, fontSize: 10 },
          },
        ],
    yAxis: showZ
      ? [
          {
            type: 'value',
            gridIndex: 0,
            scale: true,
            name: `${num}/${den}`,
            nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
            axisLine: { show: false },
            axisLabel: {
              color: theme.textSecondary,
              fontFamily: 'JetBrains Mono, monospace',
              formatter: (v: number) => formatRatio(v),
            },
            splitLine: {
              lineStyle: { color: theme.borderSubtle, type: 'dashed' as const },
            },
          },
          {
            type: 'value',
            gridIndex: 1,
            scale: true,
            name: 'z',
            nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
            axisLine: { show: false },
            axisLabel: {
              color: theme.textTertiary,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              formatter: (v: number) => v.toFixed(1),
            },
            splitLine: {
              lineStyle: { color: theme.borderSubtle, type: 'dashed' as const },
            },
          },
        ]
      : [
          {
            type: 'value',
            gridIndex: 0,
            scale: true,
            name: `${num}/${den}`,
            nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
            axisLine: { show: false },
            axisLabel: {
              color: theme.textSecondary,
              fontFamily: 'JetBrains Mono, monospace',
              formatter: (v: number) => formatRatio(v),
            },
            splitLine: {
              lineStyle: { color: theme.borderSubtle, type: 'dashed' as const },
            },
          },
        ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: {
        color: theme.textPrimary,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
      },
      valueFormatter: (v: number | string | null | undefined) =>
        typeof v === 'number' ? formatRatio(v) : String(v ?? '—'),
    },
    series: [
      {
        name: `${num}/${den}`,
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: ratioPoints,
        showSymbol: false,
        sampling: 'lttb',
        lineStyle: { width: 1.6, color: theme.accentCyan },
        areaStyle: { color: theme.accentCyanFillStrong },
      },
      ...(showZ
        ? [
            {
              name: 'z-score',
              type: 'line' as const,
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: zPoints,
              showSymbol: false,
              sampling: 'lttb',
              lineStyle: { width: 1.2, color: theme.textSecondary },
              markLine: {
                symbol: 'none',
                silent: true,
                data: [
                  {
                    yAxis: 0,
                    lineStyle: { color: theme.markerLine, type: 'solid' as const },
                  },
                  {
                    yAxis: 2,
                    lineStyle: { color: theme.markerLine, type: 'dashed' as const },
                  },
                  {
                    yAxis: -2,
                    lineStyle: { color: theme.markerLine, type: 'dashed' as const },
                  },
                ],
                label: { show: false },
              },
            },
          ]
        : []),
    ],
  };
}

function formatRatio(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(1);
  if (a >= 10) return v.toFixed(2);
  if (a >= 1) return v.toFixed(3);
  if (a >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function isSelectablePair(c: StoredConfig): boolean {
  return c.numerator !== null && c.denominator !== null;
}

export function PairsTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_pairs_ratio_config',
    DEFAULT_CONFIG,
  );

  // Cross-link target: Correlations writes a handoff under a known key + flips
  // the active-tab persisted-state. Pick it up here, apply, then clear.
  useEffect(() => {
    const raw = window.localStorage.getItem('session.analysis_pairs_handoff');
    if (!raw) return;
    try {
      const handoff = JSON.parse(raw) as PairsHandoff;
      window.localStorage.removeItem('session.analysis_pairs_handoff');
      if (handoff?.numerator && handoff?.denominator) {
        setConfig((prev) => ({
          ...prev,
          numerator: handoff.numerator,
          denominator: handoff.denominator,
        }));
      }
    } catch {
      window.localStorage.removeItem('session.analysis_pairs_handoff');
    }
    // We only want to consume the handoff once on mount; setConfig is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, setData] = useState<PairsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-picks come from the analysis_tools.config_json blob via list_analysis_tools.
  const [quickPicks, setQuickPicks] = useState<QuickPick[]>([]);
  useEffect(() => {
    let active = true;
    invoke<AnalysisToolInfo[]>('list_analysis_tools')
      .then((tools) => {
        if (!active) return;
        const me = tools.find((t) => t.id === 'pairs_ratio');
        if (!me?.configJson) return;
        try {
          const parsed = JSON.parse(me.configJson) as ToolConfig;
          if (Array.isArray(parsed.quickPicks)) {
            setQuickPicks(parsed.quickPicks.filter((p) => p.length === 2));
          }
        } catch {
          // fall through; quick-picks are optional
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const minBars = useMemo(
    () => Math.max(2, Math.floor(config.lookbackDays / 2)),
    [config.lookbackDays],
  );

  // Recompute on any picker / lookback / window change.
  useEffect(() => {
    if (!isSelectablePair(config)) {
      setData(null);
      setError(null);
      return;
    }
    const request: PairsRequest = {
      numerator: config.numerator!,
      denominator: config.denominator!,
      lookbackDays: config.lookbackDays,
      zScoreWindow: config.zScoreWindow,
    };
    let active = true;
    setLoading(true);
    setError(null);
    invoke<PairsResponse>('compute_pair_ratio', { request })
      .then((r) => {
        if (!active) return;
        setData(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(typeof e === 'string' ? e : String(e));
        setData(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    config.numerator?.ticker,
    config.numerator?.dataSource,
    config.denominator?.ticker,
    config.denominator?.dataSource,
    config.lookbackDays,
    config.zScoreWindow,
  ]);

  // ECharts lifecycle.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  const option = useMemo(() => (data ? buildOption(data) : null), [data]);
  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: true });
  }, [option]);

  // Single-ticker pickers via maxChips=1.
  const onNumeratorChange = (next: TickerKey[]) =>
    setConfig({ ...config, numerator: next[0] ?? null });
  const onDenominatorChange = (next: TickerKey[]) =>
    setConfig({ ...config, denominator: next[0] ?? null });

  const applyQuickPick = ([numTicker, denTicker]: QuickPick) => {
    setConfig({
      ...config,
      numerator: { ticker: numTicker, dataSource: 'yahoo' },
      denominator: { ticker: denTicker, dataSource: 'yahoo' },
    });
  };

  const stats = data?.stats;

  return (
    <div className="analysis-tab analysis-pairs">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Numerator</label>
          <TickerChipPicker
            selected={config.numerator ? [config.numerator] : []}
            onChange={onNumeratorChange}
            minBarsRequired={minBars}
            maxChips={1}
            placeholder="numerator…"
          />
        </div>
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Denominator</label>
          <TickerChipPicker
            selected={config.denominator ? [config.denominator] : []}
            onChange={onDenominatorChange}
            minBarsRequired={minBars}
            maxChips={1}
            placeholder="denominator…"
          />
        </div>
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Lookback</label>
          <select
            className="analysis-tab__select"
            value={config.lookbackDays}
            onChange={(e) =>
              setConfig({ ...config, lookbackDays: Number(e.target.value) })
            }
          >
            {LOOKBACKS.map((l) => (
              <option key={l.days} value={l.days}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Z-window</label>
          <select
            className="analysis-tab__select"
            value={config.zScoreWindow}
            onChange={(e) =>
              setConfig({ ...config, zScoreWindow: Number(e.target.value) })
            }
          >
            {Z_WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <TabIntro
        subtitle="One asset's price divided by another's, plotted over time. The lower chart shows whether that ratio is unusually high or low compared to its recent average."
        howToRead={
          <>
            <ul>
              <li>
                <strong>Top chart:</strong> the ratio of numerator price to denominator
                price. A rising line means the numerator is gaining ground on the
                denominator.
              </li>
              <li>
                <strong>Bottom chart (z-score):</strong> how far the current ratio sits
                from its recent average, measured in "standard deviations" — basically a
                unit of typical day-to-day variation. The dashed lines at ±2 mark the rough
                edge of "unusual."
              </li>
              <li>
                <strong>z above +2:</strong> the numerator has stretched a long way ahead
                of the denominator vs recent trend. Some traders watch this as a setup for
                the gap to narrow back.
              </li>
              <li>
                <strong>z below −2:</strong> the opposite — ratio is unusually low. The
                "underdog catches up" zone.
              </li>
              <li>
                <strong>Quick picks</strong> are pre-set common pairs (BTC vs ETH, gold vs
                silver, copper vs gold, Nasdaq vs S&amp;P). Starting points — type your own
                combinations to compare anything.
              </li>
              <li>
                The footer's "excluded" list is tickers without enough history for the
                chosen window.
              </li>
            </ul>
            <p>
              "Unusual" doesn't mean "about to revert tomorrow" — markets can stay
              one-sided longer than is comfortable. Z-scores are a way to surface
              candidates worth a second look, not a timing signal.
            </p>
          </>
        }
        math={
          <>
            <p>
              <code>ratio_t = num_t / den_t</code> over inner-joined dates.
            </p>
            <p>
              <code>z_t = (ratio_t − μ_w) / σ_w</code>, where <code>μ_w / σ_w</code> are
              rolling mean / sample stdev (n−1 denominator) over the chosen Z-window.
            </p>
            <p>
              No log-axis option in v1 — ECharts' default log axis squashes sub-decade
              ranges, which is exactly where most ratios live.
            </p>
          </>
        }
      />

      {quickPicks.length > 0 && (
        <div className="analysis-pairs__quickpicks">
          <span className="analysis-tab__label">Quick picks</span>
          {quickPicks.map(([n, d]) => (
            <button
              key={`${n}/${d}`}
              type="button"
              className="analysis-pairs__quickpick"
              onClick={() => applyQuickPick([n, d])}
            >
              {n} / {d}
            </button>
          ))}
        </div>
      )}

      {!isSelectablePair(config) && (
        <div className="analysis-tab__placeholder">
          Pick a numerator and a denominator to plot the ratio.
        </div>
      )}

      {loading && !data && (
        <div className="analysis-tab__status">Computing…</div>
      )}

      {error && <div className="analysis-tab__error">{error}</div>}

      {/* Always render visible — hiding via display:none at mount makes
          echarts.init see a zero-size container and the chart later draws
          into 0×0 even after data arrives. */}
      <div
        ref={containerRef}
        className="pairs-tab__chart"
        style={{ flex: '1 1 auto', minHeight: 480, width: '100%' }}
      />

      {data && (
        <footer className="analysis-tab__footnote">
          {stats?.currentRatio != null && (
            <>
              current {formatRatio(stats.currentRatio)}
              {stats.currentZ != null && (
                <> · z {stats.currentZ.toFixed(2)}</>
              )}
              {' · '}
            </>
          )}
          {stats?.mean != null && stats?.stdev != null && (
            <>
              μ {formatRatio(stats.mean)} · σ {formatRatio(stats.stdev)}
              {' · '}
            </>
          )}
          {stats?.min != null && stats?.max != null && (
            <>
              min {formatRatio(stats.min)} · max {formatRatio(stats.max)}
              {' · '}
            </>
          )}
          {data.barCount} bars
          {data.startDate && data.endDate && (
            <> · {data.startDate} → {data.endDate}</>
          )}
          {data.excluded.length > 0 && (
            <span className="analysis-tab__excluded">
              {' '}· excluded: {data.excluded
                .map((e) => `${e.ticker} (${e.barCount}b)`)
                .join(', ')}
            </span>
          )}
        </footer>
      )}
    </div>
  );
}
