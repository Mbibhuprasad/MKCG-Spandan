'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Checkbox, Field, FormMessage, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import { ErrorState, ModerationNotice, PageLoader } from '@/components/ui/Feedback';
import MediaUploader from '@/components/content/MediaUploader';

const ID_RE = /^[a-f\d]{24}$/i;

// Memory dates are stored as a calendar day (UTC midnight).
const toDay = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function validate(values, media) {
  const errors = {};
  if (values.title.trim().length < 3) errors.title = 'Give the memory a title of at least 3 characters.';
  if (values.caption.length > 1500) errors.caption = 'The caption can be at most 1,500 characters.';
  if (values.memoryDate && values.memoryDate > today()) errors.memoryDate = 'The date cannot be in the future.';
  if (media.length < 1) errors.mediaIds = 'Add at least one photo or video.';
  return errors;
}

/**
 * The memory form itself. Used as a page (create / edit) and, with `embedded`,
 * inside a dialog — for example from the profile's gallery, where a memory is
 * the doctor's gallery item. Either way it saves through the same /memories API.
 *
 *   embedded  — no page heading or back link; `onSaved(memory)` and `onCancel()`
 *               replace the redirects
 */
export function MemoryFormInner({ initial, presetEventId = '', embedded = false, onSaved, onCancel }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);

  const [values, setValues] = useState({
    title: initial ? initial.title : '',
    caption: initial ? initial.caption || '' : '',
    memoryDate: initial ? toDay(initial.memoryDate) : '',
    eventId: initial ? (initial.event ? initial.event.id : '') : presetEventId,
  });
  const [showInCommunity, setShowInCommunity] = useState(initial ? initial.showInCommunity !== false : true);
  const [media, setMedia] = useState(initial ? initial.media || [] : []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [maxDay] = useState(today);

  // Events the memory can be linked to (most recent past events first).
  const past = useApi('/events', { scope: 'past', limit: 30 });
  const upcoming = useApi('/events', { scope: 'upcoming', limit: 30 });
  const eventOptions = [...(past.data || []), ...(upcoming.data || [])].map((e) => ({
    id: e.id,
    label: `${e.title} — ${formatDate(e.startsAt)}`,
  }));
  if (initial && initial.event && !eventOptions.some((e) => e.id === initial.event.id)) {
    eventOptions.unshift({ id: initial.event.id, label: initial.event.title });
  }
  const eventsLoading = past.loading || upcoming.loading;

  const set = (key) => (event) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || uploading) return;

    const fieldErrors = validate(values, media);
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;

    const body = {
      title: values.title,
      caption: values.caption,
      memoryDate: values.memoryDate || null,
      eventId: values.eventId || null,
      mediaIds: media.map((m) => m.id),
      showInCommunity,
    };

    setBusy(true);
    try {
      const { data } = isEdit ? await api.patch(`/memories/${initial.id}`, body) : await api.post('/memories', body);
      toast.success(isEdit ? 'Changes saved.' : 'Published. It is in your gallery now.');
      if (onSaved) onSaved(data);
      else router.push(data.showInCommunity === false ? '/dashboard/submissions?tab=memories' : `/memories?memory=${data.id}`);
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? undefined : 'mx-auto max-w-3xl'}>
      {!embedded && (
        <>
          <Link href="/dashboard/create" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold text-fg">{isEdit ? 'Edit memory' : 'Share a memory'}</h1>
          <p className="mt-2 text-fg-soft">
            Upload photos or videos from college days, reunions and celebrations. Memories are visible to signed-in
            members only, and each one is also part of the gallery on your portfolio.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit} noValidate className={embedded ? 'space-y-5' : 'card mt-6 space-y-5 p-5 sm:p-7'}>
        {isEdit && <ModerationNotice moderation={initial.moderation} />}
        <FormMessage>{message}</FormMessage>

        <TextField
          label="Title"
          name="title"
          value={values.title}
          onChange={set('title')}
          error={errors.title}
          placeholder="e.g. Silver jubilee reunion — group photo"
          maxLength={140}
          required
        />

        <TextAreaField
          label="Caption"
          name="caption"
          rows={4}
          value={values.caption}
          onChange={set('caption')}
          error={errors.caption}
          placeholder="Who, where, when — the story behind it"
          maxLength={1500}
          optional
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Date of the memory"
            name="memoryDate"
            type="date"
            max={maxDay}
            value={values.memoryDate}
            onChange={set('memoryDate')}
            error={errors.memoryDate}
            optional
          />
          <SelectField
            label="Related event or reunion"
            name="eventId"
            value={values.eventId}
            onChange={set('eventId')}
            error={errors.eventId}
            hint={eventsLoading ? 'Loading events…' : eventOptions.length ? undefined : 'No events to link to yet.'}
            optional
          >
            <option value="">Not linked to an event</option>
            {values.eventId && !eventOptions.some((e) => e.id === values.eventId) && (
              <option value={values.eventId}>Selected event</option>
            )}
            {eventOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <Field
          label="Photos and videos"
          error={errors.mediaIds}
          hint={`Up to ${UPLOAD_LIMITS.memoryMedia} files. Photos (JPG, PNG, WebP) up to ${UPLOAD_LIMITS.imageMb} MB, videos (MP4, MOV, WebM) up to ${UPLOAD_LIMITS.videoMb} MB.`}
          required
        >
          {(props) => (
            <div id={props.id} aria-describedby={props['aria-describedby']}>
              <MediaUploader
                purpose="memory"
                value={media}
                onChange={(next) => {
                  setMedia(next);
                  if (errors.mediaIds) setErrors((e) => ({ ...e, mediaIds: undefined }));
                }}
                max={UPLOAD_LIMITS.memoryMedia}
                allowVideo
                label="Add photos or videos"
                onBusyChange={setUploading}
              />
            </div>
          )}
        </Field>

        <Checkbox
          label="Also show this in the community Memories section"
          description="It always appears in the gallery on your portfolio. Untick this to keep it there only."
          checked={showInCommunity}
          onChange={(event) => setShowInCommunity(event.target.checked)}
        />

        <div className="rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Before you upload
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.82rem] leading-relaxed">
            <li>Never upload patient-identifiable material — no patients, records, prescriptions, reports or clinical images.</li>
            <li>Do not share photos of people who would not want them shared. When in doubt, ask them first.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted">
            {isEdit ? 'Your changes are visible as soon as you save.' : 'It is published to members as soon as you save it.'}
          </p>
          <div className="flex shrink-0 gap-3">
            {onCancel ? (
              <Button variant="secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
            ) : (
              <Button href="/dashboard/submissions" variant="secondary">
                Cancel
              </Button>
            )}
            <Button type="submit" icon={Send} loading={busy} disabled={uploading}>
              {uploading ? 'Uploading…' : isEdit ? 'Save changes' : 'Publish'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Create a memory, or edit one of your own with ?edit=ID. */
export default function MemoryForm() {
  const params = useSearchParams();
  const editParam = params.get('edit') || '';
  const editId = ID_RE.test(editParam) ? editParam : '';
  const presetParam = params.get('eventId') || '';
  const presetEventId = ID_RE.test(presetParam) ? presetParam : '';

  const existing = useApi(editId ? `/memories/${editId}` : null, undefined, { enabled: Boolean(editId) });

  if (editParam && !editId) {
    return <ErrorState title="This memory could not be found" message="The link you followed is not valid." />;
  }
  if (!editId) return <MemoryFormInner initial={null} presetEventId={presetEventId} />;

  if (existing.error) {
    return (
      <ErrorState
        title="This memory could not be opened"
        message={existing.error.status === 404 ? 'It may have been deleted.' : existing.error.message}
        onRetry={existing.error.status === 404 ? undefined : existing.reload}
      />
    );
  }
  if (!existing.data || existing.data.id !== editId) return <PageLoader label="Loading your memory…" />;
  if (!existing.data.isMine) {
    return <ErrorState title="You can only edit your own memories" message="This memory was shared by another member." />;
  }
  return <MemoryFormInner key={existing.data.id} initial={existing.data} presetEventId="" />;
}
