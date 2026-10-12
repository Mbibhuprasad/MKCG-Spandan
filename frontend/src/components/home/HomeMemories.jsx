'use client';

import Link from 'next/link';
import { Images, Lock, Play } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';

/**
 * Memories are members-only, so nothing about them is rendered on the server.
 *  - signed-out visitors: an explanation of what the gallery is (no photos)
 *  - members: their latest approved community memories, loaded in the browser
 */
export default function HomeMemories() {
  const { status } = useAuth();
  const { data, loading, error } = useApi('/memories', { limit: 6 }, { enabled: status === 'authenticated' });

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-label="Loading memories">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <div className="card relative overflow-hidden p-8 sm:p-10">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-leaf-soft" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-fg shadow-soft">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-fg">The gallery opens once you are inside</h3>
            <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-fg-soft">
              Photos and videos of college days, convocations and reunions are shared only with signed-in members. Each
              upload is stored privately and never shown on public pages.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button href="/register">Join to see memories</Button>
            <Button href="/login?next=%2Fmemories" variant="secondary">
              Log in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Images}
        title="Memories could not be loaded"
        description="Please open the memories page to try again."
        action={
          <Button href="/memories" variant="secondary">
            Open memories
          </Button>
        }
      />
    );
  }

  const memories = (data || []).filter((m) => m.media && m.media.length);
  if (!memories.length) {
    return (
      <EmptyState
        icon={Images}
        title="No memories have been shared yet"
        description="Be the first to add a photo or video from your batch years or a recent get-together."
        action={<Button href="/dashboard/create/memory">Share a memory</Button>}
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {memories.map((memory) => {
        const cover = memory.media[0];
        return (
          <li key={memory.id}>
            <Link
              href={`/memories?memory=${memory.id}`}
              className="group relative block aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2"
            >
              <img
                src={cover.thumbUrl || cover.url}
                alt={memory.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              {cover.resourceType === 'video' && (
                <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-sm font-semibold text-white">
                <span className="line-clamp-1">{memory.title}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
