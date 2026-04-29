import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

import { CATEGORY_LABELS, NewsItem, RefreshResult } from '../types/news';

type Props = {
  onDataChanged?: () => void;
};

const ALL = 'All';

export default function NewsDashboard({ onDataChanged }: Props) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);
  const [refreshErrors, setRefreshErrors] = useState<string[]>([]);

  const loadItems = async () => {
    try {
      const data = await invoke<NewsItem[]>('list_news', { limit: 300 });
      setItems(data);
    } catch (err) {
      setLoadError(String(err));
    }
  };

  // Initial load — read from cache, then trigger a background refresh if any
  // items look stale. `force=false` honors each feed's refresh_minutes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadItems();
      if (cancelled) return;
      // Kick a cache-friendly background refresh on open; surfaces new items
      // on arrival without blocking the initial render.
      await triggerRefresh(false, { silent: true });
      if (!cancelled) {
        await loadItems();
        onDataChanged?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerRefresh = async (
    force: boolean,
    opts?: { silent?: boolean },
  ): Promise<RefreshResult | null> => {
    if (isRefreshing) return null;
    if (!opts?.silent) {
      setIsRefreshing(true);
      setRefreshSummary(null);
      setRefreshErrors([]);
    }
    try {
      const result = await invoke<RefreshResult>('refresh_news', { force });
      if (!opts?.silent) {
        const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
        const parts = [
          `Updated ${ts}`,
          `${result.feedsAttempted} feed${result.feedsAttempted === 1 ? '' : 's'}`,
          `${result.itemsInserted} new`,
        ];
        if (result.errors.length > 0) {
          parts.push(`${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`);
        }
        setRefreshSummary(parts.join(' · '));
        setRefreshErrors(result.errors.map(e => `${e.feedName}: ${e.message}`));
      }
      return result;
    } catch (err) {
      if (!opts?.silent) setRefreshSummary(`Error: ${err}`);
      return null;
    } finally {
      if (!opts?.silent) setIsRefreshing(false);
    }
  };

  const refresh = async () => {
    const result = await triggerRefresh(true);
    if (result && result.itemsInserted > 0) {
      await loadItems();
      onDataChanged?.();
    }
  };

  // Category chips — derived from the actual items so the UI doesn't show
  // chips for empty buckets.
  const categories = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!items) return [];
    if (activeCategory === ALL) return items;
    return items.filter(it => it.category === activeCategory);
  }, [items, activeCategory]);

  if (loadError) {
    return <div className="macro-tile__error">Failed to load news: {loadError}</div>;
  }
  if (!items) {
    return <div className="macro-tile__loading">Loading news…</div>;
  }

  return (
    <div className="news-dashboard">
      <div className="macro-dashboard__controls">
        <div className="category-tabs">
          {[ALL, ...categories].map(cat => (
            <button
              key={cat}
              type="button"
              className={`category-tab ${cat === activeCategory ? 'category-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === ALL ? 'All' : CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
        <div className="macro-dashboard__actions">
          {refreshSummary && !isRefreshing && (
            <span className="refresh-summary">{refreshSummary}</span>
          )}
          <button
            type="button"
            className="view-toggle"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'REFRESHING…' : 'REFRESH'}
          </button>
        </div>
      </div>

      {refreshErrors.length > 0 && (
        <div className="news-errors">
          {refreshErrors.map((msg, i) => (
            <div key={i} className="news-errors__item">{msg}</div>
          ))}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="macro-tile__loading">
          No items {activeCategory === ALL ? 'yet — try refreshing.' : `in "${CATEGORY_LABELS[activeCategory] ?? activeCategory}".`}
        </div>
      ) : (
        <ul className="news-list">
          {visibleItems.map(it => (
            <NewsRow key={`${it.source}|${it.externalId}`} item={it} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const openExternal = () => {
    if (item.url) {
      openUrl(item.url).catch(err => console.error('Failed to open URL:', err));
    }
  };

  const relative = relativeTime(item.publishedAt ?? item.fetchedAt);

  return (
    <li className="news-item">
      <div className="news-item__meta">
        {item.feedName && <span className="news-item__feed">{item.feedName}</span>}
        {item.ticker && <span className="news-item__ticker">{item.ticker}</span>}
        {item.category && (
          <span className="news-item__category">
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        )}
        <span className="news-item__time" title={item.publishedAt ?? item.fetchedAt}>
          {relative}
        </span>
      </div>
      <button
        type="button"
        className="news-item__headline"
        onClick={openExternal}
        disabled={!item.url}
        title={item.url ?? ''}
      >
        {item.headline}
      </button>
      {item.summary && <p className="news-item__summary">{item.summary}</p>}
    </li>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  const seconds = Math.floor((Date.now() - parsed) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(parsed).toLocaleDateString();
}

