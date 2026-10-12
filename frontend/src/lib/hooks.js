'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Loads data from the API and tracks loading / error state.
 *
 *   const { data, meta, loading, error, reload, setData } =
 *     useApi('/posts', { page }, { enabled: isAuthenticated });
 *
 * The request re-runs whenever the path or query changes. Pass `enabled: false`
 * to wait (for example until the session has been restored).
 */
export function useApi(path, query, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: Boolean(enabled), error: null });
  const [nonce, setNonce] = useState(0);
  const queryKey = JSON.stringify(query || {});
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled || !path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    api
      .get(path, JSON.parse(queryKey), { signal: controller.signal })
      .then(({ data, meta }) => {
        if (requestId === latest.current) setState({ data, meta, loading: false, error: null });
      })
      .catch((error) => {
        if (error && error.name === 'AbortError') return;
        if (requestId === latest.current) setState((s) => ({ ...s, loading: false, error }));
      });

    return () => controller.abort();
  }, [path, queryKey, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
    []
  );

  return { ...state, reload, setData };
}

/**
 * Runs an async action with a busy flag that also blocks repeated submits.
 *
 *   const [save, saving] = useAction(async () => { await api.post(...) });
 */
export function useAction(fn) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (...args) => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await fnRef.current(...args);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return [run, busy];
}

/** Debounces a fast-changing value (search boxes). */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
