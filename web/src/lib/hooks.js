import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Carga un recurso; se recarga al cambiar deps o al emitirse wp:refresh. Mantiene datos previos durante la recarga. */
export function useApi(path, params, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!(enabled && path) });
  const key = JSON.stringify([path, params]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path, params);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('wp:refresh', handler);
    return () => window.removeEventListener('wp:refresh', handler);
  }, [load]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
}

const lookupCache = new Map();

/** Listas para selectores, con caché breve compartida. */
export function useLookups(include) {
  const key = [...include].sort().join(',');
  const [data, setData] = useState(() => lookupCache.get(key)?.data ?? {});
  useEffect(() => {
    let alive = true;
    const cached = lookupCache.get(key);
    if (cached && Date.now() - cached.at < 15_000) {
      setData(cached.data);
      return undefined;
    }
    api.get('/lookups', { include: key }).then((d) => {
      lookupCache.set(key, { data: d, at: Date.now() });
      if (alive) setData(d);
    }).catch(() => {});
    const invalidate = () => lookupCache.clear();
    window.addEventListener('wp:refresh', invalidate);
    return () => {
      alive = false;
      window.removeEventListener('wp:refresh', invalidate);
    };
  }, [key]);
  return data;
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Estado persistente por usuario en este navegador (solo preferencias de vista, nunca datos sensibles). */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`wp:${key}`);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`wp:${key}`, JSON.stringify(value));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [key, value]);
  return [value, setValue];
}

export function useInterval(fn, ms) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!ms) return undefined;
    const t = setInterval(() => saved.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
