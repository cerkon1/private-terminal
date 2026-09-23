import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import { getChartTheme } from '../../styles/chartTheme';
import type { BacktestPerf, BacktestResponse, TickerKey } from '../../types/analysis';
import { TabIntro } from './TabIntro';
import { TickerChipPicker } from './TickerChipPicker';

/// v1.1 — does the SMMA Ribbon's regime flip carry any edge on this ticker?
/// Long-only: enter the bar after a confirmed bullish flip, exit the bar
/// after it leaves bullish. All rules live in src-tauri/src/analysis/backtest.rs.

type StoredConfig = { ticker: TickerKey | null };
const DEFAULT_CONFIG: StoredConfig = { ticker: null };
const MIN_BARS = 252;

const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

export function BacktestTab() {
  const [config, setConfig] = usePersistedState<StoredConfig>(
    'session.analysis_backtest_config',
    DEFAULT_CONFIG,
  );
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticker = config.ticker;
    if (!ticker) {
      setData(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    invoke<BacktestResponse>('compute_backtest', { request: { ticker } })
      .then((r) => {
        if (!active) return;
        setData(r);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
        setData(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.ticker]);

  // ECharts: container always mounted (EC-15); ResizeObserver (EC-5).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  const sim = data?.simulation ?? null;
  const option = useMemo(() => (sim && data ? buildOption(data.ticker.ticker, sim.equity) : null), [data, sim]);
  useEffect(() => {
    if (!chartRef.current) return;
    if (option) chartRef.current.setOption(option, { notMerge: true });
    else chartRef.current.clear();
  }, [option]);

  const rows: { label: string; value: (p: BacktestPerf) => string }[] = [
    { label: 'Total return', value: (p) => pct(p.totalReturnPct) },
    { label: 'CAGR', value: (p) => pct(p.cagrPct) },
    { label: 'Max drawdown', value: (p) => pct(p.maxDrawdownPct) },
    { label: 'Time in market', value: (p) => `${p.timeInMarketPct.toFixed(0)}%` },
  ];

  return (
    <div className="analysis-tab analysis-backtest">
      <header className="analysis-tab__controls">
        <div className="analysis-tab__control-group">
          <label className="analysis-tab__label">Ticker</label>
          <TickerChipPicker
            selected={config.ticker ? [config.ticker] : []}
            onChange={(next) => setConfig((prev) => ({ ...prev, ticker: next[0] ?? null }))}
            minBarsRequired={MIN_BARS}
            maxChips={1}
            placeholder="ticker…"
          />
        </div>
      </header>

      <TabIntro
        subtitle="Would following the SMMA Ribbon's bullish regime have beaten simply holding? A long-only replay over the ticker's cached history."
        howToRead={
          <ul>
            <li>
              <strong>Rules:</strong> buy at the <em>next bar's open</em> after the ribbon's
              confirmed state turns bullish; sell at the next bar's open after it stops being
              bullish. Cash in between. Default ribbon settings (15/19/25/29, 3-bar confirm) —
              the same ones Pulse uses.
            </li>
            <li>
              <strong>Strategy vs Buy &amp; hold</strong> cover the same span, from the first bar
              after the ribbon's warm-up to the last cached bar.
            </li>
            <li>
              <strong>Time in market</strong> matters: a strategy that makes a bit less while
              holding half as often took far less exposure.
            </li>
            <li>
              An <strong>open</strong> trade is still running — its result is marked to the last
              close.
            </li>
          </ul>
        }
        math={
          <>
            <p>
              Trade return = <code>exit / entry − 1</code>. Strategy equity compounds trade
              returns from 100, marked to each close while in a position.
            </p>
            <p>
              CAGR = <code>(final / 100)^(365.25 / days) − 1</code> (shown for spans of a year or
              more). Max drawdown = deepest fall of the equity curve from its running peak.
            </p>
          </>
        }
        liabilityNote="Decision support, not investment advice. No commissions, slippage, spreads, dividends or taxes; one ticker, one parameter set, cached history only — sample and survivorship bias apply. Past behaviour of a signal says nothing certain about the future."
      />

      {!config.ticker && (
        <div className="analysis-tab__placeholder">Pick a ticker with at least a year of history.</div>
      )}
      {loading && !data && <div className="analysis-tab__status">Replaying…</div>}
      {error && <div className="analysis-tab__error">{error}</div>}
      {data && data.excluded.length > 0 && (
        <div className="analysis-tab__placeholder">
          {data.ticker.ticker}: {data.excluded[0].reason} ({data.barCount} bars cached).
        </div>
      )}

      {sim && (
        <div className="backtest__summary">
          <table className="backtest__table">
            <thead>
              <tr>
                <th />
                <th>Ribbon (long-only)</th>
                <th>Buy &amp; hold</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="mono">{r.value(sim.strategy)}</td>
                  <td className="mono">{r.value(sim.buyHold)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="backtest__trade-stats">
            <span><strong>{sim.tradeStats.trades}</strong> trades</span>
            <span>win rate <strong>{pct(sim.tradeStats.winRatePct, 0).replace('+', '')}</strong></span>
            <span>avg <strong>{pct(sim.tradeStats.avgTradePct)}</strong></span>
            <span>median <strong>{pct(sim.tradeStats.medianTradePct)}</strong></span>
            <span>best <strong>{pct(sim.tradeStats.bestTradePct)}</strong></span>
            <span>worst <strong>{pct(sim.tradeStats.worstTradePct)}</strong></span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="backtest__chart" style={{ minHeight: 320, width: '100%' }} />

      {sim && sim.trades.length > 0 && (
        <div className="backtest__trades">
          <table className="backtest__table backtest__table--trades">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Bars</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {[...sim.trades].reverse().map((t) => (
                <tr key={t.entryDate}>
                  <td className="mono">{t.signalDate}</td>
                  <td className="mono">
                    {t.entryDate} @ {t.entryPrice.toPrecision(6)}
                  </td>
                  <td className="mono">
                    {t.open ? 'open · ' : ''}
                    {t.exitDate} @ {t.exitPrice.toPrecision(6)}
                  </td>
                  <td className="mono">{t.barsHeld}</td>
                  <td className={`mono ${t.returnPct >= 0 ? 'yoy-up' : 'yoy-down'}`}>{pct(t.returnPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && sim && (
        <footer className="analysis-tab__footnote">
          {data.barCount} bars · {data.startDate} → {data.endDate} · entries/exits at next open
        </footer>
      )}
    </div>
  );
}

function buildOption(
  ticker: string,
  equity: { date: string; strategy: number; buyHold: number }[],
): echarts.EChartsCoreOption {
  const theme = getChartTheme();
  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 64, right: 24, top: 36, bottom: 36 },
    legend: {
      top: 4,
      textStyle: { color: theme.textSecondary, fontSize: 11 },
      data: ['Ribbon (long-only)', `${ticker} buy & hold`],
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => (typeof v === 'number' ? v.toFixed(1) : String(v)),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.borderSubtle } },
      axisLabel: { color: theme.textTertiary, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: 'Growth of 100',
      nameTextStyle: { color: theme.textTertiary, fontSize: 10 },
      axisLabel: { color: theme.textTertiary, fontSize: 10 },
      splitLine: { lineStyle: { color: theme.borderSubtle } },
    },
    series: [
      {
        name: 'Ribbon (long-only)',
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.5, color: theme.accentCyan },
        itemStyle: { color: theme.accentCyan },
        data: equity.map((p) => [p.date, p.strategy]),
      },
      {
        name: `${ticker} buy & hold`,
        type: 'line',
        showSymbol: false,
        lineStyle: { width: 1.2, color: theme.textTertiary },
        itemStyle: { color: theme.textTertiary },
        data: equity.map((p) => [p.date, p.buyHold]),
      },
    ],
  };
}
