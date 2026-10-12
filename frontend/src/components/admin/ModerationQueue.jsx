'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CircleCheck, Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { MODERATION_QUEUES } from '@/lib/constants';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import ModerationItem from './ModerationItem';
import { AdminHeader, FilterPills, ReasonField } from './shared';

const QUEUE_KEYS = MODERATION_QUEUES.map((q) => q.key);

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];
const STATUS_VALUES = STATUS_OPTIONS.map((s) => s.value);

const NOUN = {
  posts: 'post',
  blogs: 'blog',
  comments: 'comment',
  memories: 'memory',
  events: 'event',
  'visit-plans': 'visit plan',
  polls: 'poll',
};

const PAGE_SIZE = 10;

function QueueList({ queue, status, onChanged }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi(`/admin/moderation/${queue}`, { status, page, limit: PAGE_SIZE });
  const items = data || [];
  const noun = NOUN[queue];

  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(null); // { type: 'reject' | 'delete', item }
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // After an action the item usually leaves the current view; step back a page
  // if it was the last one on this page.
  function refresh(leavesList) {
    if (leavesList && items.length === 1 && page > 1) setPage((p) => p - 1);
    else reload();
    onChanged();
  }

  function openDialog(type, item) {
    setReason('');
    setDialog({ type, item });
  }

  async function approve(item) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await api.patch(`/admin/moderation/${queue}/${item.id}`, { action: 'approve' });
      toast.success(`The ${noun} was approved and is now published.`);
      refresh(status !== 'ALL');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (rejecting) return;
    const item = dialog.item;
    setRejecting(true);
    try {
      await api.patch(`/admin/moderation/${queue}/${item.id}`, { action: 'reject', reason });
      toast.success(`The ${noun} was rejected. The author has been notified.`);
      setDialog(null);
      refresh(status !== 'ALL');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRejecting(false);
    }
  }

  async function remove() {
    const item = dialog.item;
    try {
      await api.delete(`/admin/moderation/${queue}/${item.id}`, { reason });
      toast.success(`The ${noun} was permanently deleted.`);
      setDialog(null);
      refresh(true);
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (error) return <ErrorState title="This queue could not be loaded" message={error.message} onRetry={reload} />;

  if (loading && !data) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading submissions">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-[1.125rem]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    const pending = status === 'PENDING';
    return (
      <EmptyState
        icon={pending ? CircleCheck : Inbox}
        title={pending ? `No ${noun}s are waiting for review` : `No ${noun}s with this status`}
        description={
          pending
            ? `New ${noun}s submitted by doctors will appear here until you approve or reject them.`
            : 'Try a different status filter.'
        }
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {meta ? meta.total : items.length} {meta && meta.total === 1 ? noun : `${noun}s`}
        {status === 'PENDING' ? ' — oldest first' : ''}
      </p>
      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.id}>
            <ModerationItem
              queue={queue}
              item={item}
              busy={busyId === item.id}
              onApprove={approve}
              onReject={(target) => openDialog('reject', target)}
              onDelete={(target) => openDialog('delete', target)}
            />
          </li>
        ))}
      </ul>
      <Pagination className="mt-8" page={page} totalPages={meta ? meta.totalPages : 1} onPageChange={setPage} />

      <Modal
        open={Boolean(dialog && dialog.type === 'reject')}
        onClose={() => !rejecting && setDialog(null)}
        title={`Reject this ${noun}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="danger" loading={rejecting} onClick={reject}>
              Reject
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg-soft">
            It stays hidden from the community (or is unpublished if it was already approved). The author can still see
            it, edit it and submit it again.
          </p>
          <ReasonField
            value={reason}
            onChange={setReason}
            hint="Shared with the author so they know what to change."
            placeholder="e.g. Please remove the patient details"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(dialog && dialog.type === 'delete')}
        onClose={() => setDialog(null)}
        onConfirm={remove}
        title={`Delete this ${noun} permanently?`}
        confirmLabel="Delete permanently"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg-soft">
            The {noun} is removed for everyone together with its comments, likes, attached media and related records.
            This cannot be undone. To simply hide it, reject it instead.
          </p>
          <ReasonField value={reason} onChange={setReason} hint="Shared with the author and recorded in the audit log." />
        </div>
      </ConfirmDialog>
    </>
  );
}

/**
 * Content review for administrators. The queue and status live in the URL
 * (?queue=posts&status=PENDING) so views can be linked from the dashboard and
 * from reports. Approve / reject / delete all call /admin routes, which verify
 * the ADMIN role on the server regardless of what this page shows.
 */
export default function ModerationQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const queue = QUEUE_KEYS.includes(params.get('queue')) ? params.get('queue') : 'posts';
  const status = STATUS_VALUES.includes(params.get('status')) ? params.get('status') : 'PENDING';

  const stats = useApi('/admin/stats');

  function go(nextQueue, nextStatus) {
    const query = new URLSearchParams({ queue: nextQueue });
    if (nextStatus !== 'PENDING') query.set('status', nextStatus);
    router.replace(`/admin/moderation?${query.toString()}`, { scroll: false });
  }

  const tabs = MODERATION_QUEUES.map((q) => ({
    value: q.key,
    label: q.label,
    count: stats.data ? stats.data.pending[q.key] : undefined,
  }));

  return (
    <div>
      <AdminHeader
        title="Content moderation"
        description="Everything doctors submit waits here until you approve it. Numbers on the tabs show how many items are pending in each queue."
      />

      <Tabs tabs={tabs} value={queue} onChange={(value) => go(value, status)} label="Moderation queues" />

      <FilterPills
        className="my-5"
        label="Status"
        options={STATUS_OPTIONS}
        value={status}
        onChange={(value) => go(queue, value)}
      />

      {/* Remounting per queue/status resets pagination and any open dialog. */}
      <QueueList key={`${queue}:${status}`} queue={queue} status={status} onChanged={stats.reload} />
    </div>
  );
}
