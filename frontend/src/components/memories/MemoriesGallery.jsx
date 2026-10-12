'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Images, Play, Plus } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { formatDate, plural } from '@/lib/format';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Form';
import { CardSkeletons, EmptyState, ErrorState } from '@/components/ui/Feedback';
import MemoryLightbox from './MemoryLightbox';

const PAGE_SIZE = 12;
const ID_RE = /^[a-f\d]{24}$/i;
const validId = (value) => (value && ID_RE.test(value) ? value : '');

function MemoryTile({ memory, onOpen }) {
  const cover = memory.media && memory.media[0];
  const count = memory.media ? memory.media.length : 0;
  const hasVideo = (memory.media || []).some((m) => m.resourceType === 'video');
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(memory.id)}
        className="card group block w-full overflow-hidden text-left transition-shadow duration-200 hover:shadow-lift"
        aria-label={`Open memory: ${memory.title} (${plural(count, 'file')})`}
      >
        <span className="relative block aspect-square overflow-hidden bg-surface-2">
          {cover && (cover.thumbUrl || cover.url) ? (
            <img
              src={cover.thumbUrl || cover.url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              <Images className="h-8 w-8" aria-hidden="true" />
            </span>
          )}
          {cover && cover.resourceType === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
                <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              </span>
            </span>
          )}
          {count > 1 && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
              {hasVideo && cover.resourceType !== 'video' ? (
                <Play className="h-3 w-3 fill-current" aria-hidden="true" />
              ) : (
                <Images className="h-3 w-3" aria-hidden="true" />
              )}
              {count}
            </span>
          )}
        </span>
        <span className="block p-3">
          <span className="block truncate text-sm font-bold text-fg">{memory.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {memory.owner?.name}
            {' · '}
            {formatDate(memory.memoryDate || memory.publishedAt || memory.createdAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Members-only gallery. Rendered inside <MemberGate>, so it only mounts for signed-in members. */
export default function MemoriesGallery() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const eventId = validId(params.get('eventId'));
  const openId = validId(params.get('memory'));
  const [page, setPage] = useState(1);

  const list = useApi('/memories', { eventId, page, limit: PAGE_SIZE });
  const events = useApi('/memories/events');
  const memories = list.data || [];
  const eventOptions = events.data || [];

  // The filter and the open memory live in the URL, so both can be linked to.
  const setQuery = useCallback(
    (changes) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  function changeEvent(value) {
    setPage(1);
    setQuery({ eventId: value });
  }

  function changePage(next) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const reloadList = list.reload;
  const handleDeleted = useCallback(() => {
    setQuery({ memory: '' });
    reloadList();
  }, [setQuery, reloadList]);

  const selectedEvent = eventOptions.find((e) => e.id === eventId);

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="memory-event-filter" className="mb-1.5 block text-sm font-semibold text-fg">
            Filter by event
          </label>
          <Select id="memory-event-filter" value={eventId} onChange={(e) => changeEvent(e.target.value)}>
            <option value="">All memories</option>
            {eventId && !selectedEvent && <option value={eventId}>Selected event</option>}
            {eventOptions.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </Select>
        </div>
        <Button href="/dashboard/create/memory" icon={Plus}>
          Share a memory
        </Button>
      </div>

      {list.loading && !memories.length ? (
        <CardSkeletons count={8} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" height="aspect-square h-auto" />
      ) : list.error ? (
        <ErrorState title="Memories could not be loaded" message={list.error.message} onRetry={list.reload} />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Images}
          title={eventId ? 'No memories from this event yet' : 'No memories have been shared yet'}
          description={
            eventId
              ? 'Photos and videos linked to this event will appear here once an administrator approves them.'
              : 'Be the first to share photos or videos from college days, reunions and celebrations. Memories appear here after an administrator approves them.'
          }
          action={
            <>
              <Button href={eventId ? `/dashboard/create/memory?eventId=${eventId}` : '/dashboard/create/memory'} icon={Plus}>
                Share a memory
              </Button>
              {eventId && (
                <Button variant="secondary" onClick={() => changeEvent('')}>
                  Show all memories
                </Button>
              )}
            </>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted" aria-live="polite">
            {plural(list.meta ? list.meta.total : memories.length, 'memory', 'memories')}
            {selectedEvent ? ` from “${selectedEvent.title}”` : ''}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {memories.map((memory) => (
              <MemoryTile key={memory.id} memory={memory} onOpen={(id) => setQuery({ memory: id })} />
            ))}
          </ul>
          <Pagination
            className="mt-8"
            page={list.meta ? list.meta.page : page}
            totalPages={list.meta ? list.meta.totalPages : 1}
            onPageChange={changePage}
          />
        </>
      )}

      <MemoryLightbox
        memoryId={openId}
        preview={memories.find((m) => m.id === openId) || null}
        onClose={() => setQuery({ memory: '' })}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
