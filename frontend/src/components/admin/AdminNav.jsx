'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Flag, History, LayoutDashboard, ShieldCheck, UsersRound } from 'lucide-react';
import { cn } from '@/lib/format';

const items = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/doctors', label: 'Doctors', icon: UsersRound },
  { href: '/admin/moderation', label: 'Content', icon: ClipboardList },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/audit-log', label: 'Audit log', icon: History },
];

/** Secondary navigation shown on every admin page. */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="border-b border-line bg-bg-soft">
      <div className="container-page flex items-center gap-3 py-2">
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-leaf-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-leaf-strong sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Admin
        </span>
        <ul className="flex gap-1 overflow-x-auto">
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
      </div>
    </nav>
  );
}
