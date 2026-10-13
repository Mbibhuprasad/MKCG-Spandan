import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { FormScreen } from '@/components/FormScreen';
import { MediaPicker, mediaState } from '@/components/MediaPicker';
import { Button, Input, SelectField, Sheet, TagInput, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { fieldErrors } from '@/services/api';
import { space } from '@/theme/tokens';
import { BLOG_CATEGORIES } from '@/utils/constants';
import { invalidate } from '@/utils/events';
import { blogsApi } from './api';

const LIMITS = { titleMin: 5, titleMax: 160, excerptMin: 20, excerptMax: 320, bodyMin: 200, bodyMax: 50000 };

function validate(form, media) {
  const errors = {};
  const title = form.title.trim();
  const excerpt = form.excerpt.trim();
  const body = form.body.trim();
  if (title.length < LIMITS.titleMin) errors.title = `Title must be at least ${LIMITS.titleMin} characters.`;
  if (excerpt.length < LIMITS.excerptMin) errors.excerpt = `Excerpt must be at least ${LIMITS.excerptMin} characters.`;
  if (body.length < LIMITS.bodyMin) errors.body = `A blog should be at least ${LIMITS.bodyMin} characters long (${body.length} so far).`;
  if (!form.category) errors.category = 'Choose a category.';
  if (media.uploading) errors.cover = 'Please wait for the cover image to finish uploading.';
  else if (media.failed) errors.cover = 'Remove the cover that failed, or retry it.';
  return errors;
}

// Writes to the shared blog collection through POST /blogs. The blog is
// published the moment it is saved and then appears in the Blogs list, on Home
// and on the author's portfolio — one record, three views.
export function BlogForm({ onDone, onSkip, step, steps, title = 'Write a blog', subtitle }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', excerpt: '', body: '', category: '', tags: [] });
  const [cover, setCover] = useState([]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (busy) return; // a second tap never creates a second blog
    const media = mediaState(cover);
    const found = validate(form, media);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { data } = await blogsApi.create({
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        body: form.body,
        category: form.category,
        tags: form.tags,
        coverId: media.ids[0] || null,
      });
      invalidate('blogs');
      toast.success('Your blog is published.');
      onDone(data);
    } catch (error) {
      const details = fieldErrors(error);
      setErrors({ ...details, cover: details.coverId });
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
      submitLabel="Publish Blog"
      submitIcon="send"
      onSubmit={submit}
      busy={busy}
      onSkip={onSkip}
      failure={failure}
      note="Blogs are public and published immediately. Never include identifiable patient information."
    >
      <Input label="Title" required value={form.title} onChangeText={set('title')} error={errors.title} placeholder="What is this blog about?" maxLength={LIMITS.titleMax} counter />
      <Input
        label="Excerpt"
        required
        value={form.excerpt}
        onChangeText={set('excerpt')}
        error={errors.excerpt}
        placeholder="One or two sentences shown in the blog list"
        multiline
        rows={2}
        maxLength={LIMITS.excerptMax}
        counter
      />
      <MediaPicker label="Cover image" hint="Optional" purpose="blog" value={cover} onChange={setCover} max={1} error={errors.cover} />
      <SelectField label="Category" required value={form.category} onChange={set('category')} options={BLOG_CATEGORIES} placeholder="Choose a category" error={errors.category} />
      <Input
        label="Content"
        required
        value={form.body}
        onChangeText={set('body')}
        error={errors.body}
        help="Markdown is supported: # headings, **bold**, *italic*, - lists, > quotes, [links](https://…)."
        placeholder="Write your blog here…"
        multiline
        rows={10}
        maxLength={LIMITS.bodyMax}
        counter
      />
      <TagInput label="Tags" value={form.tags} onChange={set('tags')} max={8} maxLength={30} placeholder="Add a tag" error={errors.tags} />
      <Button title="Preview" icon="eye-outline" variant="secondary" size="sm" onPress={() => setPreview(true)} style={styles.previewButton} />

      <Sheet visible={preview} onClose={() => setPreview(false)} title="Preview" maxHeight="88%">
        <ScrollView contentContainerStyle={styles.preview}>
          {cover[0] ? <Image source={{ uri: cover[0].uri }} style={styles.previewCover} contentFit="cover" /> : null}
          <Text variant="eyebrow" tone="leaf">
            {form.category || 'No category yet'}
          </Text>
          <Text variant="h1">{form.title.trim() || 'Untitled blog'}</Text>
          {form.excerpt.trim() ? <Text tone="muted">{form.excerpt.trim()}</Text> : null}
          <Text tone="soft">{form.body.trim() || 'Nothing written yet.'}</Text>
          {form.tags.length ? (
            <Text variant="small" tone="brand">
              {form.tags.map((t) => `#${t}`).join('  ')}
            </Text>
          ) : null}
          <View>
            <Text variant="caption" tone="muted">
              The text is shown as you typed it. Markdown formatting is applied when the blog is published.
            </Text>
          </View>
        </ScrollView>
      </Sheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  previewButton: { marginBottom: space.lg },
  preview: { paddingHorizontal: space.xl, gap: 10, paddingBottom: 12 },
  previewCover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14 },
});
