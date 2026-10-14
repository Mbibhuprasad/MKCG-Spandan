'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, X, FileText } from 'lucide-react';
import { mainNav } from '@/lib/site';
import { cn } from '@/lib/format';
import { useAuth } from '@/components/providers/AuthProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';

const SCHEDULE_HREF = '/events/schedule';

const isActive = (pathname, href) => {
  if (href === '/') return pathname === '/';
  // The Event Schedule has its own button, so Events is not marked there too.
  if (href === '/events' && pathname.startsWith(SCHEDULE_HREF)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
};

function UserMenu({ user, isAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: SCHEDULE_HREF, label: 'Event Schedule', icon: CalendarClock },
    { href: '/dashboard/profile', label: 'My profile', icon: UserRound },
    { href: '/dashboard/submissions', label: 'My submissions', icon: FileText },
  ];
  if (isAdmin) items.push({ href: '/admin', label: 'Admin panel', icon: ShieldCheck });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-line py-1 pl-1 pr-2.5 hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={user.name} src={user.profile?.photoUrl} size="sm" />
        {/* The name is in the menu itself; the header row has no room for it beside the Event Schedule button. */}
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
          >
            <div className="border-b border-line px-3 pb-2.5 pt-2">
              <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
              <p className="truncate text-xs text-muted">{isAdmin ? 'Administrator' : user.email}</p>
            </div>
            <div className="py-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-fg-soft hover:bg-surface-2 hover:text-fg"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg border-t border-line px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  async function handleLogout() {
    await logout('/'); // full reload onto the public homepage
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-shadow duration-200',
        scrolled || mobileOpen ? 'border-b border-line bg-bg/95 shadow-soft backdrop-blur-md' : 'border-b border-transparent bg-bg'
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-fg"
      >
        Skip to content
      </a>
      <div className="container-page flex h-[4.25rem] items-center justify-between gap-4">
        {/* Signed-in members have more header controls, so on very narrow screens
            the wordmark gives way and the theme switch moves into the menu. */}
        <Logo nameClassName={isAuthenticated ? 'hidden min-[420px]:inline' : undefined} />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {mainNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      active ? 'text-brand-ink' : 'text-fg-soft hover:text-fg'
                    )}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-leaf"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className={isAuthenticated ? 'hidden sm:inline-flex' : undefined} />
          {isLoading ? (
            <span className="skeleton hidden h-10 w-36 rounded-xl sm:block" aria-hidden="true" />
          ) : isAuthenticated ? (
            <>
              {/* Wide screens only: below 1280px the header row is full, so the
                  schedule is in the account menu (and the mobile menu) instead. */}
              <span className="hidden xl:inline-flex">
                <Button
                  href={SCHEDULE_HREF}
                  variant="outline"
                  size="sm"
                  icon={CalendarClock}
                  aria-current={pathname.startsWith(SCHEDULE_HREF) ? 'page' : undefined}
                  aria-label="Event Schedule"
                  className={cn(
                    'h-10 gap-1.5 px-2.5 text-left text-[0.7rem] leading-[1.1]',
                    pathname.startsWith(SCHEDULE_HREF) && 'bg-brand-soft'
                  )}
                >
                  {/* Two short lines keep the header row within its width. */}
                  <span aria-hidden="true">
                    Event
                    <br />
                    Schedule
                  </span>
                </Button>
              </span>
              <NotificationBell />
              <UserMenu user={user} isAdmin={isAdmin} onLogout={handleLogout} />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button href="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button href="/register" size="sm">
                Join Community
              </Button>
            </div>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-fg lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-line lg:hidden"
          >
            <nav aria-label="Mobile" className="container-page max-h-[calc(100dvh-4.25rem)] overflow-y-auto py-4">
              <ul className="space-y-1">
                {mainNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'block rounded-xl px-4 py-3 text-base font-semibold',
                          active ? 'bg-brand-soft text-brand-ink' : 'text-fg-soft hover:bg-surface-2'
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {!isLoading && !isAuthenticated && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <Button href="/login" variant="secondary">
                    Log in
                  </Button>
                  <Button href="/register">Join Community</Button>
                </div>
              )}
              {isAuthenticated && (
                <div className="mt-4 grid gap-2 border-t border-line pt-4">
                  <div className="flex items-center justify-between rounded-xl px-4 py-1.5 sm:hidden">
                    <span className="text-sm font-semibold text-fg-soft">Appearance</span>
                    <ThemeToggle />
                  </div>
                  <Button
                    href={SCHEDULE_HREF}
                    variant="outline"
                    icon={CalendarClock}
                    aria-current={pathname.startsWith(SCHEDULE_HREF) ? 'page' : undefined}
                  >
                    Event Schedule
                  </Button>
                  <Button href="/dashboard" variant="secondary" icon={LayoutDashboard}>
                    Dashboard
                  </Button>
                  {isAdmin && (
                    <Button href="/admin" variant="secondary" icon={ShieldCheck}>
                      Admin panel
                    </Button>
                  )}
                  <Button variant="danger-ghost" icon={LogOut} onClick={handleLogout}>
                    Log out
                  </Button>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
