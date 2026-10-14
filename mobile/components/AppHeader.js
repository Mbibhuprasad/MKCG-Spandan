import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Logo } from '@/components/Logo';
import { Avatar, IconButton, PressableScale, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationsContext';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

// Widths of the fixed parts of the header row (see styles), used to decide
// whether the logo's wordmark still fits beside the buttons.
const SIDE_PADDING = space.lg * 2;
const ROW_GAP = 8;
const ICON_BUTTON = 40;
const AVATAR = 41;
const SCHEDULE_BUTTON = 84;
const WORDMARK_LOGO = 175; // the 32px mark plus the MKCGSPANDAN wordmark

// The compact "Event Schedule" button: opens the schedule of travel plans.
function ScheduleButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.schedule, { backgroundColor: colors.brandSoft, borderColor: colors.glassLine }]}
      accessibilityRole="button"
      accessibilityLabel="Event Schedule"
    >
      <Ionicons name="calendar" size={16} color={colors.brandInk} />
      <Text color={colors.brandInk} style={styles.scheduleLabel} numberOfLines={2}>
        {'Event\nSchedule'}
      </Text>
    </PressableScale>
  );
}

// Header of the five tab screens: the logo (or the tab's title), the Event
// Schedule button, notifications with their unread count, the theme switch and
// the avatar that opens the profile menu.
export function AppHeader({ title, subtitle, showThemeToggle = false, children }) {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  // On narrow phones the wordmark gives way to the buttons (as on the website).
  const buttons = SCHEDULE_BUTTON + ICON_BUTTON * (showThemeToggle ? 2 : 1) + AVATAR;
  const gaps = ROW_GAP * (showThemeToggle ? 4 : 3);
  const showWordmark = width - SIDE_PADDING - buttons - gaps >= WORDMARK_LOGO;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.bg, borderBottomColor: colors.line }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          {title ? (
            <>
              <Text variant="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          ) : (
            <Logo size={32} showName={showWordmark} />
          )}
        </View>
        <ScheduleButton onPress={() => router.push('/events/schedule')} />
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
  schedule: {
    width: SCHEDULE_BUTTON,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  scheduleLabel: { fontSize: 10.5, lineHeight: 12, fontWeight: '800' },
  section: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg, marginBottom: 12 },
  action: { paddingVertical: 4, paddingLeft: 12 },
});
