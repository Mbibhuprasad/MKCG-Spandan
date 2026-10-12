'use client';

import { useId } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/format';

const CONTROL =
  'w-full rounded-xl border bg-surface text-fg placeholder:text-muted/80 px-3.5 text-[0.95rem] ' +
  'transition-colors duration-150 focus:border-ring focus:outline-2 focus:outline-ring/30 focus:outline-offset-0 ' +
  'disabled:opacity-60 disabled:bg-surface-2';

const controlClass = (error, extra) => cn(CONTROL, error ? 'border-danger' : 'border-line-strong', extra);

/**
 * Label + control + hint + error, wired together for screen readers.
 * `children` is a render function receiving the props to spread on the control.
 */
export function Field({ label, error, hint, required, optional, className, children }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-fg">
          <span>
            {label}
            {required && (
              <span className="text-danger" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </span>
          {optional && <span className="text-xs font-normal text-muted">Optional</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ error, className, ...rest }) {
  return <input className={controlClass(error, cn('h-11', className))} {...rest} />;
}

export function Textarea({ error, className, rows = 4, ...rest }) {
  return <textarea rows={rows} className={controlClass(error, cn('py-2.5 leading-relaxed', className))} {...rest} />;
}

export function Select({ error, className, children, ...rest }) {
  return (
    <select className={controlClass(error, cn('h-11 pr-8', className))} {...rest}>
      {children}
    </select>
  );
}

/** Convenience wrappers: <TextField label="…" value onChange error /> */
export function TextField({ label, error, hint, required, optional, className, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className}>
      {(props) => <Input error={error} {...props} {...inputProps} />}
    </Field>
  );
}

export function TextAreaField({ label, error, hint, required, optional, className, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className}>
      {(props) => <Textarea error={error} {...props} {...inputProps} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, required, optional, className, children, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} optional={optional} className={className}>
      {(props) => (
        <Select error={error} {...props} {...inputProps}>
          {children}
        </Select>
      )}
    </Field>
  );
}

export function Checkbox({ label, description, error, className, ...rest }) {
  const id = useId();
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-[1.15rem] w-[1.15rem] shrink-0 rounded border-line-strong accent-[var(--brand)]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        <label htmlFor={id} className="text-sm leading-snug text-fg-soft">
          <span className="font-medium text-fg">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level message (for errors that do not belong to one field). */
export function FormMessage({ tone = 'error', children }) {
  if (!children) return null;
  const tones = {
    error: 'border-danger/30 bg-danger-soft text-danger',
    success: 'border-leaf/30 bg-leaf-soft text-leaf-strong',
    info: 'border-brand/20 bg-brand-soft text-brand-ink',
    warn: 'border-warn/30 bg-warn-soft text-warn',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm font-medium', tones[tone])}>
      {children}
    </div>
  );
}
