import { EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/format';
import { Badge } from '@/components/ui/Feedback';
import Reveal from '@/components/ui/Reveal';

// Building blocks of the doctor portfolio. Headings are set in the body face at
// its heaviest weight, which is what gives the page its look; colours come from
// the site's tokens, so both themes work without per-component overrides.

export const OVERLINE = 'text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-brand-ink';
export const HEADING = 'font-sans font-extrabold tracking-tight text-fg';
// A card that lifts slightly under the pointer.
export const LIFT = 'transition-[transform,box-shadow] duration-200 hover:shadow-lift lg:hover:-translate-y-0.5';

export const HiddenBadge = () => (
  <Badge tone="warn" icon={EyeOff}>
    Hidden from other members
  </Badge>
);

/**
 * One section of the portfolio: a small overline, the heading and its content.
 * `hidden` marks a section the owner has switched off for other members (the
 * API omits it for them).
 */
export function Section({ id, overline, title, icon: Icon, align = 'left', hidden = false, action, className, children }) {
  const centered = align === 'center';
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-40 py-9 sm:py-12', className)}>
      <Reveal>
        <div className={cn('flex flex-wrap gap-x-6 gap-y-3', centered ? 'flex-col items-center text-center' : 'items-end justify-between')}>
          <div className="min-w-0">
            {overline && <p className={OVERLINE}>{overline}</p>}
            <h2
              id={`${id}-title`}
              className={cn(HEADING, 'mt-2 flex items-center gap-2.5 text-2xl leading-tight sm:text-[1.75rem]', centered && 'justify-center')}
            >
              {Icon && <Icon className="h-6 w-6 shrink-0 text-brand-ink" aria-hidden="true" />}
              <span className="min-w-0 break-words">{title}</span>
            </h2>
          </div>
          {(hidden || action) && (
            <div className="flex flex-wrap items-center gap-2">
              {hidden && <HiddenBadge />}
              {action}
            </div>
          )}
        </div>
        <div className="mt-6 sm:mt-8">{children}</div>
      </Reveal>
    </section>
  );
}

/** A large bordered panel. */
export function Panel({ as: Tag = 'div', className, children }) {
  return <Tag className={cn('rounded-[1.5rem] border border-line bg-surface p-5 shadow-soft sm:p-6', className)}>{children}</Tag>;
}

export function PanelTitle({ hidden = false, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 className={cn(HEADING, 'text-lg')}>{children}</h3>
      {hidden && <HiddenBadge />}
    </div>
  );
}

/** A compact fact: icon, small caption, bold value. */
export function InfoBox({ as: Tag = 'div', icon: Icon, label, value, sub, className, children }) {
  return (
    <Tag className={cn('flex h-full items-start gap-3 rounded-xl border border-line bg-surface p-4', className)}>
      {Icon && <Icon className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-brand-ink" aria-hidden="true" />}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-fg-soft">{label}</p>
        <p className="mt-1 break-words text-[0.95rem] font-extrabold leading-snug text-fg">{value}</p>
        {sub && <p className="mt-0.5 break-words text-sm text-fg-soft">{sub}</p>}
        {children}
      </div>
    </Tag>
  );
}

export function IconTile({ icon: Icon, tone = 'brand', className }) {
  return (
    <span
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
        tone === 'leaf' ? 'bg-leaf-soft text-leaf-strong' : 'bg-brand-soft text-brand-ink',
        className
      )}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function Tags({ items }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="max-w-full break-words rounded-full border border-brand/15 bg-brand-soft px-3.5 py-1.5 text-[0.82rem] font-semibold text-brand-ink"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Prose({ children }) {
  if (!children) return null;
  return <p className="mt-2 whitespace-pre-line break-words text-[0.92rem] leading-relaxed text-fg-soft">{children}</p>;
}

/** A detail the API returns to its owner only unless they chose to share it. */
export function Private({ children, show }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-soft">
      <span className="break-words">{children}</span>
      {show && <Badge icon={Lock}>Only you can see this</Badge>}
    </p>
  );
}

/**
 * A vertical timeline: a ring marker and a connecting rule on the left, each
 * entry a card with an accent bar. `accent` is "brand" (experience) or "ink"
 * (education).
 */
export function Timeline({ items, accent = 'brand', children }) {
  const ink = accent === 'ink';
  return (
    <ol className="space-y-5">
      {items.map((item, index) => (
        <li key={item.id} className="grid grid-cols-[1.125rem_minmax(0,1fr)] gap-x-3.5 sm:gap-x-4">
          <span className="relative flex justify-center" aria-hidden="true">
            <span className={cn('relative z-10 mt-5 h-3.5 w-3.5 rounded-full border-[3px] bg-bg-soft', ink ? 'border-fg' : 'border-brand')} />
            {index < items.length - 1 && <span className="absolute -bottom-8 left-1/2 top-10 w-px -translate-x-1/2 bg-line-strong" />}
          </span>
          <div
            className={cn(
              'min-w-0 rounded-2xl border border-l-4 border-line bg-surface p-5 shadow-soft',
              ink ? 'border-l-fg' : 'border-l-brand',
              LIFT
            )}
          >
            {children(item)}
          </div>
        </li>
      ))}
    </ol>
  );
}
