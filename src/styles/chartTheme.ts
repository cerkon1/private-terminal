// Runtime mirror of CSS color tokens for ECharts options.
//
// ECharts is configured via JS objects, where CSS `var()` doesn't apply —
// so we read the computed token values once on first access and expose
// them as a typed object. Cached for the lifetime of the page.
//
// `refreshChartTheme()` clears the cache; call it after any change that
// mutates :root CSS variables (e.g. light/dark theme toggle, when that
// arc lands). The SMMA palette presets in `theme.ts` mutate
// state-bull/bear/neutral CSS vars, but those are NOT consumed here —
// indicator series carry their own colors via `IndicatorOutput.series[].color`,
// so palette changes don't require a chart-theme refresh.

function read(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function rgbaVar(rgbVar: string, alpha: number): string {
  return `rgba(${read(rgbVar)}, ${alpha})`;
}

export type ChartTheme = {
  // Backgrounds / borders / text
  bgBase: string;
  bgSurface: string;
  borderSubtle: string;
  borderEmphasis: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Accents
  accentCyan: string;
  accentCyanFillStrong: string; // line area gradient start (0.18)
  accentCyanFillFade: string;   // line area gradient end (0.0)
  accentCyanFillSoft: string;   // dataZoom filler (0.08)

  // Status / candle
  statusUp: string;
  statusDown: string;
  volUp: string;                // status-up @ 0.35
  volDown: string;              // status-down @ 0.35

  // VRVP
  vrvpPoc: string;              // accent-yellow @ 0.55
  vrvpBar: string;              // text-secondary @ 0.32
  vrvpStroke: string;           // bg-surface @ 0.4

  // Tooltip / dataZoom / watermark
  zoomBg: string;               // bg-surface @ 0.6
  watermarkFill: string;        // text-primary @ 0.05

  // Markers
  markerLine: string;           // text-tertiary — RSI 70/30 reference lines
};

let cached: ChartTheme | null = null;

export function getChartTheme(): ChartTheme {
  if (cached) return cached;
  cached = {
    bgBase: read('--bg-base'),
    bgSurface: read('--bg-surface'),
    borderSubtle: read('--border-subtle'),
    borderEmphasis: read('--border-emphasis'),
    textPrimary: read('--text-primary'),
    textSecondary: read('--text-secondary'),
    textTertiary: read('--text-tertiary'),
    accentCyan: read('--accent-cyan'),
    accentCyanFillStrong: rgbaVar('--accent-cyan-rgb', 0.18),
    accentCyanFillFade: rgbaVar('--accent-cyan-rgb', 0.0),
    accentCyanFillSoft: rgbaVar('--accent-cyan-rgb', 0.08),
    statusUp: read('--status-up'),
    statusDown: read('--status-down'),
    volUp: rgbaVar('--status-up-rgb', 0.35),
    volDown: rgbaVar('--status-down-rgb', 0.35),
    vrvpPoc: rgbaVar('--accent-yellow-rgb', 0.55),
    vrvpBar: rgbaVar('--text-secondary-rgb', 0.32),
    vrvpStroke: rgbaVar('--bg-surface-rgb', 0.4),
    zoomBg: rgbaVar('--bg-surface-rgb', 0.6),
    watermarkFill: rgbaVar('--text-primary-rgb', 0.05),
    markerLine: read('--text-tertiary'),
  };
  return cached;
}

export function refreshChartTheme(): void {
  cached = null;
}
