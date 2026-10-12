'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ClipboardList, ExternalLink, Flag, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { CONTENT_LABELS, REPORT_REASONS, labelOf } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState, ModerationBadge, Skeleton } from '@/components/ui/Feedback';
import AuthorLine from '@/components/content/AuthorLine';
import { AdminHeader, FilterPills } from './shared';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'All' },
];

const STATUS_TONE = { OPEN: 'warn', RESOLVED: 'leaf', DISMISSED: 'neutral' };
const STATUS_LABEL = { OPEN: 'Open', RESOLVED: 'Resolved', DISMISSED: 'Dismissed' };

const PAGE_SIZE = 10;

function ReportsPage({ status }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/admin/reports', { status, page, limit: PAGE_SIZE });
  const reports = data || [];
  const [busyId, setBusyId] = useState(null);

  async function setStatus(report, nextStatus) {
    if (busyId) return;
    setBusyId(report.id);
    try {
      await api.patch(`/admin/reports/${report.id}`, { status: nextStatus });
      toast.success(nextStatus === 'RESOLVED' ? 'Report marked as resolved.' : 'Report dismissed.');
      if (status !== 'ALL' && reports.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState title="Reports could not be loaded" message={error.message} onRetry={reload} />;

  if (loading && !data) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading reports">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-[1.125rem]" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title={status === 'OPEN' ? 'No open reports' : 'No reports with this status'}
        description={
          status === 'OPEN'
            ? 'When a member reports a post, blog, comment, memory, event or poll it will appear here.'
            : 'Try a different status filter.'
        }
      />
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {reports.map((report) => {
          const target = report.target || { exists: false };
          const typeLabel = CONTENT_LABELS[report.targetType] || report.targetType;
          return (
            <li key={report.id}>
              <article className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[report.status]}>{STATUS_LABEL[report.status] || report.status}</Badge>
                  <Badge tone="danger" icon={Flag}>
                    {labelOf(REPORT_REASONS, report.reason)}
                  </Badge>
                  <span className="text-xs text-muted">Reported {formatDateTime(report.createdAt)}</span>
                </div>

                <div className="mt-4 rounded-xl bg-surface-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Reported {typeLabel.toLowerCase()}</p>
                  {target.exists ? (
                    <>
                      <p className="mt-1 break-words text-sm font-semibold text-fg">{target.title || 'Untitled'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <ModerationBadge status={target.moderationStatus} />
                        {target.link && (
                          <Link href={target.link} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
                            View item
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        )}
                        {target.queue && (
                          <Link
                            href={`/admin/moderation?queue=${target.queue}&status=${target.moderationStatus}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
                          >
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                            Open in moderation queue
                          </Link>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted">This item has since been deleted.</p>
                  )}
                </div>

                {report.details && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted">Details from the reporter</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-soft">{report.details}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1.5 text-xs font-semibold text-muted">Reported by</p>
                    <AuthorLine author={report.reporter} size="sm" />
                  </div>
                  {report.status === 'OPEN' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="leaf"
                        size="sm"
                        icon={Check}
                        loading={busyId === report.id}
                        onClick={() => setStatus(report, 'RESOLVED')}
                      >
                        Mark resolved
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={X}
                        disabled={busyId === report.id}
                        onClick={() => setStatus(report, 'DISMISSED')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    report.resolvedAt && <p className="text-xs text-muted">Closed {formatDateTime(report.resolvedAt)}</p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <Pagination className="mt-8" page={page} totalPages={meta ? meta.totalPages : 1} onPageChange={setPage} />
    </>
  );
}

/**
 * Member reports. Resolving or dismissing a report only closes the report —
 * to act on the content itself, use the moderation queue link on each card.
 */
export default function ReportsList() {
  const [status, setStatus] = useState('OPEN');
  return (
    <div>
      <AdminHeader
        title="Reports"
        description="Content flagged by members. Review the item, take action in the moderation queue if needed, then close the report."
      />
      <FilterPills className="mb-5" label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      <ReportsPage key={status} status={status} />
    </div>
  );
}
