import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from './api';

const NotificationsContext = createContext({ unreadCount: 0, refreshUnread: () => {}, setUnreadCount: () => {} });

const POLL_MS = 60 * 1000;

// Unread count of the doctor's in-app notifications (the bell in the header).
// The API has no push channel for these, so the count is re-read when the app
// comes to the foreground and once a minute while it is open.
export function NotificationsProvider({ children }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // The bell keeps its last known count; the notifications screen reports errors itself.
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    // Starts a request; state is only set when the answer arrives (the rule cannot see through the await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUnread();
    const timer = setInterval(() => AppState.currentState === 'active' && refreshUnread(), POLL_MS);
    const sub = AppState.addEventListener('change', (next) => next === 'active' && refreshUnread());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [token, refreshUnread]);

  // Signed out, the count is simply not shown; the next sign-in reads it afresh.
  const value = useMemo(() => ({ unreadCount: token ? unreadCount : 0, refreshUnread, setUnreadCount }), [token, unreadCount, refreshUnread]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
