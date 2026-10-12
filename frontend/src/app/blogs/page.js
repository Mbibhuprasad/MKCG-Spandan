import Link from 'next/link';
import { BookOpen, PenLine, Search, X } from 'lucide-react';
import { publicFetch } from '@/lib/server-api';
import { BLOG_CATEGORIES } from '@/lib/constants';
import { cn, plural } from '@/lib/format';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Layout';
import BlogCard from '@/components/cards/BlogCard';

const PAGE_SIZE = 9;
const DESCRIPTION =
  'Articles written by the doctors of MKCGSPANDAN on clinical practice, careers, research, medical education, wellbeing and batch stories.';

// Query-string values arrive untrusted; anything the API would refuse is dropped here.
function readFilters(searchParams) {
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const text = (value, max) => (typeof first(value) === 'string' ? first(value).trim().slice(0, max) : '');

  const q = text(searchParams.q, 80);
  const categoryRaw = text(searchParams.category, 60);
  const category = BLOG_CATEGORIES.includes(categoryRaw) ? categoryRaw : '';
  const tag = text(searchParams.tag, 30).toLowerCase();
  const pageNumber = Number.parseInt(text(searchParams.page, 6), 10);
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 100000 ? pageNumber : 1;
  return { q, category, tag, page };
}

function hrefWith(filters, overrides = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  if (next.tag) params.set('tag', next.tag);
  if (next.page && next.page > 1) params.set('page', String(next.page));
  const qs = params.toString();
  return qs ? `/blogs?${qs}` : '/blogs';
}

export async function generateMetadata({ searchParams }) {
  const filters = readFilters(await searchParams);
  const filtered = Boolean(filters.q || filters.category || filters.tag || filters.page > 1);
  return {
    title: 'Blogs',
    description: DESCRIPTION,
    // Every filtered or paginated view points back to the one canonical directory
    // and is kept out of the index, so search engines see a single /blogs page.
    alternates: { canonical: '/blogs' },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title: 'Blogs by the doctors of MKCGSPANDAN', description: DESCRIPTION, url: '/blogs', type: 'website' },
  };
}

const chip = (active) =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
    active
      ? 'border-brand bg-brand text-brand-fg'
      : 'border-line-strong bg-surface text-fg-soft hover:border-brand hover:text-brand-ink'
  );

export default async function BlogsPage({ searchParams }) {
  const filters = readFilters(await searchParams);
  const { q, category, tag, page } = filters;
  const hasFilters = Boolean(q || category || tag);

  const [list, taxonomy] = await Promise.all([
    publicFetch('/blogs', { query: { q, category, tag, page, limit: PAGE_SIZE } }),
    publicFetch('/blogs/taxonomy', { revalidate: 300 }),
  ]);

  const blogs = list.ok ? list.data : [];
  const meta = list.meta;
  const categories = taxonomy.ok ? taxonomy.data.categories.filter((c) => c.count > 0 || c.name === category) : [];
  const tags = taxonomy.ok ? taxonomy.data.tags : [];

  return (
    <>
      <PageHeader
        eyebrow="Blogs"
        title="Reflections from a life in medicine"
        description="Articles written by members on practice, careers, research, teaching, wellbeing and the stories a batch shares. Every blog is reviewed before it is published."
        actions={
          <Button href="/dashboard/create/blog" icon={PenLine}>
            Write a blog
          </Button>
        }
      />

      <div className="container-page py-8 sm:py-10">
        {/* Filters are plain links and a GET form: they work without JavaScript. */}
        <section aria-label="Find blogs" className="space-y-5">
          <form action="/blogs" method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="blog-search" className="mb-1.5 block text-sm font-semibold text-fg">
                Search by title
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  id="blog-search"
                  type="search"
                  name="q"
                  defaultValue={q}
                  maxLength={80}
                  placeholder="Search blogs…"
                  className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-3.5 text-[0.95rem] text-fg placeholder:text-muted/80 focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring/30"
                />
              </div>
            </div>
            {category && <input type="hidden" name="category" value={category} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {categories.length > 0 && (
            <nav aria-label="Categories">
              <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <li>
                  <Link href={hrefWith(filters, { category: '', page: 1 })} className={chip(!category)} aria-current={!category ? 'true' : undefined}>
                    All categories
                  </Link>
                </li>
                {categories.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={hrefWith(filters, { category: item.name, page: 1 })}
                      className={chip(item.name === category)}
                      aria-current={item.name === category ? 'true' : undefined}
                    >
                      {item.name}
                      <span className={cn('text-xs font-medium', item.name === category ? 'opacity-80' : 'text-muted')}>{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Showing:</span>
              {q && (
                <Link href={hrefWith(filters, { q: '', page: 1 })} className={chip(false)} aria-label={`Remove search “${q}”`}>
                  “{q}”
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              {category && (
                <Link href={hrefWith(filters, { category: '', page: 1 })} className={chip(false)} aria-label={`Remove category ${category}`}>
                  {category}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              {tag && (
                <Link href={hrefWith(filters, { tag: '', page: 1 })} className={chip(false)} aria-label={`Remove tag ${tag}`}>
                  #{tag}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              <Link href="/blogs" className="font-semibold text-brand-ink hover:underline">
                Clear all
              </Link>
            </div>
          )}
        </section>

        <section aria-labelledby="blog-results-heading" className="mt-8">
          <h2 id="blog-results-heading" className="sr-only">
            {hasFilters ? 'Matching blogs' : 'Latest blogs'}
          </h2>

          {!list.ok ? (
            <ErrorState
              title="Blogs could not be loaded"
              message="The server is not reachable right now. Please refresh the page in a moment."
            />
          ) : blogs.length === 0 ? (
            hasFilters || page > 1 ? (
              <EmptyState
                icon={Search}
                title="No blogs match these filters"
                description="Try a different search term, category or tag."
                action={
                  <Button href="/blogs" variant="secondary">
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No blogs have been published yet"
                description="When a member's blog is approved by an administrator it will appear here. Members can be the first to write one."
                action={
                  <Button href="/dashboard/create/blog" icon={PenLine}>
                    Write a blog
                  </Button>
                }
              />
            )
          ) : (
            <>
              {meta && (
                <p className="mb-5 text-sm text-muted" role="status">
                  {plural(meta.total, 'blog')}
                  {hasFilters ? ' found' : ' published'}
                </p>
              )}
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {blogs.map((blog) => (
                  <li key={blog.id}>
                    <BlogCard blog={blog} />
                  </li>
                ))}
              </ul>
              {meta && (
                <Pagination
                  className="mt-10"
                  page={meta.page}
                  totalPages={meta.totalPages}
                  hrefFor={(target) => hrefWith(filters, { page: target })}
                />
              )}
            </>
          )}
        </section>

        {tags.length > 0 && (
          <section aria-labelledby="blog-tags-heading" className="mt-12 border-t border-line pt-8">
            <h2 id="blog-tags-heading" className="text-sm font-bold uppercase tracking-wider text-muted">
              Popular tags
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {tags.map((item) => (
                <li key={item.name}>
                  <Link
                    href={hrefWith(filters, { tag: item.name === tag ? '' : item.name, page: 1 })}
                    className={cn(
                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      item.name === tag
                        ? 'border-leaf bg-leaf-soft text-leaf-strong'
                        : 'border-line bg-surface-2 text-fg-soft hover:border-brand hover:text-brand-ink'
                    )}
                    aria-current={item.name === tag ? 'true' : undefined}
                  >
                    #{item.name}
                    <span className="sr-only"> ({plural(item.count, 'blog')})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
