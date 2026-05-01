import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import { getChartTheme } from '../../styles/chartTheme';
import type {
  RegimeQuadrantRequest,
  RegimeQuadrantResponse,
} from '../../types/analysis';
import { TabIntro } from './TabIntro';

type StoredConfig = {
  inflationProxy: 'cpi' | 'pce';
  trailMonths: number;
};

const DEFAULT_CONFIG: StoredConfig = {
  inflationProxy: 'cpi',
  trailMonths: 24,
};

const TRAIL_MONTH_OPTIONS = [12, 24, 36, 48];

function quadrantStyle(rgbVar: string, alpha: number): string {
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue(rgbVar)
    .trim();
  return `rgba(${css}, ${alpha})`;
}

function buildOption(data: RegimeQuadrantResponse): echarts.EChartsCoreOption {
  const theme = getChartTheme();
  const { axisBounds, growthBaseline, inflationBaseline, trail } = data;
  const bx = growthBaseline ?? 0;
  const by = inflationBaseline ?? 0;

  // Quadrant background rectangles split at the long-run baselines. Order:
  // TR (Reflation, green), BR (Goldilocks, blue), BL (Disinflation, gray),
  // TL (Stagflation, red).
  const quadrantSeries = {
    name: '__quadrants',
    type: 'scatter',
    silent: true,
    data: [],
    markArea: {
      silent: true,
      itemStyle: { borderWidth: 0 },
      data: [
        // TR — Reflation (above-trend growth, above-trend inflation)
        [
          { xAxis: bx, yAxis: by, itemStyle: { color: quadrantStyle('--status-up-rgb', 0.07) } },
          { xAxis: axisBounds.xMax, yAxis: axisBounds.yMax },
        ],
        // BR — Goldilocks (above-trend growth, below-trend inflation)
        [
          { xAxis: bx, yAxis: axisBounds.yMin, itemStyle: { color: quadrantStyle('--accent-blue-rgb', 0.07) } },
          { xAxis: axisBounds.xMax, yAxis: by },
        ],
        // BL — Disinflation (below-trend growth, below-trend inflation)
        [
          { xAxis: axisBounds.xMin, yAxis: axisBounds.yMin, itemStyle: { color: quadrantStyle('--text-tertiary-rgb', 0.09) } },
          { xAxis: bx, yAxis: by },
        ],
        // TL — Stagflation (below-trend growth, above-trend inflation)
        [
          { xAxis: axisBounds.xMin, yAxis: by, itemStyle: { color: quadrantStyle('--status-down-rgb', 0.09) } },
          { xAxis: bx, yAxis: axisBounds.yMax },
        ],
      ],
    },
  };

  // Single trail series with per-point opacity gradient (older = fainter).
  const trailLineData = trail.map((p, i) => ({
    value: [p.growthYoy, p.inflationYoy],
    itemStyle: {
      opacity: 0.2 + 0.8 * ((i + 1) / Math.max(trail.length, 1)),
      color: theme.accentCyan,
    },
  }));

  const head = trail.length > 0 ? trail[trail.length - 1] : null;
  const headSeries = head
    ? [
        {
          name: 'current',
          type: 'scatter' as const,
          data: [
            {
              value: [head.growthYoy, head.inflationYoy],
              itemStyle: { color: theme.accentCyan, opacity: 1 },
              label: {
                show: true,
                formatter: head.date,
                position: 'right' as const,
                color: theme.textPrimary,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                padding: [2, 4, 2, 4],
                backgroundColor: theme.bgSurface,
                borderColor: theme.accentCyan,
                borderWidth: 1,
              },
            },
          ],
          symbolSize: 12,
          z: 11,
          tooltip: {
            formatter: () =>
              `${head.date}<br/>` +
              `Growth (INDPRO YoY): ${head.growthYoy.toFixed(2)}%<br/>` +
              `Inflation (${data.inflationLabel}): ${head.inflationYoy.toFixed(2)}%`,
          },
        },
      ]
    : [];

  const trailSeries = {
    name: 'trail',
    type: 'line' as const,
    data: trailLineData,
    showSymbol: true,
    symbolSize: 5,
    lineStyle: { color: theme.accentCyan, width: 1.4, opacity: 0.6 },
    z: 10,
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { dataIndex: number }) => {
        const p = trail[params.dataIndex];
        if (!p) return '';
        return (
          `${p.date}<br/>` +
          `Growth (INDPRO YoY): ${p.growthYoy.toFixed(2)}%<br/>` +
          `Inflation (${data.inflationLabel}): ${p.inflationYoy.toFixed(2)}%`
        );
      },
    },
  };

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 56, right: 96, top: 32, bottom: 36, containLabel: false },
    xAxis: {
      type: 'value',
      min: axisBounds.xMin,
      max: axisBounds.xMax,
      name: `${data.growthLabel} (%)`,
      nameLocation: 'middle' as const,
      nameGap: 26,
      nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: theme.borderSubtle, type: 'dashed' as const } },
      axisLabel: {
        color: theme.textSecondary,
        fontFamily: 'JetBrains Mono, monospace',
        formatter: (v: number) => v.toFixed(1),
      },
    },
    yAxis: {
      type: 'value',
      min: axisBounds.yMin,
      max: axisBounds.yMax,
      name: `${data.inflationLabel} (%)`,
      nameLocation: 'middle' as const,
      nameGap: 40,
      nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: theme.borderSubtle, type: 'dashed' as const } },
      axisLabel: {
        color: theme.textSecondary,
        fontFamily: 'JetBrains Mono, monospace',
        formatter: (v: number) => v.toFixed(1),
      },
    },
    tooltip: {
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: {
        color: theme.textPrimary,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
      },
    },
    graphic: quadrantLabels(theme),
    series: [
      quadrantSeries,
      // Crosshair markLines pin the quadrant split to the long-run baselines.
      // Solid markerLine at width 1 — Regime Quadrant baselines fall at
      // non-round values (~2.74 / 3.52) that don't coincide with the dashed
      // splitLine grid, so the boundary needs an explicit visual cue. RRG
      // doesn't need this because its split lands on x=100 / y=100 where the
      // grid happens to render anyway. Deliberate divergence between the two.
      {
        name: '__crosshairs',
        type: 'scatter' as const,
        silent: true,
        data: [],
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: theme.markerLine, type: 'solid' as const, width: 1 },
          label: { show: false },
          data: [{ xAxis: bx }, { yAxis: by }],
        },
      },
      trailSeries,
      ...headSeries,
    ],
  };
}

