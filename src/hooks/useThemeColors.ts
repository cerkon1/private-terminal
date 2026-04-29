import { useEffect } from 'react';

import { usePersistedState } from './usePersistedState';
import { DEFAULT_THEME, ThemeColors, rgbString } from '../types/theme';

/**
 * Applies and persists the user's SMMA Ribbon palette. CSS vars are set on
 * :root whenever the colors change — state badges, news ticker chips, and
 * any `var(--state-*)` consumer pick this up automatically. ECharts-rendered
 * indicator series (bull/bear/neutral bands + flip markers) need a separate
 * pass; see `applyThemeToIndicators` in charts/themeOverride.ts.
 */
export function useThemeColors(): [ThemeColors, (next: ThemeColors) => void] {
  const [colors, setColors] = usePersistedState<ThemeColors>(
    'session.palette',
    DEFAULT_THEME,
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--state-bull', colors.bull);
    root.style.setProperty('--state-bull-rgb', rgbString(colors.bull));
    root.style.setProperty('--state-bear', colors.bear);
    root.style.setProperty('--state-bear-rgb', rgbString(colors.bear));
    root.style.setProperty('--state-neutral', colors.neutral);
    root.style.setProperty('--state-neutral-rgb', rgbString(colors.neutral));
  }, [colors]);

  return [colors, setColors];
}
