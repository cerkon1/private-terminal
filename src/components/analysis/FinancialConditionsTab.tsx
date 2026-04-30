import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { useRecessionBars } from '../../hooks/useRecessionBars';
import { getChartTheme } from '../../styles/chartTheme';
import type { FinancialConditionsResponse } from '../../types/analysis';
import { TabIntro } from './TabIntro';

function buildOption(
  data: FinancialConditionsResponse,
  recessionMarkArea: ReturnType<typeof useRecessionBars>['markAreaData'],
): echarts.EChartsCoreOption {
  const theme = getChartTheme();

  const seriesPoints: [string, number][] = data.points.map((p) => [
    p.date,
    p.value,
  ]);

  // Earlier draft tried a `visualMap` with pieces to color the line amber
  // above zero and cyan below. Caused a webview crash on render — the
  // combination of pieces + 2,800-point series + 35-segment recession
  // markArea hit a pathological ECharts path. Single accent-cyan line +
  // zero baseline + NBER bars is enough; the tighter/looser narrative is
  // carried by the description and the zero crossings.
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
      name: 'σ',
      nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
      axisLine: { show: false },
      axisLabel: {
        color: theme.textSecondary,
        fontFamily: 'JetBrains Mono, monospace',
        formatter: (v: number) => v.toFixed(1),
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
        typeof v === 'number' ? v.toFixed(3) : String(v ?? '—'),
    },
    series: [
      {
        name: 'NFCI',
        type: 'line',
        data: seriesPoints,
        showSymbol: false,
        sampling: 'lttb',
        lineStyle: { width: 1.6, color: theme.accentCyan },
        areaStyle: { color: theme.accentCyanFillStrong },
        markLine: {
          symbol: 'none',
          silent: true,
          data: [
            {
              yAxis: 0,
              lineStyle: { color: theme.markerLine, type: 'solid' as const, width: 1.2 },
              label: {
                show: true,
                formatter: 'long-run avg',
                color: theme.textTertiary,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                position: 'insideEndTop' as const,
              },
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

export function FinancialConditionsTab() {
  const [data, setData] = useState<FinancialConditionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recession = useRecessionBars();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    invoke<FinancialConditionsResponse>('compute_financial_conditions', {
      request: {},
    })
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
    <div className="analysis-tab analysis-financial-conditions">
      <TabIntro
        subtitle="The Chicago Fed's weekly index of US financial conditions. Above zero = tighter than the long-run average (credit harder to get); below zero = looser. Watch the zero crossings."
        howToRead={
          <>
            <ul>
              <li>
                <strong>Above the solid zero line:</strong> financial conditions are
                tighter than the long-run average. Money is more expensive, credit is
                harder to get, lenders are stricter.
              </li>
              <li>
                <strong>Below the zero line:</strong> looser than average. Easy money,
                credit flowing freely, lending standards permissive.
              </li>
              <li>
                The index is anchored at 0 by construction — the zero crossing is the
                meaningful reference point, not the absolute value.
              </li>
              <li>
                <strong>Gray bands:</strong> official US recessions. Tight conditions often
                precede recessions; conditions typically loosen sharply during and after
                them as central banks ease.
              </li>
              <li>
                Built from 100+ underlying series (rates, credit spreads, equity
                volatility, leverage, household and business borrowing) — a composite of
                the financial system, not any single market.
              </li>
            </ul>
            <p>
              "Tight" and "loose" are relative to the entire history since 1971, not just
              the recent past — what feels normal today may register as historically loose
              or tight on this scale.
            </p>
          </>
        }
        math={
          <>
            <p>
              Direct plot of FRED <code>NFCI</code>.
            </p>
            <p>
              Standardized index where 0 = historical mean since 1971. Units are roughly
              standard deviations from that mean; positive values = tighter than average.
            </p>
            <p>
              An adjusted variant (<code>ANFCI</code>) exists that strips out the part
              explained by the business cycle — not implemented in v1.
            </p>
          </>
        }
      />

      {loading && !data && (
        <div className="analysis-tab__status">Loading financial conditions…</div>
      )}

      {error && <div className="analysis-tab__error">{error}</div>}

      {data && data.observationCount === 0 && (
        <div className="analysis-tab__placeholder">
          No observations yet for <code>NFCI</code>. The series may not have been fetched
          yet — refresh MACRO from the dashboard.
        </div>
      )}

      <div
        ref={containerRef}
        className="financial-conditions-tab__chart"
        style={{ flex: '1 1 auto', minHeight: 480, width: '100%' }}
      />

      {data && data.observationCount > 0 && (
        <footer className="analysis-tab__footnote">
          {data.current && (
            <>
              current {data.current.value.toFixed(3)} ({data.current.date}) ·{' '}
            </>
          )}
          {data.observationCount} weekly observations
          {data.latestDate && <> · latest {data.latestDate}</>}
          {data.minValue !== null && data.maxValue !== null && (
            <>
              {' · range '}
              {data.minValue.toFixed(2)} → {data.maxValue.toFixed(2)}
            </>
          )}
          {' · series '}
          <code>{data.seriesId}</code>
        </footer>
      )}
    </div>
  );
}
