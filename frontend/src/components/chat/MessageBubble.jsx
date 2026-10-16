'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Ban, Check, Copy, Download, Image as ImageIcon, MoreHorizontal, RotateCcw, SmilePlus, Trash2, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { cn, formatTime } from '@/lib/format';
import { REACTIONS, myReactionOf } from '@/lib/chat';

/** The photo of an image message, sized to its proportions; click opens the viewer. */
function MessagePhoto({ message, onOpen }) {
  const [state, setState] = useState('loading'); // loading | ready | error
  const image = message.image;
  const ratio = image.width && image.height ? Math.min(Math.max(image.width / image.height, 0.6), 1.9) : 4 / 3;
  const uploading = message.status === 'sending' && message.progress != null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (!message.status) onOpen();
      }}
      disabled={Boolean(message.status)}
      className="relative block w-64 max-w-full overflow-hidden rounded-xl bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-72"
      style={{ aspectRatio: String(ratio) }}
      aria-label={message.status ? 'Photo being sent' : 'Open photo'}
    >
      {state === 'error' ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-muted">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          Photo could not be loaded
        </span>
      ) : (
        <img
          src={image.previewUrl || image.url}
          alt={message.body || 'Shared in chat'}
          className={cn('h-full w-full object-cover transition-opacity duration-200', state === 'ready' ? 'opacity-100' : 'opacity-0')}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      )}
      {state === 'loading' && <span className="skeleton absolute inset-0" aria-hidden="true" />}
      {uploading && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-sm font-bold text-white">
          <span className="h-1.5 w-2/3 overflow-hidden rounded-full bg-white/30">
            <span className="block h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round((message.progress || 0) * 100)}%` }} />
          </span>
          Uploading {Math.round((message.progress || 0) * 100)}%
        </span>
      )}
    </button>
  );
}

/**
 * Contextual menu of one message: reactions and the actions that apply to it.
 * Opened from the message (click, right-click or the ⋯ button); keyboard
 * friendly — arrow keys move, Escape closes and returns focus to the message.
 */
