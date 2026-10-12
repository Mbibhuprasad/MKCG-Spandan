import { cn } from '@/lib/format';

/** Title block at the top of an inner page. */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('border-b border-line bg-bg-soft', className)}>
      <div className="container-page flex flex-col gap-5 py-10 sm:py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 text-base leading-relaxed text-fg-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/** Heading for a section inside a page. */
export function SectionHeading({ eyebrow, title, description, align = 'left', action, className }) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:mb-10',
        align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[2rem] sm:leading-tight">{title}</h2>
        {description && <p className="mt-3 text-base leading-relaxed text-fg-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Simple tab strip. `tabs`: [{ value, label, count? }] */
export function Tabs({ tabs, value, onChange, label = 'Sections', className }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface-2 p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              active ? 'bg-surface text-brand-ink shadow-soft' : 'text-muted hover:text-fg'
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  active ? 'bg-brand-soft text-brand-ink' : 'bg-line text-fg-soft'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
