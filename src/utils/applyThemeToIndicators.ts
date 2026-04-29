import { IndicatorOutput } from '../types/indicator';
import { ThemeColors, rgbString } from '../types/theme';

const BULL_BAND_ALPHA = 0.5;
const BEAR_BAND_ALPHA = 0.5;
const NEUTRAL_BAND_ALPHA = 0.3;

/**
 * Re-color SMMA Ribbon bands + flip markers using the user's chosen palette.
 * Matches the alpha values baked into smma_ribbon.rs (FILL_BULL/BEAR at 0.50,
 * FILL_NEUTRAL at 0.30). Other indicators + non-ribbon series pass through
 * unchanged. Identification is by series name / marker label — kept in sync
 * with smma_ribbon.rs labels ("Bull Band", "Bear Band", "Neutral Band",
 * "Bull Flip", "Bear Flip", "Neutral Flip").
 */
export function applyThemeToIndicators(
  indicators: IndicatorOutput[],
  theme: ThemeColors,
): IndicatorOutput[] {
  const bullRgb = rgbString(theme.bull);
  const bearRgb = rgbString(theme.bear);
  const neutralRgb = rgbString(theme.neutral);

  return indicators.map((ind) => ({
    ...ind,
    series: ind.series.map((s) => {
      switch (s.name) {
        case 'Bull Band':
          return { ...s, color: `rgba(${bullRgb}, ${BULL_BAND_ALPHA})` };
        case 'Bear Band':
          return { ...s, color: `rgba(${bearRgb}, ${BEAR_BAND_ALPHA})` };
        case 'Neutral Band':
          return { ...s, color: `rgba(${neutralRgb}, ${NEUTRAL_BAND_ALPHA})` };
        default:
          return s;
      }
    }),
    markers: ind.markers.map((m) => {
      switch (m.label) {
        case 'Bull Flip':
          return { ...m, color: theme.bull };
        case 'Bear Flip':
          return { ...m, color: theme.bear };
        case 'Neutral Flip':
          return { ...m, color: theme.neutral };
        default:
          return m;
      }
    }),
  }));
}
