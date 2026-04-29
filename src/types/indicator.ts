export type IndicatorPaneKind = 'overlay' | 'subpane';

export type IndicatorSeriesPoint = { date: string; value: number | null };

export type IndicatorSeries = {
  name: string;
  kind: 'line';
  color: string;
  data: IndicatorSeriesPoint[];
  /** Series sharing a stackGroup stack in order, producing filled band
   *  regions between curves (e.g. SMMA Ribbon's state-coloured envelope). */
  stackGroup: string | null;
  /** If true, the line stroke is invisible (used by stack-base series that
   *  contribute position but no ink). The `areaStyle` fill still renders
   *  when `stackGroup` is set. */
  hidden: boolean;
};

export type IndicatorMarker = {
  date: string;
  value: number;
  label: string;
  color: string;
  symbol: string;
};

export type IndicatorRegion = {
  startDate: string;
  endDate: string;
  color: string;
  label: string;
};

export type IndicatorOutput = {
  id: string;
  displayName: string;
  pane: IndicatorPaneKind;
  series: IndicatorSeries[];
  markers: IndicatorMarker[];
  regions: IndicatorRegion[];
};

export type IndicatorRegistration = {
  id: string;
  displayName: string;
  pane: IndicatorPaneKind;
  defaultParams: Record<string, unknown>;
};

export type IndicatorSetting = {
  ticker: string;
  indicatorId: string;
  enabled: boolean;
  paramsJson: string | null;
};
