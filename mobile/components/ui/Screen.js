import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { IconButton } from './Button';
import { Text } from './Text';

// Keeps the focused input and any bottom bar above the keyboard. Every screen
// with inputs goes through this one wrapper, so the behaviour is tuned in one place.
// padding lifts the content by exactly the part of the keyboard that overlaps it,
// which is right whether or not Android also resizes the window.
export function KeyboardView({ children, style, offset = 0 }) {
  return (
    <KeyboardAvoidingView style={[styles.flex, style]} behavior="padding" keyboardVerticalOffset={offset}>
      {children}
    </KeyboardAvoidingView>
  );
}

// Page shell: themed background, status bar style and safe-area padding.
//   <Screen header={<StackHeader title="Settings" />} scroll>…</Screen>
export function Screen({
  children,
  header,
  footer,
  scroll = false,
  padded = true,
  keyboard = false,
  bottomInset = true,
  topInset,
  refreshing,
  onRefresh,
  contentStyle,
  style,
  scrollRef,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const padTop = topInset ?? !header;

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: (bottomInset && !footer ? insets.bottom : 0) + space.xxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>{children}</View>
  );

  const content = (
    <>
      {header}
      {body}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: padTop ? insets.top : 0 }, style]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {keyboard ? <KeyboardView>{content}</KeyboardView> : content}
    </View>
  );
}

// Header for pushed screens: back, title, optional action on the right.
export function StackHeader({ title, subtitle, right, onBack, back = true, border = true, children }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 6, backgroundColor: colors.bg, borderBottomColor: border ? colors.line : 'transparent' },
      ]}
    >
      <View style={styles.headerRow}>
        {back ? <IconButton name="chevron-back" onPress={goBack} accessibilityLabel="Go back" /> : null}
        <View style={styles.flex}>
          {children || (
            <>
              <Text variant="h2" numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: space.lg, paddingTop: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  header: { paddingHorizontal: space.md, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
