'use client';

import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';

/** Closing call to action. Members are pointed to their dashboard instead. */
export default function JoinCta() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-12 text-center shadow-lift sm:px-12 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(30rem 16rem at 15% 0%, color-mix(in srgb, var(--leaf) 55%, transparent), transparent 70%), radial-gradient(26rem 14rem at 90% 100%, rgb(255 255 255 / 0.16), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-semibold leading-tight text-brand-fg sm:text-4xl">
          {isAuthenticated ? 'Your batch is waiting to hear from you' : 'Your batch is one sign-up away'}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-brand-fg/85">
          {isAuthenticated
            ? 'Share an update, add a memory or propose the next get-together.'
            : 'Create your doctor account in a minute. You are signed in immediately and can complete your profile whenever it suits you.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isAuthenticated ? (
            <>
              <Button href="/dashboard" variant="leaf" size="lg" icon={LayoutDashboard}>
                Open your dashboard
              </Button>
              <Button href="/dashboard/create" variant="secondary" size="lg">
                Share something
              </Button>
            </>
          ) : (
            <>
              <Button href="/register" variant="leaf" size="lg" iconRight={ArrowRight}>
                Join the Community
              </Button>
              <Button href="/login" variant="secondary" size="lg">
                I already have an account
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
