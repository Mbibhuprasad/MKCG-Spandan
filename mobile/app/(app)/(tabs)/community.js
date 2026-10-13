import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '@/components/AppHeader';
import { Fab } from '@/components/Fab';
import { ChipRow, EmptyState, ErrorState, ListFooter, LoadingState, SegmentedTabs } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { PollCard } from '@/features/community/PollCard';
import { PostCard } from '@/features/community/PostCard';
import { pollsApi, postsApi } from '@/features/community/api';
import { EventCard } from '@/features/events/EventCard';
import { eventsApi } from '@/features/events/api';
import { usePagedList } from '@/hooks/usePagedList';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { POST_TYPES } from '@/utils/constants';
import { invalidate } from '@/utils/events';

const TABS = [
  { key: 'feed', label: 'Posts', icon: 'chatbubbles' },
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'polls', label: 'Polls', icon: 'stats-chart' },
];

function useRefresh(list) {
  const { colors } = useTheme();
  return <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />;
}

function listEmpty(list, loadingLabel, empty) {
  if (list.status === 'loading') return <LoadingState label={loadingLabel} />;
  if (list.status === 'error') return <ErrorState error={list.error} onRetry={list.reload} />;
  return <EmptyState {...empty} />;
}

function Feed() {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState('');
  const list = usePagedList((page) => postsApi.list({ page, limit: 10, type }), [type], { topics: ['posts'] });
  const refreshControl = useRefresh(list);

  const remove = async (post) => {
    try {
      await postsApi.remove(post.id);
      list.removeItem(post.id);
      invalidate('posts');
      toast.success('Post deleted.');
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <PostCard post={item} onChange={(patch) => list.updateItem(item.id, patch)} onDelete={() => remove(item)} />
        </View>
      )}
      ListHeaderComponent={<ChipRow options={POST_TYPES} value={type} onChange={setType} allLabel="All posts" style={styles.chips} />}
      ListEmptyComponent={listEmpty(list, 'Loading posts…', {
        icon: 'chatbubbles-outline',
        title: type ? 'No posts of this kind yet' : 'Nothing posted yet',
        message: 'Share an update, an achievement or a reunion plan with the community.',
        actionLabel: 'Write a post',
        onAction: () => router.push('/create/post'),
      })}
      ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    />
  );
}

function Events() {
  const router = useRouter();
  const [scope, setScope] = useState('upcoming');
  const list = usePagedList((page) => eventsApi.list({ page, limit: 9, scope }), [scope], { topics: ['events'] });
  const refreshControl = useRefresh(list);
  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <EventCard event={item} />
        </View>
      )}
      ListHeaderComponent={
        <ChipRow
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          value={scope}
          onChange={(next) => setScope(next || 'upcoming')}
          style={styles.chips}
        />
      }
      ListEmptyComponent={listEmpty(list, 'Loading events…', {
        icon: 'calendar-outline',
        title: scope === 'past' ? 'No past events' : 'No upcoming events',
        message: scope === 'past' ? 'Events that have ended are listed here.' : 'Plan a reunion, a dinner or a visit and invite the batch.',
        actionLabel: scope === 'past' ? undefined : 'Create an event',
        onAction: () => router.push('/create/event'),
      })}
      ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    />
  );
}

function Polls() {
  const list = usePagedList((page) => pollsApi.list({ page, limit: 10, state: 'all' }), [], { topics: ['polls'] });
  const refreshControl = useRefresh(list);
  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <PollCard poll={item} onChange={(next) => list.updateItem(item.id, next)} />
        </View>
      )}
      ListEmptyComponent={listEmpty(list, 'Loading polls…', {
        icon: 'stats-chart-outline',
        title: 'No polls yet',
        message: 'Polls created by members appear here, and you can vote from the app.',
      })}
      ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    />
  );
}

export default function Community() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState('feed');
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppHeader title="Community">
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} style={styles.tabs} />
      </AppHeader>
      {tab === 'feed' ? <Feed /> : tab === 'events' ? <Events /> : <Polls />}
      {tab === 'feed' ? <Fab icon="create" label="New post" onPress={() => router.push('/create/post')} /> : null}
      {tab === 'events' ? <Fab icon="calendar" label="New event" onPress={() => router.push('/create/event')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { marginTop: 10 },
  chips: { marginBottom: 14 },
  row: { paddingHorizontal: space.lg, marginBottom: 14 },
  listContent: { paddingTop: space.lg, paddingBottom: 96, flexGrow: 1 },
});
