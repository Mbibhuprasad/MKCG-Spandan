'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ImagePlus, SendHorizontal, Users, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { ErrorState, Spinner } from '@/components/ui/Feedback';
import { Textarea } from '@/components/ui/Form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/providers/ToastProvider';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { cn, formatDate } from '@/lib/format';
import {
  CHAT_IMAGE_TYPES,
  chatApi,
  downloadChatImage,
  mergeMessages,
  myReactionOf,
  newClientId,
  withReaction,
} from '@/lib/chat';
import MessageBubble from './MessageBubble';

const PAGE = 30;
const MAX_LENGTH = 4000;
const POLL_MS = 10000; // only while the live connection is down

const dayKey = (value) => formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * One open conversation. History comes from the API (membership is checked
 * there); live events arrive through `subscribe` from MessagesView.
 */
export default function ConversationPane({ conversation, user, live, subscribe, onBack, onActivity }) {
  const toast = useToast();
  const conversationId = conversation.id;
  const group = conversation.type === 'GROUP';
  const canSend = conversation.canSend;

  const [messages, setMessages] = useState([]); // oldest → newest
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState(null); // { file, url } waiting to be sent
  const [blocked, setBlocked] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const scroller = useRef(null);
  const fileInput = useRef(null);
  const cursor = useRef(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef(null); // scroll height before older messages were prepended
  const pendingReactions = useRef(new Set());
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });

  const isNearBottom = useCallback(() => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState === 'visible') chatApi.markRead(conversationId).catch(() => {});
  }, [conversationId]);

  const loadLatest = useCallback(
    async ({ initial = false } = {}) => {
      if (initial) {
        setStatus('loading');
        setError(null);
      }
      try {
        const page = await chatApi.messages(conversationId, { limit: PAGE });
        if (initial) {
          setMessages(page.data);
          setHasMore(Boolean(page.meta && page.meta.hasMore));
          cursor.current = page.meta ? page.meta.nextBefore : null;
          stickToBottom.current = true;
          setStatus('ready');
        } else {
          setMessages((current) => mergeMessages(current, page.data));
        }
        markRead();
      } catch (err) {
        if (initial) {
          setError(err);
          setStatus('error');
        }
      }
    },
    [conversationId, markRead]
  );

  useEffect(() => {
    // Starts a request; state is set when the answer arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLatest({ initial: true });
  }, [loadLatest]);

  // Live events for this conversation, and a reload after every reconnect.
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === 'resync') return loadLatest();
        if (event.conversationId !== conversationId) return undefined;
        if (event.type === 'message') {
          if (event.message.sender && event.message.sender.id !== user.id) stickToBottom.current = isNearBottom();
          setMessages((current) => mergeMessages(current, [event.message]));
          if (event.message.sender && event.message.sender.id !== user.id) markRead();
        } else if (event.type === 'reaction') {
          setMessages((current) => current.map((m) => (m.id === event.messageId ? { ...m, reactions: event.reactions } : m)));
        } else if (event.type === 'deleted') {
          setMessages((current) => current.map((m) => (m.id === event.message.id ? { ...m, ...event.message } : m)));
          setMenuId((open) => (open === event.message.id ? null : open));
          setViewing((open) => (open && open.id === event.message.id ? null : open));
          setConfirming((open) => (open && open.id === event.message.id ? null : open));
        }
        return undefined;
      }),
    [subscribe, conversationId, user.id, loadLatest, markRead, isNearBottom]
  );

  // Without a live connection the conversation still updates, just less often.
  useEffect(() => {
    if (live) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadLatest();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [live, loadLatest]);

  // Keep the newest message in view (unless the reader scrolled up), and keep
  // the reading position when older messages are added above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restoreFrom.current != null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, status]);

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || !cursor.current) return;
    setLoadingOlder(true);
    try {
      const page = await chatApi.messages(conversationId, { before: cursor.current, limit: PAGE });
      restoreFrom.current = scroller.current ? scroller.current.scrollHeight - scroller.current.scrollTop : null;
      stickToBottom.current = false;
      setMessages((current) => mergeMessages(current, page.data));
      setHasMore(Boolean(page.meta && page.meta.hasMore));
      cursor.current = page.meta ? page.meta.nextBefore : null;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const patchLocal = (clientId, patch) =>
    setMessages((current) => current.map((m) => (m.clientId === clientId && m.status ? { ...m, ...patch } : m)));

  const deliver = async (local) => {
    let mediaId = local.mediaId;
    try {
      if (local.type === 'IMAGE' && !mediaId) {
        const uploaded = await chatApi.uploadImage(conversationId, local.file, {
          onProgress: (percent) => patchLocal(local.clientId, { progress: percent / 100 }),
        });
        mediaId = uploaded.id;
        patchLocal(local.clientId, { mediaId });
      }
      const { data } = await chatApi.send(conversationId, { body: local.body, clientId: local.clientId, mediaId });
      setMessages((current) => mergeMessages(current, [data]));
      onActivity(conversationId, data);
    } catch (err) {
      if (err.code === 'WHATSAPP_REQUIRED' || err.code === 'PEER_UNAVAILABLE') setBlocked(err);
      else toast.error(err.message);
      patchLocal(local.clientId, {
        status: 'failed',
        progress: undefined,
        ...(err.code === 'MEDIA_INVALID' ? { mediaId: undefined } : null),
        error: err.code === 'NETWORK_ERROR' ? 'No connection' : err.code === 'FILE_TOO_LARGE' ? 'Too large' : 'Not sent',
      });
    }
  };

  const send = (event) => {
    if (event) event.preventDefault();
    const text = draft.trim();
    if (!text && !photo) return;
    const clientId = newClientId();
    const local = {
      id: `local:${clientId}`,
      clientId,
      conversationId,
      type: photo ? 'IMAGE' : 'TEXT',
      body: text,
      reactions: [],
      createdAt: new Date().toISOString(),
      status: 'sending',
      sender: { id: user.id, name: user.name, photoUrl: user.profile && user.profile.photoUrl },
      ...(photo ? { file: photo.file, progress: 0, image: { previewUrl: photo.url, width: photo.width, height: photo.height } } : null),
    };
    stickToBottom.current = true;
    setMessages((current) => [...current, local]);
    setDraft('');
    setPhoto(null);
    deliver(local);
  };

  const retry = (message) => {
    patchLocal(message.clientId, { status: 'sending', error: undefined, progress: message.type === 'IMAGE' && !message.mediaId ? 0 : undefined });
    deliver(message);
  };

  // Validates a chosen photo here for a quick answer; the API checks the real
  // file content again.
  const choosePhoto = (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!CHAT_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please choose a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > UPLOAD_LIMITS.imageMb * 1024 * 1024) {
      toast.error(`That photo is larger than ${UPLOAD_LIMITS.imageMb} MB.`);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => setPhoto({ file, url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => setPhoto({ file, url, width: null, height: null });
    img.src = url;
  };

  // The object URL of a photo removed before sending is released; a sent
  // photo keeps its local preview until the page is left.
  const removePhoto = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  const react = async (message, emoji) => {
    setMenuId(null);
    if (pendingReactions.current.has(message.id)) return;
    const latest = messagesRef.current.find((m) => m.id === message.id) || message;
    if (latest.deleted) return;
    const before = latest.reactions || [];
    const update = (reactions) => setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, reactions } : m)));
    update(withReaction(before, user.id, emoji));
    pendingReactions.current.add(message.id);
    try {
      const { data } = await chatApi.react(conversationId, message.id, emoji);
      update(data.reactions);
    } catch (err) {
      update(before);
      toast.error(err.code === 'NETWORK_ERROR' ? 'No connection — the reaction was not saved.' : err.message);
    } finally {
      pendingReactions.current.delete(message.id);
    }
  };

  const copy = async (message) => {
    setMenuId(null);
    try {
      await navigator.clipboard.writeText(message.body);
      toast.success('Message copied.');
    } catch {
      toast.error('The message could not be copied.');
    }
  };

  const download = async (message) => {
    setMenuId(null);
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadChatImage(conversationId, message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const confirmDelete = async () => {
    const message = confirming;
    try {
      const { data } = await chatApi.remove(conversationId, message.id);
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, ...data.message } : m)));
      onActivity(conversationId, data.message, { deleted: true });
      setConfirming(null);
    } catch (err) {
      toast.error(err.code === 'NETWORK_ERROR' ? 'No connection — the message was not deleted.' : err.message);
    }
  };

  const nameOf = (userId) => {
    if (userId === user.id) return 'You';
    if (conversation.peer && conversation.peer.id === userId) return conversation.peer.name;
    const known = messages.find((m) => m.sender && m.sender.id === userId);
    return known ? known.sender.name : 'A member';
  };

  const subtitle = group
    ? conversation.memberCount
      ? `${conversation.memberCount} ${conversation.memberCount === 1 ? 'member' : 'members'}`
      : conversation.description
    : [conversation.peer && conversation.peer.specialization, conversation.peer && conversation.peer.city].filter(Boolean).join(' · ');

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Conversation with ${conversation.name}`}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-fg-soft hover:bg-surface-2 lg:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        {group ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : (
          <Avatar name={conversation.name} src={conversation.avatarUrl} size="sm" className="h-10 w-10" />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-fg">{conversation.name}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
        {status === 'loading' ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading messages" />
          </div>
        ) : status === 'error' ? (
          <ErrorState message={error && error.message} onRetry={() => loadLatest({ initial: true })} className="border-0 shadow-none" />
        ) : messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted">
            {group ? 'Say hello to the community.' : 'Start the conversation. Only the two of you can read it.'}
          </p>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              {hasMore ? (
                <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingOlder}>
                  Load older messages
                </Button>
              ) : (
                <p className="text-xs text-muted">
                  {group ? 'This is the start of the group conversation.' : 'This is the start of your conversation.'}
                </p>
              )}
            </div>
            <ol className="space-y-1">
              {messages.map((message, index) => {
                const older = messages[index - 1];
                const newer = messages[index + 1];
                const mine = Boolean(message.sender && message.sender.id === user.id);
                const newDay = !older || dayKey(older.createdAt) !== dayKey(message.createdAt);
                const sameAsOlder = older && !newDay && older.sender && message.sender && older.sender.id === message.sender.id;
                const sameAsNewer =
                  newer && dayKey(newer.createdAt) === dayKey(message.createdAt) && newer.sender && message.sender && newer.sender.id === message.sender.id;
                return (
                  <li key={message.id} className={cn(!sameAsOlder && 'pt-2.5')}>
                    {newDay && (
                      <p className="mb-3 flex justify-center">
                        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{dayKey(message.createdAt)}</span>
                      </p>
                    )}
                    <MessageBubble
                      message={message}
                      mine={mine}
                      group={group}
                      showName={!sameAsOlder}
                      showAvatar={!sameAsNewer}
                      myId={user.id}
                      canReact={canSend}
                      menuOpen={menuId === message.id}
                      nameOf={nameOf}
                      onOpenMenu={() => setMenuId(message.id)}
                      onCloseMenu={() => setMenuId(null)}
                      onReact={(emoji) => react(message, emoji)}
                      onToggleReaction={(emoji) => react(message, myReactionOf(message, user.id) === emoji ? '' : emoji)}
                      onCopy={() => copy(message)}
                      onDownload={() => download(message)}
                      onDelete={() => {
                        setMenuId(null);
                        setConfirming(message);
                      }}
                      onOpenPhoto={() => setViewing(message)}
                      onRetry={() => retry(message)}
                    />
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {blocked && (
        <p className="mx-3 mb-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-sm text-warn sm:mx-5" role="alert">
          {blocked.message}
        </p>
      )}

      {canSend ? (
        <form onSubmit={send} className="border-t border-line bg-surface px-3 py-3 sm:px-5">
          {photo && (
            <div className="mb-2.5 flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
              <img src={photo.url} alt="Selected for sending" className="h-14 w-14 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">Photo ready to send</p>
                <p className="truncate text-xs text-muted">Add a caption, or send it as it is.</p>
              </div>
              <button
                type="button"
                onClick={removePhoto}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
                aria-label="Remove the selected photo"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept={CHAT_IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={choosePhoto} aria-hidden="true" />
            <button
              type="button"
              onClick={() => fileInput.current && fileInput.current.click()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-soft transition-colors hover:bg-brand-soft hover:text-brand-ink"
              aria-label="Attach a photo"
              title="Attach a photo"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor={`composer-${conversationId}`}>
              {photo ? 'Photo caption' : 'Message'}
            </label>
            <Textarea
              id={`composer-${conversationId}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
              }}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder={photo ? 'Add a caption' : 'Write a message'}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl"
            />
            <button
              type="submit"
              disabled={!draft.trim() && !photo}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg shadow-soft transition-colors hover:bg-brand-strong disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
              aria-label={photo ? 'Send photo' : 'Send message'}
            >
              <SendHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-line px-5 py-4 text-center text-sm text-muted">
          This member is no longer available, so new messages cannot be sent.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={confirmDelete}
        title="Delete for everyone?"
        message="Everyone in this chat will see “This message was deleted” instead. This cannot be undone."
        confirmLabel="Delete for everyone"
      />

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title="Photo" size="xl"
        footer={
          viewing && (
            <Button icon={Download} onClick={() => download(viewing)} loading={downloading}>
              Download image
            </Button>
          )
        }
      >
        {viewing && viewing.image && (
          <figure>
            <img src={viewing.image.url || viewing.image.previewUrl} alt={viewing.body || 'Shared in chat'} className="mx-auto max-h-[65vh] w-auto rounded-xl object-contain" />
            {viewing.body && <figcaption className="mt-3 text-center text-sm text-fg-soft">{viewing.body}</figcaption>}
          </figure>
        )}
      </Modal>
    </section>
  );
}
