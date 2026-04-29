import { DEFAULT_THEME, PRESETS, ThemeColors, rgbString } from '../../types/theme';

type Props = {
  colors: ThemeColors;
  onChange: (next: ThemeColors) => void;
};

export default function AppearanceTab({ colors, onChange }: Props) {
  const setOne = (key: keyof ThemeColors) => (hex: string) =>
    onChange({ ...colors, [key]: hex });

  const presetMatches = (p: ThemeColors) =>
    p.bull.toLowerCase() === colors.bull.toLowerCase() &&
    p.bear.toLowerCase() === colors.bear.toLowerCase() &&
    p.neutral.toLowerCase() === colors.neutral.toLowerCase();

  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        Colors affect the SMMA Ribbon envelope, flip markers, state badges, and
        news ticker chips. Pick a preset for a quick start, then fine-tune each
        state individually with the color picker.
      </p>

      <div className="settings-subhead">Preset themes</div>
      <div className="preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className={`preset-pill ${presetMatches(p.colors) ? 'preset-pill--active' : ''}`}
            onClick={() => onChange(p.colors)}
            title={`Apply ${p.name} palette`}
          >
            <span className="preset-pill__swatch" style={{ background: p.colors.bull }} />
            <span className="preset-pill__swatch" style={{ background: p.colors.bear }} />
            <span className="preset-pill__swatch" style={{ background: p.colors.neutral }} />
            <span className="preset-pill__label">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="settings-subhead">Individual colors</div>
      <div className="color-row">
        <ColorField label="Bullish" hex={colors.bull} onChange={setOne('bull')} />
        <ColorField label="Bearish" hex={colors.bear} onChange={setOne('bear')} />
        <ColorField label="Neutral" hex={colors.neutral} onChange={setOne('neutral')} />
      </div>

      <div className="settings-subhead">Preview</div>
      <PreviewStrip colors={colors} />

      <div className="settings-actions">
        <button
          type="button"
          className="view-toggle"
          onClick={() => onChange(DEFAULT_THEME)}
        >
          RESET TO DEFAULTS
        </button>
      </div>
    </div>
  );
}

function ColorField({
  label,
  hex,
  onChange,
}: {
  label: string;
  hex: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="color-field">
      <span className="color-field__label">{label}</span>
      <span className="color-field__swatch-wrap">
        <input
          type="color"
          className="color-field__picker"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      <span className="color-field__hex mono">{hex.toUpperCase()}</span>
    </label>
  );
}

function PreviewStrip({ colors }: { colors: ThemeColors }) {
  const bullRgb = rgbString(colors.bull);
  const bearRgb = rgbString(colors.bear);
  const neutralRgb = rgbString(colors.neutral);
  return (
    <div className="theme-preview">
      <div className="theme-preview__envelope">
        <div
          className="theme-preview__band"
          style={{ background: `rgba(${bullRgb}, 0.5)` }}
        >
          <span style={{ color: colors.bull }}>Bull Band</span>
        </div>
        <div
          className="theme-preview__band"
          style={{ background: `rgba(${neutralRgb}, 0.3)` }}
        >
          <span style={{ color: colors.neutral }}>Neutral Band</span>
        </div>
        <div
          className="theme-preview__band"
          style={{ background: `rgba(${bearRgb}, 0.5)` }}
        >
          <span style={{ color: colors.bear }}>Bear Band</span>
        </div>
      </div>
      <div className="theme-preview__badges">
        <span className="state-badge" style={{ background: `rgba(${bullRgb}, 0.2)`, color: colors.bull, borderColor: colors.bull }}>
          BULLISH
        </span>
        <span className="state-badge" style={{ background: `rgba(${bearRgb}, 0.2)`, color: colors.bear, borderColor: colors.bear }}>
          BEARISH
        </span>
        <span className="state-badge" style={{ background: `rgba(${neutralRgb}, 0.2)`, color: colors.neutral, borderColor: colors.neutral }}>
          NEUTRAL
        </span>
      </div>
    </div>
  );
}
