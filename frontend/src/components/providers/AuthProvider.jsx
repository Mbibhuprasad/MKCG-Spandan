'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, onUnauthorized, setCsrfToken } from '@/lib/api';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user for the whole app.
 *
 *   status: 'loading'        → the session is being restored (first render)
 *           'authenticated'  → `user` is set
 *           'anonymous'      → nobody is signed in
 *
 * The role shown here only decides which links are displayed. Every permission
 * is enforced again by the API.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [sessionMessage, setSessionMessage] = useState('');
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applySession = useCallback((data) => {
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    setStatus('authenticated');
    setSessionMessage('');
  }, []);

  const clearSession = useCallback((message = '') => {
    setCsrfToken('');
    setUser(null);
    setStatus('anonymous');
    setSessionMessage(message);
  }, []);

  // Restore the session after a page refresh.
  useEffect(() => {
    let cancelled = false;
    // /auth/session always answers 200, so signed-out visitors do not log a
    // failed request in the console on every page load.
    api
      .get('/auth/session', undefined, { silentAuth: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data.authenticated) applySession(data);
        else clearSession(data.reason === 'ACCOUNT_SUSPENDED' ? data.message : '');
      })
      .catch(() => !cancelled && clearSession(''));
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  // If any later request reports an expired session or a suspension, sign the UI out.
  useEffect(() => {
    onUnauthorized((error) => {
      if (statusRef.current !== 'authenticated') return;
      clearSession(
        error.code === 'ACCOUNT_SUSPENDED' ? error.message : 'Your session has ended. Please sign in again.'
      );
    });
    return () => onUnauthorized(null);
  }, [clearSession]);

  const login = useCallback(
    async (identifier, password) => {
      const { data } = await api.post('/auth/login', { identifier, password }, { silentAuth: true });
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload, { silentAuth: true });
      applySession(data); // registration signs the doctor in immediately
      return data.user;
    },
    [applySession]
  );

  // Ends the session on the server, then reloads onto a public page. The full
  // page load discards all member data held in memory, and avoids a private
  // page's guard briefly redirecting to the login screen first.
  const logout = useCallback(async (redirectTo = '/') => {
    try {
      await api.post('/auth/logout', {}, { silentAuth: true });
    } catch {
      // The cookie is cleared by the server whenever it can be reached.
    }
    setCsrfToken('');
    window.location.assign(redirectTo);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    applySession(data);
    return data.user;
  }, [applySession]);

  const value = useMemo(
    () => ({
      status,
      user,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isAdmin: Boolean(user && user.role === 'ADMIN'),
      sessionMessage,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [status, user, sessionMessage, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
