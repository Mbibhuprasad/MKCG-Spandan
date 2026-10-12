'use client';

import { useState } from 'react';
import { CircleCheck, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Field, Input } from '@/components/ui/Form';

/**
 * Layout shared by /admin-login and /admin-register: a blue-to-green panel
 * beside (on phones: above) a white form card.
 */
export default function AdminAuthShell({ eyebrow, headline, lead, points = [], title, subtitle, children, footer }) {
  return (
    <div className="relative overflow-hidden bg-bg-soft">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-leaf/15 blur-3xl" />

      <div className="container-page relative py-6 sm:py-10 lg:py-14">
        <div className="card mx-auto grid w-full max-w-lg overflow-hidden shadow-lift lg:max-w-5xl lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative overflow-hidden bg-[linear-gradient(140deg,#14398a_0%,#17609a_48%,#12804b_100%)] px-5 py-6 text-white sm:px-8 sm:py-8 lg:px-10 lg:py-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/[0.07]" />

            <div className="relative">
              <p className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white/90">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                {eyebrow}
              </p>
              <p className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl lg:mt-8 lg:text-[2.1rem]">{headline}</p>
              {lead && <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/85 lg:mt-4 lg:text-[0.95rem]">{lead}</p>}

              {points.length > 0 && (
                <ul className="mt-8 hidden space-y-4 lg:block">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-white/90">
                      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12">
            <h1 className="font-display text-2xl font-semibold text-fg sm:text-[1.75rem]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-fg-soft">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 space-y-2 border-t border-line pt-5 text-center text-sm text-fg-soft">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Password-style input with a show/hide button. */
export function SecretField({ label, error, hint, required, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(props) => (
        <div className="relative">
          <Input {...props} {...inputProps} type={visible ? 'text' : 'password'} error={error} className="pr-11" />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
}
