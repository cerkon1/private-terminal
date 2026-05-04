import { IndicatorRegistration } from '../types/indicator';

type Props = {
  indicators: IndicatorRegistration[];
  enabledIds: Set<string>;
  onToggle: (indicatorId: string, enabled: boolean) => void;
};

/// Hover-tip descriptions for the per-ticker Rust-computed indicators.
/// Lifted from FeaturesTab card copy. Keep in sync if a card body changes.
const DESCRIPTIONS: Record<string, string> = {
  smma_ribbon:
    'SMMA Ribbon — quad-MA state classifier (bull / bear / neutral) by line ordering. Lengths 15·19·25·29, confirm=3.',
  rsi_14:
    'RSI(14) — Wilder relative-strength oscillator 0-100. Overbought >70, oversold <30.',
  atr_14:
    'ATR(14) — Wilder average true range; volatility in price units, magnitude-scaled.',
};

export default function IndicatorPanel({ indicators, enabledIds, onToggle }: Props) {
  if (indicators.length === 0) return null;
  return (
    <div className="indicator-panel">
      {indicators.map((ind) => {
        const on = enabledIds.has(ind.id);
        return (
          <label
            key={ind.id}
            className={`indicator-chip ${on ? 'indicator-chip--on' : ''}`}
            title={DESCRIPTIONS[ind.id] ?? ind.displayName}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onToggle(ind.id, e.target.checked)}
            />
            <span>{ind.displayName}</span>
          </label>
        );
      })}
    </div>
  );
}
