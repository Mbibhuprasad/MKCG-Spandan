import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, FieldError, FieldLabel, ProgressBar, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { UPLOAD_LIMITS } from '@/utils/constants';
import { postersApi } from './api';
import { STEPS, TEMPLATES } from './model';
import { TEMPLATE_THUMBNAILS } from './thumbnails';

// Template preview images are the website's own templates drawn with
// placeholder text ("Your name"), generated from the website renderer — no
// doctor's details. The poster itself is always drawn by the website.
export function TemplateThumb({ templateId, width = 120, selected = false }) {
  const { colors } = useTheme();
  const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const source = TEMPLATE_THUMBNAILS[template.id];
  const height = Math.round((width * 1754) / 1240);
  return (
    <View
      style={[
        styles.thumb,
        { width, height, borderColor: selected ? colors.brand : colors.line, backgroundColor: colors.surface2 },
        selected && styles.thumbSelected,
      ]}
    >
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.swatches}>
          {template.palettes[0].swatch.map((c) => (
            <View key={c} style={[styles.swatchBand, { backgroundColor: c }]} />
          ))}
        </View>
      )}
    </View>
  );
}

/** Horizontal gallery of the six templates; the selected one is outlined and ticked. */
export function TemplateGallery({ value, onChange, width = 132 }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {TEMPLATES.map((t) => {
        const selected = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={[styles.galleryItem, { width }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${t.name} template${selected ? ', selected' : ''}`}
          >
            <View>
              <TemplateThumb templateId={t.id} width={width} selected={selected} />
              {selected ? (
                <View style={[styles.tick, { backgroundColor: colors.brand }]}>
                  <Ionicons name="checkmark" size={15} color="#fff" />
                </View>
              ) : null}
            </View>
            <Text variant="smallStrong" numberOfLines={2} tone={selected ? 'brand' : 'default'}>
              {t.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The template's colour variations as swatches. */
export function PaletteChooser({ templateId, value, onChange }) {
  const { colors } = useTheme();
  const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  return (
    <View style={styles.palettes}>
      {template.palettes.map((p) => {
        const selected = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[styles.palette, { borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandSoft : colors.surface }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Colour: ${p.label}`}
          >
            <View style={styles.paletteDots}>
              {p.swatch.map((c, i) => (
                <View key={`${c}-${i}`} style={[styles.paletteDot, { backgroundColor: c, marginLeft: i ? -6 : 0, borderColor: colors.surface }]} />
              ))}
            </View>
            <Text variant="caption" tone={selected ? 'brand' : 'soft'} numberOfLines={2} style={styles.flex}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusPill({ status, missing = [] }) {
  const { colors } = useTheme();
  const ready = status === 'READY' && !missing.length;
  return (
    <View style={[styles.pill, { backgroundColor: ready ? colors.leafSoft : colors.surface2 }]}>
      <Ionicons name={ready ? 'checkmark-circle' : 'create-outline'} size={12} color={ready ? colors.leafStrong : colors.muted} />
      <Text variant="caption" color={ready ? colors.leafStrong : colors.muted} style={styles.pillText}>
        {ready ? 'Finished' : 'Draft'}
      </Text>
    </View>
  );
}

/** "Step 2 of 6" with a progress bar and tappable step chips (error counts shown). */
export function StepHeader({ step, onSelect, counts }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stepHeader, { borderBottomColor: colors.line, backgroundColor: colors.bg }]}>
      <View style={styles.stepTop}>
        <Text variant="eyebrow" tone="brand">
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.stepTitle}>
          {STEPS[step].title}
        </Text>
      </View>
      <ProgressBar value={(step + 1) / STEPS.length} height={5} tone="brand" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepChips} keyboardShouldPersistTaps="handled">
        {STEPS.map((s, i) => {
          const active = i === step;
          const errors = counts[i];
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(i)}
              style={[styles.stepChip, { backgroundColor: active ? colors.brandSoft : 'transparent', borderColor: active ? colors.brand : colors.line }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Step ${i + 1}: ${s.short}${errors ? `, ${errors} to check` : ''}`}
            >
              <View style={[styles.stepNum, { backgroundColor: errors ? colors.dangerSoft : active ? colors.brand : colors.surface2 }]}>
                <Text variant="caption" color={errors ? colors.danger : active ? '#fff' : colors.muted} style={styles.stepNumText}>
                  {errors || i + 1}
                </Text>
              </View>
              <Text variant="smallStrong" tone={active ? 'brand' : 'soft'}>
                {s.short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * One poster photograph: pick from the gallery (no camera), preview, replace,
 * remove. Uploads go through POST /media (purpose "poster"): the API checks the
 * real file and stores it privately in Cloudinary; the poster refers to it by id.
 */
export function PhotoField({ label, hint, media, onChange, onBusyChange, round = false }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [failedAsset, setFailedAsset] = useState(null);

  const upload = async (asset) => {
    setBusy(true);
    setError('');
    setProgress(0);
    if (onBusyChange) onBusyChange(true);
    try {
      const uploaded = await postersApi.uploadPhoto(asset, { onProgress: setProgress });
      setFailedAsset(null);
      onChange(uploaded);
    } catch (err) {
      setFailedAsset(asset);
      setError(err.isNetwork ? 'No connection — the photo was not uploaded.' : err.message || 'The upload failed.');
    } finally {
      setBusy(false);
      if (onBusyChange) onBusyChange(false);
    }
  };

  const pick = async () => {
    if (busy) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.9,
        exif: false, // location and device details embedded in photos are not read
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > UPLOAD_LIMITS.imageMb * 1024 * 1024) {
        setError(`That photo is larger than ${UPLOAD_LIMITS.imageMb} MB.`);
        return;
      }
      upload(asset);
    } catch {
      setError('The photo library could not be opened.');
    }
  };

  const url = media && (media.thumbUrl || media.url);
  return (
    <View style={styles.photoField}>
      <FieldLabel label={label} hint={hint} />
      <View style={styles.photoRow}>
        <Pressable
          onPress={pick}
          disabled={busy}
          style={[styles.photoBox, round && styles.photoRound, { borderColor: error ? colors.danger : colors.line, backgroundColor: colors.surface2 }]}
          accessibilityRole="button"
          accessibilityLabel={url ? `${label}: replace photo` : `${label}: choose a photo`}
        >
          {url ? (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <Ionicons name="image-outline" size={26} color={colors.muted} />
          )}
          {busy ? (
            <View style={styles.photoBusy}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.photoActions}>
          {busy ? (
            <>
              <Text variant="small" tone="muted">
                Uploading… {Math.round(progress * 100)}%
              </Text>
              <ProgressBar value={progress} height={5} tone="brand" />
            </>
          ) : (
            <>
              <Button title={url ? 'Replace' : 'Choose photo'} icon="images-outline" size="sm" variant="secondary" onPress={pick} />
              {url ? <Button title="Remove" icon="trash-outline" size="sm" variant="ghost" onPress={() => onChange(null)} /> : null}
              {failedAsset ? <Button title="Retry upload" icon="refresh" size="sm" variant="ghost" onPress={() => upload(failedAsset)} /> : null}
            </>
          )}
        </View>
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  thumb: { borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden' },
  thumbSelected: { borderWidth: 3 },
  swatches: { flex: 1 },
  swatchBand: { flex: 1 },
  gallery: { gap: 12, paddingVertical: 4, paddingRight: space.lg },
  galleryItem: { gap: 8 },
  tick: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  palettes: { flexDirection: 'row', gap: 8 },
  palette: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1.5 },
  paletteDots: { flexDirection: 'row' },
  paletteDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontWeight: '700' },
  stepHeader: { paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 6, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepTitle: { flex: 1, textAlign: 'right' },
  stepChips: { gap: 6, paddingVertical: 2 },
  stepChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 12, height: 36, borderRadius: 18, borderWidth: 1 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontWeight: '800' },
  photoField: { gap: 6 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoBox: { width: 92, height: 92, borderRadius: radius.lg, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoRound: { borderRadius: 46 },
  photoBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  photoActions: { flex: 1, gap: 8, alignItems: 'flex-start' },
});
