import { publicFetch } from '@/lib/server-api';
import { absoluteUrl } from '@/lib/site';

// Regenerated at most once an hour.
export const revalidate = 3600;

const PAGE_SIZE = 30; // the API's maximum page size for blogs
const MAX_PAGES = 200; // safety limit: 6,000 blogs

// Only pages that are meant to be indexed. Member-only areas (directory,
// community feed, memories, events), the dashboard and the admin panel are
// deliberately absent — see robots.js.
const STATIC_PAGES = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/blogs', changeFrequency: 'daily', priority: 0.9 },
  { path: '/register', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/community-guidelines', changeFrequency: 'yearly', priority: 0.3 },
];

// Every approved blog, read from the public API (which never returns pending
// or rejected blogs). If the API is unreachable the sitemap simply lists the
// static pages.
async function approvedBlogs() {
  const entries = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await publicFetch('/blogs', { query: { page, limit: PAGE_SIZE }, revalidate });
    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) break;
    for (const blog of result.data) {
      const entry = { url: absoluteUrl(`/blogs/${blog.slug}`), changeFrequency: 'monthly', priority: 0.7 };
      const modified = blog.updatedAt || blog.publishedAt;
      if (modified) entry.lastModified = new Date(modified);
      entries.push(entry);
    }
    if (!result.meta || page >= result.meta.totalPages) break;
  }
  return entries;
}

export default async function sitemap() {
  const pages = STATIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  }));
  return [...pages, ...(await approvedBlogs())];
}
