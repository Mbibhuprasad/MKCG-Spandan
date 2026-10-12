import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { formatDate } from '@/lib/format';

/**
 * Presentational blog article, shared by the server-rendered public page and
 * the client-side author/admin preview. `blog` is the API's blog detail.
 *
 *   notice   — optional block above the title (e.g. the moderation notice)
 *   children — optional block below the body (likes, comments)
 *
 * The author is shown without a profile link: this view is public, and doctor
 * profiles are for signed-in members only.
 */
export default function BlogArticle({ blog, notice, children }) {
  const author = blog.author || {};
  const authorMeta = author.isAdmin
    ? 'Community admin'
    : [author.professionalTitle, author.specialization].filter(Boolean).join(' · ');
  const date = blog.publishedAt || blog.createdAt;

  return (
    <article className="container-page max-w-3xl py-10 sm:py-14">
      <nav aria-label="Breadcrumb">
        <Link href="/blogs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All blogs
        </Link>
      </nav>

      {notice && <div className="mt-6">{notice}</div>}

      <header className="mt-6">
        <p>
          <Link
            href={`/blogs?category=${encodeURIComponent(blog.category)}`}
            className="text-xs font-bold uppercase tracking-wider text-leaf hover:underline"
          >
            {blog.category}
          </Link>
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-[2.6rem] sm:leading-[1.15]">
          {blog.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-fg-soft">{blog.excerpt}</p>

        <div className="mt-6 flex items-center gap-3 border-y border-line py-4">
          <Avatar name={author.name} src={author.photoUrl} size="md" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[0.95rem] font-semibold text-fg">{author.name}</p>
            {authorMeta && <p className="mt-0.5 truncate text-xs text-muted">{authorMeta}</p>}
          </div>
          <p className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted sm:flex-row sm:items-center sm:gap-2">
            {date && <time dateTime={new Date(date).toISOString()}>{formatDate(date)}</time>}
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {blog.readingMinutes} min read
            </span>
          </p>
        </div>
      </header>

      {blog.cover && (
        <figure className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface-2">
          <img
            src={blog.cover.url}
            alt={`Cover for “${blog.title}”`}
            width={blog.cover.width || undefined}
            height={blog.cover.height || undefined}
            className="h-auto max-h-[32rem] w-full object-cover"
            decoding="async"
          />
        </figure>
      )}

      {/*
        bodyHtml is NOT raw user input. The API renders the author's Markdown with
        raw HTML disabled and then passes the result through an allow-list
        sanitiser (backend/src/services/markdown.service.js) before storing it,
        so it is safe to inject here.
      */}
      <div className="prose-blog mt-8" dangerouslySetInnerHTML={{ __html: blog.bodyHtml }} />

      {blog.tags && blog.tags.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
          {blog.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/blogs?tag=${encodeURIComponent(tag)}`}
                className="inline-flex rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-fg-soft hover:border-brand hover:text-brand-ink"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {children}
    </article>
  );
}
