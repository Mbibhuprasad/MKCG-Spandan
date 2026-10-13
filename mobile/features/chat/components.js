import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { listStamp } from '@/utils/format';

// One conversation in the Chat tab: avatar, name, latest message, time, unread count.
export function ConversationRow({ conversation, myId }) {
  const { colors } = useTheme();
  const router = useRouter();
  const group = conversation.type === 'GROUP';
  const last = conversation.lastMessage;
  const unread = conversation.unreadCount || 0;

  let preview = group ? conversation.description || 'No messages yet' : 'No messages yet — say hello';
  if (last) {
    const who = last.senderId === myId ? 'You' : group ? (last.senderName || '').split(' ').slice(0, 2).join(' ') : '';
    preview = who ? `${who}: ${last.preview}` : last.preview;
  }

  return (
    <PressableScale
      onPress={() => router.push(`/chat/${conversation.id}`)}
      scaleTo={0.985}
      style={[styles.row, { borderBottomColor: colors.line }]}
      accessibilityRole="button"
      accessibilityLabel={`${conversation.name}${unread ? `, ${unread} unread` : ''}. ${preview}`}
    >
      <Avatar uri={conversation.avatarUrl} name={conversation.name} size={52} icon={group ? 'people' : undefined} />
      <View style={styles.flex}>
        <View style={styles.line}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {conversation.name}
          </Text>
          <Text variant="caption" color={unread ? colors.leaf : colors.muted}>
            {listStamp(last ? last.at : conversation.lastActivityAt)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text variant="small" tone={unread ? 'default' : 'muted'} numberOfLines={1} style={[styles.flex, unread && styles.unreadText]}>
            {preview}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
              <Text color="#ffffff" style={styles.badgeText}>
                {unread > 99 ? '99+' : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
        {group && conversation.memberCount ? (
          <Text variant="caption" tone="muted">
            {conversation.memberCount} {conversation.memberCount === 1 ? 'member' : 'members'}
          </Text>
        ) : null}
        {!group && conversation.peer && !conversation.peer.available ? (
          <Text variant="caption" tone="muted">
            No longer available
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

// Thin strip that says when live delivery is not available right now.
export function ConnectionBanner({ connection }) {
  const { colors } = useTheme();
  if (connection === 'online' || connection === 'idle') return null;
  const connecting = connection === 'connecting';
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.banner, { backgroundColor: connecting ? colors.warnSoft : colors.dangerSoft }]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={connecting ? 'sync-outline' : 'cloud-offline-outline'} size={14} color={connecting ? colors.warn : colors.danger} />
      <Text variant="caption" color={connecting ? colors.warn : colors.danger}>
        {connecting ? 'Connecting to live chat…' : 'Offline — messages will arrive when the connection returns'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadText: { fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10.5, lineHeight: 13, fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
});
