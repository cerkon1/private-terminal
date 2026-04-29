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

  useEffect(() => {
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
    // Key is expected stable for a component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const serialize = opts?.serialize ?? ((v: T) => JSON.stringify(v));
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      invoke('set_session_key', { key, value: serialize(value) }).catch(() => {});
    }, 300);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue, status];
}
