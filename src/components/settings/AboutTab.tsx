import { openUrl } from '@tauri-apps/plugin-opener';

import { APP_VERSION } from '../../version';

const PRIVATE_ACB_URL = 'https://privateacb.com';

export default function AboutTab() {
  return (
    <div className="settings-section">
      <div className="about-header">
        <h3 className="about-header__name">Private Terminal</h3>
        <div className="about-header__version mono">
          v{APP_VERSION} · personal research dashboard
        </div>
      </div>

      <p className="settings-section__intro">
        A free, locally-stored desktop research tool. No accounts, no cloud, no
        telemetry. Data stays on this machine.
      </p>

      <div className="about-card">
        <div className="about-card__title">From the maker of PrivateACB</div>
        <p className="about-card__body">
          Private Terminal was built alongside <strong>PrivateACB</strong> — a
          desktop crypto tax calculator for Canada, the US, Australia, and the
          UK. It imports transactions from major exchanges, applies the
          cost-base method your jurisdiction expects, and produces the reports
          your accountant needs at year-end. Same privacy-first, single-machine
          philosophy as this app.
        </p>
        <button
          type="button"
          className="view-toggle"
          onClick={() => openUrl(PRIVATE_ACB_URL).catch(() => {})}
        >
          LEARN MORE ↗
        </button>
      </div>
    </div>
  );
}
