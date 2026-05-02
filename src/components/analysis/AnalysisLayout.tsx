import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { usePersistedState } from '../../hooks/usePersistedState';
import type { AnalysisToolInfo } from '../../types/analysis';
import { ANALYSIS_TAB_REGISTRY } from './registry';

/// Top-level shell for the v1.1 Analysis section. Fetches the registry
/// (const Rust list merged with DB enabled/config_json) and dispatches
/// the active tab through ANALYSIS_TAB_REGISTRY.
///
/// Active-tab state persists under session.analysis_active_tab.
/// Tools missing from the React registry render a placeholder so a
/// half-implemented Phase 2+ tool doesn't crash the section.
export function AnalysisLayout() {
  const [tools, setTools] = useState<AnalysisToolInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId, activeIdStatus] = usePersistedState<string>(
    'session.analysis_active_tab',
    'correlation_matrix',
  );

  useEffect(() => {
    let active = true;
    invoke<AnalysisToolInfo[]>('list_analysis_tools')
      .then((r) => {
        if (!active) return;
        setTools(r);
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(typeof e === 'string' ? e : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  // Sorted, enabled-only tab list.
  const visibleTools = useMemo(() => {
    if (!tools) return [];
    return tools
      .filter((t) => t.enabled)
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [tools]);

  // If the persisted active tab disappeared (disabled or removed), fall
  // back to the first visible one so the section stays usable.
  useEffect(() => {
    if (visibleTools.length === 0) return;
    if (!visibleTools.some((t) => t.id === activeId)) {
      setActiveId(visibleTools[0].id);
    }
  }, [visibleTools, activeId, setActiveId]);

  // MACRO tile → Analysis tab handoff (S22). MacroDashboard writes the
  // target tab id to localStorage before flipping section to ANALYSIS.
  // Gated on activeIdStatus.loaded so the async usePersistedState load
  // doesn't race our setActiveId and overwrite it back to the persisted
  // value. Read + clear so a stale handoff can't hijack later manual
  // selections.
  useEffect(() => {
    if (!activeIdStatus.loaded) return;
    const target = localStorage.getItem('session.analysis_handoff_tab');
    if (target) {
      localStorage.removeItem('session.analysis_handoff_tab');
      setActiveId(target);
    }
  }, [activeIdStatus.loaded, setActiveId]);

  // Cross-tab navigation: a tab can request a switch by dispatching
  // `analysis-set-active-tab` with detail = target tabId. Used by the
  // Correlations cell-click → Pairs handoff (S15 Q1).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') setActiveId(detail);
    };
    window.addEventListener('analysis-set-active-tab', handler);
    return () => window.removeEventListener('analysis-set-active-tab', handler);
  }, [setActiveId]);

  const ActiveComponent = ANALYSIS_TAB_REGISTRY[activeId];

  return (
    <div className="analysis-layout">
      {loadError && (
        <div className="analysis-tab__error" style={{ margin: 'var(--space-md)' }}>
          {loadError}
        </div>
      )}
      <div className="tab-strip">
        {visibleTools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-strip__tab ${activeId === t.id ? 'tab-strip__tab--active' : ''}`}
            onClick={() => setActiveId(t.id)}
          >
            {t.displayName}
          </button>
        ))}
      </div>
      <div className="analysis-layout__body">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : visibleTools.length === 0 ? (
          <div className="analysis-tab__placeholder">
            No analysis tools enabled.
          </div>
        ) : (
          <div className="analysis-tab__placeholder">
            Tool "{activeId}" has no component yet.
          </div>
        )}
      </div>
    </div>
  );
}
