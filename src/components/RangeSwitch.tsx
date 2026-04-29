import { TILE_RANGES, TileRange } from '../types/sector';

type Props = {
  value: TileRange;
  onChange: (next: TileRange) => void;
};

export default function RangeSwitch({ value, onChange }: Props) {
  return (
    <div className="range-switch">
      {TILE_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`range-switch__btn ${r === value ? 'range-switch__btn--active' : ''}`}
          onClick={() => onChange(r)}
          title={`Show ${r} change on ticker tiles`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
