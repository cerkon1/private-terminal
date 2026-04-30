import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { useRecessionBars } from '../../hooks/useRecessionBars';
import { getChartTheme } from '../../styles/chartTheme';
import type { RecessionProbResponse } from '../../types/analysis';
import { TabIntro } from './TabIntro';

function buildOption(
  data: RecessionProbResponse,
  recessionMarkArea: ReturnType<typeof useRecessionBars>['markAreaData'],
): echarts.EChartsCoreOption {
  const theme = getChartTheme();

  const seriesPoints: [string, number][] = data.points.map((p) => [
    p.date,
    p.value,
  ]);

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 56, right: 24, top: 32, bottom: 36, containLabel: false },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.borderSubtle } },
      axisLabel: { color: theme.textTertiary, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: '%',
      nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
      axisLine: { show: false },
      axisLabel: {
        color: theme.textSecondary,
        fontFamily: 'JetBrains Mono, monospace',
        formatter: (v: number) => v.toFixed(0),
      },
      splitLine: { lineStyle: { color: theme.borderSubtle, type: 'dashed' as const } },
    },
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
        typeof v === 'number' ? `${v.toFixed(2)}%` : String(v ?? '—'),
    },
    series: [
      {
        name: 'Recession probability',
        type: 'line',
        data: seriesPoints,
        showSymbol: false,
        sampling: 'lttb',
        lineStyle: { width: 1.6, color: theme.accentCyan },
        areaStyle: { color: theme.accentCyanFillStrong },
        markLine: {
          symbol: 'none',
          silent: true,
          label: {
            color: theme.textTertiary,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            position: 'insideEndTop' as const,
          },
          data: [
            {
              yAxis: data.thresholds.warnPct,
              lineStyle: {
                color: getComputedStyle(document.documentElement)
                  .getPropertyValue('--accent-amber')
                  .trim(),
                type: 'dashed' as const,
              },
              label: { formatter: `${data.thresholds.warnPct}% warn` },
            },
            {
              yAxis: data.thresholds.imminentPct,
              lineStyle: {
                color: theme.statusDown,
                type: 'dashed' as const,
              },
              label: { formatter: `${data.thresholds.imminentPct}% imminent` },
            },
          ],
        },
        markArea: recessionMarkArea.length === 0
          ? undefined
          : {
              silent: true,
              itemStyle: {
                color: `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary-rgb').trim()}, 0.30)`,
              },
              data: recessionMarkArea,
            },
      },
    ],
  };
}

export function RecessionProbTab() {
  const [data, setData] = useState<RecessionProbResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recession = useRecessionBars();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    invoke<RecessionProbResponse>('compute_recession_prob', { request: {} })
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
  }, []);

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

  const option = useMemo(() => {
    if (!data) return null;
    return buildOption(data, recession.markAreaData);
  }, [data, recession.markAreaData]);

  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div className="analysis-tab analysis-recession-prob">
      <TabIntro
        subtitle="The NY Fed's modeled probability of a US recession in the next 12 months, with 30% and 50% reference lines."
        howToRead={
          <>
            <ul>
              <li>
                The line is a monthly probability estimate from the NY Fed's term-spread
                model — what the yield curve is implying about recession risk over the
                next year.
              </li>
              <li>
                <strong>30% line (amber):</strong> historical "warning" level. Readings
                above this have generally preceded US recessions.
              </li>
              <li>
                <strong>50% line (red):</strong> historical "imminent" level. By the time
                the model crosses here, a recession has typically been close at hand.
              </li>
              <li>
                <strong>Gray bands:</strong> official US recessions, dated by the National
                Bureau of Economic Research.
              </li>
              <li>
                This is a single-model estimate. The NY Fed has paused publication updates
                in some past periods — check the "latest" date in the footer to know how
                fresh the data is.
              </li>
            </ul>
            <p>
              The model is based on the term spread alone — it can underweight other
              risk channels like credit stress or asset bubbles. The exact percentage is
              less meaningful than the trajectory and the threshold crossings.
            </p>
          </>
        }
        math={
          <>
            <p>
              Direct plot of FRED <code>RECPROUSM156N</code>. No transformation.
            </p>
            <p>
              The 30% / 50% threshold lines are conventional reference levels used in NY
              Fed commentary — they're chart metadata, not computed from the data.
            </p>
          </>
        }
      />

      {loading && !data && (
        <div className="analysis-tab__status">Loading recession probability…</div>
      )}

      {error && <div className="analysis-tab__error">{error}</div>}

      {data && data.observationCount === 0 && (
        <div className="analysis-tab__placeholder">
          No observations yet for <code>RECPROUSM156N</code>. The series may not have
          been fetched yet — refresh MACRO from the dashboard, or the NY Fed may have
          paused publication. Check{' '}
          <a
            href="https://fred.stlouisfed.org/series/RECPROUSM156N"
            target="_blank"
            rel="noreferrer"
          >
            FRED
          </a>{' '}
          for current status.
        </div>
      )}

      <div
        ref={containerRef}
        className="recession-prob-tab__chart"
        style={{ flex: '1 1 auto', minHeight: 480, width: '100%' }}
      />

      {data && data.observationCount > 0 && (
        <footer className="analysis-tab__footnote">
          {data.current && (
            <>
              current {data.current.value.toFixed(2)}% ({data.current.date}) ·
              {' '}
            </>
          )}
          {data.observationCount} monthly observations
          {data.latestDate && <> · latest {data.latestDate}</>}
          {' · series '}
          <code>{data.seriesId}</code>
        </footer>
      )}
    </div>
  );
}
