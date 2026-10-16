'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { POST_TYPES, UPLOAD_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { FormMessage, SelectField, TextAreaField } from '@/components/ui/Form';
import MediaUploader from '@/components/content/MediaUploader';
import EditorLoader from './EditorLoader';

const MAX_BODY = 5000;

function PostFormFields({ initial }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial);
  const photosLabelId = useId();

  const [type, setType] = useState(initial?.type || 'GENERAL');
  const [body, setBody] = useState(initial?.body || '');
  const [media, setMedia] = useState(initial?.media || []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || uploading) return;

    const text = body.trim();
    const fieldErrors = {};
    if (!text) fieldErrors.body = 'Write something to share.';
    else if (text.length > MAX_BODY) fieldErrors.body = `Your post must be at most ${MAX_BODY} characters.`;
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    setBusy(true);
    try {
      const payload = { type, body: text, mediaIds: media.map((m) => m.id) };
      await (editing ? api.patch(`/posts/${initial.id}`, payload) : api.post('/posts', payload));
      toast.success(editing ? 'Post updated.' : 'Post published.');
      router.push('/community');
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold text-fg">{editing ? 'Edit your post' : 'Create a post'}</h1>
      <p className="mt-2 text-fg-soft">
        Share an update, an achievement or reunion news with fellow doctors in the community feed.
      </p>

      <form onSubmit={handleSubmit} noValidate className="card mt-6 space-y-5 p-5 sm:p-6">
        <FormMessage tone="info">
          {editing
            ? 'Your changes are visible to the community as soon as you save.'
            : 'Your post is published to the community as soon as you share it. You can edit or delete it later under My submissions.'}
        </FormMessage>
        <FormMessage>{message}</FormMessage>

        <SelectField
          label="Type of post"
          value={type}
          onChange={(e) => setType(e.target.value)}
          error={errors.type}
          required
        >
          {POST_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div>
          <TextAreaField
            label="Your post"
            rows={7}
            maxLength={MAX_BODY}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (errors.body) setErrors((current) => ({ ...current, body: undefined }));
            }}
            error={errors.body}
            placeholder="What would you like to share with your batchmateFriends?"
            hint="Plain text only. Never include patient-identifiable information."
            required
          />
          <p
            className={cn('mt-1 text-right text-xs tabular-nums', body.length > MAX_BODY - 200 ? 'text-warn' : 'text-muted')}
            aria-live="polite"
          >
            {body.length} / {MAX_BODY}
          </p>
        </div>

        <div className="space-y-1.5" role="group" aria-labelledby={photosLabelId}>
          <p id={photosLabelId} className="flex items-baseline justify-between text-sm font-semibold text-fg">
            <span>Photos</span>
            <span className="text-xs font-normal text-muted">Optional</span>
          </p>
          <MediaUploader
            purpose="post"
            value={media}
            onChange={setMedia}
            max={UPLOAD_LIMITS.postMedia}
            label="Add photos"
            onBusyChange={setUploading}
          />
          {errors.mediaIds ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {errors.mediaIds}
            </p>
          ) : (
            <p className="text-xs text-muted">
              Up to {UPLOAD_LIMITS.postMedia} photos (JPG, PNG or WebP, {UPLOAD_LIMITS.imageMb} MB each).
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          <Button href={editing ? '/dashboard/submissions' : '/dashboard/create'} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={uploading} icon={Send}>
            {uploading ? 'Uploading photos…' : editing ? 'Save changes' : 'Publish post'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Create a post, or edit one of your own with ?edit=ID. */
export default function PostForm() {
  return (
    <EditorLoader resource="/posts" label="post">
      {(post) => <PostFormFields key={post ? post.id : 'new'} initial={post} />}
    </EditorLoader>
  );
}
