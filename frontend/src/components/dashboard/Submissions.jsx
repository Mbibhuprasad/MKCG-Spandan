'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Layout';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { FormMessage, TextAreaField } from '@/components/ui/Form';
import { EmptyState, ErrorState, ModerationBadge, Skeleton } from '@/components/ui/Feedback';
import { SUBMISSION_TYPES, submissionTypeByTab } from './submissionTypes';

const PAGE_SIZE = 10;

const linkClass =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-fg-soft hover:bg-surface-2 hover:text-fg';

function CommentEditor({ comment, onClose, onSaved }) {
  const toast = useToast();
  const [body, setBody] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch(`/comments/${comment.id}`, { body: text });
      toast[data.moderation && data.moderation.status === 'APPROVED' ? 'success' : 'info'](
        data.moderation && data.moderation.status === 'APPROVED'
          ? 'Comment updated.'
          : 'Comment updated. It will be reviewed again before others can see it.'
      );
      onSaved();
    } catch (err) {
      const parsed = formErrors(err);
      setError(parsed.fieldErrors.body || parsed.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormMessage>{error}</FormMessage>
      <TextAreaField label="Your comment" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} required />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!body.trim()}>
          Save comment
        </Button>
      </div>
    </form>
  );
}

function SubmissionList({ type, onChanged }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const { data, meta, loading, error, reload } = useApi(type.minePath, { page, limit: PAGE_SIZE });
  const items = data || [];

  async function confirmDelete() {
    const item = toDelete;
    try {
      await api.delete(type.itemPath(item.id));
      toast.success(`${type.label} deleted.`);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToDelete(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading your submissions">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[1.125rem]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={type.icon}
        title={`No ${type.plural.toLowerCase()} yet`}
        description={type.emptyText}
        action={
          <Button href={type.createHref} icon={Plus}>
            {type.createLabel}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((item) => {
          const moderation = item.moderation || { status: 'APPROVED' };
          const approved = moderation.status === 'APPROVED';
          const title = type.title(item) || type.label;
          const viewHref = approved ? type.viewHref(item) : null;
          const editHref = type.editHref(item);
          return (
            <li key={item.id} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    <type.icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 break-words text-[0.95rem] font-semibold text-fg">{title}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {[type.meta(item), `Submitted ${formatDate(moderation.submittedAt || item.createdAt)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <ModerationBadge status={moderation.status} className="w-fit shrink-0" />
              </div>

              {moderation.status === 'PENDING' && (
                <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                  Only you can see this until an administrator approves it.
                </p>
              )}
              {moderation.status === 'REJECTED' && (
                <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  {moderation.rejectionReason ? `Reason: ${moderation.rejectionReason}` : 'This was not approved.'}{' '}
                  {type.key === 'comment' || editHref ? 'You can edit it and it will be reviewed again.' : ''}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                {viewHref && (
                  <Link href={viewHref} className={linkClass} aria-label={`View: ${title}`}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View
                  </Link>
                )}
                {editHref && (
                  <Link href={editHref} className={linkClass} aria-label={`Edit: ${title}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Link>
                )}
                {type.key === 'comment' && (
                  <button type="button" className={linkClass} onClick={() => setEditing(item)} aria-label={`Edit: ${title}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-danger hover:bg-danger-soft"
                  onClick={() => setToDelete(item)}
                  aria-label={`Delete: ${title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-6" />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete this ${type.label.toLowerCase()}?`}
        message={
          type.key === 'comment'
            ? 'This cannot be undone.'
            : 'It will be removed permanently, together with its likes, comments and other responses. This cannot be undone.'
        }
        confirmLabel="Delete"
      />

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit comment" size="sm">
        {editing && (
          <CommentEditor
            key={editing.id}
            comment={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
              onChanged();
            }}
          />
        )}
      </Modal>
    </>
  );
}

/** "My submissions": everything the doctor has submitted, with its review status. */
export default function Submissions() {
  const router = useRouter();
  const params = useSearchParams();
  const type = submissionTypeByTab(params.get('tab')) || SUBMISSION_TYPES[0];
  const summary = useApi('/dashboard/summary');
  const counts = summary.data ? summary.data.submissions : null;

  const tabs = SUBMISSION_TYPES.map((t) => ({
    value: t.tab,
    label: t.plural,
    count: counts && counts[t.key] ? counts[t.key].total : undefined,
  }));

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">My submissions</h1>
          <p className="mt-2 max-w-2xl text-fg-soft">
            Everything you have shared and where it stands. Submissions are reviewed by an administrator before the
            community can see them; editing an item sends it for review again.
          </p>
        </div>
        <Button href="/dashboard/create" icon={Plus}>
          Create
        </Button>
      </header>

      <Tabs
        className="mt-6"
        label="Submission types"
        tabs={tabs}
        value={type.tab}
        onChange={(tab) => router.replace(`/dashboard/submissions?tab=${tab}`, { scroll: false })}
      />

      <div className="mt-6" role="tabpanel" aria-label={type.plural}>
        <SubmissionList key={type.key} type={type} onChanged={summary.reload} />
      </div>
    </div>
  );
}
