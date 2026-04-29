export type NewsItem = {
  source: string;
  externalId: string;
  feedId: string | null;
  feedName: string | null;
  ticker: string | null;
  category: string | null;
  headline: string;
  url: string | null;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
};

export type NewsFeed = {
  id: string;
  sourceType: string;
  url: string | null;
  displayName: string;
  category: string | null;
  refreshMinutes: number;
  lastFetched: string | null;
  enabled: boolean;
};

export type FeedError = {
  feedId: string;
  feedName: string;
  message: string;
};

export type RefreshResult = {
  feedsAttempted: number;
  itemsInserted: number;
  errors: FeedError[];
};

/** Display label for the filter-chip categories. */
export const CATEGORY_LABELS: Record<string, string> = {
  world: 'World',
  us: 'US',
  canada: 'Canada',
  central_bank: 'Central Banks',
  ticker: 'My Tickers',
};
