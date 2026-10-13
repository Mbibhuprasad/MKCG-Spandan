import { useState } from 'react';
import { View } from 'react-native';
import { FormScreen } from '@/components/FormScreen';
import { MediaPicker, mediaState } from '@/components/MediaPicker';
import { ChipRow, FieldLabel, Input } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { fieldErrors } from '@/services/api';
import { POST_TYPES, UPLOAD_LIMITS } from '@/utils/constants';
import { invalidate } from '@/utils/events';
import { postsApi } from './api';

// A community post (POST /posts): text, a kind, and up to four photos.
// Visible to members as soon as it is saved.
export function PostForm({ onDone }) {
  const toast = useToast();
  const [type, setType] = useState('GENERAL');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState([]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const state = mediaState(media);
    const found = {};
    if (!body.trim()) found.body = 'Write something to post.';
    if (state.uploading) found.media = 'Please wait for the photos to finish uploading.';
    else if (state.failed) found.media = 'Remove the photos that failed, or retry them.';
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { data } = await postsApi.create({ type, body: body.trim(), mediaIds: state.ids });
      invalidate('posts');
      toast.success('Posted to the community.');
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
      title="New post"
      submitLabel="Post"
      submitIcon="send"
      onSubmit={submit}
      busy={busy}
      failure={failure}
      note="Posts are visible to signed-in members. Never share identifiable patient information."
    >
      <FieldLabel label="Kind of post" />
      <View style={{ marginHorizontal: -16, marginBottom: 16 }}>
        <ChipRow options={POST_TYPES} value={type} onChange={(next) => setType(next || 'GENERAL')} />
      </View>
      <Input
        label="Your post"
        required
        value={body}
        onChangeText={(value) => {
          setBody(value);
          if (errors.body) setErrors((e) => ({ ...e, body: undefined }));
        }}
        error={errors.body}
        placeholder="Share an update, an achievement or a plan…"
        multiline
        rows={6}
        maxLength={5000}
        counter
        autoFocus
      />
      <MediaPicker label="Photos" hint={`Optional · up to ${UPLOAD_LIMITS.postMedia}`} purpose="post" value={media} onChange={setMedia} max={UPLOAD_LIMITS.postMedia} error={errors.media} />
    </FormScreen>
  );
}