function MessageMenu({ message, anchorRef, mine, myId, canReact, onReact, onCopy, onDownload, onDelete, onClose }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);
  const myReaction = myReactionOf(message, myId);
  const isPhoto = message.type === 'IMAGE' && message.image;

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor || !ref.current) return;
      const rect = anchor.getBoundingClientRect();
      const menu = ref.current.getBoundingClientRect();
      const gap = 8;
      const below = rect.bottom + gap + menu.height <= window.innerHeight - gap;
      const top = below ? rect.bottom + gap : Math.max(gap, rect.top - gap - menu.height);
      const preferred = mine ? rect.right - menu.width : rect.left;
      const left = Math.min(Math.max(gap, preferred), window.innerWidth - menu.width - gap);
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorRef, mine]);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus moves into the menu once it is placed (a hidden element cannot take focus).
  const focused = useRef(false);
  useEffect(() => {
    if (!position || focused.current) return;
    focused.current = true;
    const first = ref.current && ref.current.querySelector('[role^="menuitem"]');
    if (first) first.focus();
  }, [position]);

  useEffect(() => {
    const onPointer = (event) => {
      const anchor = anchorRef.current;
      if (ref.current && !ref.current.contains(event.target) && !(anchor && anchor.contains(event.target))) closeRef.current();
    };
    const onScroll = (event) => {
      if (ref.current && ref.current.contains(event.target)) return;
      closeRef.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchorRef]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const items = [...ref.current.querySelectorAll('[role^="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    let next = at;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (at + 1) % items.length;
    else next = (at - 1 + items.length) % items.length;
    event.preventDefault();
    items[next].focus();
  };

  const item =
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-fg outline-none hover:bg-surface-2 focus-visible:bg-surface-2';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Message options"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
      className="fixed z-50 w-[17.5rem] max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-surface p-2 shadow-lift"
      style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {canReact && (
        <div className="mb-1 flex items-center justify-between gap-0.5 border-b border-line px-0.5 pb-2" role="group" aria-label="React">
          {REACTIONS.map((emoji) => {
            const chosen = myReaction === emoji;
            return (
              <button
                key={emoji}
                type="button"
                role="menuitemcheckbox"
                onClick={() => onReact(chosen ? '' : emoji)}
                aria-label={chosen ? `Remove your ${emoji} reaction` : `React with ${emoji}`}
                aria-checked={chosen}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none outline-none transition-transform duration-150 hover:scale-115 hover:bg-surface-2 focus-visible:scale-115 focus-visible:bg-surface-2',
                  chosen && 'bg-brand-soft ring-2 ring-brand'
                )}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>
      )}
      {message.body && (
        <button type="button" role="menuitem" className={item} onClick={onCopy}>
          <Copy className="h-4 w-4 text-muted" aria-hidden="true" /> Copy text
        </button>
      )}
      {isPhoto && (
        <button type="button" role="menuitem" className={item} onClick={onDownload}>
          <Download className="h-4 w-4 text-muted" aria-hidden="true" /> Download image
        </button>
      )}
      {canReact && myReaction && (
        <button type="button" role="menuitem" className={item} onClick={() => onReact('')}>
          <SmilePlus className="h-4 w-4 text-muted" aria-hidden="true" /> Remove my reaction
        </button>
      )}
      {mine && (
        <button type="button" role="menuitem" className={cn(item, 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft')} onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete for everyone
        </button>
      )}
      <button type="button" role="menuitem" className={cn(item, 'text-fg-soft')} onClick={() => onClose(true)}>
        <X className="h-4 w-4 text-muted" aria-hidden="true" /> Cancel
      </button>
    </div>
  );
}

/**
 * One message of the timeline. All handlers are bound to this message, so a
 * reaction, menu or download can never act on a neighbouring message.
 */
export default function MessageBubble({
  message,
  mine,
  group,
  showName,
  showAvatar,
  myId,
  canReact,
  menuOpen,
  nameOf,
  onOpenMenu,
  onCloseMenu,
  onReact,
  onToggleReaction,
  onCopy,
  onDownload,
  onDelete,
  onOpenPhoto,
  onRetry,
}) {
  const bubbleRef = useRef(null);
  const failed = message.status === 'failed';
  const sending = message.status === 'sending';
  const deleted = Boolean(message.deleted);
  const hasMenu = !message.status && !deleted;
  const isPhoto = !deleted && message.type === 'IMAGE' && message.image;
  const reactions = deleted ? [] : message.reactions || [];

  const open = () => hasMenu && onOpenMenu();
  const close = (restoreFocus) => {
    onCloseMenu();
    if (restoreFocus && bubbleRef.current) bubbleRef.current.focus();
  };

  return (
    <div className={cn('group/message flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
      {group && !mine && (
        <div className="w-8 shrink-0">{showAvatar && <Avatar name={message.sender.name} src={message.sender.photoUrl} size="xs" className="h-8 w-8" />}</div>
      )}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
        <div className={cn('flex items-center gap-1', mine ? 'flex-row-reverse' : 'flex-row')}>
          {/* The bubble itself is the menu trigger (click / Enter / right-click). */}
          <div
            ref={bubbleRef}
            role={hasMenu ? 'button' : undefined}
            tabIndex={hasMenu ? 0 : undefined}
            aria-haspopup={hasMenu ? 'menu' : undefined}
            aria-expanded={hasMenu ? menuOpen : undefined}
            aria-label={
              hasMenu
                ? `${mine ? 'You' : message.sender.name}, ${formatTime(message.createdAt)}: ${isPhoto ? `photo${message.body ? `, ${message.body}` : ''}` : message.body}. Press Enter for options`
                : undefined
            }
            onClick={open}
            onKeyDown={(event) => {
              if (hasMenu && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                open();
              }
            }}
            onContextMenu={(event) => {
              if (!hasMenu) return;
              event.preventDefault();
              open();
            }}
            className={cn(
              'relative min-w-0 rounded-2xl text-[0.94rem] leading-relaxed outline-none transition-[filter,box-shadow] duration-150',
              isPhoto ? 'p-1' : 'px-3.5 py-2',
              mine ? 'rounded-br-md bg-brand text-brand-fg' : 'rounded-bl-md border border-line bg-surface text-fg',
              deleted && 'border border-dashed border-line-strong bg-transparent text-muted',
              failed && 'border border-danger/40 bg-danger-soft text-danger',
              sending && 'opacity-75',
              hasMenu && 'cursor-pointer hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              menuOpen && 'ring-2 ring-ring'
            )}
          >
            {group && !mine && showName && (
              <p className={cn('mb-0.5 truncate text-xs font-bold text-leaf-strong', isPhoto && 'px-2 pt-1')}>{message.sender.name}</p>
            )}
            {deleted ? (
              <p className="flex items-center gap-1.5 text-sm italic">
                <Ban className="h-3.5 w-3.5" aria-hidden="true" /> This message was deleted
              </p>
            ) : (
              <>
                {isPhoto && <MessagePhoto message={message} onOpen={onOpenPhoto} />}
                {message.body && <p className={cn('whitespace-pre-wrap break-words', isPhoto && 'px-2 pt-1.5')}>{message.body}</p>}
              </>
            )}
            <p
              className={cn(
                'mt-0.5 flex items-center justify-end gap-1 text-[0.68rem]',
                isPhoto && 'px-2 pb-0.5',
                mine && !deleted && !failed ? 'text-brand-fg/75' : 'text-muted'
              )}
            >
              {failed ? (
                <span className="font-semibold text-danger">{message.error || 'Not sent'}</span>
              ) : (
                <>
                  {sending ? 'Sending…' : formatTime(message.createdAt)}
                  {mine && !sending && !deleted && <Check className="h-3 w-3" aria-hidden="true" />}
                </>
              )}
            </p>
          </div>
          {hasMenu && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                open();
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-100 transition-opacity hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 sm:opacity-0 sm:group-hover/message:opacity-100"
              aria-label="Message options"
              tabIndex={-1}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {failed && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-danger hover:bg-danger-soft"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </button>
          )}
        </div>

        {reactions.length > 0 && (
          <ul className={cn('mt-1 flex flex-wrap gap-1', mine ? 'justify-end' : 'justify-start')} aria-label="Reactions">
            {reactions.map((reaction) => {
              const own = reaction.userIds.includes(myId);
              const names = reaction.userIds.map(nameOf);
              return (
                <li key={reaction.emoji}>
                  <button
                    type="button"
                    onClick={() => canReact && onToggleReaction(reaction.emoji)}
                    title={names.join(', ')}
                    aria-pressed={own}
                    aria-label={`${reaction.emoji} from ${names.join(', ')}.${canReact ? (own ? ' Remove yours.' : ' Add yours.') : ''}`}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-sm leading-none shadow-soft transition-transform duration-150 hover:-translate-y-0.5',
                      own ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-fg-soft'
                    )}
                  >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    {reaction.userIds.length > 1 && <span className="text-xs font-bold">{reaction.userIds.length}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {menuOpen && hasMenu && (
        <MessageMenu
          message={message}
          anchorRef={bubbleRef}
          mine={mine}
          myId={myId}
          canReact={canReact}
          onReact={onReact}
          onCopy={onCopy}
          onDownload={onDownload}
          onDelete={onDelete}
          onClose={close}
        />
      )}
    </div>
  );
}
