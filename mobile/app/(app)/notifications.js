import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, EmptyState, ErrorState, ListFooter, LoadingState, PressableScale, Screen, StackHeader, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/features/notifications/NotificationsContext';
import { notificationsApi } from '@/features/notifications/api';
import { routeForLink } from '@/features/notifications/links';
import { usePagedList } from '@/hooks/usePagedList';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { timeAgo } from '@/utils/format';

const ICONS = {
  WELCOME: 'sparkles',
  CONTENT_REMOVED: 'trash',
  EVENT_PUBLISHED: 'calendar',
  POLL_PUBLISHED: 'stats-chart',
  EVENT_REMINDER: 'alarm',
  NEW_COMMENT: 'chatbubble',
  ACCOUNT_STATUS: 'shield',
};

// The doctor's own in-app notifications (GET /notifications).
export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { unreadCount, setUnreadCount, refreshUnread } = useNotifications();
  const list = usePagedList((page) => notificationsApi.list({ page, limit: 15 }), []);

  const open = async (item) => {
    if (!item.read) {
      list.updateItem(item.id, { read: true });
      setUnreadCount((count) => Math.max(0, count - 1));
      notificationsApi.markRead(item.id).catch(() => refreshUnread());
    }
    const route = routeForLink(item.link);
    if (route) router.push(route);
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      list.setItems((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  return (
    <Screen
      header={<StackHeader title="Notifications" subtitle={unreadCount ? `${unreadCount} unread` : 'All caught up'} right={unreadCount ? <Button title="Mark all read" size="sm" variant="ghost" onPress={markAll} /> : null} />}
      padded={false}
    >
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => open(item)}
            scaleTo={0.985}
            style={[styles.row, { borderBottomColor: colors.line, backgroundColor: item.read ? 'transparent' : colors.bgSoft }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.message}`}
          >
            <View style={[styles.icon, { backgroundColor: item.read ? colors.surface2 : colors.brandSoft }]}>
              <Ionicons name={ICONS[item.type] || 'notifications'} size={18} color={item.read ? colors.muted : colors.brandInk} />
            </View>
            <View style={styles.flex}>
              <Text variant={item.read ? 'body' : 'bodyStrong'}>{item.title}</Text>
              {item.message ? (
                <Text variant="small" tone="muted">
                  {item.message}
                </Text>
              ) : null}
              <Text variant="caption" tone="muted" style={styles.time}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>
            {!item.read ? <View style={[styles.dot, { backgroundColor: colors.leaf }]} /> : null}
          </PressableScale>
        )}
        ListEmptyComponent={
          list.status === 'loading' ? (
            <LoadingState label="Loading notifications…" />
          ) : list.status === 'error' ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="notifications-off-outline" title="No notifications yet" message="Event reminders, new events and polls, and news about your account appear here." />
          )
        }
        ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={() => {
              list.refresh();
              refreshUnread();
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  time: { marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
});
