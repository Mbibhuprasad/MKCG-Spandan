'use client';

import { useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Textarea, FormMessage } from '@/components/ui/Form';
import { ModerationBadge, Spinner } from '@/components/ui/Feedback';
import AuthorLine from './AuthorLine';
import ReportButton from './ReportButton';

const PAGE_SIZE = 10;

/**
 * Comment thread for any commentable item (targetType: 'post' | 'blog' | 'memory' | 'event').
 *
 * Members see approved comments plus their own comments that are still awaiting
 * review. A doctor's new comment is submitted for approval; nobody else sees it
 * until an administrator approves it.
 */
export default function CommentSection({ targetType, targetId, canComment = true, onCountChange }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const { data, meta, loading, error: loadError, reload } = useApi(
    '/comments',
    { targetType, targetId, page, limit: PAGE_SIZE },
    { enabled: Boolean(user) }
  );
  const comments = data || [];

  async function submit(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data: created } = await api.post('/comments', { targetType, targetId, body: text });
      setBody('');
      if (created.moderation && created.moderation.status === 'APPROVED') {
        toast.success('Comment posted.');
        if (onCountChange) onCountChange(1);
      } else {
        toast.info('Comment submitted. It will appear once an admin approves it.');
      }
      if (page === 1) reload();
      else setPage(1);
    } catch (err) {
      setError(formErrors(err).fieldErrors.body || formErrors(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const comment = toDelete;
    try {
      await api.delete(`/comments/${comment.id}`);
      toast.success('Comment deleted.');
      if (onCountChange && (!comment.moderation || comment.moderation.status === 'APPROVED')) onCountChange(-1);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToDelete(null);
    }
  }

  return (
    <section aria-label="Comments" className="space-y-4">
      {canComment && (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor={`comment-${targetId}`} className="sr-only">
            Write a comment
          </label>
          <Textarea
            id={`comment-${targetId}`}
            rows={2}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            error={Boolean(error)}
          />
          <FormMessage>{error}</FormMessage>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {isAdmin ? 'Admin comments are published immediately.' : 'Comments appear after admin approval.'}
            </p>
            <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      )}

      {loading && !comments.length ? (
        <div className="flex justify-center py-4">
          <Spinner label="Loading comments" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-danger" role="alert">
          Comments could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={reload}>
            Retry
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          No comments yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const pending = comment.moderation && comment.moderation.status !== 'APPROVED';
            return (
              <li key={comment.id} className="rounded-xl bg-surface-2/70 p-3.5">
                <AuthorLine
                  author={comment.author}
                  date={comment.createdAt}
                  size="sm"
                  trailing={
                    <div className="flex shrink-0 items-center gap-1">
                      {pending && <ModerationBadge status={comment.moderation.status} />}
                      {comment.isMine ? (
                        <button
                          type="button"
                          onClick={() => setToDelete(comment)}
                          className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                          aria-label="Delete your comment"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <ReportButton targetType="comment" targetId={comment.id} compact />
                      )}
                    </div>
                  }
                />
                <p className="mt-2 whitespace-pre-wrap break-words pl-12 text-sm leading-relaxed text-fg-soft">{comment.body}</p>
                {comment.moderation && comment.moderation.status === 'REJECTED' && comment.moderation.rejectionReason && (
                  <p className="mt-1.5 pl-12 text-xs text-danger">Reason: {comment.moderation.rejectionReason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span className="text-xs text-muted">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this comment?"
        message="This cannot be undone."
        confirmLabel="Delete"
      />
    </section>
  );
}
