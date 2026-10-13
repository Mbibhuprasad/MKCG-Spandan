import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FieldError, FieldLabel, ProgressBar, Text } from '@/components/ui';
import { uploadMedia } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { UPLOAD_LIMITS } from '@/utils/constants';

let localId = 0;

// Chooses photos (and, for memories, videos) from the phone's gallery and
// uploads each one through POST /media. The API checks the real file content,
// stores it with Cloudinary and returns a Media record; the form later refers
// to it by id (mediaIds / coverId). The camera is never opened.
//
//   value:    [{ key, id?, uri, kind, status: 'uploading'|'done'|'error', progress, error? }]
//   onChange: receives the next array (or an updater function)
export function MediaPicker({ label, hint, purpose, value = [], onChange, max = 1, allowVideo = false, error, required }) {
  const { colors } = useTheme();
  const [picking, setPicking] = useState(false);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  const patch = (key, changes) => onChange((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const upload = async (item) => {
    try {
      const media = await uploadMedia(item.asset, purpose, { onProgress: (progress) => patch(item.key, { progress }) });
      patch(item.key, { status: 'done', progress: 1, id: media.id, remote: media });
    } catch (err) {
      patch(item.key, { status: 'error', error: (err && err.message) || 'The upload failed.' });
    }
  };

  const pick = async () => {
    if (picking) return;
    const room = max - latest.current.length;
    if (room <= 0) return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: allowVideo ? ['images', 'videos'] : ['images'],
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
        quality: 0.85,
        exif: false, // location and device details embedded in photos are not read
      });
      if (result.canceled || !result.assets) return;
      const items = result.assets.slice(0, room).map((asset) => {
        localId += 1;
        const kind = asset.type === 'video' ? 'video' : 'image';
        const limitMb = kind === 'video' ? UPLOAD_LIMITS.videoMb : UPLOAD_LIMITS.imageMb;
        const tooLarge = asset.fileSize && asset.fileSize > limitMb * 1024 * 1024;
        return {
          key: `local-${localId}`,
          uri: asset.uri,
          kind,
          asset,
          progress: 0,
          status: tooLarge ? 'error' : 'uploading',
          error: tooLarge ? `That ${kind} is larger than ${limitMb} MB.` : undefined,
        };
      });
      onChange((current) => [...current, ...items]);
      items.filter((item) => item.status === 'uploading').forEach(upload);
    } catch {
      onChange((current) => current);
    } finally {
      setPicking(false);
    }
  };

  const retry = (item) => {
    patch(item.key, { status: 'uploading', progress: 0, error: undefined });
    upload(item);
  };

  const remove = (item) => onChange((current) => current.filter((i) => i.key !== item.key));

  const single = max === 1;
  const canAdd = value.length < max;
  const wide = single || value.length === 0;
  const failed = value.find((item) => item.status === 'error');

  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} hint={hint || (single ? undefined : `${value.length}/${max}`)} />
      <View style={styles.grid}>
        {value.map((item) => (
          <View key={item.key} style={[single ? styles.single : styles.tile, { backgroundColor: colors.surface2, borderColor: item.status === 'error' ? colors.danger : colors.line }]}>
            {item.kind === 'video' ? (
              <View style={styles.videoTile}>
                <Ionicons name="videocam" size={28} color={colors.muted} />
                <Text variant="caption" tone="muted">
                  Video
                </Text>
              </View>
            ) : (
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            )}
            {item.status === 'uploading' ? (
              <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
                <ActivityIndicator color="#ffffff" />
                <ProgressBar value={item.progress} height={5} trackColor="rgba(255,255,255,0.35)" style={styles.progress} />
              </View>
            ) : null}
            {item.status === 'error' ? (
              <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => (item.asset ? retry(item) : null)} accessibilityRole="button" accessibilityLabel="Retry upload">
                <Ionicons name="refresh-circle" size={30} color="#ffffff" />
                <Text variant="caption" color="#ffffff" center>
                  Tap to retry
                </Text>
              </Pressable>
            ) : null}
            {item.status === 'done' ? (
              <View style={[styles.done, { backgroundColor: colors.leaf }]}>
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              </View>
            ) : null}
            <Pressable style={styles.remove} onPress={() => remove(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove file">
              <Ionicons name="close" size={15} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        {canAdd ? (
          <Pressable
            onPress={pick}
            style={[wide ? (single ? styles.single : styles.wideAdd) : styles.tile, styles.add, { borderColor: error ? colors.danger : colors.lineStrong, backgroundColor: colors.bgSoft }]}
            accessibilityRole="button"
            accessibilityLabel={allowVideo ? 'Add a photo or video' : 'Add a photo'}
          >
            {picking ? <ActivityIndicator color={colors.brand} /> : <Ionicons name={allowVideo ? 'images-outline' : 'image-outline'} size={26} color={colors.brandInk} />}
            <Text variant="smallStrong" tone="brand" center>
              {!wide ? 'Add' : allowVideo ? 'Add photo or video' : single ? 'Choose a photo' : 'Add photo'}
            </Text>
            {wide ? (
              <Text variant="caption" tone="muted" center>
                {allowVideo ? `JPG, PNG, WebP up to ${UPLOAD_LIMITS.imageMb} MB · MP4, MOV, WebM up to ${UPLOAD_LIMITS.videoMb} MB` : `JPG, PNG or WebP · up to ${UPLOAD_LIMITS.imageMb} MB`}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <FieldError message={error || (failed && failed.error)} />
    </View>
  );
}

// What a form needs to know about its picker before submitting.
export const mediaState = (items = []) => ({
  uploading: items.some((item) => item.status === 'uploading'),
  failed: items.some((item) => item.status === 'error'),
  ids: items.filter((item) => item.status === 'done' && item.id).map((item) => item.id),
});

const styles = StyleSheet.create({
  field: { marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', aspectRatio: 1, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  single: { width: '100%', height: 170, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  wideAdd: { width: '100%', height: 132, borderRadius: radius.lg, overflow: 'hidden' },
  add: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  progress: { width: '80%' },
  done: { position: 'absolute', left: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
});
