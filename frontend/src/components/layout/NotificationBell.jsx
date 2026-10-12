'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

/** Bell with the unread count. Refreshes on navigation and every two minutes. */
export default function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .get('/notifications/unread-count')
        .then(({ data }) => !cancelled && setCount(data.unreadCount))
        .catch(() => {});
    load();
    const timer = setInterval(load, 120000);
    const onChange = () => load();
    window.addEventListener('mkcg:notifications-changed', onChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('mkcg:notifications-changed', onChange);
    };
  }, [pathname]);

  return (
    <Link
      href="/dashboard/notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-fg-soft hover:bg-surface-2 hover:text-fg"
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-danger-fg">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

/** Call after marking notifications as read so the bell updates immediately. */
export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('mkcg:notifications-changed'));
}
