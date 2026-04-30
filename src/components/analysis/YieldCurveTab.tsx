import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import { useRecessionBars } from '../../hooks/useRecessionBars';
import { getChartTheme } from '../../styles/chartTheme';
import { TabIntro } from './TabIntro';
import type {
  YieldCurveRequest,
  YieldCurveResponse,
  YieldCurveSpread,
} from '../../types/analysis';

type StoredConfig = {
  spread: YieldCurveSpread;
};

const DEFAULT_CONFIG: StoredConfig = { spread: '2s10s' };

const SPREAD_OPTIONS: { value: YieldCurveSpread; label: string }[] = [
  { value: '2s10s', label: '10Y − 2Y' },
  { value: '3m10y', label: '10Y − 3M' },
];

/// Build the ECharts options object for the dual-pane yield-curve chart.
/// Top grid (term structure): tenor on category x-axis, yield on y-axis,
/// three line series (one per snapshot).
/// Bottom grid (spread series): time on x-axis with NBER markArea overlay.
function buildOption(
  data: YieldCurveResponse,
  recessionData: ReturnType<typeof useRecessionBars>['markAreaData'],
): echarts.EChartsCoreOption {
  const theme = getChartTheme();

  const tenorLabels = data.termStructure[0]?.points.map((p) => p.tenor) ?? [];

  // One line series per snapshot. Color graduates: brightest for "Today",
  // dimmer for the historical anchors.
  const snapshotColors = [
    theme.accentCyan,
    theme.statusUp,
    theme.textTertiary,
  ];
  const termSeries = data.termStructure.map((snap, i) => ({
    name: snap.label,
    type: 'line' as const,
    xAxisIndex: 0,
    yAxisIndex: 0,
    data: snap.points.map((p) => p.yieldPct),
    showSymbol: true,
    symbolSize: 6,
    connectNulls: false,
    lineStyle: { width: i === 0 ? 2.4 : 1.6, color: snapshotColors[i] ?? theme.textTertiary },
    itemStyle: { color: snapshotColors[i] ?? theme.textTertiary },
  }));

  const spreadSeries: echarts.EChartsCoreOption['series'] = {
    name: data.spreadLabel,
    type: 'line',
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: data.spreadSeries.map((p) => [p.date, p.value]),
    showSymbol: false,
    sampling: 'lttb',
    lineStyle: { width: 1.4, color: theme.accentCyan },
    areaStyle: { color: theme.accentCyanFillStrong },
    markLine: {
      symbol: 'none',
      silent: true,
      data: [{ yAxis: 0, lineStyle: { color: theme.markerLine, type: 'dashed' as const } }],
      label: { show: false },
    },
    markArea: recessionData.length === 0
      ? undefined
      : {
          silent: true,
          itemStyle: {
            color: `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary-rgb').trim()}, 0.30)`,
          },
          data: recessionData,
        },
  };

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: [
      { left: 56, right: 24, top: 32, height: '52%', containLabel: false },
      { left: 56, right: 24, top: '66%', bottom: 36, containLabel: false },
    ],
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: tenorLabels,
        axisLine: { lineStyle: { color: theme.borderSubtle } },
        axisLabel: { color: theme.textSecondary, fontFamily: 'JetBrains Mono, monospace' },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: theme.borderSubtle } },
        axisLabel: { color: theme.textTertiary, fontSize: 10 },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        scale: true,
        name: '%',
        nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
        axisLine: { show: false },
        axisLabel: {
          color: theme.textSecondary,
          fontFamily: 'JetBrains Mono, monospace',
          formatter: (v: number) => v.toFixed(2),
        },
        splitLine: { lineStyle: { color: theme.borderSubtle, type: 'dashed' as const } },
      },
      {
        type: 'value',
        gridIndex: 1,
        scale: true,
        name: 'pp',
        nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
        axisLine: { show: false },
        axisLabel: {
          color: theme.textTertiary,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: (v: number) => v.toFixed(2),
        },
        splitLine: { lineStyle: { color: theme.borderSubtle, type: 'dashed' as const } },
      },
    ],
    legend: {
      top: 4,
      left: 56,
      data: data.termStructure.map((s) => s.label),
      textStyle: { color: theme.textSecondary, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      itemHeight: 8,
      itemWidth: 16,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: { color: theme.textPrimary, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
      valueFormatter: (v: number | string | null | undefined) =>
        typeof v === 'number' ? v.toFixed(3) : String(v ?? '—'),
    },
    series: [...termSeries, spreadSeries],
  };
}

