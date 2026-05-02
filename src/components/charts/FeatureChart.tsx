import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';

import { IndicatorOutput, IndicatorSeriesPoint } from '../../types/indicator';
import { usePersistedState } from '../../hooks/usePersistedState';
import { getChartTheme } from '../../styles/chartTheme';

type LineObservation = { date: string; value: number };
type CandleBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

type Props = {
  title: string;
  units: string;
  mode: 'line' | 'candlestick';
  /** Used when mode='line' — MACRO feature charts. */
  observations?: LineObservation[];
  /** Used when mode='candlestick' — ticker feature charts. */
  bars?: CandleBar[];
  /** Indicator outputs — overlays drawn on the price pane, subpanes stacked below volume. */
  indicators?: IndicatorOutput[];
  /** Shared ECharts `connect()` group id — lets future multi-chart views sync crosshairs. */
  connectGroup?: string;
};


export default function FeatureChart({
  title,
  units,
  mode,
  observations = [],
  bars = [],
  indicators = [],
  connectGroup = 'macro',
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  /** Right-click toggles the hover stats tooltip. Crosshair stays visible. */
  const [tooltipVisible, setTooltipVisible] = useState(true);
  /** Y-axis controls. Persisted globally — same scale across all feature charts.
   *  Log mode was experimented with in S11 and dropped: ECharts' default log
   *  axis ticks at powers-of-10 only, which compresses sub-decade ranges (e.g.
   *  BTC's $30k-$70k window squeezes between 10k and 100k ticks). True log
   *  display TradingView-style requires either a manual log transform on a
   *  linear axis OR a chart-library swap — neither warranted for v1. Tracked
   *  in PROGRESS.md → Discovered for v1.1. */
  const [autoFitY, setAutoFitY] = usePersistedState<boolean>(
    'session.feature_chart_autofit',
    true,
  );
  const [showVolume, setShowVolume] = usePersistedState<boolean>(
    'session.feature_chart_show_volume',
    true,
  );
  const [showVrvp, setShowVrvp] = usePersistedState<boolean>(
    'session.feature_chart_show_vrvp',
    true,
  );
  const [showDrawdown, setShowDrawdown] = usePersistedState<boolean>(
    'session.feature_chart_show_drawdown',
    false,
  );
  const [pngFlash, setPngFlash] = useState(false);

  // Default visible window — last ~1 year (~252 trading days) for candlesticks,
  // full series for line mode.
  const defaultStartPct = useMemo(() => {
    if (mode !== 'candlestick' || bars.length <= 252) return 0;
    return Math.max(0, 100 * (1 - 252 / bars.length));
  }, [mode, bars.length]);

  /** Visible-window percent range. Drives auto-fit Y bounds. Updated by the
   *  ECharts `datazoom` event so the y-axis tightens to match the user's
   *  current zoom selection. */
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>(
    () => ({ start: defaultStartPct, end: 100 }),
  );

  // Reset visible range when the underlying bar set changes (new ticker selected).
  useEffect(() => {
    setVisibleRange({ start: defaultStartPct, end: 100 });
  }, [defaultStartPct, bars.length]);

  // Init / teardown. Re-uses ResizeObserver to survive flex layout settle.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.group = connectGroup;
    echarts.connect(connectGroup);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      setTooltipVisible((v) => !v);
    };
    el.addEventListener('contextmenu', onContext);
    // dataZoom event fires for both `inside` (mouse-wheel + drag) and
    // `slider` (handle drag). Payload shape varies — read current zoom
    // state from getOption() rather than the event itself.
    const onZoom = () => {
      const opt = chart.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> };
      const dz = opt.dataZoom?.[0];
      if (!dz) return;
      const start = dz.start ?? 0;
      const end = dz.end ?? 100;
      setVisibleRange((prev) =>
        Math.abs(prev.start - start) < 0.01 && Math.abs(prev.end - end) < 0.01
          ? prev
          : { start, end },
      );
    };
    chart.on('datazoom', onZoom);
    return () => {
      chart.off('datazoom', onZoom);
      el.removeEventListener('contextmenu', onContext);
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [connectGroup]);

  const option = useMemo<echarts.EChartsCoreOption>(() => {
    if (mode === 'candlestick') {
      return buildCandlestickOption({
        title,
        units,
        bars,
        indicators,
        tooltipVisible,
        autoFitY,
        showVolume,
        visibleRange,
        defaultStartPct,
        showVrvp,
        showDrawdown,
      });
    }
    return buildLineOption({ title, units, observations, tooltipVisible });
  }, [
    mode,
    title,
    units,
    observations,
    bars,
    indicators,
    tooltipVisible,
    autoFitY,
    showVolume,
    visibleRange,
    defaultStartPct,
    showVrvp,
    showDrawdown,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true });
    chart.resize();
  }, [option]);

  const saveImage = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: getChartTheme().bgBase,
    });
    const safeTitle = title.replace(/[^\w\d-]+/g, '-').replace(/^-+|-+$/g, '');
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle || 'chart'}-${date}.png`;
    a.click();
    setPngFlash(true);
    setTimeout(() => setPngFlash(false), 1500);
  };

  return (
    <div className="feature-chart">
      <div className="feature-chart__toolbar">
        {mode === 'candlestick' && (
          <>
            <button
              type="button"
              className={`feature-chart__tool ${autoFitY ? 'feature-chart__tool--active' : ''}`}
              onClick={() => setAutoFitY((v) => !v)}
              title="Auto-fit Y axis to visible window (default on). Off = stable Y across all data."
            >
              AUTO Y
            </button>
            <button
              type="button"
              className={`feature-chart__tool ${showVolume ? 'feature-chart__tool--active' : ''}`}
              onClick={() => setShowVolume((v) => !v)}
              title="Show / hide the volume pane (saves vertical room for the price chart)"
            >
              VOL
            </button>
            <button
              type="button"
              className={`feature-chart__tool ${showVrvp ? 'feature-chart__tool--active' : ''}`}
              onClick={() => setShowVrvp((v) => !v)}
              title="Volume Profile — overlays a horizontal histogram of total volume by price level on the right side of the price pane. POC bin highlighted yellow."
            >
              VRVP
            </button>
            <button
              type="button"
              className={`feature-chart__tool ${showDrawdown ? 'feature-chart__tool--active' : ''}`}
              onClick={() => setShowDrawdown((v) => !v)}
              title="Drawdown — subpane below price showing % decline from the running peak. Floor = max drawdown over the visible window."
            >
              DD
            </button>
          </>
        )}
        <button
          type="button"
          className="feature-chart__tool"
          onClick={saveImage}
          title="Save the current chart as a PNG (includes current zoom + indicators)"
        >
          PNG
        </button>
        {pngFlash && (
          <span className="feature-chart__flash">✓ saved to Downloads</span>
        )}
      </div>
      <div ref={ref} className="feature-chart__canvas" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Line mode (MACRO feature chart). Unchanged from the M2 version.
// ────────────────────────────────────────────────────────────────────────────

function buildLineOption({
  title,
  units,
  observations,
  tooltipVisible,
}: {
  title: string;
  units: string;
  observations: LineObservation[];
  tooltipVisible: boolean;
}): echarts.EChartsCoreOption {
  const theme = getChartTheme();
  return {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      color: theme.textPrimary,
    },
    graphic: watermarkGraphic(title, 56),
    grid: { left: 60, right: 24, top: 32, bottom: 40 },
    tooltip: {
      show: true,
      showContent: tooltipVisible,
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: theme.borderEmphasis, type: 'dashed', width: 1 },
      },
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: { color: theme.textPrimary },
      valueFormatter: (v: number | string) =>
        typeof v === 'number' ? formatValue(v, units) : String(v),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.borderEmphasis } },
      axisLabel: { color: theme.textSecondary },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: theme.borderEmphasis } },
      axisLabel: {
        color: theme.textSecondary,
        formatter: (v: number) => formatValue(v, units),
      },
      splitLine: { lineStyle: { color: theme.borderSubtle } },
    },
    series: [
      {
        name: title,
        type: 'line',
        data: observations.map((o) => [o.date, o.value]),
        showSymbol: false,
        lineStyle: { color: theme.accentCyan, width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.accentCyanFillStrong },
            { offset: 1, color: theme.accentCyanFillFade },
          ]),
        },
      },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Candlestick mode — price + volume + N subpanes + dataZoom.
// ────────────────────────────────────────────────────────────────────────────

function buildCandlestickOption({
  title,
  units,
  bars,
  indicators,
  tooltipVisible,
  autoFitY,
  showVolume,
  visibleRange,
  defaultStartPct,
  showVrvp,
  showDrawdown,
}: {
  title: string;
  units: string;
  bars: CandleBar[];
  indicators: IndicatorOutput[];
  tooltipVisible: boolean;
  autoFitY: boolean;
  showVolume: boolean;
  visibleRange: { start: number; end: number };
  defaultStartPct: number;
  showVrvp: boolean;
  showDrawdown: boolean;
}): echarts.EChartsCoreOption {
  const theme = getChartTheme();
  const overlayIndicators = indicators.filter((i) => i.pane === 'overlay');
  const subpaneIndicators = indicators.filter((i) => i.pane === 'subpane');

  // Layout: price pane is the biggest; drawdown (when shown) sits directly
  // below price; volume (when shown) is slim and below drawdown; each
  // subpane indicator gets its own slim pane below volume. Pane indices
  // are assigned sequentially as toggles flip, so series can pin
  // themselves to the right pane without per-toggle conditional math.
  let nextPaneIdx = 1;
  const drawdownPaneIndex = showDrawdown ? nextPaneIdx++ : -1;
  const volumePaneIndex = showVolume ? nextPaneIdx++ : -1;
  const subpaneStartIndex = nextPaneIdx;
  const paneCount = subpaneStartIndex + subpaneIndicators.length;

  // Volume Profile (visible-range) bin computation — buckets total volume by
  // close-price across the visible window. Returns null when the visible
  // window has no volume (e.g. DXY / FX), in which case the overlay
  // auto-suppresses regardless of the toggle state.
  const VRVP_BIN_COUNT = 180;
  const VRVP_OVERLAY_RATIO = 0.18; // fraction of price-pane width consumed by the overlay
  const visibleBars = sliceVisibleBars(bars, visibleRange);
  const vrvpData = showVrvp ? computeVrvpBins(visibleBars, VRVP_BIN_COUNT) : null;

  // Y-axis bounds for auto-fit. Price pane (idx 0) and ATR-style subpanes
  // tighten to the visible X window. Volume pane (idx 1) stays anchored at 0.
  // RSI subpanes stay fixed at [0, 100] — the indicator's whole semantic.
  const padPct = 0.03; // 3% headroom above/below visible high/low
  const priceBounds =
    autoFitY && visibleBars.length > 0
      ? padBounds(priceLowHigh(visibleBars), padPct)
      : null;

  const grids = layoutGrids(paneCount);

  const xAxisArr = grids.map((_g, i) => ({
    type: 'category' as const,
    gridIndex: i,
    data: bars.map((b) => b.date),
    scale: true,
    boundaryGap: false,
    axisLine: { lineStyle: { color: theme.borderEmphasis } },
    axisLabel: i === paneCount - 1 ? { color: theme.textSecondary, fontSize: 10 } : { show: false },
    axisTick: { show: i === paneCount - 1 },
    splitLine: { show: false },
  }));

  const yAxisArr: any[] = grids.map((_g, i) => {
    const baseAxis: any = {
      gridIndex: i,
      type: 'value' as const,
      scale: true,
      axisLine: { lineStyle: { color: theme.borderEmphasis } },
      axisLabel: {
        color: theme.textSecondary,
        fontSize: 10,
        formatter: i === 0 ? (v: number) => formatValue(v, units) : undefined,
      },
      splitLine: { lineStyle: { color: theme.borderSubtle } },
    };
    if (i === 0) {
      // Price pane — auto-fit Y applies here.
      if (priceBounds) {
        baseAxis.min = priceBounds.min;
        baseAxis.max = priceBounds.max;
      }
    } else if (i === drawdownPaneIndex) {
      // Drawdown pane — anchored at 0% top, auto-fit floor from visible window.
      // Drawdowns are always ≤ 0 by construction so the upper bound is fixed.
      baseAxis.axisLabel = {
        color: theme.textSecondary,
        fontSize: 10,
        formatter: (v: number) => `${v.toFixed(0)}%`,
      };
      baseAxis.max = 0;
      if (autoFitY && visibleBars.length > 0) {
        const visibleDd = computeDrawdown(visibleBars.map((b) => b.close));
        let minDd = 0;
        for (const v of visibleDd) {
          if (v !== null && v < minDd) minDd = v;
        }
        baseAxis.min = minDd === 0 ? -1 : minDd * 1.05; // 5% padding below floor
      }
    } else if (i === volumePaneIndex) {
      // Volume pane — anchor to 0 baseline, no auto-fit.
      baseAxis.axisLabel = { color: theme.textSecondary, fontSize: 10, formatter: formatVolume };
      baseAxis.min = 0;
    } else {
      // Subpane indicators (RSI, ATR, …). Pin RSI to [0, 100]; auto-fit ATR
      // and any other future indicator that benefits from a tight window.
      const subIdx = i - subpaneStartIndex;
      const ind = subpaneIndicators[subIdx];
      if (ind?.id === 'rsi_14') {
        baseAxis.min = 0;
        baseAxis.max = 100;
      } else if (autoFitY && ind && visibleBars.length > 0) {
        const indBounds = padBounds(
          subpaneSeriesLowHigh(visibleBars, ind),
          padPct,
        );
        if (indBounds) {
          baseAxis.min = indBounds.min;
          baseAxis.max = indBounds.max;
        }
      }
    }
    return baseAxis;
  });

  // Dedicated hidden value-axis on the price grid for the VRVP series.
  // Decouples VRVP from the time-axis dataZoom — without this, ECharts
  // culls custom-series data points whose category index falls outside the
  // current zoom window, producing dead-zones where the overlay vanishes
  // mid-pan. Value-axis range [0, 1] with the anchor at 0.5 means the data
  // point is always "in range," so renderItem always fires.
  const vrvpXAxisIndex = xAxisArr.length;
  if (vrvpData) {
    xAxisArr.push({
      type: 'value' as const,
      gridIndex: 0,
      min: 0,
      max: 1,
      show: false,
      splitLine: { show: false },
    } as any);
  }

  // Heterogeneous series (candlestick + line + bar). ECharts' SeriesOption
  // union is hard to narrow when pushing; `any[]` is the pragmatic choice
  // for this polymorphic option graph. Runtime shape is what ECharts reads.
  const series: any[] = [];

  // Main candlestick series.
  const candleData = bars.map((b) => [b.open ?? b.close, b.close, b.low ?? b.close, b.high ?? b.close]);
  series.push({
    name: title,
    type: 'candlestick',
    xAxisIndex: 0,
    yAxisIndex: 0,
    data: candleData,
    itemStyle: {
      color: theme.statusUp,
      color0: theme.statusDown,
      borderColor: theme.statusUp,
      borderColor0: theme.statusDown,
    },
    markPoint: buildMarkPoint(overlayIndicators, bars),
    z: 10, // candles render above indicator fills
  });

  // Overlay indicator series on price grid. Series sharing a `stackGroup`
  // render as stacked area fills (used by SMMA Ribbon's state-coloured envelope
  // between v1 and v2). Plain lines render above the fills.
  for (const ind of overlayIndicators) {
    for (const s of ind.series) {
      const isStacked = !!s.stackGroup;
      series.push({
        name: s.name,
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: alignToCategories(bars, s.data),
        showSymbol: false,
        smooth: false,
        connectNulls: false,
        // itemStyle.color drives the legend swatch when legend.icon is set
        // to a shape (roundRect here). Stacked series show their fill color;
        // outlines show their line color.
        itemStyle: { color: s.color },
        ...(isStacked
          ? {
              stack: `${ind.id}_${s.stackGroup}`,
              lineStyle: { opacity: 0, width: 0 },
              areaStyle: { color: s.color, opacity: 1 },
              symbol: 'none',
            }
          : {
              lineStyle: s.hidden
                ? { opacity: 0, width: 0 }
                : { color: s.color, width: 1 },
            }),
      });
    }
  }

  // Volume bar series on the volume pane — only when VOL is on.
  if (showVolume) {
    series.push({
      name: 'Volume',
      type: 'bar',
      xAxisIndex: volumePaneIndex,
      yAxisIndex: volumePaneIndex,
      data: bars.map((b) => b.volume ?? 0),
      itemStyle: {
        color: (params: { dataIndex: number }) => {
          const b = bars[params.dataIndex];
          return (b.close ?? 0) >= (b.open ?? b.close ?? 0) ? theme.volUp : theme.volDown;
        },
      },
    });
  }

  // Drawdown subpane — % decline from running peak. Filled red area dropping
  // from 0% to the visible-window floor. Computed on the full bar series so
  // the running peak survives across the dataZoom window; auto-fit y-min is
  // taken from the visible slice so the floor reads at full pane height.
  if (showDrawdown) {
    const drawdownData = computeDrawdown(bars.map((b) => b.close));
    series.push({
      name: 'Drawdown',
      type: 'line',
      xAxisIndex: drawdownPaneIndex,
      yAxisIndex: drawdownPaneIndex,
      data: drawdownData,
      showSymbol: false,
      smooth: false,
      connectNulls: false,
      lineStyle: { color: theme.statusDown, width: 1 },
      areaStyle: { color: theme.statusDownFill },
      z: 5,
    });
  }

  // Subpane indicator line series — pane index depends on whether volume
  // is shown (volume pushes subpanes down by one).
  subpaneIndicators.forEach((ind, subpaneIdx) => {
    const gridIdx = subpaneStartIndex + subpaneIdx;
    for (const s of ind.series) {
      series.push({
        name: s.name,
        type: 'line',
        xAxisIndex: gridIdx,
        yAxisIndex: gridIdx,
        data: alignToCategories(bars, s.data),
        showSymbol: false,
        lineStyle: { color: s.color, width: 1.25 },
        itemStyle: { color: s.color },
        connectNulls: false,
        // RSI threshold markers (70 / 30)
        ...(ind.id === 'rsi_14'
          ? {
              markLine: {
                symbol: 'none',
                silent: true,
                lineStyle: { color: theme.markerLine, type: 'dashed', width: 1 },
                data: [{ yAxis: 70 }, { yAxis: 30 }],
                label: { show: false },
              },
            }
          : {}),
      });
    }
  });

  // Volume Profile overlay — semi-transparent horizontal histogram of
  // total volume by price level, occupying the right ~18% of the price pane.
  // POC bin (highest-volume price level in the visible window) renders in
  // translucent yellow, all other bins in translucent gray. Pixel positioning
  // uses params.coordSys, so the anchor x-value (0.5 on the dedicated value-
  // axis) is irrelevant to placement — it only exists to keep the data point
  // "in range" so ECharts never culls it.
  if (vrvpData) {
    const POC_FILL = theme.vrvpPoc;
    const BAR_FILL = theme.vrvpBar;
    series.push({
      name: 'VRVP',
      type: 'custom',
      xAxisIndex: vrvpXAxisIndex,
      yAxisIndex: 0,
      data: vrvpData.bins.map((bin) => ({ value: [0.5, bin.midPrice] })),
      renderItem: (params: any, api: any) => {
        const i = params.dataIndex;
        const bin = vrvpData.bins[i];
        const isPoc = i === vrvpData.pocIndex;
        const cs = params.coordSys as { x: number; y: number; width: number; height: number };
        const gridRight = cs.x + cs.width;
        const zoneWidth = cs.width * VRVP_OVERLAY_RATIO;
        const barLen = (bin.volume / vrvpData.maxVolume) * zoneWidth;
        const yTop = api.coord([0.5, bin.priceHigh])[1];
        const yBottom = api.coord([0.5, bin.priceLow])[1];
        return {
          type: 'rect',
          shape: {
            x: gridRight - barLen,
            y: yTop,
            width: barLen,
            height: Math.max(1, yBottom - yTop - 0.5),
          },
          style: {
            fill: isPoc ? POC_FILL : BAR_FILL,
            stroke: theme.vrvpStroke,
            lineWidth: 0.5,
          },
        };
      },
      silent: true,
      clip: false,
      tooltip: { show: false }, // axis tooltip would otherwise list every bin
      z: 15, // above candles (z=10) so the overlay reads
    });
  }

  // dataZoom widgets track the user's current drag position. The default
  // window only applies on first paint (and on bar-set change, where the
  // parent component resets `visibleRange` for us). Reading `visibleRange`
  // here means option rebuilds (e.g. after VOL toggle, indicator change, or
  // a `setVisibleRange` from the datazoom handler) leave the slider where
  // the user put it instead of snapping back to default.
  const allPaneAxisIndices = Array.from({ length: paneCount }, (_, i) => i);

  // Pin the watermark to the price grid's vertical center so it stays
  // behind the candles when subpanes (drawdown / volume / RSI / ATR) push
  // the chart's geometric center down. Horizontal uses ECharts' 'center'
  // keyword (auto-centers the text box on the container) — a numeric
  // `left: '50%'` would anchor the box's left edge, not its center,
  // despite `textAlign: 'center'`.
  const priceGrid = grids[0];
  const watermarkCenter = {
    topPct: parseFloat(priceGrid.top) + parseFloat(priceGrid.height) / 2,
  };

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'JetBrains Mono, Consolas, monospace', color: theme.textPrimary },
    graphic: watermarkGraphic(title, 96, watermarkCenter),
    tooltip: {
      show: true,
      showContent: tooltipVisible,
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: theme.borderEmphasis, type: 'dashed', width: 1 },
      },
      backgroundColor: theme.bgSurface,
      borderColor: theme.borderEmphasis,
      textStyle: { color: theme.textPrimary, fontSize: 11 },
      valueFormatter: (v: number | string) =>
        typeof v === 'number' ? formatTickerValue(v) : String(v),
    },
    // Link the crosshair across the time-series panes so it snaps together
    // vertically. The VRVP value-axis is intentionally excluded — it has no
    // time semantics, so linking it would just confuse axisPointer math.
    axisPointer: { link: [{ xAxisIndex: allPaneAxisIndices }] },
    legend: {
      show: overlayIndicators.length + subpaneIndicators.length > 0,
      top: 2,
      textStyle: { color: theme.textSecondary, fontSize: 10 },
      // Force rectangular icons so stacked-area series (lineStyle.opacity=0)
      // don't render as invisible/gray swatches — the rect icon picks up
      // `itemStyle.color`, which we set to match the visual fill/stroke.
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
      // All series appear in legend.data — omitting a series makes ECharts
      // treat it as legend-unselected and drop it from the stack, which
      // collapses stacked-area envelopes (e.g. SMMA Ribbon's `Base`). If we
      // want to suppress a legend entry later, use `legend.selected` to force
      // it on while omitting the text — not `legend.data` filtering.
      data: [
        ...overlayIndicators.flatMap((ind) => ind.series.map((s) => s.name)),
        ...subpaneIndicators.flatMap((ind) => ind.series.map((s) => s.name)),
      ],
    },
    grid: grids,
    xAxis: xAxisArr,
    yAxis: yAxisArr,
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: allPaneAxisIndices,
        start: visibleRange.start,
        end: visibleRange.end,
      },
      {
        type: 'slider',
        xAxisIndex: allPaneAxisIndices,
        start: visibleRange.start,
        end: visibleRange.end,
        bottom: 4,
        height: 20,
        backgroundColor: theme.zoomBg,
        fillerColor: theme.accentCyanFillSoft,
        borderColor: theme.borderEmphasis,
        handleStyle: { color: theme.borderEmphasis },
        textStyle: { color: theme.textSecondary, fontSize: 9 },
      },
    ],
    series,
  };
}

function layoutGrids(paneCount: number): { left: number; right: number; top: string; height: string }[] {
  // Vertical budget (percent of chart area; ~14% reserved at bottom for the
  // dataZoom slider). Non-price panes each get a fixed slim height; price
  // pane absorbs whatever's left. Toggling a pane off (e.g. VOL → hidden)
  // returns its full height to price rather than just freeing the inter-pane
  // gap. Keeps the price chart usable regardless of how many subpanes are on.
  const sliderReserve = 14;
  const usable = 100 - sliderReserve;
  const gapBetween = 2;
  const otherPaneCount = Math.max(0, paneCount - 1);
  const otherPaneHeight = 12; // slim, matches volume's typical ECharts proportions
  const totalGaps = gapBetween * Math.max(0, paneCount - 1);
  const priceHeight = Math.max(
    24, // floor — never starve price below readable
    usable - totalGaps - otherPaneHeight * otherPaneCount,
  );

  const grids: { left: number; right: number; top: string; height: string }[] = [];
  let cursor = 4; // percent from top (leaves space for legend)
  for (let i = 0; i < paneCount; i++) {
    const h = i === 0 ? priceHeight : otherPaneHeight;
    grids.push({
      left: 60,
      right: 24,
      top: `${cursor}%`,
      height: `${h}%`,
    });
    cursor += h + gapBetween;
  }
  return grids;
}

function buildMarkPoint(overlayIndicators: IndicatorOutput[], bars: CandleBar[]) {
  const markers = overlayIndicators.flatMap((ind) => ind.markers);
  if (markers.length === 0) return undefined;
  const theme = getChartTheme();
  // Only render markers whose date exists in the current bar set.
  const dateSet = new Set(bars.map((b) => b.date));
  return {
    symbolSize: 12,
    label: { show: false },
    data: markers
      .filter((m) => dateSet.has(m.date))
      .map((m) => {
        // ECharts only supports 'triangle' (pointing up). Rotate 180° for down.
        const [symbol, rotate] =
          m.symbol === 'triangle-down'
            ? ['triangle', 180]
            : m.symbol === 'triangle-up' || m.symbol === 'arrow'
              ? ['triangle', 0]
              : ['circle', 0];
        return {
          name: m.label,
          coord: [m.date, m.value],
          value: m.label,
          itemStyle: { color: m.color, borderColor: theme.bgBase, borderWidth: 1 },
          symbol,
          symbolRotate: rotate,
        };
      }),
  };
}

/** ECharts category axes match x by *index*, not by label. We map indicator
 *  series into an aligned Vec<Option<number>> by date so the lines render
 *  at the right x position for every bar. Missing dates become nulls. */
function alignToCategories(bars: CandleBar[], pts: IndicatorSeriesPoint[]): (number | null)[] {
  const byDate = new Map<string, number | null>();
  for (const p of pts) byDate.set(p.date, p.value);
  return bars.map((b) => byDate.get(b.date) ?? null);
}

function formatValue(v: number, units: string): string {
  const u = units.toLowerCase();
  if (u.includes('percent')) return `${v.toFixed(2)}%`;
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Decimal scaling for the candlestick tooltip — mirrors formatPrice() in
// types/sector.ts so chart hover matches tile precision. Applies to every
// numeric series in the candle chart (OHLC, indicators, volume), so the
// magnitude tiers fall through cleanly: large volume ints render with no
// decimals, RSI lands at 4dp (slightly noisier than 2dp but readable),
// sub-cent crypto gets 6dp.
function formatTickerValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs >= 0.01) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs === 0) return '0';
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

/** Drawdown % from running peak. For each close[i], computes
 *  (close[i] / max(close[0..i]) - 1) * 100. Always ≤ 0. Skips
 *  non-positive closes (would invert the percent calculation). */
function computeDrawdown(closes: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let peak = -Infinity;
  for (const c of closes) {
    if (!Number.isFinite(c) || c <= 0) {
      out.push(null);
      continue;
    }
    if (c > peak) peak = c;
    out.push(peak > 0 ? (c / peak - 1) * 100 : null);
  }
  return out;
}

// Faint centered text behind the chart — terminal-style watermark.
// Default placement is the chart container's geometric center (used by
// single-pane line mode). Pass `gridCenter` to pin the watermark to a
// specific grid's center instead — the candlestick chart uses this so
// the watermark stays behind the price pane regardless of how many
// subpanes (volume / drawdown / RSI / ATR) are toggled on.
function watermarkGraphic(
  text: string,
  fontSize: number,
  gridCenter?: { topPct: number },
) {
  const positional = gridCenter
    ? { left: 'center' as const, top: `${gridCenter.topPct}%` }
    : { left: 'center' as const, top: 'middle' as const };
  return {
    type: 'text' as const,
    ...positional,
    z: 0,
    silent: true,
    style: {
      text,
      fill: getChartTheme().watermarkFill,
      fontSize,
      fontWeight: 'bold' as const,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      textAlign: 'center' as const,
      textVerticalAlign: 'middle' as const,
    },
  };
}

// ──── Auto-fit Y bounds helpers (M8.6) ──────────────────────────────────────

/** Slice the bar array to whatever's currently visible per the dataZoom
 *  start/end percent. Indices are inclusive on both ends to match ECharts'
 *  filter semantics. */
function sliceVisibleBars(bars: CandleBar[], range: { start: number; end: number }): CandleBar[] {
  if (bars.length === 0) return bars;
  const i0 = Math.max(0, Math.floor((range.start / 100) * bars.length));
  const i1 = Math.min(bars.length, Math.ceil((range.end / 100) * bars.length));
  if (i1 <= i0) return [];
  return bars.slice(i0, i1);
}

function priceLowHigh(bars: CandleBar[]): { min: number; max: number } | null {
  if (bars.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const b of bars) {
    const lo = b.low ?? b.close;
    const hi = b.high ?? b.close;
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min, max };
}

function subpaneSeriesLowHigh(
  bars: CandleBar[],
  ind: IndicatorOutput,
): { min: number; max: number } | null {
  if (bars.length === 0) return null;
  const dateSet = new Set(bars.map((b) => b.date));
  let min = Infinity;
  let max = -Infinity;
  for (const s of ind.series) {
    for (const p of s.data) {
      if (!dateSet.has(p.date)) continue;
      if (p.value === null) continue;
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
  }
  if (!isFinite(min) || !isFinite(max)) return null;
  return { min, max };
}

// Volume Profile bin computation. Buckets total volume by close-price into
// N equal-width bins across the visible price range. Returns null when the
// visible window has no volume (e.g. DXY / FX) so the caller auto-suppresses
// the overlay regardless of the toggle state.
type VrvpBin = { priceLow: number; priceHigh: number; midPrice: number; volume: number; barCount: number };
type VrvpData = { bins: VrvpBin[]; pocIndex: number; maxVolume: number; binWidth: number };

function computeVrvpBins(visibleBars: CandleBar[], binCount: number): VrvpData | null {
  if (visibleBars.length === 0) return null;
  const bounds = priceLowHigh(visibleBars);
  if (!bounds) return null;
  const { min, max } = bounds;
  const range = max - min;
  if (range <= 0) return null;
  const binWidth = range / binCount;
  const bins: VrvpBin[] = Array.from({ length: binCount }, (_, i) => ({
    priceLow: min + i * binWidth,
    priceHigh: min + (i + 1) * binWidth,
    midPrice: min + (i + 0.5) * binWidth,
    volume: 0,
    barCount: 0,
  }));
  for (const bar of visibleBars) {
    const v = bar.volume ?? 0;
    if (v <= 0) continue;
    let idx = Math.floor((bar.close - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].volume += v;
    bins[idx].barCount += 1;
  }
  let maxVolume = 0;
  let pocIndex = 0;
  bins.forEach((b, i) => {
    if (b.volume > maxVolume) {
      maxVolume = b.volume;
      pocIndex = i;
    }
  });
  if (maxVolume <= 0) return null; // no volume in visible window — auto-suppress
  return { bins, pocIndex, maxVolume, binWidth };
}

/** Add headroom above/below the data extent so candles/lines don't kiss the
 *  pane edges. Padding is a fraction of the range, with a small floor so
 *  flat windows still get visible breathing room. */
function padBounds(
  bounds: { min: number; max: number } | null,
  padFraction: number,
): { min: number; max: number } | null {
  if (!bounds) return null;
  const { min, max } = bounds;
  const range = Math.max(max - min, Math.abs(max) * 0.001);
  const pad = range * padFraction;
  return { min: min - pad, max: max + pad };
}
