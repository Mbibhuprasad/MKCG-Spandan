import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { FieldError, FieldLabel, Input } from './Fields';
import { Text } from './Text';

// Bottom sheet: a panel that slides up over a dimmed screen.
export function Sheet({ visible, onClose, title, children, maxHeight = '82%' }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        {/* Sheets hold inputs (search boxes, list entries): the panel rides above the keyboard. */}
        <KeyboardAvoidingView behavior="padding" style={styles.avoid} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line, maxHeight, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.lineStrong }]} />
          {title ? (
            <View style={styles.titleRow}>
              <Text variant="h3" style={styles.flex}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// List of actions in a sheet. actions: [{ key, label, icon, danger, onPress }]
export function ActionSheet({ visible, onClose, title, actions }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {actions.map((action) => (
        <Pressable
          key={action.key || action.label}
          onPress={() => {
            onClose();
            action.onPress();
          }}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surface2 }]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          {action.icon ? <Ionicons name={action.icon} size={20} color={action.danger ? colors.danger : colors.fgSoft} /> : null}
          <Text variant="bodyStrong" tone={action.danger ? 'danger' : 'default'}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

// A field that opens a sheet of options. options: strings or { value, label, description }.
// With `allowCustom`, whatever the doctor typed can be used as the value.
export function SelectField({
  label,
  required,
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  error,
  searchable = false,
  allowCustom = false,
  clearable = false,
  icon,
  style,
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)), [options]);
  const current = list.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((o) => o.label.toLowerCase().includes(q) || (o.keywords || '').toLowerCase().includes(q)) : list;
  const customOffer = allowCustom && q && !list.some((o) => o.label.toLowerCase() === q);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={[styles.field, style]}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.box, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.line }]}
        accessibilityRole="button"
        accessibilityLabel={`${label || placeholder}: ${current ? current.label : value || 'not set'}`}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
        <Text style={styles.flex} tone={value ? 'default' : 'muted'} numberOfLines={1}>
          {current ? current.label : value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <FieldError message={error} />

      <Sheet visible={open} onClose={() => setOpen(false)} title={label || placeholder}>
        {searchable || allowCustom ? (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={allowCustom ? 'Search or type your own' : 'Search'}
            icon="search"
            autoCorrect={false}
            style={styles.search}
          />
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(item) => String(item.value)}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          ListHeaderComponent={
            <>
              {customOffer ? (
                <Pressable onPress={() => choose(query.trim())} style={styles.option} accessibilityRole="button">
                  <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
                  <Text variant="bodyStrong" tone="brand" style={styles.flex}>
                    Use “{query.trim()}”
                  </Text>
                </Pressable>
              ) : null}
              {clearable && value ? (
                <Pressable onPress={() => choose('')} style={styles.option} accessibilityRole="button">
                  <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                  <Text tone="muted" style={styles.flex}>
                    Not stated
                  </Text>
                </Pressable>
              ) : null}
            </>
          }
          ListEmptyComponent={
            customOffer ? null : (
              <Text tone="muted" center style={styles.empty}>
                Nothing matches.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const selected = item.value === value;
            return (
              <Pressable
                onPress={() => choose(item.value)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface2 }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.flex}>
                  <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'brand' : 'default'}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" tone="muted">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {selected ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1 },
  avoid: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.xl, paddingVertical: 15 },
  field: { marginBottom: space.lg },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48 },
  search: { marginHorizontal: space.xl, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.xl, paddingVertical: 13 },
  empty: { paddingVertical: 28 },
});
