'use client';

import { FileSearch, Pencil } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { ErrorState, ModerationNotice, PageLoader } from '@/components/ui/Feedback';
import BlogArticle from './BlogArticle';
import BlogInteractions from './BlogInteractions';

function NotFound({ signedIn, slug }) {
  return (
    <div className="container-page flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <FileSearch className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="font-display text-3xl font-semibold text-fg">We couldn&apos;t find that blog</h1>
      <p className="mt-3 max-w-md text-fg-soft">
        It may have been removed, or it may not have been published yet.
        {!signedIn && ' If it is your own blog awaiting review, log in to preview it.'}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button href="/blogs">Browse all blogs</Button>
        {!signedIn && (
          <Button href={`/login?next=${encodeURIComponent(`/blogs/${slug}`)}`} variant="secondary">
            Log in
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Rendered when the public API has no approved blog for this slug.
 *
 * A blog that is pending or rejected exists only for its author and for
 * administrators, so it can never be part of the server-rendered HTML. This
 * component asks the API again from the browser, with the visitor's session:
 * the API returns the blog to its author / an admin and 404 to everyone else.
 */
export default function BlogPreview({ slug }) {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const { data: blog, error, reload } = useApi(`/blogs/slug/${slug}`, undefined, { enabled: signedIn });

  if (status === 'loading') return <PageLoader label="Looking for this blog…" />;
  if (!signedIn) return <NotFound signedIn={false} slug={slug} />;

  if (error) {
    if (error.status === 404 || error.status === 400) return <NotFound signedIn slug={slug} />;
    return (
      <div className="container-page max-w-xl py-16">
        <ErrorState title="This blog could not be loaded" message={error.message} onRetry={reload} />
      </div>
    );
  }
  // Signed in, no answer yet: the request is still on its way.
  if (!blog) return <PageLoader label="Looking for this blog…" />;

  const approved = !blog.moderation || blog.moderation.status === 'APPROVED';

  return (
    <BlogArticle
      blog={blog}
      notice={
        <div className="space-y-3">
          {!approved && (
            <p className="rounded-xl border border-brand/20 bg-brand-soft px-3.5 py-2.5 text-sm font-medium text-brand-ink">
              Preview — this blog is not published. Only you and the administrators can open this page.
            </p>
          )}
          <ModerationNotice moderation={blog.moderation} />
          {blog.isMine && (
            <Button href={`/dashboard/create/blog?edit=${blog.id}`} variant="secondary" size="sm" icon={Pencil}>
              Edit this blog
            </Button>
          )}
        </div>
      }
    >
      <BlogInteractions
        blogId={blog.id}
        slug={blog.slug}
        initialLikeCount={blog.likeCount}
        initialCommentCount={blog.commentCount}
        canInteract={approved}
      />
    </BlogArticle>
  );
}
