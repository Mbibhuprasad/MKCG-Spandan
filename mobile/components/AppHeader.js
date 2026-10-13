import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Logo } from '@/components/Logo';
import { Avatar, IconButton, PressableScale, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationsContext';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

// Header of the five tab screens: the logo (or the tab's title), notifications
// with their unread count, the theme switch and the avatar that opens the
// profile menu.
export function AppHeader({ title, subtitle, showThemeToggle = false, children }) {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.bg, borderBottomColor: colors.line }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          {title ? (
            <>
              <Text variant="h1" numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          ) : (
            <Logo size={32} />
          )}
        </View>
        <IconButton
          name="notifications-outline"
          badge={unreadCount}
          onPress={() => router.push('/notifications')}
          accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        />
        {showThemeToggle ? (
          <IconButton
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            onPress={toggle}
            accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          />
        ) : null}
        <PressableScale onPress={() => router.push('/menu')} scaleTo={0.92} accessibilityRole="button" accessibilityLabel="Open profile menu">
          <View style={[styles.avatarRing, { borderColor: colors.leaf }]}>
            <Avatar uri={user && user.profile.photoUrl} name={user ? user.name : ''} size={34} />
          </View>
        </PressableScale>
      </View>
      {children}
    </View>
  );
}

// Title row above a Home section with an optional "View all" action.
export function SectionHeader({ title, eyebrow, actionLabel, onAction, style }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.flex}>
        {eyebrow ? (
          <Text variant="eyebrow" tone="leaf">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Text variant="smallStrong" tone="brand" onPress={onAction} accessibilityRole="button" style={styles.action} suppressHighlighting>
          {actionLabel} ›
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  avatarRing: { borderWidth: 2, borderRadius: 21, padding: 1.5 },
  section: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg, marginBottom: 12 },
  action: { paddingVertical: 4, paddingLeft: 12 },
});
