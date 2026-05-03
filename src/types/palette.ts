/// Ctrl+K command palette types. Aggregator hook combines four IPC
/// shapes into a single Searchable[] array; the modal renders ranked
/// fuzzy-matched results grouped by category. (S22)

export type PaletteTicker = {
  ticker: string;
  sectorGroupId: string;
  dataSource: string;
  displayName: string | null;
};

/** Internal palette item. The `action` closure performs the navigation
 *  when the user presses ↵; aggregator builds these against current
 *  app state (setActiveSection + localStorage handoffs + custom events). */
export type SearchableCategory =
  | 'ticker'
  | 'sector'
  | 'fred'
  | 'analysis';

export type Searchable = {
  /** Stable id for React keys + Fuse index. Format: `<category>:<...>`. */
  id: string;
  category: SearchableCategory;
  /** Bold first line in the result row — typically the symbol or canonical id. */
  primary: string;
  /** Subtitle text — display name / description. */
  secondary?: string;
  /** Right-aligned context — sector group label or category. */
  tertiary?: string;
  /** Closure that performs the navigation. Captures setActiveSection
   *  and any required handoff writes. Called on ↵ or click. */
  action: () => void;
};
