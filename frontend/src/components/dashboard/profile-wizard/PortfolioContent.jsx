'use client';

import { useState } from 'react';
import { BookOpen, ExternalLink, Images, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, plural } from '@/lib/format';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Skeleton, Spinner } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { MemoryFormInner } from '@/components/memories/MemoryForm';
import { BlogFormFields } from '@/components/community/BlogForm';

function Subsection({ icon: Icon, title, description, action, children }) {
  return (
    <section className="rounded-2xl border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-fg">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {title}
          </h3>
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LoadError({ onRetry }) {
  return (
    <p className="text-sm text-danger" role="alert">
      This could not be loaded.{' '}
      <button type="button" className="font-semibold underline" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}

/**
 * The doctor's personal gallery and personal blogs.
 *
 * The gallery is the member's own: its photos are stored through the /memories
 * API as gallery items and shown in the Gallery on their profile only, never
 * in the community Memories section. A blog IS a community blog (the /blogs
 * API and collection). Both are published the moment they are saved.
 */
export default function PortfolioContent() {
  const toast = useToast();
  const { user } = useAuth();
  // `owner` selects the profile gallery — community memories are not part of it.
  const memories = useApi('/memories', { owner: user.id, limit: 36 });
  const blogs = useApi('/blogs/mine', { limit: 30 });

  // { kind: 'memory' | 'blog', item: record or null (new), loading?: true }
  const [editor, setEditor] = useState(null);
  const [removing, setRemoving] = useState(null); // { kind, item }

  const close = () => setEditor(null);
  const saved = (list) => () => {
    close();
    list.reload();
  };

  // Editing a blog needs its Markdown source, which list items do not carry.
  async function editBlog(blog) {
    setEditor({ kind: 'blog', loading: true });
    try {
      const { data } = await api.get(`/blogs/${blog.id}`);
      setEditor({ kind: 'blog', item: data });
    } catch (err) {
      setEditor(null);
      toast.error(err.message);
    }
  }

  async function remove() {
    const { kind, item } = removing;
    try {
      await api.delete(kind === 'memory' ? `/memories/${item.id}` : `/blogs/${item.id}`);
      toast.success(kind === 'memory' ? 'Removed from your gallery.' : 'Blog deleted.');
      setRemoving(null);
      (kind === 'memory' ? memories : blogs).reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const gallery = memories.data || [];
  const posts = blogs.data || [];

  return (
    <div className="space-y-5">
      <Subsection
        icon={Images}
        title="Personal gallery"
        description="Photos for the Gallery on your profile. Members see them when they open your profile — they are not added to the community Memories section."
        action={
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setEditor({ kind: 'memory', item: null })}>
            Add photos
          </Button>
        }
      >
        {memories.loading && !memories.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-label="Loading your gallery">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        ) : memories.error ? (
          <LoadError onRetry={memories.reload} />
        ) : gallery.length === 0 ? (
          <p className="rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-muted">No gallery items yet.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">{plural(memories.meta ? memories.meta.total : gallery.length, 'item')}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((memory) => {
                const cover = memory.media && memory.media[0];
                return (
                  <li key={memory.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="relative aspect-square bg-surface-2">
                      {cover && <img src={cover.thumbUrl || cover.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      {memory.media.length > 1 && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                          {memory.media.length}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-semibold text-fg">{memory.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {memory.memoryDate ? formatDate(memory.memoryDate) : formatDate(memory.createdAt)}
                      </p>
                      <div className="mt-2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          className="px-2"
                          onClick={() => setEditor({ kind: 'memory', item: memory })}
                          aria-label={`Edit gallery item: ${memory.title}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          icon={Trash2}
                          className="px-2"
                          onClick={() => setRemoving({ kind: 'memory', item: memory })}
                          aria-label={`Remove gallery item: ${memory.title}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Subsection>

      <Subsection
        icon={BookOpen}
        title="Personal blogs"
        description="Blogs you write here are the same blogs shown on the community Blogs page — one article, visible in both places and on your portfolio."
        action={
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setEditor({ kind: 'blog', item: null })}>
            Write a blog
          </Button>
        }
      >
        {blogs.loading && !blogs.data ? (
          <div className="space-y-3" role="status" aria-label="Loading your blogs">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : blogs.error ? (
          <LoadError onRetry={blogs.reload} />
        ) : posts.length === 0 ? (
          <p className="rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-muted">No blogs yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((blog) => (
              <li key={blog.id} className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {blog.cover && <img src={blog.cover.thumbUrl || blog.cover.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-fg">{blog.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {blog.category} · {formatDate(blog.publishedAt || blog.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    href={`/blogs/${blog.slug}`}
                    target="_blank"
                    rel="noopener"
                    variant="ghost"
                    size="sm"
                    icon={ExternalLink}
                    className="px-2"
                    aria-label={`View blog: ${blog.title} (opens in a new tab)`}
                  >
                    View
                  </Button>
                  <Button variant="ghost" size="sm" icon={Pencil} className="px-2" onClick={() => editBlog(blog)} aria-label={`Edit blog: ${blog.title}`}>
                    Edit
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    icon={Trash2}
                    className="px-2"
                    onClick={() => setRemoving({ kind: 'blog', item: blog })}
                    aria-label={`Delete blog: ${blog.title}`}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Subsection>

      <Modal
        open={Boolean(editor && editor.kind === 'memory')}
        onClose={close}
        size="lg"
        title={editor && editor.item ? 'Edit gallery item' : 'Add to your gallery'}
        description="Shown in the Gallery on your profile as soon as you save."
      >
        {editor && editor.kind === 'memory' && (
          <MemoryFormInner key={editor.item ? editor.item.id : 'new'} initial={editor.item} embedded gallery onSaved={saved(memories)} onCancel={close} />
        )}
      </Modal>

      <Modal
        open={Boolean(editor && editor.kind === 'blog')}
        onClose={close}
        size="xl"
        title={editor && editor.item ? 'Edit blog' : 'Write a blog'}
        description="Saved through the Blogs module and published straight away."
      >
        {editor && editor.kind === 'blog' &&
          (editor.loading ? (
            <div className="flex justify-center py-10">
              <Spinner label="Loading your blog" />
            </div>
          ) : (
            <BlogFormFields key={editor.item ? editor.item.id : 'new'} initial={editor.item} embedded onSaved={saved(blogs)} onCancel={close} />
          ))}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        title={removing && removing.kind === 'blog' ? 'Delete this blog?' : 'Remove this gallery item?'}
        message={
          removing && removing.kind === 'blog'
            ? 'The blog is deleted everywhere — from the Blogs page and from your portfolio — together with its comments and likes. This cannot be undone.'
            : 'The item is deleted from your gallery together with its photos, comments and likes. This cannot be undone.'
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
