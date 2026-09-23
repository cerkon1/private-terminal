// Economic calendar helpers (v1.1) — pure, unit-tested in macroCalendar.test.ts.
import type { CalendarEntry } from '../types/macro';

export type NextRelease = { date: string; releaseName: string };

/** First upcoming release per series. Entries arrive date-ordered. */
export function nextReleaseBySeries(entries: CalendarEntry[]): Map<string, NextRelease> {
  const out = new Map<string, NextRelease>();
  for (const e of entries) {
    for (const sid of e.seriesIds) {
      if (!out.has(sid)) out.set(sid, { date: e.date, releaseName: e.releaseName });
    }
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Whole days from `today` to `date` (both YYYY-MM-DD, compared as UTC dates). */
export function daysUntil(date: string, today: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** 'Today' / 'Tomorrow' / 'Thu Oct 15'. */
export function releaseDayLabel(date: string, today: string): string {
  const n = daysUntil(date, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Short tile badge: 'Today' / 'Tmrw' / 'Oct 15'. */
export function releaseBadge(date: string, today: string): string {
  const n = daysUntil(date, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tmrw';
  const [, m, d] = date.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d}` : date;
}
