import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { alertNewMessage } from '@/features/notifications/localAlerts';
import { ApiError, api } from '@/services/api';
import { createChatSocket, emitWithAck } from '@/services/socket';
import { publish, subscribe } from '@/utils/events';
import { chatApi } from './api';

// One live chat connection for the signed-in doctor, plus the conversation list
// that the Chat tab, the tab-bar badge and every conversation screen share.
//
// Kept separate from the screens on purpose: later additions that need the same
// authenticated socket (typing indicators, call signalling for voice/video)
// plug in here without touching the message UI.
const ChatContext = createContext(null);

const PREVIEW_LENGTH = 140;
const UNREAD_CAP = 99;
const messageTopic = (conversationId) => `chat:message:${conversationId}`;
export const RESYNC_TOPIC = 'chat:resync';

const byActivity = (a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);

// connection: idle | connecting | online | offline
export function ChatProvider({ children }) {
  const { token, user } = useAuth();
  const userId = user ? user.id : null;
  const [connection, setConnection] = useState(token ? 'connecting' : 'idle');
  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState(token ? 'loading' : 'idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);

  // A different session (sign-in, sign-out, another account) starts from a
  // clean slate, so one doctor's conversations can never be shown to another.
  const [session, setSession] = useState(token);
  if (session !== token) {
    setSession(token);
    setConnection(token ? 'connecting' : 'idle');
    setConversations([]);
    setStatus(token ? 'loading' : 'idle');
    setError(null);
  }

  const socketRef = useRef(null);
  const activeRef = useRef(null); // conversation currently open on screen
  const knownRef = useRef(new Set());
  const loadRun = useRef(0);

  const refreshConversations = useCallback(async ({ silent = false } = {}) => {
    const run = ++loadRun.current;
    if (!silent) setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const { data } = await chatApi.conversations();
      if (run !== loadRun.current) return;
      knownRef.current = new Set(data.map((c) => c.id));
      setConversations(data);
      setError(null);
      setStatus('ready');
    } catch (err) {
      if (run !== loadRun.current) return;
      setError(err);
      setStatus((s) => (s === 'ready' ? s : 'error')); // keep the list that is already shown
    }
  }, []);

  const applyIncoming = useCallback(
    (conversationId, message) => {
      const mine = message.sender && message.sender.id === userId;
      const open = activeRef.current === conversationId;

      if (!knownRef.current.has(conversationId)) {
        // A conversation this device has not seen yet (someone just opened a
        // one-to-one chat with this doctor): load it from the server.
        refreshConversations({ silent: true });
      } else {
        setConversations((list) =>
          list
            .map((c) =>
              c.id !== conversationId
                ? c
                : {
                    ...c,
                    lastMessage: {
                      id: message.id,
                      preview: String(message.body).replace(/\s+/g, ' ').slice(0, PREVIEW_LENGTH),
                      senderId: message.sender ? message.sender.id : null,
                      senderName: message.sender ? message.sender.name : '',
                      at: message.createdAt,
                    },
                    lastActivityAt: message.createdAt,
                    unreadCount: mine || open ? c.unreadCount : Math.min(UNREAD_CAP + 1, (c.unreadCount || 0) + 1),
                  }
            )
            .sort(byActivity)
        );
      }

      publish(messageTopic(conversationId), message);

      if (!mine && !open) {
        alertNewMessage({
          title: message.sender ? message.sender.name : 'New message',
          body: String(message.body).slice(0, 160),
          conversationId,
        });
      }
    },
    [userId, refreshConversations]
  );

  // Connect while signed in; disconnect and forget everything on sign-out.
  useEffect(() => {
    knownRef.current = new Set();
    if (!token) return undefined;

    const socket = createChatSocket(token);
    socketRef.current = socket;
    // Starts a request; state is only set when the answer arrives (the rule cannot see through the await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConversations({ silent: true });

    const onReady = () => {
      setConnection('online');
      // Anything sent while this device was away is fetched again: the list
      // here, and the open conversation through the resync topic.
      refreshConversations({ silent: true });
      publish(RESYNC_TOPIC);
    };
    const onDisconnect = (reason) => {
      setConnection('offline');
      // The server closed the socket (for example the 5-device limit, or a
      // restart). Socket.IO does not reconnect by itself in that case.
      if (reason === 'io server disconnect') setTimeout(() => socketRef.current === socket && socket.connect(), 2000);
    };
    const onConnectError = (err) => {
      setConnection('offline');
      const code = err && err.data && err.data.code;
      if (code === 'SESSION_EXPIRED' || code === 'UNAUTHENTICATED' || code === 'ACCOUNT_SUSPENDED') {
        socket.disconnect();
        // Let the REST client confirm it; that signs the app out in one place.
        api.get('/auth/me').catch(() => {});
      }
    };
    const onMessage = (payload) => {
      if (!payload || !payload.message || !payload.conversationId) return;
      applyIncoming(String(payload.conversationId), payload.message);
    };

    socket.on('ready', onReady);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    socket.io.on('reconnect_attempt', () => setConnection('connecting'));
    socket.connect();

    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (!socket.connected) socket.connect();
      else refreshConversations({ silent: true });
    });

    return () => {
      appState.remove();
      socket.off('ready', onReady);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessage);
      socket.io.off('reconnect_attempt');
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [token, applyIncoming, refreshConversations]);

  // Sends over the live connection; when there is none, or no acknowledgement
  // arrives, the same message (same clientId) goes through REST. The server
  // stores a clientId once, so a message can never be duplicated by the retry.
  const sendMessage = useCallback(
    async (conversationId, body, clientId) => {
      const socket = socketRef.current;
      let message;
      if (socket && socket.connected) {
        try {
          const reply = await emitWithAck(socket, 'message:send', { conversationId, body, clientId });
          message = reply.message;
        } catch (err) {
          if (!(err instanceof ApiError) || (err.code !== 'SOCKET_TIMEOUT' && err.code !== 'SOCKET_OFFLINE')) throw err;
        }
      }
      if (!message) {
        const { data } = await chatApi.send(conversationId, body, clientId);
        message = data;
      }
      // The broadcast normally arrives first; this covers the REST path while offline from the socket.
      applyIncoming(conversationId, message);
      return message;
    },
    [applyIncoming]
  );

  const markRead = useCallback(async (conversationId) => {
    setConversations((list) => list.map((c) => (c.id === conversationId && c.unreadCount ? { ...c, unreadCount: 0 } : c)));
    const socket = socketRef.current;
    try {
      if (socket && socket.connected) await emitWithAck(socket, 'conversation:read', { conversationId }, 5000);
      else await chatApi.markRead(conversationId);
    } catch {
      // The next conversation refresh brings the true unread count back.
    }
  }, []);

  const setActiveConversation = useCallback((conversationId) => {
    activeRef.current = conversationId || null;
  }, []);

  const upsertConversation = useCallback((conversation) => {
    if (!conversation) return;
    knownRef.current.add(conversation.id);
    setConversations((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)].sort(byActivity));
  }, []);

  const unread = useMemo(() => {
    const totals = { total: 0, GROUP: 0, DIRECT: 0 };
    for (const c of conversations) {
      totals.total += c.unreadCount || 0;
      totals[c.type] = (totals[c.type] || 0) + (c.unreadCount || 0);
    }
    return totals;
  }, [conversations]);

  const value = useMemo(
    () => ({
      connection,
      conversations,
      status,
      error,
      unread,
      refreshConversations,
      sendMessage,
      markRead,
      setActiveConversation,
      upsertConversation,
    }),
    [connection, conversations, status, error, unread, refreshConversations, sendMessage, markRead, setActiveConversation, upsertConversation]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}

// Calls `listener(message)` for every message that arrives in one conversation.
export function useConversationMessages(conversationId, listener) {
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  });
  useEffect(() => {
    if (!conversationId) return undefined;
    return subscribe(messageTopic(conversationId), (message) => ref.current(message));
  }, [conversationId]);
}
