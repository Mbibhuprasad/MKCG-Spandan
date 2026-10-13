import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, onAuthFailure, setToken } from '@/services/api';
import { KEYS, getItem, removeItem, setItem } from '@/services/storage';

const AuthContext = createContext(null);

// Asks the API for a session token in the response body instead of a cookie
// (see docs/AUTHENTICATION.md, "Mobile (bearer) flow").
const MOBILE = { auth: false, headers: { 'X-Client-Type': 'mobile' } };

// status:
//   loading    reading the stored session
//   signedOut  no session
//   signedIn   session confirmed by the API
//   offline    a stored session exists but the API could not be reached to
//              confirm it — the doctor is asked to retry, never signed out
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [notice, setNotice] = useState(null); // why the doctor was signed out, shown on the login screen
  const [bootError, setBootError] = useState(null);
  const [introSeen, setIntroSeen] = useState(true);
  const [onboardingPending, setOnboardingPending] = useState(false);
  const signingOut = useRef(false);

  const clearSession = useCallback(async (message) => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setOnboardingPending(false);
    setStatus('signedOut');
    setNotice(message || null);
    await removeItem(KEYS.token);
  }, []);

  const adopt = useCallback(async (sessionToken, account) => {
    setToken(sessionToken);
    setTokenState(sessionToken);
    setUser(account);
    setNotice(null);
    setBootError(null);
    const pending = await getItem(KEYS.onboarding);
    setOnboardingPending(pending === account.id);
    setStatus('signedIn');
  }, []);

  // Reads the stored session and asks the API whether it is still valid.
  const loadSession = useCallback(async () => {
    const [stored, seen] = await Promise.all([getItem(KEYS.token), getItem(KEYS.introSeen)]);
    setIntroSeen(seen === '1');
    if (!stored) {
      setStatus('signedOut');
      return;
    }
    setToken(stored);
    try {
      const { data } = await api.get('/auth/me');
      await adopt(stored, data.user);
    } catch (error) {
      if (error instanceof ApiError && (error.isNetwork || error.code === 'NOT_CONFIGURED' || error.status >= 500 || error.code === 'RATE_LIMITED')) {
        // The session may well be valid; the server just could not confirm it.
        setTokenState(stored);
        setBootError(error);
        setStatus('offline');
        return;
      }
      await clearSession(error && error.code === 'ACCOUNT_SUSPENDED' ? error.message : 'Your session has ended. Please sign in again.');
    }
  }, [adopt, clearSession]);

  // On launch the status is already "loading".
  useEffect(() => {
    // Starts a request; state is only set when the answer arrives (the rule cannot see through the await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  // "Try again" on the server-unreachable screen.
  const restore = useCallback(() => {
    setStatus('loading');
    setBootError(null);
    return loadSession();
  }, [loadSession]);

  // Any request that reports an ended session or a suspension signs the app out.
  useEffect(() => {
    onAuthFailure((error) => {
      if (signingOut.current) return;
      clearSession(error.message);
    });
    return () => onAuthFailure(null);
  }, [clearSession]);

  const signIn = useCallback(
    async ({ identifier, password }) => {
      const { data } = await api.post('/auth/login', { identifier, password }, MOBILE);
      if (!data.token) throw new ApiError({ code: 'NO_TOKEN', message: 'The server did not start a mobile session. Please update the app.' });
      await setItem(KEYS.token, data.token);
      await adopt(data.token, data.user);
      return data.user;
    },
    [adopt]
  );

  // Registration signs the doctor in straight away (there is no approval step)
  // and marks the optional onboarding as still to do.
  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload, MOBILE);
      if (!data.token) throw new ApiError({ code: 'NO_TOKEN', message: 'The server did not start a mobile session. Please update the app.' });
      await Promise.all([setItem(KEYS.token, data.token), setItem(KEYS.onboarding, data.user.id)]);
      await adopt(data.token, data.user);
      return data.user;
    },
    [adopt]
  );

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      // Ends the server-side session too. Signing out locally must not depend on it.
      await api.post('/auth/logout', {}, { timeout: 6000 }).catch(() => {});
    } finally {
      await clearSession(null);
      signingOut.current = false;
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const finishOnboarding = useCallback(async () => {
    setOnboardingPending(false);
    await removeItem(KEYS.onboarding);
  }, []);

  const markIntroSeen = useCallback(async () => {
    setIntroSeen(true);
    await setItem(KEYS.introSeen, '1');
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      token: status === 'signedIn' ? token : null,
      notice,
      bootError,
      introSeen,
      onboardingPending,
      isAdmin: Boolean(user && user.role === 'ADMIN'),
      signIn,
      register,
      signOut,
      restore,
      refreshUser,
      setUser,
      finishOnboarding,
      markIntroSeen,
      clearNotice: () => setNotice(null),
    }),
    [status, user, token, notice, bootError, introSeen, onboardingPending, signIn, register, signOut, restore, refreshUser, finishOnboarding, markIntroSeen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
