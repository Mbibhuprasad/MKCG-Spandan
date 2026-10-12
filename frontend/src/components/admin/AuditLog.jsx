'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { formatDateTime } from '@/lib/format';
import Pagination from '@/components/ui/Pagination';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { AdminHeader, prettyAction } from './shared';

const PAGE_SIZE = 20;

const actionTone = (action) => {
  if (/DELETED|SUSPENDED|REJECTED/.test(action)) return 'danger';
  if (/APPROVED|REACTIVATED|RESOLVED/.test(action)) return 'leaf';
  return 'neutral';
};

/** Read-only record of sensitive administrative actions (GET /admin/audit-logs). */
export default function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi('/admin/audit-logs', { page, limit: PAGE_SIZE });
  const logs = data || [];

  return (
    <div>
      <AdminHeader
        title="Audit log"
        description="A permanent record of sensitive admin actions: content decisions, account sanctions and deletions. Entries cannot be edited."
      />

      {error ? (
        <ErrorState title="The audit log could not be loaded" message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-2" role="status" aria-label="Loading audit log">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No admin actions recorded yet"
          description="Approvals, rejections, deletions and account changes will be listed here as they happen."
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Administrative actions, newest first</caption>
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Admin</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-fg-soft">
                      <time dateTime={new Date(log.createdAt).toISOString()}>{formatDateTime(log.createdAt)}</time>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-fg">{log.actorName || 'system'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={actionTone(log.action)} className="whitespace-nowrap">
                        {prettyAction(log.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-soft">
                      <span className="break-words">{log.summary || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination className="mt-8" page={page} totalPages={meta ? meta.totalPages : 1} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
