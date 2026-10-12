'use client';

import { useId } from 'react';
import { Ban, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/format';
import { Badge } from '@/components/ui/Feedback';
import { TextAreaField } from '@/components/ui/Form';

/** Title block at the top of an admin page. */
export function AdminHeader({ title, description, actions }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-2 text-fg-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

/** Small segmented filter. `options`: [{ value, label }] */
export function FilterPills({ label, options, value, onChange, className }) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted" aria-hidden="true">
        {label}
      </span>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
              active
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-line-strong bg-surface text-fg-soft hover:bg-surface-2 hover:text-fg'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Account status (separate from content moderation status). */
export function AccountStatusBadge({ status }) {
  if (status === 'SUSPENDED') {
    return (
      <Badge tone="danger" icon={Ban}>
        Suspended
      </Badge>
    );
  }
  return (
    <Badge tone="leaf" icon={CircleCheck}>
      Active
    </Badge>
  );
}

/** Accessible on/off switch with a label and explanation. */
export function Switch({ checked, onChange, disabled, label, description }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-semibold text-fg">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-leaf' : 'bg-line-strong'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/** Optional free-text reason attached to a moderation or account action. */
export function ReasonField({ value, onChange, label = 'Reason', hint, placeholder }) {
  return (
    <TextAreaField
      label={label}
      optional
      rows={3}
      maxLength={500}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      hint={hint}
      placeholder={placeholder}
    />
  );
}

/** 'CONTENT_APPROVED' → 'Content approved' */
export function prettyAction(action = '') {
  const text = String(action).replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
