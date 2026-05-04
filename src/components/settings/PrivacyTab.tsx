import { openUrl } from '@tauri-apps/plugin-opener';

const PRIVATE_ACB_URL = 'https://privateacb.com';

/// The brand-thesis surface. Documents what the app does NOT do (the bulk of
/// the value), the full list of outbound network calls (transparency), where
/// data lives (Storage tab pointer), and the maker-tie-back to PrivateACB.
/// Hard rule: keep this honest. If we ever add a phone-home, it gets listed
/// here BEFORE it ships, or we don't ship it.
export default function PrivacyTab() {
  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        Private Terminal stores everything locally and phones nothing home.
        This page documents exactly what that means and what leaves the
        machine.
      </p>

      <div className="settings-subhead">What we don't do</div>

      <div className="about-card">
        <ul className="privacy-list">
          <li>
            <strong>No accounts.</strong> No login, no signup, no email
            collection.
          </li>
          <li>
            <strong>No telemetry.</strong> The app does not report usage,
            errors, performance, or anything else back to us.
          </li>
          <li>
            <strong>No analytics.</strong> No Google Analytics, no Mixpanel,
            no PostHog, no Segment, no Sentry. The HTML and JavaScript do not
            load any third-party trackers.
          </li>
          <li>
            <strong>No auto-update phone-home.</strong> The app does not
            check for updates in the background. New versions ship as
            installers you choose to download.
          </li>
          <li>
            <strong>No data selling.</strong> We don't sell, share, or
            aggregate any user data — because we have none to sell.
          </li>
          <li>
            <strong>No cloud sync.</strong> Your watchlist, indicator
            settings, AVWAP anchors, view preferences — all live in a single
            SQLite file on this machine.
          </li>
        </ul>
      </div>

      <div className="settings-subhead">What goes out — full list</div>

      <p className="settings-section__intro">
        These are the only outbound network calls Private Terminal makes.
        Each is a request to a public data source for the data that source
        publishes — nothing more, nothing else.
      </p>

      <div className="about-card">
        <table className="privacy-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>What for</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">api.stlouisfed.org</td>
              <td>Macroeconomic series observations from FRED</td>
              <td>Daily, when MACRO opens</td>
            </tr>
            <tr>
              <td className="mono">query2.finance.yahoo.com</td>
              <td>Live quotes + historical price bars for tickers in your watchlist</td>
              <td>Every 5 min during market hours, hourly otherwise; on-demand for history</td>
            </tr>
            <tr>
              <td className="mono">finnhub.io</td>
              <td>US-equity news headlines (only if you supply a Finnhub API key)</td>
              <td>Every 15 min when NEWS is open</td>
            </tr>
            <tr>
              <td>News RSS feed publishers</td>
              <td>Headline feeds — what each publisher already broadcasts publicly (BBC, CNBC, Fed, BoC, FP, CBC, Al Jazeera)</td>
              <td>Every 30 min per feed when NEWS is open</td>
            </tr>
            <tr>
              <td>External browser links</td>
              <td>Opens the URL in your default browser — same as typing it yourself</td>
              <td>Only when you click a news headline or the PrivateACB cross-link</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="settings-subhead">Where your data lives</div>

      <div className="about-card">
        <p className="about-card__body">
          Everything is in a single SQLite file inside the OS application
          data directory. The header at the top of the app shows the exact
          path — click it to copy.
        </p>
        <p className="about-card__body">
          To wipe everything, close the app and delete the file. (Settings →
          Storage has a backup-copy action if you want a copy first.) There
          is no remote copy. When you delete the file, the data is gone.
        </p>
        <p className="about-card__body">
          API keys you enter for FRED or Finnhub are stored in the same
          SQLite file, not encrypted at rest. They never leave the machine
          except as part of the request to that API. If you remove a key
          via Settings → API Keys, it is removed from the file.
        </p>
      </div>

      <div className="settings-subhead">Why this matters to us</div>

      <div className="about-card">
        <p className="about-card__body">
          Private Terminal is built by the team behind <strong>PrivateACB</strong>.
          Both tools answer one question the same way: your data is yours,
          full stop. A research tool shouldn't sell your watchlist, and a
          tax tool shouldn't require you to upload your transaction history
          to a server. That's the stance — both apps, same maker, same
          answer.
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
