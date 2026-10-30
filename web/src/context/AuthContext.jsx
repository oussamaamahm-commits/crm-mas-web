import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrfToken, setUnauthorizedHandler } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, permissions: new Set(), expiresAt: null });

  const apply = useCallback((me) => {
    setCsrfToken(me.csrfToken);
    setState({ status: 'authenticated', user: me.user, permissions: new Set(me.permissions), expiresAt: me.expiresAt });
  }, []);

  const reset = useCallback(() => {
    setCsrfToken(null);
    setState({ status: 'anonymous', user: null, permissions: new Set(), expiresAt: null });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    api.get('/auth/me').then(apply).catch(reset);
  }, [apply, reset]);

  const value = useMemo(
    () => ({
      ...state,
      can: (perm) => state.permissions.has(perm),
      login: async (email, password) => apply(await api.post('/auth/login', { email, password })),
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          reset();
        }
      },
    }),
    [state, apply, reset],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Muestra el contenido solo con el permiso indicado (el backend también lo exige). */
export function Can({ perm, children, fallback = null }) {
  const { can } = useAuth();
  return can(perm) ? children : fallback;
}
