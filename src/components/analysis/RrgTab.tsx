import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import { getChartTheme } from '../../styles/chartTheme';
import type {
  RrgRequest,
  RrgResponse,
  RrgTail,
  TickerCoverage,
  TickerKey,
} from '../../types/analysis';
import { TabIntro } from './TabIntro';
import { TickerChipPicker } from './TickerChipPicker';

type StoredConfig = {
  benchmark: TickerKey;
  tickers: TickerKey[];
  rsPeriod: number;
  momentumPeriod: number;
  tailLength: number;
};

const DEFAULT_CONFIG: StoredConfig = {
  benchmark: { ticker: '^GSPC', dataSource: 'yahoo' },
  tickers: [],
  rsPeriod: 14,
  momentumPeriod: 5,
  tailLength: 8,
};

const TAIL_LENGTHS = [4, 8, 12];

function quadrantStyle(rgbVar: string, alpha: number): string {
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue(rgbVar)
    .trim();
  return `rgba(${css}, ${alpha})`;
}

/// Build the ECharts option for the four-quadrant RRG.
function buildOption(data: RrgResponse, axisPad = 0.5): echarts.EChartsCoreOption {
  const theme = getChartTheme();

  // Compute axis bounds across all tails, padded.
  let minR = Infinity;
  let maxR = -Infinity;
  let minM = Infinity;
  let maxM = -Infinity;
  for (const tail of data.tails) {
    for (const p of tail.points) {
      if (Number.isFinite(p.rsRatio)) {
        minR = Math.min(minR, p.rsRatio);
        maxR = Math.max(maxR, p.rsRatio);
      }
      if (Number.isFinite(p.rsMomentum)) {
        minM = Math.min(minM, p.rsMomentum);
        maxM = Math.max(maxM, p.rsMomentum);
      }
    }
  }
  // Anchor a sensible default if we have no data yet.
  if (!Number.isFinite(minR)) {
    minR = 99;
    maxR = 101;
  }
  if (!Number.isFinite(minM)) {
    minM = 99;
    maxM = 101;
  }

  // Symmetrize around 100 so the centerline sits in the middle of the plot.
  const halfR = Math.max(maxR - 100, 100 - minR, axisPad) + axisPad;
  const halfM = Math.max(maxM - 100, 100 - minM, axisPad) + axisPad;
  const xMin = 100 - halfR;
  const xMax = 100 + halfR;
  const yMin = 100 - halfM;
  const yMax = 100 + halfM;

  // Quadrant background rectangles via a hidden helper series carrying
  // markArea entries. Order: TR (Leading), BR (Weakening), BL (Lagging),
  // TL (Improving).
  const quadrantSeries = {
    name: '__quadrants',
    type: 'scatter',
    silent: true,
    data: [],
    markArea: {
      silent: true,
      itemStyle: { borderWidth: 0 },
      data: [
        // TR — Leading (green)
        [
          { xAxis: 100, yAxis: 100, itemStyle: { color: quadrantStyle('--status-up-rgb', 0.07) } },
          { xAxis: xMax, yAxis: yMax },
        ],
        // BR — Weakening (amber)
        [
          { xAxis: 100, yAxis: yMin, itemStyle: { color: quadrantStyle('--accent-amber-rgb', 0.07) } },
          { xAxis: xMax, yAxis: 100 },
        ],
        // BL — Lagging (red)
        [
          { xAxis: xMin, yAxis: yMin, itemStyle: { color: quadrantStyle('--status-down-rgb', 0.07) } },
          { xAxis: 100, yAxis: 100 },
        ],
        // TL — Improving (blue)
        [
          { xAxis: xMin, yAxis: 100, itemStyle: { color: quadrantStyle('--accent-blue-rgb', 0.07) } },
          { xAxis: 100, yAxis: yMax },
        ],
      ],
    },
  };

  // Per-ticker palette (cycled). Each tail = one line series + one scatter
  // series for the head dot + label so the head is visually emphasized.
  const palette = [
    theme.accentCyan,
    theme.statusUp,
    theme.statusDown,
    '#a78bfa', // violet — distinct from the four quadrant fills
    theme.textSecondary,
  ];

  const tailSeries = data.tails.flatMap((tail, idx) => {
    const color = palette[idx % palette.length];
    const points = tail.points;
    if (points.length === 0) return [];
    // Tail line with opacity gradient via per-point itemStyle. Older points
    // fade toward 0.2; head sits at full opacity.
    const lineData = points.map((p, i) => ({
      value: [p.rsRatio, p.rsMomentum],
      itemStyle: {
        opacity: 0.2 + 0.8 * ((i + 1) / points.length),
        color,
      },
    }));
    const head = points[points.length - 1];
    return [
      {
        name: tail.ticker.ticker,
        type: 'line' as const,
        data: lineData,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color, width: 1.4, opacity: 0.6 },
        emphasis: { focus: 'series' as const },
        z: 10,
      },
      {
        name: `${tail.ticker.ticker} head`,
        type: 'scatter' as const,
        data: [
          {
            value: [head.rsRatio, head.rsMomentum],
            itemStyle: { color, opacity: 1 },
            label: {
              show: true,
              formatter: tail.ticker.ticker,
              position: 'right' as const,
              color: theme.textPrimary,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              padding: [2, 4, 2, 4],
              backgroundColor: theme.bgSurface,
              borderColor: color,
              borderWidth: 1,
            },
          },
        ],
        symbolSize: 12,
        z: 11,
        tooltip: {
          formatter: () =>
            `${tail.ticker.ticker} · ${head.date}<br/>` +
            `RS-Ratio ${head.rsRatio.toFixed(2)}<br/>` +
            `RS-Momentum ${head.rsMomentum.toFixed(2)}`,
        },
      },
    ];
  });

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 56, right: 96, top: 32, bottom: 36, containLabel: false },
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      name: 'RS-Ratio',
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
      min: yMin,
      max: yMax,
      name: 'RS-Momentum',
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
      trigger: 'item',
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: {
        color: theme.textPrimary,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
      },
    },
    // Centerline crosshairs at 100 / 100 + quadrant labels.
    graphic: quadrantLabels(theme, xMin, xMax, yMin, yMax),
    series: [quadrantSeries, ...tailSeries],
  };
}

