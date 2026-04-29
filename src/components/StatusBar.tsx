import { openUrl } from '@tauri-apps/plugin-opener';

import { APP_VERSION } from '../version';

const PRIVATE_ACB_URL = 'https://privateacb.com';

export default function StatusBar() {
  return (
    <footer className="status-bar">
      <span className="status-bar__version">v{APP_VERSION}</span>
      <span className="status-bar__sep">·</span>
      <span>
        Provided for free by the folks at{' '}
        <button
          type="button"
          className="status-bar__link"
          onClick={() => openUrl(PRIVATE_ACB_URL).catch(() => {})}
        >
          PrivateACB.com
        </button>
      </span>
    </footer>
  );
}
