import { useState } from 'react';

import AboutTab from './settings/AboutTab';
import ApiKeysTab from './settings/ApiKeysTab';
import AppearanceTab from './settings/AppearanceTab';
import FeaturesTab from './settings/FeaturesTab';
import PrivacyTab from './settings/PrivacyTab';
import StorageTab from './settings/StorageTab';
import { ThemeColors } from '../types/theme';

type Props = {
  onClose: () => void;
  themeColors: ThemeColors;
  setThemeColors: (next: ThemeColors) => void;
};

type TabId = 'api' | 'appearance' | 'storage' | 'features' | 'privacy' | 'about';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'api', label: 'API Keys' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'storage', label: 'Storage' },
  { id: 'features', label: 'Features' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'about', label: 'About' },
];

export default function SettingsModal({ onClose, themeColors, setThemeColors }: Props) {
  const [tab, setTab] = useState<TabId>('api');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Settings</h2>
          <button type="button" className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tab-strip">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-strip__tab ${tab === t.id ? 'tab-strip__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal__body">
          {tab === 'api' && <ApiKeysTab />}
          {tab === 'appearance' && (
            <AppearanceTab colors={themeColors} onChange={setThemeColors} />
          )}
          {tab === 'storage' && <StorageTab />}
          {tab === 'features' && <FeaturesTab />}
          {tab === 'privacy' && <PrivacyTab />}
          {tab === 'about' && <AboutTab />}
        </div>

        <div className="modal__footer">
          <button type="button" className="view-toggle" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
