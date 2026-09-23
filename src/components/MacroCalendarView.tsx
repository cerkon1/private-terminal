import type { CalendarResponse, MacroTileData } from '../types/macro';
import { daysUntil, releaseDayLabel } from './macroCalendar';

/// Economic calendar (v1.1): upcoming FRED release dates for the MACRO
/// series, grouped by day. Series chips open the series like a tile click.

type Props = {
  calendar: CalendarResponse | null;
  loading: boolean;
  loadError: string | null;
  tilesById: Map<string, MacroTileData>;
  onOpenSeries: (tile: MacroTileData) => void;
};

export default function MacroCalendarView({ calendar, loading, loadError, tilesById, onOpenSeries }: Props) {
  if (loadError) return <div className="macro-tile__error">Calendar unavailable: {loadError}</div>;
  if (!calendar) {
    return <div className="macro-tile__loading">{loading ? 'Loading release calendar…' : 'No calendar yet.'}</div>;
  }
  if (calendar.missingKey) {
    return (
      <div className="macro-tile__loading">
        The release calendar uses your FRED key — add it in Settings → API Keys.
      </div>
    );
  }

  const byDate = new Map<string, CalendarResponse['entries']>();
  for (const e of calendar.entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  return (
    <div className="macro-calendar">
      {calendar.error && (
        <div className="macro-calendar__warn" title={calendar.error}>
          Some release dates couldn't be refreshed — showing what's cached.
        </div>
      )}
      {byDate.size === 0 && (
        <div className="macro-tile__loading">No scheduled releases in the next 45 days for these series.</div>
      )}
      {[...byDate.entries()].map(([date, entries]) => {
        const soon = daysUntil(date, calendar.today) <= 1;
        return (
          <div key={date} className={`macro-calendar__day ${soon ? 'macro-calendar__day--soon' : ''}`}>
            <div className="macro-calendar__date">
              {releaseDayLabel(date, calendar.today)}
              <span className="macro-calendar__iso">{date}</span>
            </div>
            <div className="macro-calendar__releases">
              {entries.map((e) => (
                <div key={e.releaseId} className="macro-calendar__release">
                  <span className="macro-calendar__name">{e.releaseName}</span>
                  <span className="macro-calendar__series">
                    {e.seriesIds.map((sid) => {
                      const tile = tilesById.get(sid);
                      return (
                        <button
                          key={sid}
                          type="button"
                          className="macro-calendar__chip"
                          disabled={!tile}
                          onClick={() => tile && onOpenSeries(tile)}
                          title={tile ? `${tile.title} — open chart` : sid}
                        >
                          {sid}
                        </button>
                      );
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="macro-calendar__footnote">
        Dates are US release days from FRED's release calendar (next 45 days; daily series omitted). Refreshed at most once a day, or on REFRESH.
      </div>
    </div>
  );
}
