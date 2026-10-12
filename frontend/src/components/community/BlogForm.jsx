'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Eye, Pencil, Plus, Send, X } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { BLOG_CATEGORIES, UPLOAD_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Badge, ModerationBadge, ModerationNotice } from '@/components/ui/Feedback';
import { Field, FormMessage, Input, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import MediaUploader from '@/components/content/MediaUploader';
import EditorLoader from './EditorLoader';

const LIMITS = { titleMin: 5, titleMax: 160, excerptMin: 20, excerptMax: 320, bodyMin: 200, bodyMax: 50000, tags: 8, tagLength: 30 };

const cleanTag = (value) => value.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, LIMITS.tagLength);

// Mirrors the server rules for quick feedback; the API validates everything again.
function validate({ title, excerpt, body, category }) {
  const errors = {};
  const t = title.trim();
  const e = excerpt.trim();
  const b = body.trim();
  if (t.length < LIMITS.titleMin) errors.title = `Title must be at least ${LIMITS.titleMin} characters.`;
  if (e.length < LIMITS.excerptMin) errors.excerpt = `Excerpt must be at least ${LIMITS.excerptMin} characters.`;
  if (!category) errors.category = 'Choose a category.';
  if (b.length < LIMITS.bodyMin) errors.body = `A blog should be at least ${LIMITS.bodyMin} characters long.`;
  else if (b.length > LIMITS.bodyMax) errors.body = 'A blog can be at most 50,000 characters long.';
  return errors;
}

