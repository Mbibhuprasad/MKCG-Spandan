'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessagesSquare, Users, Wifi, WifiOff } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { ErrorState, Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { cn, formatDate, formatTime } from '@/lib/format';
import { chatApi, createChatSocket, messagePreview } from '@/lib/chat';
import ConversationPane from './ConversationPane';

const LIST_POLL_MS = 20000; // only while the live connection is down
const OBJECT_ID = /^[a-f\d]{24}$/i;

const byActivity = (a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);

function stamp(value) {
  if (!value) return '';
  const d = new Date(value);
  return formatDate(d) === formatDate(new Date()) ? formatTime(d) : formatDate(d, { day: 'numeric', month: 'short' });
}

/**
 * Messages (/dashboard/messages): the community group and one-to-one chats —
 * the same conversations as in the Android app. `?c=<id>` opens a
 * conversation; `?with=<doctorId>` opens (or starts) the one-to-one chat with
 * that doctor.
 */
export default function MessagesView() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get('c');
  const withDoctor = params.get('with');

  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | online | offline
  const listeners = useRef(new Set());
  const selectedRef = useRef(selectedId);
  const knownIds = useRef(new Set());
  useEffect(() => {
    selectedRef.current = selectedId;
    knownIds.current = new Set(conversations.map((c) => c.id));
  });

  const publish = useCallback((event) => {
    for (const listener of [...listeners.current]) listener(event);
  }, []);
  const subscribe = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const { data } = await chatApi.conversations();
      setConversations(data);
      setError(null);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  useEffect(() => {
    // Starts a request; state is set when the answer arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Updates the list entry of a conversation after a message, or a deletion.
  const applyActivity = useCallback((conversationId, message, { deleted = false } = {}) => {
    setConversations((list) => {
      if (!list.some((c) => c.id === conversationId)) return list;
      return list
        .map((c) => {
          if (c.id !== conversationId) return c;
          if (deleted) {
            return c.lastMessage && c.lastMessage.id === message.id
              ? { ...c, lastMessage: { ...c.lastMessage, preview: messagePreview(message) } }
              : c;
          }
          const mine = message.sender && message.sender.id === user.id;
          const open = selectedRef.current === conversationId && document.visibilityState === 'visible';
          return {
            ...c,
            lastMessage: {
              id: message.id,
              preview: messagePreview(message),
              senderId: message.sender ? message.sender.id : null,
              senderName: message.sender ? message.sender.name : '',
              at: message.createdAt,
            },
            lastActivityAt: message.createdAt,
            unreadCount: mine || open ? 0 : Math.min(100, (c.unreadCount || 0) + (c.lastMessage && c.lastMessage.id === message.id ? 0 : 1)),
          };
        })
        .sort(byActivity);
    });
  }, [user.id]);

  // The live connection: receives new messages, reactions and deletions for
  // every conversation this member belongs to (the server picks the rooms).
  useEffect(() => {
    const socket = createChatSocket();
    if (!socket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnection('offline');
      return undefined;
    }
    let retry = null;
    const onReady = () => {
      setConnection('online');
      refresh({ silent: true });
      publish({ type: 'resync' });
    };
    const onDisconnect = (reason) => {
      setConnection('offline');
      if (reason === 'io server disconnect') retry = setTimeout(() => socket.connect(), 3000);
    };
    // A refused handshake (e.g. the hosted API is still waking up) is not
    // retried by Socket.IO itself; try again a little later.
    const onConnectError = () => {
      setConnection('offline');
      if (!socket.active) retry = setTimeout(() => socket.connect(), 8000);
    };
    const onMessage = (payload) => {
      if (!payload || !payload.message || !payload.conversationId) return;
      const conversationId = String(payload.conversationId);
      // A conversation this page has not seen yet (someone just started a chat).
      if (!knownIds.current.has(conversationId)) refresh({ silent: true });
      applyActivity(conversationId, payload.message);
      publish({ type: 'message', conversationId, message: payload.message });
    };
    const onReaction = (payload) => {
      if (!payload || !payload.conversationId || !payload.messageId) return;
      publish({ type: 'reaction', conversationId: String(payload.conversationId), messageId: payload.messageId, reactions: payload.reactions });
    };
    const onDeleted = (payload) => {
      if (!payload || !payload.conversationId || !payload.message) return;
      const conversationId = String(payload.conversationId);
      applyActivity(conversationId, payload.message, { deleted: true });
      publish({ type: 'deleted', conversationId, message: payload.message });
    };
    socket.on('ready', onReady);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessage);
    socket.on('message:reaction', onReaction);
    socket.on('message:deleted', onDeleted);
    socket.io.on('reconnect_attempt', () => setConnection('connecting'));
    socket.connect();
    return () => {
      clearTimeout(retry);
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    };
  }, [refresh, publish, applyActivity]);

  // Without a live connection the list still updates, just less often.
  useEffect(() => {
    if (connection === 'online') return undefined;
    const timer = setInterval(() => document.visibilityState === 'visible' && refresh({ silent: true }), LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [connection, refresh]);

  const select = useCallback(
    (id) => {
      const next = new URLSearchParams();
      if (id) next.set('c', id);
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  // ?with=<doctorId>: open the one-to-one chat (the API creates it on first use).
  const opening = useRef(null);
  useEffect(() => {
    if (!withDoctor || !OBJECT_ID.test(withDoctor) || opening.current === withDoctor) return;
    opening.current = withDoctor;
    chatApi
      .openDirect(withDoctor)
      .then(({ data }) => {
        setConversations((list) => [data, ...list.filter((c) => c.id !== data.id)].sort(byActivity));
        select(data.id);
      })
      .catch((err) => {
        toast.error(err.message);
        select(null);
      });
  }, [withDoctor, select, toast]);

  // Opening a conversation clears its unread badge (the pane marks it read).
  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations((list) => list.map((c) => (c.id === selectedId && c.unreadCount ? { ...c, unreadCount: 0 } : c)));
  }, [selectedId]);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) || null, [conversations, selectedId]);

  return (
    <div className="card flex h-[calc(100dvh-13rem)] min-h-[30rem] overflow-hidden p-0">
      <aside
        className={cn('flex w-full min-w-0 flex-col border-line lg:w-[21rem] lg:shrink-0 lg:border-r', selected ? 'max-lg:hidden' : 'flex')}
        aria-label="Conversations"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
          <h1 className="text-lg font-bold text-fg">Messages</h1>
          <span
            className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', connection === 'online' ? 'text-leaf-strong' : 'text-muted')}
            role="status"
          >
            {connection === 'online' ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {connection === 'online' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Updating every few seconds'}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {status === 'loading' ? (
            <div className="flex justify-center py-12">
              <Spinner label="Loading conversations" />
            </div>
          ) : status === 'error' ? (
            <ErrorState message={error && error.message} onRetry={() => refresh()} className="m-3" />
          ) : conversations.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {conversations.map((c) => {
                const active = c.id === selectedId;
                const last = c.lastMessage;
                const preview = last ? `${last.senderId === user.id ? 'You: ' : c.type === 'GROUP' && last.senderName ? `${last.senderName}: ` : ''}${last.preview}` : c.description || 'No messages yet';
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        active ? 'bg-brand-soft' : 'hover:bg-surface-2'
                      )}
                    >
                      {c.type === 'GROUP' ? (
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink ring-1 ring-line">
                          <Users className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : (
                        <Avatar name={c.name} src={c.avatarUrl} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-bold text-fg">{c.name}</span>
                          <span className="shrink-0 text-[0.7rem] text-muted">{stamp(last ? last.at : null)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={cn('truncate text-xs', c.unreadCount ? 'font-semibold text-fg' : 'text-muted')}>{preview}</span>
                          {c.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[0.68rem] font-bold text-brand-fg">
                              {c.unreadCount > 99 ? '99+' : c.unreadCount}
                              <span className="sr-only"> unread</span>
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {selected ? (
        <ConversationPane
          key={selected.id}
          conversation={selected}
          user={user}
          live={connection === 'online'}
          subscribe={subscribe}
          onBack={() => select(null)}
          onActivity={applyActivity}
        />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center lg:flex">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <MessagesSquare className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-fg">Choose a conversation</p>
          <p className="max-w-sm text-sm text-muted">
            The community group and your one-to-one chats — the same conversations as in the MKCGSPANDAN app.
          </p>
        </div>
      )}
    </div>
  );
}
