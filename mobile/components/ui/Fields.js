import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { HIT_SLOP, radius, space, type } from '@/theme/tokens';
import { PressableScale } from './Button';
import { Text } from './Text';

export function FieldLabel({ label, required, hint }) {
  if (!label) return null;
  return (
    <View style={styles.labelRow}>
      <Text variant="smallStrong" tone="soft">
        {label}
        {required ? <Text variant="smallStrong" tone="danger">{' *'}</Text> : null}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <Text variant="caption" tone="danger" style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

// Text input with a label, an optional leading icon, a show/hide switch for
// passwords, a character counter and an error line.
export function Input({
  label,
  required,
  hint,
  error,
  help,
  icon,
  secure = false,
  multiline = false,
  rows = 4,
  maxLength,
  counter = false,
  value,
  style,
  inputStyle,
  right,
  ...rest
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.line;

  return (
    <View style={[styles.field, style]}>
      <FieldLabel label={label} required={required} hint={hint} />
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor },
          focused && { borderWidth: 1.5 },
          multiline && { alignItems: 'flex-start', minHeight: 22 * rows + 24 },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.muted} style={multiline && { marginTop: 13 }} /> : null}
        <TextInput
          {...rest}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          secureTextEntry={hidden}
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(e) => {
            setFocused(true);
            if (rest.onFocus) rest.onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            if (rest.onBlur) rest.onBlur(e);
          }}
          style={[styles.input, { color: colors.fg }, multiline && styles.multiline, inputStyle]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.muted} />
          </Pressable>
        ) : null}
        {right}
      </View>
      <View style={styles.below}>
        <View style={styles.flex}>
          <FieldError message={error} />
          {!error && help ? (
            <Text variant="caption" tone="muted" style={styles.error}>
              {help}
            </Text>
          ) : null}
        </View>
        {counter && maxLength ? (
          <Text variant="caption" tone="muted" style={styles.error}>
            {String(value || '').length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// A labelled on/off row (settings, visibility choices, form options).
export function SwitchRow({ label, description, value, onValueChange, disabled, icon }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      {icon ? (
        <View style={[styles.switchIcon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name={icon} size={17} color={colors.brandInk} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={Boolean(value)}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.lineStrong, true: colors.leaf }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Chip({ label, selected = false, onPress, icon, tone = 'brand', small = false, style }) {
  const { colors } = useTheme();
  const on = tone === 'leaf' ? { bg: colors.leafSoft, fg: colors.leafStrong, line: colors.leaf } : { bg: colors.brandSoft, fg: colors.brandInk, line: colors.brand };
  const bg = selected ? on.bg : colors.surface;
  const fg = selected ? on.fg : colors.fgSoft;
  const body = (
    <>
      {icon ? <Ionicons name={icon} size={small ? 12 : 14} color={fg} /> : null}
      <Text variant={small ? 'caption' : 'smallStrong'} color={fg} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const frame = [styles.chip, small && styles.chipSmall, { backgroundColor: bg, borderColor: selected ? on.line : colors.line }, style];
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <PressableScale onPress={onPress} style={frame} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}>
      {body}
    </PressableScale>
  );
}

// One-line horizontally scrolling set of filter chips. `options` are strings or { value, label }.
export function ChipRow({ options, value, onChange, allLabel, style }) {
  const list = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, style]} keyboardShouldPersistTaps="handled">
      {allLabel ? <Chip label={allLabel} selected={!value} onPress={() => onChange('')} /> : null}
      {list.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(value === o.value && allLabel ? '' : o.value)} />
      ))}
    </ScrollView>
  );
}

// Free-form list of short entries (areas of expertise, tags, languages…).
export function TagInput({ label, hint, value = [], onChange, placeholder = 'Type and press add', max = 20, maxLength = 80, error, suggestions = [] }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const add = (text) => {
    const entry = String(text).replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (!entry || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === entry.toLowerCase())) return setDraft('');
    onChange([...value, entry]);
    setDraft('');
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <View style={styles.field}>
      <FieldLabel label={label} hint={hint || `${value.length}/${max}`} />
      {value.length ? (
        <View style={styles.tags}>
          {value.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onChange(value.filter((v) => v !== tag))}
              style={[styles.tag, { backgroundColor: colors.brandSoft }]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tag}`}
            >
              <Text variant="smallStrong" tone="brand">
                {tag}
              </Text>
              <Ionicons name="close" size={14} color={colors.brandInk} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Input
        value={draft}
        onChangeText={setDraft}
        placeholder={value.length >= max ? 'Limit reached' : placeholder}
        editable={value.length < max}
        maxLength={maxLength}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={() => add(draft)}
        error={error}
        style={styles.noGap}
        right={
          draft.trim() ? (
            <Pressable onPress={() => add(draft)} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Add entry">
              <Ionicons name="add-circle" size={24} color={colors.brand} />
            </Pressable>
          ) : null
        }
      />
      {open.length ? (
        <View style={[styles.tags, { marginTop: space.sm }]}>
          {open.map((s) => (
            <Chip key={s} label={s} small icon="add" onPress={() => add(s)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Tappable checkbox with a text label (policy acceptance).
export function Checkbox({ checked, onChange, children, error }) {
  const { colors } = useTheme();
  return (
    <View>
      <Pressable
        onPress={() => onChange(!checked)}
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={6}
      >
        <View
          style={[
            styles.checkBox,
            { borderColor: error ? colors.danger : checked ? colors.brand : colors.lineStrong, backgroundColor: checked ? colors.brand : 'transparent' },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={15} color={colors.brandFg} /> : null}
        </View>
        <View style={styles.flex}>{children}</View>
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { marginBottom: space.lg },
  noGap: { marginBottom: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: { flex: 1, ...type.body, paddingVertical: 10 },
  multiline: { paddingTop: 12, paddingBottom: 12 },
  below: { flexDirection: 'row', gap: 8 },
  error: { marginTop: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  switchIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipSmall: { height: 26, paddingHorizontal: 9 },
  chipRow: { gap: 8, paddingHorizontal: space.lg, paddingVertical: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 11, paddingRight: 8, height: 30, borderRadius: radius.pill },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
