'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Feedback';

// These guards only decide what to *show*. The API independently refuses every
// request the caller is not allowed to make.

/** For private areas (dashboard): signed-out visitors are sent to the login page. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated') return <PageLoader label="Checking your session…" />;
  return children;
}

/** For the admin panel: only users whose role is ADMIN see the content. */
export function RequireAdmin({ children }) {
  const { status, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated') return <PageLoader label="Checking your session…" />;
  if (!isAdmin) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-12 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold text-fg">Administrators only</h1>
          <p className="mt-2 text-sm text-muted">Your account does not have access to this area.</p>
          <Button href="/dashboard" variant="secondary" className="mt-6">
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }
  return children;
}

/**
 * For member-only pages that appear in the public navigation (Doctors,
 * Memories, Community, Events). Signed-out visitors see an explanation and a
 * way in instead of a redirect — and no member data is ever requested for them.
 */
export function MemberGate({ title = 'This area is for members', description, children }) {
  const { status } = useAuth();
  const pathname = usePathname();

  if (status === 'loading') return <PageLoader />;
  if (status === 'anonymous') {
    return (
      <div className="container-page py-16 sm:py-20">
        <div className="card mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center sm:px-10">
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="font-display text-2xl font-semibold text-fg">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-fg-soft">
            {description ||
              'MKCGSPANDAN is a private community. Sign in or join to see what members share with one another.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href="/register" size="lg">
              Join the Community
            </Button>
            <Button href={`/login?next=${encodeURIComponent(pathname)}`} variant="secondary" size="lg">
              Log in
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}