export function YieldCurveTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_yield_curve_config',
    DEFAULT_CONFIG,
  );

  const [data, setData] = useState<YieldCurveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recession = useRecessionBars();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Fetch on spread change. snapshotDate stays null = use latest available.
  useEffect(() => {
    const request: YieldCurveRequest = {
      snapshotDate: null,
      spread: config.spread,
    };
    let active = true;
    setLoading(true);
    setError(null);
    invoke<YieldCurveResponse>('compute_yield_curve', { request })
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
  }, [config.spread]);

  // Initialize echarts once; teardown on unmount.
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

  // Re-render option whenever data or recession bars change.
  const option = useMemo(() => {
    if (!data) return null;
    return buildOption(data, recession.markAreaData);
  }, [data, recession.markAreaData]);

  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: true });
  }, [option]);

  const onSpreadChange = (next: YieldCurveSpread) =>
    setConfig({ ...config, spread: next });

  return (
    <div className="analysis-tab analysis-yield-curve">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Spread</label>
          <select
            className="analysis-tab__select"
            value={config.spread}
            onChange={(e) => onSpreadChange(e.target.value as YieldCurveSpread)}
          >
            {SPREAD_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {data && (
          <div className="analysis-tab__control-group">
            <span className="analysis-tab__label">Anchor</span>
            <span className="analysis-tab__readout">
              {data.termStructure[0]?.date ?? '—'}
            </span>
          </div>
        )}
      </header>

      <TabIntro
        subtitle="What the US government pays to borrow money for different lengths of time, today vs. 6 months ago vs. 5 years ago. Below: the gap between long- and short-term rates over time, with US recessions shaded gray."
        howToRead={
          <>
            <ul>
              <li>
                <strong>Top chart:</strong> each line is a snapshot of yields by loan
                length, from 3 months out to 30 years. Normally the line rises
                left-to-right — investors demand more interest to lend their money for
                longer. A flat or downward-sloping line is unusual and historically signals
                trouble ahead.
              </li>
              <li>
                <strong>Bottom chart:</strong> the difference between the 10-year yield and
                a shorter yield, plotted over time. Above zero = normal. Below zero =
                short-term rates are <em>higher</em> than long-term rates — known as an
                "inverted yield curve."
              </li>
              <li>
                <strong>Gray bands:</strong> official US recession periods, dated by the
                National Bureau of Economic Research.
              </li>
              <li>
                <strong>Why people watch this:</strong> the 10y/2y gap typically turns
                negative <em>6–18 months before</em> a recession starts. The flip itself is
                the warning — by the time the recession lands, the curve has often already
                un-inverted.
              </li>
              <li>
                The trailing edge of the most recent gray bar can shift later, because
                recessions are officially dated 6–18 months <em>after</em> they end.
              </li>
            </ul>
            <p>
              The signal isn't perfect — the link between curve shape and recessions can
              change in unusual rate environments (e.g. when central banks hold short rates
              near zero for years).
            </p>
          </>
        }
        math={
          <>
            <p>
              Raw FRED yields (<code>DGS3MO / DGS2 / DGS5 / DGS10 / DGS30</code>) plotted
              directly — no smoothing.
            </p>
            <p>
              Spread series = <code>DGS10 − DGS2</code> (or <code>DGS10 − DGS3MO</code>) per
              business day, inner-joined on dates where both series have non-sentinel
              observations.
            </p>
            <p>
              Recession bars: USREC FRED series (monthly 0/1), run-length-encoded into
              start/end ranges.
            </p>
          </>
        }
      />

      {loading && !data && (
        <div className="analysis-tab__status">Loading yield curve…</div>
      )}
      {error && <div className="analysis-tab__error">{error}</div>}

      <div
        ref={containerRef}
        className="yield-curve__chart"
        style={{ flex: '1 1 auto', minHeight: 480, width: '100%' }}
      />

      {data && (
        <footer className="analysis-tab__footnote">
          {data.spreadSeries.length} spread observations · {data.spreadLabel}
          {' · '}
          {recession.loaded
            ? `${recession.segments.length} NBER recession segments`
            : 'recession segments loading…'}
          {recession.error && (
            <span className="analysis-tab__excluded"> · recession error: {recession.error}</span>
          )}
        </footer>
      )}
    </div>
  );
}
