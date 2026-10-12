'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, LayoutDashboard } from 'lucide-react';
import Button from '@/components/ui/Button';

const REDIRECT_MS = 4000;
const EASE = [0.22, 1, 0.36, 1];

/**
 * Shown only after the API has confirmed that the profile was saved and marked
 * complete. Draws a tick, then takes the doctor to their portfolio.
 */
export default function SuccessScreen({ portfolioHref, listed, updated }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const heading = useRef(null);

  useEffect(() => {
    if (heading.current) heading.current.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    const timer = setTimeout(() => router.push(portfolioHref), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [router, portfolioHref]);

  const draw = (delay, duration) =>
    reduce
      ? { initial: false }
      : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay, duration, ease: EASE } };

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="card relative mx-auto max-w-2xl overflow-hidden px-6 py-12 text-center sm:px-10 sm:py-14"
      aria-labelledby="wizard-success-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(28rem 10rem at 50% 0%, color-mix(in srgb, var(--leaf) 16%, transparent), transparent 70%)',
        }}
      />
      <motion.span
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
        className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-leaf-soft"
      >
        <svg viewBox="0 0 52 52" className="h-14 w-14" fill="none" aria-hidden="true">
          <motion.circle cx="26" cy="26" r="23" stroke="var(--leaf)" strokeWidth="3" strokeLinecap="round" {...draw(0.15, 0.5)} />
          <motion.path
            d="M15.5 27l7.5 7.5 13.5-15.5"
            stroke="var(--leaf)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...draw(0.55, 0.35)}
          />
        </svg>
      </motion.span>

      <h1
        id="wizard-success-title"
        ref={heading}
        tabIndex={-1}
        className="relative mt-6 font-display text-3xl font-semibold tracking-tight text-fg outline-none"
      >
        {updated ? 'Your profile has been updated' : 'Your professional profile is complete'}
      </h1>
      <p className="relative mx-auto mt-3 max-w-md text-fg-soft" role="status">
        {listed
          ? 'Everything is saved. Your portfolio is live and you appear in the doctor directory for fellow members.'
          : 'Everything is saved. Your portfolio is ready — it follows the visibility choices you made.'}
      </p>
      <p className="relative mt-2 text-sm text-muted">Taking you to your portfolio…</p>

      <div className="relative mt-8 flex flex-wrap justify-center gap-3">
        <Button href={portfolioHref} icon={Eye}>
          View my portfolio
        </Button>
        <Button href="/dashboard" variant="secondary" icon={LayoutDashboard}>
          Go to dashboard
        </Button>
      </div>
    </motion.section>
  );
}
