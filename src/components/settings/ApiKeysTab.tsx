import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

type ApiKeyStatus = {
  service: string;
  source: 'stored' | 'env' | 'none';
  masked: string | null;
};

const SERVICES: Array<{ id: string; label: string; helpUrl: string }> = [
  { id: 'fred', label: 'FRED', helpUrl: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  { id: 'finnhub', label: 'Finnhub', helpUrl: 'https://finnhub.io/dashboard' },
];

export default function ApiKeysTab() {
  return (
    <div className="settings-section">
      <p className="settings-section__intro">
        API keys are stored in the app's local database (path shown in the
        header) — only your user account can read it. A key in a{' '}
        <code>.env</code> file at startup still works as a fallback for
        development.
      </p>
      {SERVICES.map((s) => (
        <ApiKeyRow key={s.id} service={s.id} label={s.label} helpUrl={s.helpUrl} />
      ))}
    </div>
  );
}

function ApiKeyRow({
  service,
  label,
  helpUrl,
}: {
  service: string;
  label: string;
  helpUrl: string;
}) {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((v) => (v === msg ? null : v)), 2500);
  };

  const reload = async () => {
    try {
      const s = await invoke<ApiKeyStatus>('get_api_key_status', { service });
      setStatus(s);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      await invoke('set_api_key', { service, value: trimmed });
      setInput('');
      await reload();
      showFlash('Saved ✓');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setErr(null);
    try {
      await invoke('clear_api_key', { service });
      await reload();
      showFlash('Cleared ✓');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const badge = (() => {
    if (err) {
      return <span className="api-key__badge api-key__badge--warn">error — see below</span>;
    }
    if (!status) {
      return <span className="api-key__badge api-key__badge--none">checking…</span>;
    }
    if (status.source === 'stored') {
      return (
        <span className="api-key__badge api-key__badge--ok">
          stored {status.masked ? `· ${status.masked}` : ''}
        </span>
      );
    }
    if (status.source === 'env') {
      return (
        <span className="api-key__badge api-key__badge--warn">
          .env fallback {status.masked ? `· ${status.masked}` : ''}
        </span>
      );
    }
    return <span className="api-key__badge api-key__badge--none">not set</span>;
  })();

  return (
    <div className="api-key-row">
      <div className="api-key-row__header">
        <span className="api-key-row__label">{label}</span>
        {badge}
        <button
          type="button"
          className="api-key-row__help"
          onClick={() => openUrl(helpUrl).catch(() => {})}
          title="Open provider's API key page"
        >
          get key ↗
        </button>
      </div>
      <div className="api-key-row__controls">
        <input
          type="password"
          className="edit-panel__input"
          placeholder={status?.source === 'stored' ? 'Replace with new key…' : 'Paste key'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          disabled={busy}
          autoComplete="off"
        />
        <button
          type="button"
          className="view-toggle"
          onClick={save}
          disabled={busy || !input.trim()}
        >
          SAVE
        </button>
        {status?.source === 'stored' && (
          <button type="button" className="view-toggle" onClick={clear} disabled={busy}>
            CLEAR
          </button>
        )}
      </div>
      {flash && <div className="api-key__flash">{flash}</div>}
      {err && <div className="edit-panel__error">{err}</div>}
    </div>
  );
}
