import { LoaderCircle, Inbox, TriangleAlert, Clock, CircleCheck, CircleX } from 'lucide-react';
import { cn } from '@/lib/format';
import { MODERATION_LABELS } from '@/lib/constants';
import Button from './Button';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={cn('h-5 w-5 animate-spin text-brand-ink', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-7 w-7" label={label} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** Grid of placeholder cards while a list loads. */
export function CardSkeletons({ count = 6, className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3', height = 'h-56' }) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-[1.125rem]', height)} />
      ))}
    </div>
  );
}

/** Shown whenever there is genuinely nothing to display — never fake content. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-10 text-center', className)} role="alert">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-fg-soft border-line',
  brand: 'bg-brand-soft text-brand-ink border-brand/15',
  leaf: 'bg-leaf-soft text-leaf-strong border-leaf/20',
  warn: 'bg-warn-soft text-warn border-warn/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
};

export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        BADGE_TONES[tone],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

const MODERATION_STYLE = {
  PENDING: { tone: 'warn', icon: Clock },
  APPROVED: { tone: 'leaf', icon: CircleCheck },
  REJECTED: { tone: 'danger', icon: CircleX },
};

/** Moderation status of a submission (shown to its author and to admins). */
export function ModerationBadge({ status, className }) {
  const style = MODERATION_STYLE[status];
  if (!style) return null;
  return (
    <Badge tone={style.tone} icon={style.icon} className={className}>
      {MODERATION_LABELS[status]}
    </Badge>
  );
}

/** Explains the review step to an author right after they submit something. */
export function ModerationNotice({ moderation, className }) {
  if (!moderation || moderation.status === 'APPROVED') return null;
  const pending = moderation.status === 'PENDING';
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-2.5 text-sm',
        pending ? 'border-warn/25 bg-warn-soft text-warn' : 'border-danger/25 bg-danger-soft text-danger',
        className
      )}
    >
      <p className="font-semibold">{pending ? 'Awaiting admin review' : 'Not approved'}</p>
      <p className="mt-0.5 text-[0.8rem] opacity-90">
        {pending
          ? 'Only you can see this until an administrator approves it.'
          : moderation.rejectionReason
            ? `Reason: ${moderation.rejectionReason}`
            : 'You can edit it and submit it again.'}
      </p>
    </div>
  );
}
