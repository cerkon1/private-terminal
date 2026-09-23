import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type Options<T> = {
  serialize?: (value: T) => string;
  parse?: (raw: string) => T;
};

export type PersistenceStatus = {
  loaded: boolean;
  hadStoredValue: boolean;
};

/**
 * React state that persists to SQLite's `config` KV via session_cmds.
 *
 * `loaded` flips true once the initial read resolves; `hadStoredValue`
 * tells consumers whether the current state came from persistence or
 * from `initial`. Consumers that need "first-ever-launch" semantics
 * (e.g. default-expand-all) should gate on `hadStoredValue === false`.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  opts?: Options<T>,
): [T, React.Dispatch<React.SetStateAction<T>>, PersistenceStatus] {
  const [value, setValue] = useState<T>(initial);
  const [status, setStatus] = useState<PersistenceStatus>({
    loaded: false,
    hadStoredValue: false,
  });
  const loadedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  // The debounced write carries its own key, so a flush after a key change
  // or unmount still lands on the key the value belongs to.
  const pendingRef = useRef<{ key: string; raw: string } | null>(null);

  const flush = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    invoke('set_session_key', { key: pending.key, value: pending.raw }).catch(() => {});
  };

  useEffect(() => {
    // New key: write out anything pending for the old key, then block writes
    // until this key's stored value has loaded. Without the reset, the write
    // effect below (same commit, loadedRef still true) wrote the OLD value to
    // the NEW key — the FE-9 race.
    flush();
    loadedRef.current = false;
    let cancelled = false;
    const parse = opts?.parse ?? ((raw: string) => JSON.parse(raw) as T);
    invoke<string | null>('get_session_key', { key })
      .then((raw) => {
        if (cancelled) return;
        let had = false;
        if (raw != null) {
          try {
            setValue(parse(raw));
            had = true;
          } catch {
            // Malformed stored value — fall back to initial.
          }
        }
        loadedRef.current = true;
        setStatus({ loaded: true, hadStoredValue: had });
      })
      .catch(() => {
        if (cancelled) return;
        loadedRef.current = true;
        setStatus({ loaded: true, hadStoredValue: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const serialize = opts?.serialize ?? ((v: T) => JSON.stringify(v));
    pendingRef.current = { key, raw: serialize(value) };
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  // Unmount: write the pending value now instead of dropping it. (Toggling
  // AUTO Y then clicking Back within 300 ms used to lose the toggle.)
  // flush only touches refs, so the first render's closure is fine here.
  useEffect(() => flush, []);

  return [value, setValue, status];
}
