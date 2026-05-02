import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { AnalysisLayout } from './components/analysis/AnalysisLayout';
import AppHeader from './components/AppHeader';
import MacroDashboard from './components/MacroDashboard';
import ManageWatchlistModal from './components/ManageWatchlistModal';
import MarketHoursStrip from './components/MarketHoursStrip';
import NewsDashboard from './components/NewsDashboard';
import PulseDashboard from './components/pulse/PulseDashboard';
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TickerDashboard from './components/TickerDashboard';
import { usePersistedState } from './hooks/usePersistedState';
import { useThemeColors } from './hooks/useThemeColors';
import { SectorGroup } from './types/sector';

export default function App() {
  const [activeSection, setActiveSection] = usePersistedState<string>(
    'session.active_section',
    'macro',
  );
  const [dbRefreshCounter, setDbRefreshCounter] = useState(0);
  const [groups, setGroups] = useState<SectorGroup[]>([]);
  const [groupsVersion, setGroupsVersion] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeColors, setThemeColors] = useThemeColors();
  const bumpDb = () => setDbRefreshCounter(c => c + 1);
  const reloadGroups = () => setGroupsVersion(v => v + 1);

  // Single fetch of sector groups at the app level — Sidebar + SectionView
  // both resolve against this list. Re-fetches when groupsVersion bumps
  // (after ticker add/remove/move or group CRUD).
  useEffect(() => {
    invoke<SectorGroup[]>('list_sector_groups').then(setGroups);
  }, [groupsVersion]);

  // Fallback when the persisted active_section no longer resolves — e.g.
  // user was on SCANNER before it was deprecated (S21), or a custom group
  // they later deleted. Drop them on PULSE rather than the "Loading
  // section…" placeholder.
  useEffect(() => {
    if (groups.length === 0) return;
    const valid = new Set(groups.map((g) => g.id));
    if (!valid.has(activeSection)) {
      setActiveSection('pulse');
    }
  }, [groups, activeSection, setActiveSection]);

  const handleDataChanged = () => {
    bumpDb();
    reloadGroups();
  };

  return (
    <div className="app-shell">
      <AppHeader
        refreshTrigger={dbRefreshCounter}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <MarketHoursStrip />
      <div className="app-body">
        <Sidebar
          activeId={activeSection}
          onSelect={setActiveSection}
          onManage={() => setManageOpen(true)}
          groupsVersion={groupsVersion}
        />
        <main className="app-main">
          <SectionView
            section={activeSection}
            groups={groups}
            themeColors={themeColors}
            onDataChanged={handleDataChanged}
            onSelectSection={setActiveSection}
          />
        </main>
      </div>
      <StatusBar />
      {manageOpen && (
        <ManageWatchlistModal
          onClose={() => setManageOpen(false)}
          onChanged={handleDataChanged}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          themeColors={themeColors}
          setThemeColors={setThemeColors}
        />
      )}
    </div>
  );
}

function SectionView({
  section,
  groups,
  themeColors,
  onDataChanged,
  onSelectSection,
}: {
  section: string;
  groups: SectorGroup[];
  themeColors: import('./types/theme').ThemeColors;
  onDataChanged: () => void;
  onSelectSection: (sectionId: string) => void;
}) {
  if (section === 'pulse') {
    return <PulseDashboard onSelectSection={onSelectSection} />;
  }
  if (section === 'analysis') {
    return <AnalysisLayout />;
  }
  if (section === 'macro') {
    return <MacroDashboard onDataChanged={onDataChanged} />;
  }
  if (section === 'news') {
    return <NewsDashboard onDataChanged={onDataChanged} />;
  }

  // Route any other enabled sector group through the shared TickerDashboard.
  const group = groups.find(g => g.id === section);
  if (!group) {
    return (
      <div className="macro-tile__loading">Loading section "{section}"…</div>
    );
  }
  if (!group.enabled) {
    return (
      <div className="macro-tile__loading">
        Section "{group.displayName}" is not implemented in this milestone.
      </div>
    );
  }

  // Build a section label: include parent context when this is a sub-sector.
  const parent = group.parentId ? groups.find(g => g.id === group.parentId) : null;
  const label = parent
    ? `${parent.displayName.toUpperCase()} · ${group.displayName}`
    : group.displayName.toUpperCase();

  return (
    <TickerDashboard
      sectorGroupId={group.id}
      sectorName={label}
      themeColors={themeColors}
      onDataChanged={onDataChanged}
    />
  );
}
