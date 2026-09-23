import { describe, expect, it } from 'vitest';
import { daysUntil, nextReleaseBySeries, releaseBadge, releaseDayLabel } from './macroCalendar';

describe('nextReleaseBySeries', () => {
  it('keeps the earliest release per series', () => {
    const map = nextReleaseBySeries([
      { date: '2026-10-02', releaseId: 50, releaseName: 'Employment Situation', seriesIds: ['PAYEMS', 'UNRATE'] },
      { date: '2026-10-15', releaseId: 10, releaseName: 'Consumer Price Index', seriesIds: ['CPIAUCSL'] },
      { date: '2026-11-06', releaseId: 50, releaseName: 'Employment Situation', seriesIds: ['PAYEMS', 'UNRATE'] },
    ]);
    expect(map.get('PAYEMS')).toEqual({ date: '2026-10-02', releaseName: 'Employment Situation' });
    expect(map.get('CPIAUCSL')?.date).toBe('2026-10-15');
    expect(map.has('GDP')).toBe(false);
  });
});

describe('labels', () => {
  it('counts whole days across month and DST boundaries', () => {
    expect(daysUntil('2026-10-01', '2026-09-30')).toBe(1);
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2);
  });

  it('names near days and formats the rest', () => {
    expect(releaseDayLabel('2026-09-23', '2026-09-23')).toBe('Today');
    expect(releaseDayLabel('2026-09-24', '2026-09-23')).toBe('Tomorrow');
    expect(releaseDayLabel('2026-10-15', '2026-09-23')).toBe('Thu Oct 15');
    expect(releaseBadge('2026-09-24', '2026-09-23')).toBe('Tmrw');
    expect(releaseBadge('2026-10-15', '2026-09-23')).toBe('Oct 15');
  });
});
