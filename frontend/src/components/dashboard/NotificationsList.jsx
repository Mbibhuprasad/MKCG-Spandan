'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CircleCheck,
  CircleX,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  Vote,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { cn, formatDateTime, timeAgo } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import { notifyNotificationsChanged } from '@/components/layout/NotificationBell';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';

const PAGE_SIZE = 15;

const TYPE_STYLE = {
  CONTENT_APPROVED: { icon: CircleCheck, className: 'bg-leaf-soft text-leaf-strong' },
  CONTENT_REJECTED: { icon: CircleX, className: 'bg-danger-soft text-danger' },
  CONTENT_REMOVED: { icon: Trash2, className: 'bg-danger-soft text-danger' },
  EVENT_PUBLISHED: { icon: CalendarDays, className: 'bg-brand-soft text-brand-ink' },
  POLL_PUBLISHED: { icon: Vote, className: 'bg-brand-soft text-brand-ink' },
  EVENT_REMINDER: { icon: CalendarClock, className: 'bg-warn-soft text-warn' },
  NEW_COMMENT: { icon: MessageCircle, className: 'bg-brand-soft text-brand-ink' },
  ACCOUNT_STATUS: { icon: ShieldAlert, className: 'bg-warn-soft text-warn' },
  WELCOME: { icon: Sparkles, className: 'bg-leaf-soft text-leaf-strong' },
};
const DEFAULT_STYLE = { icon: Bell, className: 'bg-surface-2 text-fg-soft' };

// Notification links are created by the API and always point inside this site.
const internalLink = (link) => (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null);

export default function NotificationsList() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload, setData } = useApi('/notifications', {
    page,
    limit: PAGE_SIZE,
    unread: filter === 'unread' ? 'true' : undefined,
  });
  const items = data || [];
  const unreadCount = meta ? meta.unreadCount : 0;

  // Marks one notification as read. Used by the button and when its link is followed.
  async function markRead(notification, { quiet = false } = {}) {
    if (notification.read) return;
    setData((list) => (list || []).map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      notifyNotificationsChanged();
      if (!quiet) reload();
    } catch (err) {
      if (!quiet) {
        toast.error(err.message);
        reload();
      }
    }
  }

  const [markAllRead, markingAll] = useAction(async () => {
    try {
      await api.patch('/notifications/read-all');
      notifyNotificationsChanged();
      toast.success('All notifications marked as read.');
      if (page === 1) reload();
      else setPage(1);
    } catch (err) {
      toast.error(err.message);
    }
  });

  function changeFilter(value) {
    setFilter(value);
    setPage(1);
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Notifications</h1>
          <p className="mt-2 text-fg-soft" aria-live="polite">
            {meta ? (unreadCount ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}.` : 'You are all caught up.') : 'Approvals, events, polls and account updates.'}
          </p>
        </div>
        <Button variant="secondary" icon={CheckCheck} onClick={markAllRead} loading={markingAll} disabled={!unreadCount}>
          Mark all as read
        </Button>
      </header>

      <Tabs
        className="mt-6 w-fit max-w-full"
        label="Filter notifications"
        value={filter}
        onChange={changeFilter}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: meta ? unreadCount : undefined },
        ]}
      />

      <div className="mt-6">
        {loading && !data ? (
          <div className="space-y-3" role="status" aria-label="Loading notifications">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-[1.125rem]" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'You have read everything.'
                : 'You will be notified here when your submissions are reviewed, when events and polls are published and about changes to your account.'
            }
            action={
              filter === 'unread' ? (
                <Button variant="secondary" onClick={() => changeFilter('all')}>
                  Show all notifications
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((n) => {
              const style = TYPE_STYLE[n.type] || DEFAULT_STYLE;
              const href = internalLink(n.link);
              return (
                <li
                  key={n.id}
                  className={cn('card flex items-start gap-4 p-4 sm:p-5', !n.read && 'border-brand/30 bg-brand-soft/40')}
                >
                  <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.className)}>
                    <style.icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[0.95rem] text-fg', n.read ? 'font-medium' : 'font-bold')}>
                      {!n.read && <span className="sr-only">Unread: </span>}
                      {href ? (
                        <Link href={href} onClick={() => markRead(n, { quiet: true })} className="hover:text-brand-ink hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </p>
                    {n.message && <p className="mt-1 break-words text-sm leading-relaxed text-fg-soft">{n.message}</p>}
                    <p className="mt-1.5 text-xs text-muted">
                      <time dateTime={new Date(n.createdAt).toISOString()} title={formatDateTime(n.createdAt)} suppressHydrationWarning>
                        {timeAgo(n.createdAt)}
                      </time>
                    </p>
                  </div>
                  {!n.read && (
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => markRead(n)} aria-label={`Mark as read: ${n.title}`}>
                      Mark as read
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-6" />}
    </div>
  );
}
