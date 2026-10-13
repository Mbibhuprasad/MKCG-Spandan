import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function LoadingState({ label = 'Loading…', compact = false, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, compact ? styles.compact : styles.roomy, style]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size={compact ? 'small' : 'large'} color={colors.brand} />
      {label ? (
        <Text variant="small" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'leaf-outline', title, message, actionLabel, onAction, compact = false, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, compact ? styles.compact : styles.roomy, style]}>
      <View style={[styles.iconTile, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={26} color={colors.brandInk} />
      </View>
      {title ? (
        <Text variant="h3" center>
          {title}
        </Text>
      ) : null}
      {message ? (
        <Text variant="small" tone="muted" center style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} size="sm" variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

const ERROR_COPY = {
  NETWORK: { icon: 'cloud-offline-outline', title: 'Cannot reach the server' },
  TIMEOUT: { icon: 'hourglass-outline', title: 'The server is not answering' },
  NOT_CONFIGURED: { icon: 'construct-outline', title: 'Server address not set' },
  NOT_FOUND: { icon: 'help-circle-outline', title: 'Not found' },
  RATE_LIMITED: { icon: 'speedometer-outline', title: 'Too many requests' },
};

// Shows why a request failed and offers to try again. A failed request is never
// presented as "nothing here".
export function ErrorState({ error, onRetry, compact = false, style }) {
  const { colors } = useTheme();
  const copy = (error && ERROR_COPY[error.code]) || { icon: 'alert-circle-outline', title: 'Something went wrong' };
  return (
    <View style={[styles.center, compact ? styles.compact : styles.roomy, style]} accessibilityRole="alert">
      <View style={[styles.iconTile, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={copy.icon} size={26} color={colors.danger} />
      </View>
      <Text variant="h3" center>
        {copy.title}
      </Text>
      <Text variant="small" tone="muted" center style={styles.message}>
        {(error && error.message) || 'Please try again.'}
      </Text>
      {onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} size="sm" variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

// Inline notice: info | success | warn | danger
export function Banner({ tone = 'info', icon, title, message, actionLabel, onAction, style }) {
  const { colors } = useTheme();
  const look = {
    info: { bg: colors.brandSoft, fg: colors.brandInk, icon: 'information-circle' },
    success: { bg: colors.leafSoft, fg: colors.leafStrong, icon: 'checkmark-circle' },
    warn: { bg: colors.warnSoft, fg: colors.warn, icon: 'warning' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: look.bg }, style]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Ionicons name={icon || look.icon} size={20} color={look.fg} style={styles.bannerIcon} />
      <View style={styles.flex}>
        {title ? (
          <Text variant="smallStrong" color={look.fg}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text variant="small" color={look.fg}>
            {message}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <Text variant="smallStrong" color={look.fg} onPress={onAction} style={styles.bannerAction} accessibilityRole="button">
            {actionLabel} →
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Pulsing placeholder block shown while content loads.
export function Skeleton({ width = '100%', height = 14, round = radius.sm, style }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: colors.skeleton }, animated, style]} />;
}

export function SkeletonCard({ style, lines = 2, media = true, width }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.line, width }, style]}>
      {media ? <Skeleton height={110} round={radius.md} /> : null}
      <Skeleton width="70%" height={15} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '45%' : '92%'} height={11} />
      ))}
    </View>
  );
}

// Small footer for paged lists: spinner while loading more, or the failure.
export function ListFooter({ loading, error, onRetry, done, doneLabel }) {
  if (loading) return <LoadingState compact label="" />;
  if (error) return <ErrorState compact error={error} onRetry={onRetry} />;
  if (done && doneLabel) {
    return (
      <Text variant="caption" tone="muted" center style={styles.footer}>
        {doneLabel}
      </Text>
    );
  }
  return <View style={styles.footerGap} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: space.xxl },
  roomy: { paddingVertical: 56 },
  compact: { paddingVertical: 20 },
  iconTile: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  message: { maxWidth: 300 },
  action: { marginTop: 8, alignSelf: 'center' },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md },
  bannerIcon: { marginTop: 1 },
  bannerAction: { marginTop: 6 },
  skeletonCard: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: 12, gap: 10 },
  footer: { paddingVertical: 18 },
  footerGap: { height: 18 },
});
