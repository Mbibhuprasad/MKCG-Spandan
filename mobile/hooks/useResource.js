import { useCallback, useEffect, useRef, useState } from 'react';
import { onInvalidate } from '@/utils/events';

// Loads one value from the API and keeps the three states a screen has to
// show apart: loading, error (with the reason) and ready. An empty result is
// "ready" — it is never confused with a failed request.
//
//   const { data, status, error, refreshing, refresh, reload, setData } =
//     useResource(() => blogsApi.list({ limit: 10 }), [], { topics: ['blogs'] });
//
// `fetcher` resolves with { data, meta } (what services/api returns). `deps`
// are the primitive values the request depends on; when they change the hook
// is "loading" again until the new answer arrives. That is derived from which
// request the stored answer belongs to, so no state is set just to say "loading".
export function useResource(fetcher, deps = [], { topics = [], enabled = true } = {}) {
  const depsKey = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: null, meta: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(depsKey);
  const run = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = depsKey;
  });

  // mode: load (replace whatever is shown) | refresh / silent (keep it if the request fails)
  const load = useCallback(async (mode, key) => {
    const id = ++run.current;
    try {
      const result = await fetcherRef.current();
      if (id !== run.current) return;
      setState({ key, data: result.data, meta: result.meta || null, error: null });
    } catch (error) {
      if (id !== run.current) return;
      setState((s) => (mode !== 'load' && s.key === key && !s.error ? s : { key, data: null, meta: null, error }));
    } finally {
      if (id === run.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load('load', depsKey);
    return () => {
      run.current += 1; // an answer for old deps, or after unmount, is ignored
    };
  }, [enabled, depsKey, load]);

  const topicKey = topics.join('|');
  useEffect(() => {
    if (!enabled || !topicKey) return undefined;
    const offs = topicKey.split('|').map((topic) => onInvalidate(topic, () => load('silent', keyRef.current)));
    return () => offs.forEach((off) => off());
  }, [topicKey, enabled, load]);

  const current = state.key === depsKey;
  const status = !enabled ? 'idle' : !current ? 'loading' : state.error ? 'error' : 'ready';

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load('refresh', keyRef.current);
  }, [load]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, key: null })); // back to "loading"
    return load('load', keyRef.current);
  }, [load]);

  const reloadSilently = useCallback(() => load('silent', keyRef.current), [load]);

  return {
    data: current ? state.data : null,
    meta: current ? state.meta : null,
    error: current ? state.error : null,
    status,
    refreshing,
    refresh,
    reload,
    reloadSilently,
    setData,
  };
}
