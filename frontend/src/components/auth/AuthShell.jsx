import { HeartPulse, ShieldCheck, Users } from 'lucide-react';

const points = [
  { icon: Users, text: 'Reconnect with batchmates and discover where their journeys led.' },
  { icon: HeartPulse, text: 'Share achievements, memories and reunion plans in one place.' },
  { icon: ShieldCheck, text: 'A private, moderated space — member content stays inside the community.' },
];

/** Two-column layout shared by the login and registration pages. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16">
      <aside className="hidden lg:block lg:pt-6">
        <p className="eyebrow">MKCGSPANDAN</p>
        <p className="mt-3 font-display text-4xl font-semibold leading-[1.15] text-fg">
          Together in Medicine. <span className="text-gradient-brand">Connected Beyond Medicine.</span>
        </p>
        <ul className="mt-9 space-y-5">
          {points.map((point) => (
            <li key={point.text} className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <point.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="pt-2 text-[0.95rem] leading-relaxed text-fg-soft">{point.text}</p>
            </li>
          ))}
        </ul>
      </aside>

      <section className="card mx-auto w-full max-w-lg p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-fg-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-line pt-5 text-center text-sm text-fg-soft">{footer}</div>}
      </section>
    </div>
  );
}

// Only same-site paths are accepted for post-login redirects (no open redirect).
export function safeNextPath(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