function quadrantLabels(
  theme: ReturnType<typeof getChartTheme>,
): echarts.EChartsCoreOption['graphic'] {
  const labelStyle = (color: string) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 16,
    fontWeight: 'bold',
    fill: color,
    opacity: 0.55,
  });
  return [
    {
      type: 'text',
      right: 100,
      top: 36,
      style: { text: 'REFLATION', ...labelStyle(theme.statusUp) },
      silent: true,
    },
    {
      type: 'text',
      right: 100,
      bottom: 40,
      style: { text: 'GOLDILOCKS', ...labelStyle('#60a5fa') },
      silent: true,
    },
    {
      type: 'text',
      left: 80,
      bottom: 40,
      style: { text: 'DISINFLATION', ...labelStyle(theme.textTertiary) },
      silent: true,
    },
    {
      type: 'text',
      left: 80,
      top: 36,
      style: { text: 'STAGFLATION', ...labelStyle(theme.statusDown) },
      silent: true,
    },
  ];
}

export function RegimeQuadrantTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_regime_quadrant_config',
    DEFAULT_CONFIG,
  );
  const [data, setData] = useState<RegimeQuadrantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const request: RegimeQuadrantRequest = {
      inflationProxy: config.inflationProxy,
      trailMonths: config.trailMonths,
    };
    invoke<RegimeQuadrantResponse>('compute_regime_quadrant', { request })
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
  }, [config.inflationProxy, config.trailMonths]);

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

  return (
    <div className="analysis-tab analysis-regime-quadrant">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Inflation</label>
          <select
            className="analysis-tab__select"
            value={config.inflationProxy}
            onChange={(e) =>
              setConfig({
                ...config,
                inflationProxy: e.target.value as 'cpi' | 'pce',
              })
            }
          >
            <option value="cpi">CPI YoY (headline)</option>
            <option value="pce">Core PCE YoY (Fed target)</option>
          </select>
        </div>
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Trail (months)</label>
          <select
            className="analysis-tab__select"
            value={config.trailMonths}
            onChange={(e) =>
              setConfig({ ...config, trailMonths: Number(e.target.value) })
            }
          >
            {TRAIL_MONTH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </header>

      <TabIntro
        subtitle="Where the US economy sits on a growth-vs-inflation map. The path traces the chosen trail length; the labelled dot is the most recent reading."
        howToRead={
          <>
            <ul>
              <li>
                <strong>Horizontal:</strong> industrial-production growth, year-over-year.
                Right of the crosshair = above the long-run average; left = below.
              </li>
              <li>
                <strong>Vertical:</strong> inflation, year-over-year. Above the crosshair =
                above the long-run average; below = below.
              </li>
              <li>
                <strong>Reflation</strong> (top-right, green): growth and inflation both
                running hot. Common late-cycle / overheating phase.
              </li>
              <li>
                <strong>Goldilocks</strong> (bottom-right, blue): growth above trend with
                inflation below trend. The regime risk markets historically reward most.
              </li>
              <li>
                <strong>Disinflation</strong> (bottom-left, gray): growth and inflation
                both cooling. Recession-adjacent territory.
              </li>
              <li>
                <strong>Stagflation</strong> (top-left, red): growth below trend while
                inflation stays above. The hardest regime for both stocks and bonds.
              </li>
              <li>
                <strong>The trail tells the story.</strong> Direction matters more than the
                exact dot — a dot in Reflation pointing toward Stagflation is a
                deteriorating-growth picture even if it hasn't crossed the line yet.
              </li>
            </ul>
            <p>
              The crosshairs sit at the long-run averages of each series (computed from the
              full available history), so the quadrants describe "above-trend" vs
              "below-trend" — not absolute levels.
            </p>
          </>
        }
        math={
          <>
            <p>
              <strong>Growth axis:</strong> 12-month % change of FRED{' '}
              <code>INDPRO</code> (Industrial Production Index, monthly).
            </p>
            <p>
              <code>YoY_t = (level_t / level_t-12 - 1) × 100</code>
            </p>
            <p>
              <strong>Inflation axis:</strong> same formula on{' '}
              <code>CPIAUCSL</code> (CPI All Urban Consumers, headline) by default, or{' '}
              <code>PCEPILFE</code> (Core PCE — what the Fed actually targets) when
              toggled.
            </p>
            <p>
              <strong>Crosshair baselines:</strong> arithmetic mean of each series across
              all observations after the 12-month YoY warm-up.
            </p>
            <p>
              The two series are inner-joined on calendar month so observation-date
              mismatches between INDPRO and CPI/PCE don't drop pairs.
            </p>
          </>
        }
      />

      {loading && !data && (
        <div className="analysis-tab__status">Loading regime data…</div>
      )}

      {error && <div className="analysis-tab__error">{error}</div>}

      {data && data.observationCount === 0 && (
        <div className="analysis-tab__placeholder">
          No observations yet for <code>{data.growthSeriesId}</code> ×{' '}
          <code>{data.inflationSeriesId}</code>. The series may not have been fetched yet
          — refresh MACRO from the dashboard.
        </div>
      )}

      <div
        ref={containerRef}
        className="regime-quadrant-tab__chart"
        style={{ flex: '1 1 auto', minHeight: 520, width: '100%' }}
      />

      {data && data.trail.length > 0 && data.current && (
        <footer className="analysis-tab__footnote">
          current {data.current.date} · growth {data.current.growthYoy.toFixed(2)}% ·
          inflation {data.current.inflationYoy.toFixed(2)}%
          {data.growthBaseline !== null && data.inflationBaseline !== null && (
            <>
              {' · baselines '}
              {data.growthBaseline.toFixed(2)}% / {data.inflationBaseline.toFixed(2)}%
            </>
          )}
          {' · trail '}
          {data.trail.length} months
          {' · series '}
          <code>{data.growthSeriesId}</code> × <code>{data.inflationSeriesId}</code>
        </footer>
      )}
    </div>
  );
}
