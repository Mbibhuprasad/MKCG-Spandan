import Link from 'next/link';
import { Clock, BookOpen } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { formatDate } from '@/lib/format';

/** Card for an approved blog (API blog summary). Safe to render on public pages. */
export default function BlogCard({ blog }) {
  const href = `/blogs/${blog.slug}`;
  return (
    <article className="card group flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lift">
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-surface-2" tabIndex={-1} aria-hidden="true">
        {blog.cover ? (
          <img
            src={blog.cover.thumbUrl || blog.cover.url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-leaf-soft text-brand-ink/60">
            <BookOpen className="h-9 w-9" />
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-leaf">{blog.category}</p>
        <h3 className="mt-2 text-lg font-bold leading-snug text-fg">
          <Link href={href} className="hover:text-brand-ink">
            {blog.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-soft">{blog.excerpt}</p>

        <div className="mt-auto flex items-center gap-3 pt-5">
          <Avatar name={blog.author?.name} src={blog.author?.photoUrl} size="sm" />
          <div className="min-w-0 text-xs text-muted">
            <p className="truncate text-sm font-semibold text-fg">{blog.author?.name}</p>
            <p className="flex items-center gap-1.5">
              {blog.publishedAt && <time dateTime={new Date(blog.publishedAt).toISOString()}>{formatDate(blog.publishedAt)}</time>}
              <span aria-hidden="true">·</span>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {blog.readingMinutes} min read
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
