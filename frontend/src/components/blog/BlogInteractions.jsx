'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { plural } from '@/lib/format';
import { useAuth } from '@/components/providers/AuthProvider';
import { Skeleton } from '@/components/ui/Feedback';
import LikeButton from '@/components/content/LikeButton';
import CommentSection from '@/components/content/CommentSection';
import ReportButton from '@/components/content/ReportButton';

/**
 * Member-only island on the public blog page: like, report and comments.
 *
 * The article itself is server-rendered for everyone. Nothing personal (whether
 * the viewer liked it, members' comments) is in that HTML — it is requested
 * here, with the session cookie, only once the visitor is signed in.
 *
 * `canInteract` is false for a blog that is not approved yet (author preview).
 */
export default function BlogInteractions({ blogId, slug, initialLikeCount = 0, initialCommentCount = 0, canInteract = true }) {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const [commentDelta, setCommentDelta] = useState(0);

  // The viewer's own like state and the latest count.
  const { data: mine, error } = useApi(`/blogs/slug/${slug}`, undefined, { enabled: signedIn && canInteract });

  if (status === 'loading') {
    return (
      <section className="mt-12 border-t border-line pt-8" aria-label="Likes and comments">
        <Skeleton className="h-9 w-40" />
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="mt-12 border-t border-line pt-8" aria-labelledby="blog-discussion-heading">
        <h2 id="blog-discussion-heading" className="font-display text-xl font-semibold text-fg">
          Join the conversation
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="h-4 w-4" aria-hidden="true" />
            {plural(initialLikeCount, 'like')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {plural(initialCommentCount, 'comment')}
          </span>
        </p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-soft">
          Likes and comments are for members.{' '}
          <Link href={`/login?next=${encodeURIComponent(`/blogs/${slug}`)}`} className="font-semibold text-brand-ink underline underline-offset-2">
            Log in
          </Link>{' '}
          or{' '}
          <Link href="/register" className="font-semibold text-brand-ink underline underline-offset-2">
            join the community
          </Link>{' '}
          to like this blog or leave a comment.
        </p>
      </section>
    );
  }

  if (!canInteract) {
    return (
      <section className="mt-12 border-t border-line pt-8" aria-label="Likes and comments">
        <p className="text-sm text-muted">Likes and comments are available once this blog is published.</p>
      </section>
    );
  }

  const likeCount = mine ? mine.likeCount : initialLikeCount;
  const commentCount = Math.max(0, (mine ? mine.commentCount : initialCommentCount) + commentDelta);

  return (
    <section className="mt-12 border-t border-line pt-6" aria-labelledby="blog-discussion-heading">
      <div className="flex items-center justify-between gap-3">
        {!mine && !error ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          // Mounted only after the member's like state is known, so it starts correct.
          <LikeButton
            key={mine ? 'loaded' : 'fallback'}
            targetType="blog"
            targetId={blogId}
            initialLiked={Boolean(mine && mine.likedByMe)}
            initialCount={likeCount}
          />
        )}
        {mine && !mine.isMine && <ReportButton targetType="blog" targetId={blogId} />}
      </div>

      <h2 id="blog-discussion-heading" className="mt-6 font-display text-xl font-semibold text-fg">
        Comments <span className="text-base font-normal text-muted">({commentCount})</span>
      </h2>
      <div className="mt-4">
        <CommentSection targetType="blog" targetId={blogId} onCountChange={(delta) => setCommentDelta((d) => d + delta)} />
      </div>
    </section>
  );
}
