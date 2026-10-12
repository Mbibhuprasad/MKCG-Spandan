'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { POST_TYPES, labelOf } from '@/lib/constants';
import { cn } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Badge, ModerationBadge, ModerationNotice } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import AuthorLine from '@/components/content/AuthorLine';
import LikeButton from '@/components/content/LikeButton';
import CommentSection from '@/components/content/CommentSection';
import ReportButton from '@/components/content/ReportButton';

const TYPE_TONES = {
  GENERAL: 'neutral',
  ACHIEVEMENT: 'leaf',
  REUNION_UPDATE: 'brand',
  ANNOUNCEMENT: 'warn',
  EXPERIENCE: 'neutral',
  MEMORY: 'brand',
};

const LONG_BODY = 700;

function MediaGrid({ media, onOpen }) {
  if (!media.length) return null;
  const single = media.length === 1;
  return (
    <ul className={cn('mt-4 grid gap-2', single ? 'grid-cols-1' : 'grid-cols-2')}>
      {media.map((item, index) => (
        <li key={item.id} className={cn(media.length === 3 && index === 0 && 'col-span-2')}>
          <button
            type="button"
            onClick={() => onOpen(index)}
            className={cn(
              'block w-full overflow-hidden rounded-xl border border-line bg-surface-2',
              single || (media.length === 3 && index === 0) ? 'aspect-video' : 'aspect-square'
            )}
            aria-label={`View photo ${index + 1} of ${media.length}`}
          >
            <img
              src={single ? item.url : item.thumbUrl || item.url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * A community post (API post object).
 *  - everyone: author, text, photos, likes and comments on approved posts
 *  - the author: moderation status, edit and delete
 *  - other members: report
 * `onDeleted(id)` is called after the author deletes the post.
 */
export default function PostCard({ post, defaultCommentsOpen = false, onDeleted }) {
  const toast = useToast();
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(defaultCommentsOpen);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const approved = !post.moderation || post.moderation.status === 'APPROVED';
  const media = post.media || [];
  const isLong = post.body.length > LONG_BODY;
  const body = isLong && !expanded ? `${post.body.slice(0, LONG_BODY).trimEnd()}…` : post.body;
  const commentsId = `post-comments-${post.id}`;

  async function handleDelete() {
    try {
      await api.delete(`/posts/${post.id}`);
      toast.success('Post deleted.');
      setConfirmDelete(false);
      if (onDeleted) onDeleted(post.id);
    } catch (error) {
      toast.error(error.message);
      setConfirmDelete(false);
    }
  }

  const current = lightbox !== null ? media[lightbox] : null;

  return (
    <article className="card p-5 sm:p-6">
      <AuthorLine
        author={post.author}
        date={post.publishedAt || post.createdAt}
        trailing={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Badge tone={TYPE_TONES[post.type] || 'neutral'}>{labelOf(POST_TYPES, post.type)}</Badge>
            {!approved && <ModerationBadge status={post.moderation.status} />}
          </div>
        }
      />

      {post.isMine && <ModerationNotice moderation={post.moderation} className="mt-4" />}

      <p className="mt-4 whitespace-pre-wrap break-words text-[0.975rem] leading-relaxed text-fg">{body}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-semibold text-brand-ink hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <MediaGrid media={media} onOpen={setLightbox} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-1">
          <LikeButton
            targetType="post"
            targetId={post.id}
            initialLiked={post.likedByMe}
            initialCount={post.likeCount}
            disabled={!approved}
          />
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            disabled={!approved}
            aria-expanded={showComments}
            aria-controls={commentsId}
            aria-label={`${showComments ? 'Hide' : 'Show'} comments. ${commentCount} comments`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-fg-soft hover:bg-surface-2 hover:text-fg disabled:opacity-50"
          >
            <MessageCircle className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
            <span>{commentCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {post.isMine ? (
            <>
              <Button href={`/dashboard/create/post?edit=${post.id}`} variant="ghost" size="sm" icon={Pencil}>
                Edit
              </Button>
              <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          ) : (
            approved && <ReportButton targetType="post" targetId={post.id} />
          )}
        </div>
      </div>

      {!approved && (
        <p className="mt-2 text-xs text-muted">Likes and comments open once the post has been approved.</p>
      )}

      {approved && showComments && (
        <div id={commentsId} className="mt-4 border-t border-line pt-4">
          <CommentSection
            targetType="post"
            targetId={post.id}
            onCountChange={(delta) => setCommentCount((count) => Math.max(0, count + delta))}
          />
        </div>
      )}

      <Modal
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        title={current ? `Photo ${lightbox + 1} of ${media.length}` : 'Photo'}
        description={`Shared by ${post.author.name}`}
        size="xl"
        footer={
          media.length > 1 ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                onClick={() => setLightbox((i) => (i - 1 + media.length) % media.length)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconRight={ChevronRight}
                onClick={() => setLightbox((i) => (i + 1) % media.length)}
              >
                Next
              </Button>
            </>
          ) : null
        }
      >
        {current && (
          <img
            src={current.url}
            alt={`Shared by ${post.author.name} in a community post (${lightbox + 1} of ${media.length})`}
            className="mx-auto max-h-[65vh] w-auto max-w-full rounded-xl object-contain"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this post?"
        message="The post, its photos, likes and comments will be removed permanently."
        confirmLabel="Delete post"
      />
    </article>
  );
}
