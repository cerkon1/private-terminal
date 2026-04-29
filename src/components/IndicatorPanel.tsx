import { IndicatorRegistration } from '../types/indicator';

type Props = {
  indicators: IndicatorRegistration[];
  enabledIds: Set<string>;
  onToggle: (indicatorId: string, enabled: boolean) => void;
};

export default function IndicatorPanel({ indicators, enabledIds, onToggle }: Props) {
  if (indicators.length === 0) return null;
  return (
    <div className="indicator-panel">
      <span className="indicator-panel__label">Indicators</span>
      {indicators.map((ind) => {
        const on = enabledIds.has(ind.id);
        return (
          <label
            key={ind.id}
            className={`indicator-chip ${on ? 'indicator-chip--on' : ''}`}
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
