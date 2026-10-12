'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, CircleAlert } from 'lucide-react';
import { cn, plural } from '@/lib/format';

const STATUS_TEXT = { complete: 'Completed', current: 'In progress', upcoming: 'To do' };

const dotClass = (status) =>
  cn(
    'relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-200',
    status === 'complete' && 'border-leaf bg-leaf text-leaf-fg',
    status === 'current' && 'border-brand bg-brand text-brand-fg',
    status === 'error' && 'border-danger bg-danger-soft text-danger',
    status === 'upcoming' && 'border-line-strong bg-surface text-muted'
  );

function statusLabel(step, status, errorCount) {
  if (status === 'error') return `${plural(errorCount, 'field')} to check`;
  if (status === 'upcoming' && step.optional) return 'Optional';
  return STATUS_TEXT[status];
}

function Dot({ status, number }) {
  return (
    <span className={dotClass(status)} aria-hidden="true">
      {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : status === 'error' ? <CircleAlert className="h-3.5 w-3.5" /> : number}
    </span>
  );
}

// GSAP owns the progress fills (and nothing else in the navigation): it tweens
// their scale whenever the value changes and is killed on cleanup, so React
// development double-rendering never leaves a stray tween behind.
function useProgressFill(ref, axis, value) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const vars =
      axis === 'x' ? { scaleX: value, transformOrigin: 'left center' } : { scaleY: value, transformOrigin: 'center top' };
    if (reduce) {
      gsap.set(el, vars);
      return undefined;
    }
    const tween = gsap.to(el, { ...vars, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    return () => tween.kill();
  }, [ref, axis, value, reduce]);
}

function ProgressBar({ percent, className }) {
  const fill = useRef(null);
  useProgressFill(fill, 'x', percent / 100);
  return (
    <div
      role="progressbar"
      aria-label="Profile steps completed"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <div
        ref={fill}
        className="h-full w-full rounded-full bg-gradient-to-r from-brand to-leaf"
        style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
      />
    </div>
  );
}

/**
 * Step navigation.
 *   steps      — STEPS from the model
 *   statuses   — per step: 'complete' | 'current' | 'error' | 'upcoming'
 *   errorCounts— per step: number of fields with a validation message
 *   onSelect   — (index) => void; the wizard validates before moving forward
 */
export function StepSidebar({ steps, current, statuses, errorCounts, percent, completed, onSelect, disabled }) {
  const line = useRef(null);
  useProgressFill(line, 'y', steps.length > 1 ? current / (steps.length - 1) : 0);
  const remaining = steps.length - completed;

  return (
    <nav aria-label="Profile steps" className="card p-4">
      <div className="px-1">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="text-fg-soft">Overall progress</span>
          <span className="text-leaf-strong">{percent}%</span>
        </div>
        <ProgressBar percent={percent} />
        <p className="mt-2 text-xs text-muted">
          {completed} of {steps.length} steps complete{remaining > 0 ? ` · ${remaining} remaining` : ''}
        </p>
      </div>

      <ol className="relative mt-4">
        {/* Rail behind the step markers; the green part is drawn by GSAP. */}
        <li role="presentation" aria-hidden="true" className="absolute bottom-[26px] left-[21px] top-[26px] w-0.5 bg-line">
          <span
            ref={line}
            className="block h-full w-full bg-leaf"
            style={{ transform: 'scaleY(0)', transformOrigin: 'center top' }}
          />
        </li>
        {steps.map((step, index) => {
          const status = statuses[index];
          const active = index === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex h-[3.25rem] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors',
                  !active && 'hover:bg-surface-2/70'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="wizard-sidebar-active"
                    className="absolute inset-0 rounded-xl bg-brand-soft"
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden="true"
                  />
                )}
                <Dot status={status} number={index + 1} />
                <span className="relative z-10 min-w-0">
                  <span className={cn('block truncate text-sm font-semibold', active ? 'text-brand-ink' : 'text-fg')}>
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.short}
                  </span>
                  <span className={cn('block truncate text-xs', status === 'error' ? 'font-semibold text-danger' : 'text-muted')}>
                    {statusLabel(step, status, errorCounts[index])}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact progress header with a horizontally scrolling step strip (small screens). */
export function StepStrip({ steps, current, statuses, errorCounts, percent, onSelect, disabled }) {
  const scroller = useRef(null);
  const reduce = useReducedMotion();

  // Keep the current step in view without moving the page itself.
  useEffect(() => {
    const list = scroller.current;
    const item = list && list.children[current];
    if (!item) return;
    const left = item.offsetLeft - (list.clientWidth - item.clientWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [current, reduce]);

  const step = steps[current];
  return (
    <nav aria-label="Profile steps" className="card p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            Step {current + 1} of {steps.length}
          </p>
          <p className="mt-0.5 truncate text-base font-bold text-fg">{step.short}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-leaf-strong">{percent}% complete</p>
      </div>
      <ProgressBar percent={percent} className="mt-3" />

      <ol ref={scroller} className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((item, index) => {
          const status = statuses[index];
          const active = index === current;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${item.short} — ${statusLabel(item, status, errorCounts[index])}`}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full border px-2 text-sm font-semibold transition-colors',
                  active ? 'border-brand/30 bg-brand-soft pr-4 text-brand-ink' : 'border-transparent text-fg-soft'
                )}
              >
                <Dot status={status} number={index + 1} />
                {active && <span className="whitespace-nowrap">{item.short}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
