import { useState } from 'react';
import { FormScreen } from '@/components/FormScreen';
import { MediaPicker, mediaState } from '@/components/MediaPicker';
import { DateField, Input, SelectField } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { eventsApi } from '@/features/events/api';
import { useResource } from '@/hooks/useResource';
import { fieldErrors } from '@/services/api';
import { UPLOAD_LIMITS } from '@/utils/constants';
import { invalidate } from '@/utils/events';
import { formatDate } from '@/utils/format';
import { memoriesApi } from './api';

function validate(form, media, items) {
  const errors = {};
  if (form.title.trim().length < 3) errors.title = 'Give the memory a title of at least 3 characters.';
  if (!items.length) errors.media = 'Add at least one photo or video.';
  else if (media.uploading) errors.media = 'Please wait for the uploads to finish.';
  else if (media.failed) errors.media = 'Remove the files that failed, or retry them.';
  return errors;
}

// Uploads go to Cloudinary through the API (POST /media), then POST /memories
// saves the item with their ids. It is published immediately, in one of two
// places: the community Memories section or, with `gallery`, the Gallery on
// the member's own profile. An item is never in both.
export function MemoryForm({ onDone, onSkip, step, steps, gallery = false, title = gallery ? 'Add to your gallery' : 'Share a memory', subtitle }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', caption: '', memoryDate: null, eventId: '' });
  const [media, setMedia] = useState([]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  // Events the memory can be linked to: recent past ones first, then upcoming.
  const events = useResource(async () => {
    const [past, upcoming] = await Promise.all([eventsApi.list({ scope: 'past', limit: 30 }), eventsApi.list({ scope: 'upcoming', limit: 30 })]);
    return { data: [...past.data, ...upcoming.data] };
  }, []);
  const eventOptions = (events.data || []).map((e) => ({ value: e.id, label: e.title, description: formatDate(e.startsAt) }));

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (busy) return;
    const state = mediaState(media);
    const found = validate(form, state, media);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { data } = await memoriesApi.create({
        title: form.title.trim(),
        caption: form.caption.trim(),
        memoryDate: form.memoryDate ? form.memoryDate.toISOString() : null,
        eventId: form.eventId || null,
        mediaIds: state.ids,
        showInCommunity: !gallery,
      });
      invalidate('memories');
      toast.success(gallery ? 'Added to your gallery.' : 'Your memory is shared.');
      onDone(data);
    } catch (error) {
      const details = fieldErrors(error);
      setErrors({ ...details, media: details.mediaIds });
      setFailure(error);
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={title}
      subtitle={subtitle}
      step={step}
      steps={steps}
      submitLabel={gallery ? 'Add to Gallery' : 'Share Memory'}
      submitIcon="images"
      onSubmit={submit}
      busy={busy}
      onSkip={onSkip}
      failure={failure}
      note={`${gallery ? 'These appear in the Gallery on your profile only, not in community Memories. ' : 'Shared with the whole community in Memories. '}Share photos you took or have permission to share. Never upload anything that shows a patient or patient records.`}
    >
      <MediaPicker
        label="Photos or videos"
        required
        purpose="memory"
        value={media}
        onChange={(next) => {
          setMedia(next);
          if (errors.media) setErrors((e) => ({ ...e, media: undefined }));
        }}
        max={UPLOAD_LIMITS.memoryMedia}
        allowVideo
        error={errors.media}
      />
      <Input label="Title" required value={form.title} onChangeText={set('title')} error={errors.title} placeholder="Hostel night, final year, 2004" maxLength={140} counter />
      <Input label="Caption" value={form.caption} onChangeText={set('caption')} error={errors.caption} placeholder="Tell the story behind it" multiline rows={3} maxLength={1500} counter />
      <DateField label="When was this?" value={form.memoryDate} onChange={set('memoryDate')} maximumDate={new Date()} error={errors.memoryDate} placeholder="Optional date" />
      {eventOptions.length ? (
        <SelectField label="Related event" value={form.eventId} onChange={set('eventId')} options={eventOptions} placeholder="Optional" searchable clearable error={errors.eventId} />
      ) : null}
    </FormScreen>
  );
}
