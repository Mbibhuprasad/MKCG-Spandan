'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, FileText, LayoutDashboard, PenSquare, UserRound } from 'lucide-react';
import { cn } from '@/lib/format';

const items = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/profile', label: 'My profile', icon: UserRound },
  { href: '/dashboard/submissions', label: 'My submissions', icon: FileText },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/create', label: 'Create', icon: PenSquare },
];

/** Secondary navigation shown on every dashboard page. */
export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="border-b border-line bg-bg-soft">
      <ul className="container-page flex gap-1 overflow-x-auto py-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                  active ? 'bg-surface text-brand-ink shadow-soft' : 'text-fg-soft hover:bg-surface hover:text-fg'
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
