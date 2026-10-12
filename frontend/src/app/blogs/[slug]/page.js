import { notFound } from 'next/navigation';
import { publicFetch } from '@/lib/server-api';
import { absoluteUrl, site } from '@/lib/site';
import Button from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/Feedback';
import BlogArticle from '@/components/blog/BlogArticle';
import BlogInteractions from '@/components/blog/BlogInteractions';
import BlogPreview from '@/components/blog/BlogPreview';

const SLUG_RE = /^[a-z0-9-]{1,200}$/;

// Public, credential-less read: the API only returns a blog here once an
// administrator has approved it. Both generateMetadata and the page call this;
// Next.js de-duplicates the identical request.
function loadBlog(slug) {
  if (!SLUG_RE.test(slug)) return Promise.resolve({ ok: false, status: 404, data: null });
  return publicFetch(`/blogs/slug/${slug}`, { revalidate: 60 });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { ok, data: blog } = await loadBlog(slug);

  if (!ok || !blog) {
    // Unknown, unpublished or temporarily unavailable: nothing to index.
    return { title: 'Blog', robots: { index: false, follow: false } };
  }

  const path = `/blogs/${blog.slug}`;
  const images = blog.cover
    ? [
        {
          url: blog.cover.url,
          width: blog.cover.width || undefined,
          height: blog.cover.height || undefined,
          alt: `Cover for “${blog.title}”`,
        },
      ]
    : undefined;

  return {
    title: blog.title,
    description: blog.excerpt,
    alternates: { canonical: path },
    authors: blog.author?.name ? [{ name: blog.author.name }] : undefined,
    keywords: blog.tags && blog.tags.length ? blog.tags : undefined,
    openGraph: {
      type: 'article',
      title: blog.title,
      description: blog.excerpt,
      url: path,
      siteName: site.name,
      publishedTime: blog.publishedAt || undefined,
      modifiedTime: blog.updatedAt || undefined,
      authors: blog.author?.name ? [blog.author.name] : undefined,
      section: blog.category,
      tags: blog.tags,
      images,
    },
    twitter: {
      card: blog.cover ? 'summary_large_image' : 'summary',
      title: blog.title,
      description: blog.excerpt,
      images: blog.cover ? [blog.cover.url] : undefined,
    },
  };
}

// Structured data built only from the approved blog's real fields.
function articleJsonLd(blog) {
  const url = absoluteUrl(`/blogs/${blog.slug}`);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: blog.title,
    description: blog.excerpt,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: blog.category,
    publisher: { '@type': 'Organization', name: site.name, url: site.url },
  };
  if (blog.publishedAt) data.datePublished = blog.publishedAt;
  if (blog.updatedAt) data.dateModified = blog.updatedAt;
  if (blog.author?.name) data.author = { '@type': 'Person', name: blog.author.name };
  if (blog.cover) data.image = [blog.cover.url];
  if (blog.tags && blog.tags.length) data.keywords = blog.tags.join(', ');
  // "<" is escaped so the JSON can never close the surrounding <script> element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function BlogDetailPage({ params }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) notFound(); // not a slug this site could ever have issued
  const { ok, status, data: blog } = await loadBlog(slug);

  if (ok && blog) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd(blog) }} />
        <BlogArticle blog={blog}>
          <BlogInteractions
            blogId={blog.id}
            slug={blog.slug}
            initialLikeCount={blog.likeCount}
            initialCommentCount={blog.commentCount}
          />
        </BlogArticle>
      </>
    );
  }

  if (status === 404) {
    // No approved blog with this slug. It may still be the visitor's own pending
    // blog, so the browser asks again with their session. Unpublished content is
    // therefore never part of this server-rendered HTML.
    return <BlogPreview slug={slug} />;
  }

  // The API could not be reached: say so rather than pretending the blog is gone.
  return (
    <div className="container-page max-w-xl py-16">
      <ErrorState
        title="This blog could not be loaded"
        message="The server is not reachable right now. Please try again in a moment."
      />
      <div className="mt-6 flex justify-center">
        <Button href="/blogs" variant="secondary">
          Browse all blogs
        </Button>
      </div>
    </div>
  );
}
