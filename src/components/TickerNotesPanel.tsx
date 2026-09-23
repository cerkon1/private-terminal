import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

/// Private per-ticker notes (v1.1). Plain text stored in the local SQLite
/// file via get/set_ticker_note — never sent anywhere. The parent keys this
/// component by `${ticker}:${dataSource}`, so a ticker switch remounts it
/// (and the unmount flush saves the previous ticker's pending edit).

type TickerNote = { body: string; updatedAt: string };

type Props = {
  ticker: string;
  dataSource: string;
  /** Called after a save/delete so tiles can show or clear the ✎ mark. */
  onHasNoteChange?: (hasNote: boolean) => void;
};

const SAVE_DEBOUNCE_MS = 600;

function localIsoDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatSavedAt(rfc3339: string): string {
  const d = new Date(rfc3339);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TickerNotesPanel({ ticker, dataSource, onHasNoteChange }: Props) {
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<number | null>(null);
  // Pending body not yet written. Refs so the unmount flush sees the latest.
  const pendingRef = useRef<string | null>(null);
  const onHasNoteChangeRef = useRef(onHasNoteChange);
  onHasNoteChangeRef.current = onHasNoteChange;

  const flush = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending == null) return;
    pendingRef.current = null;
    setDirty(false);
    setSaving(true);
    invoke<TickerNote | null>('set_ticker_note', { ticker, dataSource, body: pending })
      .then((saved) => {
        setSavedAt(saved?.updatedAt ?? null);
        setError(null);
        onHasNoteChangeRef.current?.(saved != null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setSaving(false));
  };

  useEffect(() => {
    let cancelled = false;
    invoke<TickerNote | null>('get_ticker_note', { ticker, dataSource })
      .then((note) => {
        if (cancelled) return;
        setBody(note?.body ?? '');
        setSavedAt(note?.updatedAt ?? null);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, dataSource]);

  // Save whatever is pending when the panel closes or the ticker changes.
  // flush only reads refs + the props it was created with, which are fixed
  // for this instance (the parent remounts on ticker change).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);

  const update = (next: string) => {
    setBody(next);
    setDirty(true);
    pendingRef.current = next;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
  };

  const insertDate = () => {
    const el = textRef.current;
    const stamp = `${localIsoDate()} — `;
    if (!el) {
      update(body + (body && !body.endsWith('\n') ? '\n' : '') + stamp);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const atLineStart = start === 0 || body[start - 1] === '\n';
    const insert = (atLineStart ? '' : '\n') + stamp;
    update(body.slice(0, start) + insert + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const status = error
    ? `Not saved: ${error}`
    : saving
      ? 'Saving…'
      : dirty
        ? 'Editing…'
        : savedAt
          ? `Saved ${formatSavedAt(savedAt)}`
          : 'No note yet';

  return (
    <aside className="notes-panel" aria-label={`Notes for ${ticker}`}>
      <div className="notes-panel__header">
        <span className="notes-panel__title">NOTES · {ticker}</span>
        <button
          type="button"
          className="view-toggle notes-panel__date"
          onClick={insertDate}
          disabled={!loaded}
          title="Insert today's date for a journal entry"
        >
          + DATE
        </button>
      </div>
      <textarea
        ref={textRef}
        className="notes-panel__text"
        value={body}
        onChange={(e) => update(e.target.value)}
        onBlur={flush}
        disabled={!loaded}
        placeholder={loaded ? 'Thesis, levels to watch, why you hold it… Stored only on this machine.' : 'Loading…'}
        spellCheck
      />
      <div className={`notes-panel__status ${error ? 'notes-panel__status--error' : ''}`}>{status}</div>
    </aside>
  );
}
