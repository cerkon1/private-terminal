import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import type { AnalysisToolInfo } from '../types/analysis';
import type { MacroTileData } from '../types/macro';
import type { PaletteTicker, Searchable } from '../types/palette';
import type { SectorGroup } from '../types/sector';

/// Aggregates every navigation target in the app into a flat Searchable[]
/// array for the Ctrl+K palette. Refreshes when sector groups change
/// (palette must reflect newly added/removed tickers without an app
/// restart). Macro tiles + analysis tools are one-shot — they don't
/// change during a session.
export function useCommandSearchables(
  groups: SectorGroup[],
  setActiveSection: (sectionId: string) => void,
): { searchables: Searchable[]; loading: boolean } {
  const [tickers, setTickers] = useState<PaletteTicker[]>([]);
  const [macros, setMacros] = useState<MacroTileData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisToolInfo[]>([]);
  const [loadedTickers, setLoadedTickers] = useState(false);
  const [loadedStatic, setLoadedStatic] = useState(false);

  // Tickers re-fetch when groups change (add/remove ticker → re-aggregate).
  useEffect(() => {
    let active = true;
    invoke<PaletteTicker[]>('list_palette_tickers')
      .then((rows) => {
        if (!active) return;
        setTickers(rows);
        setLoadedTickers(true);
      })
      .catch(() => {
        if (!active) return;
        setLoadedTickers(true);
      });
    return () => {
      active = false;
    };
  }, [groups]);

  // One-shot for the static-during-session lookups.
  useEffect(() => {
    let active = true;
    Promise.all([
      invoke<MacroTileData[]>('list_macro_tiles', { force: false }).catch(() => [] as MacroTileData[]),
      invoke<AnalysisToolInfo[]>('list_analysis_tools').catch(() => [] as AnalysisToolInfo[]),
    ]).then(([m, a]) => {
      if (!active) return;
      setMacros(m);
      setAnalysis(a);
      setLoadedStatic(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Memoize so referential equality holds across App.tsx re-renders that
  // don't actually change the underlying data (dbRefreshCounter bumps,
  // theme toggles, etc.). Fuse instance in CommandPalette keys off
  // identity; without this it'd rebuild every parent render.
  const searchables = useMemo<Searchable[]>(() => {
  const groupById = new Map<string, SectorGroup>();
  for (const g of groups) groupById.set(g.id, g);

  const sectorLabel = (g: SectorGroup): string => {
    if (!g.parentId) return g.displayName.toUpperCase();
    const p = groupById.get(g.parentId);
    return p
      ? `${p.displayName.toUpperCase()} · ${g.displayName}`
      : g.displayName.toUpperCase();
  };

  const searchables: Searchable[] = [];

  // Tickers — one entry per (ticker, sectorGroupId). Action navigates to
  // the sector and uses the S21 localStorage handoff so TickerDashboard
  // auto-opens the matching feature chart on mount.
  for (const t of tickers) {
    const g = groupById.get(t.sectorGroupId);
    searchables.push({
      id: `ticker:${t.ticker}::${t.sectorGroupId}`,
      category: 'ticker',
      primary: t.ticker,
      secondary: t.displayName ?? undefined,
      tertiary: g ? sectorLabel(g) : undefined,
      action: () => {
        localStorage.setItem(
          'session.pulse_feature_chart_target',
          JSON.stringify({ ticker: t.ticker, dataSource: t.dataSource }),
        );
        setActiveSection(t.sectorGroupId);
      },
    });
  }

  // Sectors — top-level + leaf sectors. Skip 'pulse' / 'analysis' / 'macro'
  // / 'news' (those have their own palette entries through different
  // categories), and skip user-hidden / disabled groups (already filtered
  // by list_sector_groups but defensive).
  const PINNED_NON_USER = new Set(['pulse', 'analysis', 'macro', 'news']);
  for (const g of groups) {
    if (PINNED_NON_USER.has(g.id)) continue;
    if (!g.enabled) continue;
    searchables.push({
      id: `sector:${g.id}`,
      category: 'sector',
      primary: g.displayName,
      secondary: g.parentId
        ? groupById.get(g.parentId)?.displayName ?? undefined
        : undefined,
      tertiary: 'Sector',
      action: () => setActiveSection(g.id),
    });
  }

  // Pinned top-level sections — Pulse, MACRO, NEWS get explicit entries
  // so users can search "pulse" or "news" and navigate. Analysis tabs are
  // their own entries (below) — searching "analysis" gets you the section
  // through any of its tabs.
  searchables.push({
    id: 'sector:pulse',
    category: 'sector',
    primary: 'Pulse',
    secondary: 'Cross-section heatmap',
    tertiary: 'Section',
    action: () => setActiveSection('pulse'),
  });
  searchables.push({
    id: 'sector:macro',
    category: 'sector',
    primary: 'Macro',
    secondary: 'FRED dashboard',
    tertiary: 'Section',
    action: () => setActiveSection('macro'),
  });
  searchables.push({
    id: 'sector:news',
    category: 'sector',
    primary: 'News',
    secondary: 'Curated feeds',
    tertiary: 'Section',
    action: () => setActiveSection('news'),
  });

  // FRED tiles — direct hop to the MACRO chart. Uses a dedicated
  // localStorage handoff (consumed by MacroDashboard on mount, S22) so
  // the chart auto-opens for that series.
  for (const m of macros) {
    searchables.push({
      id: `fred:${m.seriesId}`,
      category: 'fred',
      primary: m.seriesId,
      secondary: m.title,
      tertiary: m.category ?? 'FRED',
      action: () => {
        localStorage.setItem('session.macro_chart_handoff', m.seriesId);
        setActiveSection('macro');
      },
    });
  }

  // Analysis tabs — switch section + write the localStorage handoff that
  // AnalysisLayout consumes on mount once its own usePersistedState load
  // resolves (S22 MACRO → Analysis handoff key). Avoids the race where a
  // CustomEvent fires before the listener attaches.
  for (const a of analysis) {
    if (!a.enabled) continue;
    searchables.push({
      id: `analysis:${a.id}`,
      category: 'analysis',
      primary: a.displayName,
      secondary: undefined,
      tertiary: 'Analysis',
      action: () => {
        localStorage.setItem('session.analysis_handoff_tab', a.id);
        setActiveSection('analysis');
      },
    });
  }

  return searchables;
  }, [groups, tickers, macros, analysis, setActiveSection]);

  return {
    searchables,
    loading: !loadedTickers || !loadedStatic,
  };
}
