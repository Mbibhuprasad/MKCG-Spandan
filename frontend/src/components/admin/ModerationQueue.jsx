'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { MODERATION_QUEUES } from '@/lib/constants';
import { useToast } from '@/components/providers/ToastProvider';
import Pagination from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import ModerationItem from './ModerationItem';
import { AdminHeader, FilterPills, ReasonField } from './shared';

const QUEUE_KEYS = MODERATION_QUEUES.map((q) => q.key);

// Everything is published when it is created. "Hidden" lists the few items the
// former approval workflow left unpublished (they are visible only to their
// authors and to administrators).
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'HIDDEN', label: 'Hidden (old approval system)' },
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

function ContentList({ queue, status, onChanged }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  // The API filters by one stored status; old hidden items are almost always PENDING.
  const { data, meta, loading, error, reload } = useApi(`/admin/moderation/${queue}`, {
    status: status === 'HIDDEN' ? 'PENDING' : 'ALL',
    page,
    limit: PAGE_SIZE,
  });
  const items = data || [];
  const noun = NOUN[queue];

  const [target, setTarget] = useState(null); // the item about to be deleted
  const [reason, setReason] = useState('');

  async function remove() {
    try {
      await api.delete(`/admin/moderation/${queue}/${target.id}`, { reason });
      toast.success(`The ${noun} was permanently deleted.`);
      setTarget(null);
      // Step back a page if that was the last item on this one.
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (error) return <ErrorState title="This list could not be loaded" message={error.message} onRetry={reload} />;

  if (loading && !data) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading content">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-[1.125rem]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={status === 'HIDDEN' ? `No hidden ${noun}s` : `No ${noun}s yet`}
        description={
          status === 'HIDDEN'
            ? 'Nothing is left over from the old approval system here.'
            : `${noun.charAt(0).toUpperCase()}${noun.slice(1)}s appear here as soon as doctors publish them.`
        }
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {meta ? meta.total : items.length} {meta && meta.total === 1 ? noun : `${noun}s`} — newest first
      </p>
      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.id}>
            <ModerationItem
              queue={queue}
              item={item}
              onDelete={(chosen) => {
                setReason('');
                setTarget(chosen);
              }}
            />
          </li>
        ))}
      </ul>
      <Pagination className="mt-8" page={page} totalPages={meta ? meta.totalPages : 1} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={remove}
        title={`Delete this ${noun} permanently?`}
        confirmLabel="Delete permanently"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg-soft">
            The {noun} is removed for everyone together with its comments, likes, attached media and related records.
            This cannot be undone.
          </p>
          <ReasonField value={reason} onChange={setReason} hint="Shared with the author and recorded in the audit log." />
        </div>
      </ConfirmDialog>
    </>
  );
}

/**
 * Content management for administrators: see what doctors have published and
 * delete anything that should not be there. Nothing needs approving — content
 * is public to the community as soon as its author saves it.
 *
 * The content type lives in the URL (?queue=posts) so lists can be linked from
 * the dashboard and from reports. Deleting calls an /admin route, which checks
 * the ADMIN role on the server regardless of what this page shows.
 */
export default function ModerationQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const queue = QUEUE_KEYS.includes(params.get('queue')) ? params.get('queue') : 'posts';
  const status = STATUS_VALUES.includes(params.get('status')) ? params.get('status') : 'ALL';

  const stats = useApi('/admin/stats');
  const hidden = stats.data ? stats.data.hiddenLegacyItems : 0;

  function go(nextQueue, nextStatus) {
    const query = new URLSearchParams({ queue: nextQueue });
    if (nextStatus !== 'ALL') query.set('status', nextStatus);
    router.replace(`/admin/moderation?${query.toString()}`, { scroll: false });
  }

  const tabs = MODERATION_QUEUES.map((q) => ({
    value: q.key,
    label: q.label,
    count: stats.data ? stats.data.content[q.key] : undefined,
  }));

  return (
    <div>
      <AdminHeader
        title="Community content"
        description="Everything doctors share is published straight away. Use this page to look through it and to delete anything that breaks the community guidelines."
      />

      <Tabs tabs={tabs} value={queue} onChange={(value) => go(value, status)} label="Content types" />

      {/* Only offered while something from the old approval system is still hidden. */}
      {hidden > 0 || status === 'HIDDEN' ? (
        <FilterPills className="my-5" label="Show" options={STATUS_OPTIONS} value={status} onChange={(value) => go(queue, value)} />
      ) : (
        <div className="my-5" />
      )}

      {/* Remounting per type/filter resets pagination and any open dialog. */}
      <ContentList key={`${queue}:${status}`} queue={queue} status={status} onChanged={stats.reload} />
    </div>
  );
}
