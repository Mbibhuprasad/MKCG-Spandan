'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';

/**
 * Like / unlike for posts, blogs and memories (targetType: 'post' | 'blog' | 'memory').
 * Updates optimistically, then adopts the count returned by the API. The API
 * guarantees one like per member, so double clicks cannot inflate the count.
 */
export default function LikeButton({ targetType, targetId, initialLiked = false, initialCount = 0, disabled = false, className }) {
  const toast = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || disabled) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const { data } = next
        ? await api.put(`/likes/${targetType}/${targetId}`)
        : await api.delete(`/likes/${targetType}/${targetId}`);
      setLiked(data.liked);
      setCount(data.likeCount);
    } catch (error) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? `Unlike. ${count} likes` : `Like. ${count} likes`}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
        liked ? 'text-danger hover:bg-danger-soft' : 'text-fg-soft hover:bg-surface-2 hover:text-fg',
        className
      )}
    >
      <Heart className={cn('h-[1.1rem] w-[1.1rem] transition-transform', liked && 'scale-110 fill-current')} aria-hidden="true" />
      <span>{count}</span>
    </button>
  );
}
