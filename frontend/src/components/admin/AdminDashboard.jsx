'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Flag,
  Images,
  MessageCircle,
  MessageSquareText,
  Plane,
  UserCheck,
  UserX,
  Vote,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { MODERATION_QUEUES } from '@/lib/constants';
import { cn } from '@/lib/format';
import Button from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { AdminHeader } from './shared';

const QUEUE_ICONS = {
  posts: MessageSquareText,
  blogs: BookOpen,
  comments: MessageCircle,
  memories: Images,
  events: CalendarDays,
  'visit-plans': Plane,
  polls: Vote,
};

function StatTile({ href, icon: Icon, label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-brand-soft text-brand-ink',
    leaf: 'bg-leaf-soft text-leaf-strong',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <Link href={href} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-extrabold tabular-nums text-fg">{value}</p>
      <p className="mt-1 text-sm font-semibold text-fg-soft">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Link>
  );
}

function TileSkeletons({ count }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-[1.125rem]" />
      ))}
    </div>
  );
}

/** Admin overview. Every figure comes from GET /admin/stats — nothing is estimated. */
export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi('/admin/stats');

  const totalPending = data ? Object.values(data.pending).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <div>
      <AdminHeader
        title="Admin dashboard"
        description="Community health at a glance: member accounts and everything waiting for your review."
        actions={
          <Button href="/admin/moderation" icon={MessageSquareText}>
            Review submissions
          </Button>
        }
      />

      {error ? (
        <ErrorState title="Statistics could not be loaded" message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-10">
          <TileSkeletons count={3} />
          <TileSkeletons count={7} />
        </div>
      ) : data ? (
        <div className="space-y-10">
          <section aria-labelledby="stats-members">
            <h2 id="stats-members" className="mb-4 text-lg font-bold text-fg">
              Members
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                href="/admin/doctors?status=ACTIVE"
                icon={UserCheck}
                label="Active doctors"
                value={data.doctors.active}
                tone="leaf"
              />
              <StatTile
                href="/admin/doctors?status=SUSPENDED"
                icon={UserX}
                label="Suspended doctors"
                value={data.doctors.suspended}
                tone={data.doctors.suspended > 0 ? 'danger' : 'neutral'}
              />
              <StatTile
                href="/admin/reports"
                icon={Flag}
                label="Open reports"
                value={data.openReports}
                hint="Content flagged by members"
                tone={data.openReports > 0 ? 'warn' : 'neutral'}
              />
            </div>
          </section>

          <section aria-labelledby="stats-pending">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="stats-pending" className="text-lg font-bold text-fg">
                Awaiting review
              </h2>
              <p className="text-sm text-muted">
                {totalPending === 0
                  ? 'Nothing is waiting — the queues are clear.'
                  : `${totalPending} ${totalPending === 1 ? 'submission is' : 'submissions are'} waiting in total.`}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODERATION_QUEUES.map((queue) => {
                const count = data.pending[queue.key] ?? 0;
                return (
                  <StatTile
                    key={queue.key}
                    href={`/admin/moderation?queue=${queue.key}`}
                    icon={QUEUE_ICONS[queue.key] || MessageSquareText}
                    label={`Pending ${queue.label.toLowerCase()}`}
                    value={count}
                    tone={count > 0 ? 'warn' : 'neutral'}
                  />
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
