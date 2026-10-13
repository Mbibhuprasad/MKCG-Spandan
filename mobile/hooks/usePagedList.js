import { useCallback, useEffect, useRef, useState } from 'react';
import { onInvalidate } from '@/utils/events';

const EMPTY = [];

// Page-by-page loading for the API's paginated lists (`meta.page`, `meta.totalPages`).
//
//   const list = usePagedList((page) => blogsApi.list({ page, limit: 10, q }), [q], { topics: ['blogs'] });
//   <FlatList data={list.items} onEndReached={list.loadMore} refreshing={list.refreshing} onRefresh={list.refresh} />
//
// `deps` are the primitive values the request depends on (search text,
// filters). Changing them makes the list "loading" until the first page of
// the new query arrives — derived from which query the stored pages belong to.
export function usePagedList(fetchPage, deps = [], { topics = [] } = {}) {
  const depsKey = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, items: EMPTY, meta: null, error: null });
  const [moreError, setMoreError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRef = useRef(fetchPage);
  const keyRef = useRef(depsKey);
  const run = useRef(0);
  const page = useRef(1);
  const busy = useRef(false);

  useEffect(() => {
    fetchRef.current = fetchPage;
    keyRef.current = depsKey;
  });

  // mode: load (replace the list) | refresh / silent (keep the list if the request fails)
  const loadFirst = useCallback(async (mode, key) => {
    const id = ++run.current;
    busy.current = true;
    try {
      const result = await fetchRef.current(1);
      if (id !== run.current) return;
      page.current = 1;
      setMoreError(null);
      setState({ key, items: result.data || EMPTY, meta: result.meta || null, error: null });
    } catch (err) {
      if (id !== run.current) return;
      setState((s) => (mode !== 'load' && s.key === key && !s.error ? s : { key, items: EMPTY, meta: null, error: err }));
      if (mode !== 'load') setMoreError(err); // what is on screen stays; the footer says the reload failed
    } finally {
      if (id === run.current) {
        busy.current = false;
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    loadFirst('load', depsKey);
    return () => {
      run.current += 1; // an answer for an old query, or after unmount, is ignored
    };
  }, [depsKey, loadFirst]);

  const topicKey = topics.join('|');
  useEffect(() => {
    if (!topicKey) return undefined;
    const offs = topicKey.split('|').map((topic) => onInvalidate(topic, () => loadFirst('silent', keyRef.current)));
    return () => offs.forEach((off) => off());
  }, [topicKey, loadFirst]);

  const current = state.key === depsKey;
  const status = !current ? 'loading' : state.error ? 'error' : 'ready';
  const meta = current ? state.meta : null;
  const hasMore = Boolean(status === 'ready' && meta && meta.page < meta.totalPages);

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore) return;
    const id = run.current;
    const key = keyRef.current;
    busy.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = page.current + 1;
      const result = await fetchRef.current(next);
      if (id !== run.current) return;
      page.current = next;
      // A row can move between pages while the list is open; keep each id once.
      setState((s) => {
        if (s.key !== key) return s;
        const seen = new Set(s.items.map((item) => item.id));
        return { ...s, items: [...s.items, ...(result.data || []).filter((item) => !seen.has(item.id))], meta: result.meta || s.meta };
      });
    } catch (err) {
      if (id === run.current) setMoreError(err);
    } finally {
      if (id === run.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [hasMore]);

  const setItems = useCallback((updater) => {
    setState((s) => ({ ...s, items: typeof updater === 'function' ? updater(s.items) : updater }));
  }, []);

  const updateItem = useCallback(
    (id, patch) => setItems((items) => items.map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item))),
    [setItems]
  );

  const removeItem = useCallback((id) => setItems((items) => items.filter((item) => item.id !== id)), [setItems]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return loadFirst('refresh', keyRef.current);
  }, [loadFirst]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, key: null })); // back to "loading"
    return loadFirst('load', keyRef.current);
  }, [loadFirst]);

  const items = current ? state.items : EMPTY;
  return {
    items,
    status,
    error: current ? state.error : null,
    moreError,
    meta,
    total: meta ? meta.total : items.length,
    refreshing,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    reload,
    updateItem,
    removeItem,
    setItems,
  };
}
