export type ThemeColors = {
  bull: string;
  bear: string;
  neutral: string;
};

export const DEFAULT_THEME: ThemeColors = {
  bull: '#0891B2',
  bear: '#FB7185',
  neutral: '#9CA3AF',
};

export type ThemePreset = { name: string; colors: ThemeColors };

export const PRESETS: ThemePreset[] = [
  { name: 'Gold / Navy', colors: { bull: '#D4AF37', bear: '#1E3A8A', neutral: '#9CA3AF' } },
  { name: 'Teal / Fuchsia', colors: { bull: '#14B8A6', bear: '#D946EF', neutral: '#9CA3AF' } },
  { name: 'Sky / Pink', colors: { bull: '#38BDF8', bear: '#F472B6', neutral: '#9CA3AF' } },
  { name: 'Cyan / Rose', colors: { bull: '#0891B2', bear: '#FB7185', neutral: '#9CA3AF' } },
  { name: 'Emerald / Red', colors: { bull: '#10B981', bear: '#EF4444', neutral: '#9CA3AF' } },
];

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return [156, 163, 175];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function rgbString(hex: string): string {
  return hexToRgb(hex).join(', ');
}
