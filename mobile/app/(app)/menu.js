import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Divider, ProgressBar, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationsContext';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadow, space } from '@/theme/tokens';
import { joinParts } from '@/utils/format';

function Row({ icon, label, onPress, badge, danger, tone }) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : tone === 'leaf' ? colors.leafStrong : colors.brandInk;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
      android_ripple={{ color: colors.surface2 }}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : tone === 'leaf' ? colors.leafSoft : colors.brandSoft }]}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text variant="bodyStrong" tone={danger ? 'danger' : 'default'} style={styles.flex}>
        {label}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text color="#ffffff" style={styles.badgeText}>
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// The profile menu opened from the avatar in the header: a panel over the
// current screen. Every entry leads to a real screen backed by the API.
export default function ProfileMenu() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const completion = user.profileCompletion;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Close the panel first, then open the destination on top of the tabs.
  const go = (href) => {
    close();
    setTimeout(() => router.push(href), 40);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your email or phone number and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <Animated.View entering={FadeIn.duration(160)} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close menu" />
      <Animated.View
        entering={SlideInRight.duration(240)}
        style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 8 }, shadow(colors, 3)]}
      >
        <View style={styles.head}>
          <Avatar uri={user.profile.photoUrl} name={user.name} size={52} />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {user.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {isAdmin ? 'Administrator' : joinParts([user.profile.specialization, user.profile.city]) || user.email}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close menu">
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>
        {completion.percent < 100 ? (
          <View style={styles.progress}>
            <ProgressBar value={completion.percent / 100} height={6} />
            <Text variant="caption" tone="muted">
              Profile {completion.percent}% complete
            </Text>
          </View>
        ) : null}
        <Divider />

        <ScrollView showsVerticalScrollIndicator={false}>
          <Row icon="person-outline" label="My Profile" onPress={() => go('/profile')} />
          <Row icon="create-outline" label="Edit Profile" onPress={() => go('/profile/edit')} />
          {completion.percent < 100 || !completion.isComplete ? <Row icon="checkmark-done-outline" label="Complete Profile" tone="leaf" onPress={() => go('/profile/edit')} /> : null}
          <Row icon="settings-outline" label="Settings" onPress={() => go('/settings')} />
          <Divider style={styles.gap} />
          <Row icon="book-outline" label="Create Blog" onPress={() => go('/create/blog')} />
          <Row icon="calendar-outline" label="Create Event" onPress={() => go('/create/event')} />
          <Row icon="images-outline" label="Create Memory" onPress={() => go('/create/memory')} />
          <Divider style={styles.gap} />
          <Row icon="notifications-outline" label="Notifications" badge={unreadCount} onPress={() => go('/notifications')} />
          <Row icon="heart-outline" label="About MKCGSPANDAN" onPress={() => go('/about')} />
          <Row icon="shield-checkmark-outline" label="Privacy and Community Guidelines" onPress={() => go('/guidelines')} />
          {isAdmin ? (
            <Text variant="caption" tone="muted" style={styles.note}>
              Administration (member accounts, reports, removing content) is done on the MKCGSPANDAN website.
            </Text>
          ) : null}
          <Divider style={styles.gap} />
          <Row icon="log-out-outline" label="Logout" danger onPress={confirmSignOut} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'flex-end' },
  panel: { width: '84%', maxWidth: 360, flex: 1, borderLeftWidth: StyleSheet.hairlineWidth * 2, borderTopLeftRadius: radius.xxl, borderBottomLeftRadius: radius.xxl, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingBottom: 12 },
  progress: { paddingHorizontal: space.lg, paddingBottom: 12, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, minHeight: 50 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gap: { marginVertical: 6 },
  note: { paddingHorizontal: space.lg, paddingVertical: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10.5, lineHeight: 13, fontWeight: '800' },
});
