'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import Button from '@/components/ui/Button';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';
import PostCard from './PostCard';

const ID_RE = /^[a-f\d]{24}$/i;

/** Single post with its comments open (linked from notifications and submissions). */
export default function PostDetail({ id }) {
  const router = useRouter();
  const valid = ID_RE.test(id || '');
  const { data: post, loading, error, reload } = useApi(valid ? `/posts/${id}` : null, undefined, { enabled: valid });

  const notFound = !valid || (error && (error.status === 404 || error.status === 400));

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Button href="/community" variant="ghost" size="sm" icon={ArrowLeft} className="mb-4 -ml-2">
          Back to the feed
        </Button>

        {notFound ? (
          <EmptyState
            icon={SearchX}
            title="This post is not available"
            description="It may have been removed."
            action={
              <Button href="/community" variant="secondary">
                Go to the community feed
              </Button>
            }
          />
        ) : loading && !post ? (
          <PageLoader label="Loading post…" />
        ) : error ? (
          <ErrorState title="The post could not be loaded" message={error.message} onRetry={reload} />
        ) : post ? (
          <>
            <h1 className="sr-only">Post by {post.author.name}</h1>
            <PostCard key={post.id} post={post} defaultCommentsOpen onDeleted={() => router.push('/community')} />
          </>
        ) : null}
      </div>
    </div>
  );
}