function FormattingGuide() {
  const rows = [
    ['## Section heading', 'Heading (use ### for a smaller one)'],
    ['**bold** and *italic*', 'Emphasis'],
    ['- item  or  1. item', 'Bulleted or numbered list'],
    ['[link text](https://example.com)', 'Link'],
    ['> quoted text', 'Quotation'],
  ];
  return (
    <details className="rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm">
      <summary className="font-semibold text-fg">Formatting guide (Markdown)</summary>
      <dl className="mt-3 space-y-2">
        {rows.map(([syntax, meaning]) => (
          <div key={meaning} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
            <dt>
              <code className="rounded bg-surface px-1.5 py-0.5 text-[0.8rem] text-fg">{syntax}</code>
            </dt>
            <dd className="text-fg-soft">{meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">
        Leave a blank line between paragraphs. Images inside the body are not supported — use the cover image instead.
        Raw HTML is not rendered; it is shown as plain text.
      </p>
    </details>
  );
}

function SavedPreview({ blog, onEdit }) {
  const published = blog.moderation && blog.moderation.status === 'APPROVED';
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-fg">{published ? 'Your blog is published' : 'Your blog has been submitted'}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {blog.moderation && <ModerationBadge status={blog.moderation.status} />}
        <Badge tone="brand">{blog.category}</Badge>
        <span className="text-sm text-muted">{blog.readingMinutes} min read</span>
      </div>
      <ModerationNotice moderation={blog.moderation} className="mt-4" />
      {published && (
        <p className="mt-4 text-sm text-fg-soft">
          It is now visible to everyone at{' '}
          <Link href={`/blogs/${blog.slug}`} className="font-semibold text-brand-ink hover:underline">
            /blogs/{blog.slug}
          </Link>
          .
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/dashboard/submissions">Go to my submissions</Button>
        <Button variant="secondary" icon={Pencil} onClick={onEdit}>
          Keep editing
        </Button>
        {published && (
          <Button href={`/blogs/${blog.slug}`} variant="secondary" icon={Eye}>
            View blog
          </Button>
        )}
      </div>

      <section aria-labelledby="blog-preview-heading" className="card mt-8 overflow-hidden">
        <p id="blog-preview-heading" className="border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted">
          Preview — exactly as readers will see it
        </p>
        {blog.cover && <img src={blog.cover.url} alt="" className="aspect-[16/7] w-full object-cover" />}
        <div className="p-5 sm:p-8">
          <h2 className="font-display text-2xl font-semibold leading-tight text-fg sm:text-3xl">{blog.title}</h2>
          <p className="mt-3 text-base leading-relaxed text-fg-soft">{blog.excerpt}</p>
          {blog.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
              {blog.tags.map((tag) => (
                <li key={tag}>
                  <Badge>#{tag}</Badge>
                </li>
              ))}
            </ul>
          )}
          {/* bodyHtml is rendered from Markdown and sanitised by the API. */}
          <div className="prose-blog mt-6 border-t border-line pt-6" dangerouslySetInnerHTML={{ __html: blog.bodyHtml }} />
        </div>
      </section>
    </div>
  );
}

/**
 * The blog form itself. Used as a page (create / edit) and, with `embedded`,
 * inside a dialog on the profile. Both save through the same /blogs API, so a
 * blog written from the profile is the very same record the Blogs page lists.
 *
 *   embedded  — no page heading; `onSaved(blog)` and `onCancel()` replace the
 *               preview screen and the Cancel link
 */
export function BlogFormFields({ initial, embedded = false, onSaved, onCancel }) {
  const toast = useToast();
  const coverLabelId = useId();

  // Once saved, further saves update the same blog.
  const [blogId, setBlogId] = useState(initial?.id || null);
  const [saved, setSaved] = useState(null);

  const [title, setTitle] = useState(initial?.title || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [cover, setCover] = useState(initial?.cover ? [initial.cover] : []);
  const [body, setBody] = useState(initial?.bodyMarkdown || '');
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const editing = Boolean(blogId);
  const bodyLength = body.trim().length;

  const clearError = (key) => errors[key] && setErrors((current) => ({ ...current, [key]: undefined }));

  function addTag() {
    const pieces = tagDraft.split(',').map(cleanTag).filter(Boolean);
    if (!pieces.length) return;
    setTags((current) => [...new Set([...current, ...pieces])].slice(0, LIMITS.tags));
    setTagDraft('');
    clearError('tags');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || uploading) return;

    const fieldErrors = validate({ title, excerpt, body, category });
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) {
      setMessage('Please check the highlighted fields.');
      return;
    }

    setBusy(true);
    try {
      const pendingTags = tagDraft.split(',').map(cleanTag).filter(Boolean);
      const allTags = [...new Set([...tags, ...pendingTags])].slice(0, LIMITS.tags);
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        body,
        category,
        tags: allTags,
        coverId: cover[0] ? cover[0].id : null,
      };
      const { data } = editing ? await api.patch(`/blogs/${blogId}`, payload) : await api.post('/blogs', payload);
      setBlogId(data.id);
      setTags(data.tags);
      setTagDraft('');
      setCover(data.cover ? [data.cover] : []);
      toast.success(editing ? 'Blog updated.' : 'Blog published.');
      if (onSaved) {
        onSaved(data);
        return;
      }
      setSaved(data);
      window.scrollTo({ top: 0 });
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
    } finally {
      setBusy(false);
    }
  }

  if (saved) return <SavedPreview blog={saved} onEdit={() => setSaved(null)} />;

  return (
    <div className={embedded ? undefined : 'mx-auto max-w-3xl'}>
      {!embedded && (
        <>
          <h1 className="font-display text-3xl font-semibold text-fg">{editing ? 'Edit your blog' : 'Write a blog'}</h1>
          <p className="mt-2 text-fg-soft">
            Share clinical perspectives, career lessons, research notes or batch stories in a longer article.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit} noValidate className={embedded ? 'space-y-5' : 'card mt-6 space-y-5 p-5 sm:p-6'}>
        <FormMessage tone="info">
          {editing
            ? 'Your changes are public as soon as you save.'
            : 'Your blog is published as soon as you save it: on the Blogs page and on your portfolio.'}
        </FormMessage>
        <FormMessage tone="warn">
          Blogs are public: anyone can read them and search engines may index them. Never include
          patient-identifiable information, reports, prescriptions or other confidential clinical details.
        </FormMessage>
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearError('title');
          }}
          error={errors.title}
          maxLength={LIMITS.titleMax}
          placeholder="A clear, specific title"
          required
        />

        <TextAreaField
          label="Excerpt"
          rows={2}
          value={excerpt}
          onChange={(e) => {
            setExcerpt(e.target.value);
            clearError('excerpt');
          }}
          error={errors.excerpt}
          maxLength={LIMITS.excerptMax}
          hint={`A one or two sentence summary shown on blog cards and in search results (${excerpt.trim().length} / ${LIMITS.excerptMax}).`}
          required
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              clearError('category');
            }}
            error={errors.category}
            required
          >
            <option value="">Choose a category</option>
            {BLOG_CATEGORIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <Field
            label="Tags"
            optional
            error={errors.tags}
            hint={`Up to ${LIMITS.tags} tags. Press Enter or comma to add one.`}
          >
            {(props) => (
              <div>
                <div className="flex gap-2">
                  <Input
                    {...props}
                    required={undefined}
                    value={tagDraft}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.endsWith(',')) {
                        setTagDraft(value);
                        // Commit on comma using the latest value.
                        const pieces = value.split(',').map(cleanTag).filter(Boolean);
                        if (pieces.length) {
                          setTags((current) => [...new Set([...current, ...pieces])].slice(0, LIMITS.tags));
                          setTagDraft('');
                        }
                      } else {
                        setTagDraft(value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    maxLength={60}
                    disabled={tags.length >= LIMITS.tags}
                    placeholder={tags.length >= LIMITS.tags ? 'Tag limit reached' : 'e.g. cardiology'}
                    error={errors.tags}
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={addTag}
                    disabled={!tagDraft.trim() || tags.length >= LIMITS.tags}
                    aria-label="Add tag"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected tags">
                    {tags.map((tag) => (
                      <li
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-fg-soft"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => setTags((current) => current.filter((t) => t !== tag))}
                          className="rounded-full p-0.5 text-muted hover:bg-line hover:text-fg"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>
        </div>

        <div className="space-y-1.5" role="group" aria-labelledby={coverLabelId}>
          <p id={coverLabelId} className="flex items-baseline justify-between text-sm font-semibold text-fg">
            <span>Cover image</span>
            <span className="text-xs font-normal text-muted">Optional</span>
          </p>
          <div className="max-w-md">
            <MediaUploader
              purpose="blog"
              value={cover}
              onChange={(next) => {
                setCover(next.slice(-1));
                clearError('coverId');
              }}
              max={1}
              label="Add a cover image"
              onBusyChange={setUploading}
            />
          </div>
          {errors.coverId ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {errors.coverId}
            </p>
          ) : (
            <p className="text-xs text-muted">
              A wide image works best (JPG, PNG or WebP, up to {UPLOAD_LIMITS.imageMb} MB). The cover is public, like the blog.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <TextAreaField
            label="Body"
            rows={18}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              clearError('body');
            }}
            error={errors.body}
            maxLength={LIMITS.bodyMax}
            className="[&_textarea]:font-mono [&_textarea]:text-[0.9rem]"
            placeholder={'Write your article here using Markdown.\n\n## A section heading\n\nA paragraph of text…'}
            required
          />
          <p
            className={cn(
              'text-right text-xs tabular-nums',
              bodyLength < LIMITS.bodyMin ? 'text-warn' : 'text-muted'
            )}
            aria-live="polite"
          >
            {bodyLength.toLocaleString('en-IN')} characters
            {bodyLength < LIMITS.bodyMin ? ` — ${LIMITS.bodyMin - bodyLength} more needed (minimum ${LIMITS.bodyMin})` : ''}
          </p>
          <FormattingGuide />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          {onCancel ? (
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          ) : (
            <Button href={editing ? '/dashboard/submissions' : '/dashboard/create'} variant="secondary">
              Cancel
            </Button>
          )}
          <Button type="submit" loading={busy} disabled={uploading} icon={Send}>
            {uploading ? 'Uploading image…' : editing ? (embedded ? 'Save changes' : 'Save and preview') : 'Publish blog'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Write a blog, or edit one of your own with ?edit=ID. */
export default function BlogForm() {
  return (
    <EditorLoader resource="/blogs" label="blog">
      {(blog) => <BlogFormFields key={blog ? blog.id : 'new'} initial={blog} />}
    </EditorLoader>
  );
}
