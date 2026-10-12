'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Pencil, Play, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ErrorState, ModerationNotice, PageLoader } from '@/components/ui/Feedback';
import AuthorLine from '@/components/content/AuthorLine';
import LikeButton from '@/components/content/LikeButton';
import CommentSection from '@/components/content/CommentSection';
import ReportButton from '@/components/content/ReportButton';

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'].includes(target.tagName) || target.isContentEditable);

/** One memory: media stage with previous/next, details and interactions. */
function MemoryViewer({ memory, fresh, onDeleted }) {
  const toast = useToast();
  const media = memory.media || [];
  const [index, setIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = media[Math.min(index, media.length - 1)];
  const many = media.length > 1;
  const approved = !memory.moderation || memory.moderation.status === 'APPROVED';

  // Left / right arrow keys move between the files of this memory.
  useEffect(() => {
    if (media.length < 2) return undefined;
    const onKey = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') setIndex((i) => (i + 1) % media.length);
      if (event.key === 'ArrowLeft') setIndex((i) => (i - 1 + media.length) % media.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media.length]);

  // The API checks membership and visibility, then returns a link that expires
  // within minutes. The link is used once and never stored.
  const [download, downloading] = useAction(async () => {
    try {
      const { data } = await api.get(`/memories/${memory.id}/media/${current.id}/download`);
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error.message);
    }
  });

  async function handleDelete() {
    try {
      await api.delete(`/memories/${memory.id}`);
      toast.success('Memory deleted.');
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      toast.error(error.message);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      <div className="min-w-0">
        <div
          className="relative flex min-h-[14rem] items-center justify-center overflow-hidden rounded-xl bg-black"
          role="group"
          aria-roledescription="carousel"
          aria-label={`Photos and videos of ${memory.title}`}
        >
          {!current ? (
            <p className="p-8 text-sm text-white/80">This memory has no viewable files.</p>
          ) : current.resourceType === 'video' ? (
            // Member-uploaded videos have no caption track available.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={current.id}
              controls
              preload="metadata"
              poster={current.thumbUrl || undefined}
              className="max-h-[62vh] w-full bg-black"
              aria-label={`Video ${index + 1} of ${media.length}: ${memory.title}`}
            >
              <source src={current.url} type="video/mp4" />
              Your browser cannot play this video.
            </video>
          ) : (
            <img
              key={current.id}
              src={current.url}
              alt={many ? `${memory.title} — photo ${index + 1} of ${media.length}` : memory.title}
              className="max-h-[62vh] w-full object-contain"
            />
          )}

          {many && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
                className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Previous file"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % media.length)}
                className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Next file"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span
                className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-0.5 text-xs font-semibold text-white"
                aria-live="polite"
              >
                {index + 1} / {media.length}
              </span>
            </>
          )}
        </div>

        {many && (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="All files in this memory">
            {media.map((item, i) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${item.resourceType === 'video' ? 'video' : 'photo'} ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'relative block h-14 w-14 overflow-hidden rounded-lg border-2 bg-surface-2',
                    i === index ? 'border-brand' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                >
                  {item.thumbUrl && <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  {item.resourceType === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <ModerationNotice moderation={memory.moderation} />
        <AuthorLine author={memory.owner} date={memory.publishedAt || memory.createdAt} />

        {memory.caption && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-soft">{memory.caption}</p>
        )}

        <dl className="space-y-1.5 text-sm text-fg-soft">
          {memory.memoryDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <dt className="sr-only">Date of the memory</dt>
              <dd>{formatDate(memory.memoryDate)}</dd>
            </div>
          )}
          {memory.event && (
            <div className="flex items-start gap-2">
              <dt className="shrink-0 text-muted">From the event</dt>
              <dd className="min-w-0">
                <Link href={`/events/${memory.event.id}`} className="font-semibold text-brand-ink hover:underline">
                  {memory.event.title}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-1 border-y border-line py-2">
          {approved && (
            <LikeButton
              // Remount when fresher data arrives so the button never shows a stale state.
              key={`${fresh}-${memory.likedByMe}-${memory.likeCount}`}
              targetType="memory"
              targetId={memory.id}
              initialLiked={memory.likedByMe}
              initialCount={memory.likeCount}
            />
          )}
          {current && (
            <Button variant="ghost" size="sm" icon={Download} onClick={download} loading={downloading}>
              Download
            </Button>
          )}
          {approved && !memory.isMine && <ReportButton targetType="memory" targetId={memory.id} />}
          {memory.isMine && (
            <>
              <Button variant="ghost" size="sm" icon={Pencil} href={`/dashboard/create/memory?edit=${memory.id}`}>
                Edit
              </Button>
              <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )}
        </div>

        {approved ? (
          <div>
            <h3 className="mb-3 text-sm font-bold text-fg">Comments</h3>
            <CommentSection targetType="memory" targetId={memory.id} />
          </div>
        ) : (
          <p className="text-sm text-muted">Likes and comments open once this memory has been approved.</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this memory?"
        message="The photos and videos, likes and comments of this memory will be permanently removed."
        confirmLabel="Delete memory"
      />
    </div>
  );
}

/**
 * Lightbox for a memory. `preview` (the gallery item) is shown instantly while
 * the full, current record is loaded from the API — which also makes direct
 * links (?memory=ID) and an owner's pending memory work.
 */
export default function MemoryLightbox({ memoryId, preview, onClose, onDeleted }) {
  const detail = useApi(memoryId ? `/memories/${memoryId}` : null, undefined, { enabled: Boolean(memoryId) });
  const loaded = detail.data && detail.data.id === memoryId ? detail.data : null;
  const memory = loaded || (preview && preview.id === memoryId ? preview : null);

  return (
    <Modal open={Boolean(memoryId)} onClose={onClose} title={memory ? memory.title : 'Memory'} size="xl">
      {memory ? (
        <MemoryViewer key={memory.id} memory={memory} fresh={Boolean(loaded)} onDeleted={onDeleted} />
      ) : detail.error ? (
        <ErrorState
          title="This memory is not available"
          message={
            detail.error.status === 404
              ? 'It may have been removed, or it has not been approved yet.'
              : detail.error.message
          }
          onRetry={detail.error.status === 404 ? undefined : detail.reload}
          className="border-0 shadow-none"
        />
      ) : (
        <PageLoader label="Opening memory…" />
      )}
    </Modal>
  );
}