/// ECharts `graphic` array with four corner labels naming each quadrant.
function quadrantLabels(
  theme: ReturnType<typeof getChartTheme>,
  _xMin: number,
  _xMax: number,
  _yMin: number,
  _yMax: number,
): echarts.EChartsCoreOption['graphic'] {
  const labelStyle = (color: string) => ({
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10,
    fontWeight: 'bold',
    fill: color,
    opacity: 0.55,
  });
  return [
    {
      type: 'text',
      right: 100,
      top: 36,
      style: { text: 'LEADING', ...labelStyle(theme.statusUp) },
      silent: true,
    },
    {
      type: 'text',
      right: 100,
      bottom: 40,
      style: { text: 'WEAKENING', ...labelStyle('#fbbf24') },
      silent: true,
    },
    {
      type: 'text',
      left: 60,
      bottom: 40,
      style: { text: 'LAGGING', ...labelStyle(theme.statusDown) },
      silent: true,
    },
    {
      type: 'text',
      left: 60,
      top: 36,
      style: { text: 'IMPROVING', ...labelStyle('#60a5fa') },
      silent: true,
    },
  ];
}

export function RrgTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_rrg_config',
    DEFAULT_CONFIG,
  );

  // Local benchmark text input — not committed until Apply (S15 Q3:
  // re-normalization is too costly to fire on every keystroke).
  const [benchmarkInput, setBenchmarkInput] = useState<string>(
    config.benchmark.ticker,
  );
  useEffect(() => {
    setBenchmarkInput(config.benchmark.ticker);
  }, [config.benchmark.ticker]);

  const [available, setAvailable] = useState<TickerCoverage[]>([]);
  useEffect(() => {
    let active = true;
    invoke<TickerCoverage[]>('list_tickers_with_coverage')
      .then((r) => {
        if (active) setAvailable(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [data, setData] = useState<RrgResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch on benchmark / tickers / periods / tail changes. Benchmark
  // commits via Apply (sets config.benchmark), which then triggers this.
  useEffect(() => {
    if (config.tickers.length === 0) {
      setData(null);
      setError(null);
      return;
    }
    const request: RrgRequest = {
      benchmark: config.benchmark,
      tickers: config.tickers,
      rsPeriod: config.rsPeriod,
      momentumPeriod: config.momentumPeriod,
      tailLength: config.tailLength,
    };
    let active = true;
    setLoading(true);
    setError(null);
    invoke<RrgResponse>('compute_rrg', { request })
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
    config.benchmark.ticker,
    config.benchmark.dataSource,
    config.tickers,
    config.rsPeriod,
    config.momentumPeriod,
    config.tailLength,
  ]);

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

  // Min weeks needed for a valid pair = rsPeriod + momentumPeriod weeks ≈
  // roughly that many calendar days × 7. Translate into a daily-bar minimum
  // for the chip-picker greyed gate.
  const minBars = useMemo(
    () => (config.rsPeriod + config.momentumPeriod + config.tailLength) * 5,
    [config.rsPeriod, config.momentumPeriod, config.tailLength],
  );

  const onTickersChange = (next: TickerKey[]) =>
    setConfig({ ...config, tickers: next });

  const applyBenchmark = () => {
    const trimmed = benchmarkInput.trim().toUpperCase();
    if (!trimmed) return;
    // Resolve dataSource from the available coverage list when possible;
    // fall back to 'yahoo' (the only equity-like source today).
    const match = available.find((c) => c.ticker.toUpperCase() === trimmed);
    setConfig({
      ...config,
      benchmark: {
        ticker: trimmed,
        dataSource: match?.dataSource ?? 'yahoo',
      },
    });
  };

  return (
    <div className="analysis-tab analysis-rrg">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Benchmark</label>
          <div className="analysis-rrg__benchmark-row">
            <input
              type="text"
              className="analysis-tab__select analysis-rrg__benchmark-input"
              value={benchmarkInput}
              onChange={(e) => setBenchmarkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyBenchmark();
              }}
              placeholder="^GSPC"
            />
            <button
              type="button"
              className="analysis-rrg__apply"
              onClick={applyBenchmark}
              disabled={
                benchmarkInput.trim().toUpperCase() ===
                config.benchmark.ticker.toUpperCase()
              }
            >
              Apply
            </button>
          </div>
        </div>
        <div className="analysis-tab__control-group analysis-tab__control-group--grow">
          <label className="analysis-tab__label">Tickers</label>
          <TickerChipPicker
            selected={config.tickers}
            onChange={onTickersChange}
            minBarsRequired={minBars}
          />
        </div>
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Tail (wk)</label>
          <select
            className="analysis-tab__select"
            value={config.tailLength}
            onChange={(e) =>
              setConfig({ ...config, tailLength: Number(e.target.value) })
            }
          >
            {TAIL_LENGTHS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </header>

      <TabIntro
        subtitle="A four-quadrant map of how each ticker is performing against a benchmark. The horizontal position shows whether it's beating the benchmark; the vertical position shows whether that's getting better or worse. The line behind each dot is its path over the last several weeks."
        howToRead={
          <>
            <ul>
              <li>
                <strong>Leading</strong> (top-right, green): beating the benchmark{' '}
                <em>and</em> the lead is growing. Strongest spot to be in.
              </li>
              <li>
                <strong>Weakening</strong> (bottom-right, amber): still ahead of the
                benchmark, but losing steam. Often the next stop after Leading.
              </li>
              <li>
                <strong>Lagging</strong> (bottom-left, red): trailing the benchmark{' '}
                <em>and</em> falling further behind.
              </li>
              <li>
                <strong>Improving</strong> (top-left, blue): trailing the benchmark, but
                the gap is closing — momentum has turned.
              </li>
              <li>
                <strong>The classical rotation goes clockwise:</strong> Leading → Weakening
                → Lagging → Improving → Leading. The <em>direction</em> the tail is
                pointing is usually more telling than where it currently sits. A dot deep
                in Leading but pointing down-and-right is on its way to Weakening.
              </li>
              <li>
                <strong>Benchmark:</strong> defaults to the S&amp;P 500. Type a different
                ticker — <code>^GSPTSE</code> for the TSX, <code>BTC-USD</code> for crypto
                rotation, <code>^IXIC</code> for tech-leadership view — and click Apply to
                compare against that instead.
              </li>
              <li>
                <strong>The labels describe state, not instructions.</strong> "Leading"
                doesn't mean "buy" — it means "currently outperforming, with momentum
                behind it."
              </li>
            </ul>
            <p>
              This implementation uses a simpler formula than Bloomberg's proprietary RRG,
              so exact dot positions may differ from a Bloomberg terminal — but the
              four-quadrant interpretation is the same.
            </p>
          </>
        }
        math={
          <>
            <p>
              <strong>Weekly resampling:</strong> last close per ISO week, joined across
              ticker and benchmark.
            </p>
            <p>
              <code>RS_t = ticker_t / benchmark_t</code>
            </p>
            <p>
              <code>RS-Ratio_t = 100 × RS_t / SMA(RS, 14w)_t</code>
            </p>
            <p>
              <code>RS-Momentum_t = 100 × RS-Ratio_t / SMA(RS-Ratio, 5w)_t</code>
            </p>
            <p>
              Both stats are dimensionless ratios anchored at 100 — "indexed deviation from
              the trailing mean."
            </p>
          </>
        }
      />

      {config.tickers.length === 0 && (
        <div className="analysis-tab__placeholder">
          Add tickers to plot rotation against {config.benchmark.ticker}.
        </div>
      )}

      {loading && !data && (
        <div className="analysis-tab__status">Computing rotation…</div>
      )}

      {error && <div className="analysis-tab__error">{error}</div>}

      {/* Always render visible — hiding via display:none at mount makes
          echarts.init see a zero-size container and the chart later draws
          into 0×0 even after data arrives. */}
      <div
        ref={containerRef}
        className="rrg-tab__chart"
        style={{ flex: '1 1 auto', minHeight: 520, width: '100%' }}
      />

      {data && (
        <footer className="analysis-tab__footnote">
          {data.tails.length} ticker{data.tails.length === 1 ? '' : 's'}
          {' · '}
          benchmark {data.benchmark.ticker} ({data.weeklyBars} weekly bars)
          {' · '}
          RS-Ratio {data.rsPeriod}w · RS-Momentum {data.momentumPeriod}w · tail {data.tailLength}w
          {data.excluded.length > 0 && (
            <span className="analysis-tab__excluded">
              {' '}· excluded: {data.excluded
                .map((e) => `${e.ticker} (${e.barCount}wk)`)
                .join(', ')}
            </span>
          )}
        </footer>
      )}
    </div>
  );
}

/* re-export so unused types lint stays quiet if we tighten later */
export type { RrgTail };
