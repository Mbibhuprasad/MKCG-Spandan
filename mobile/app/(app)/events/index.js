import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Fab } from '@/components/Fab';
import { ChipRow, EmptyState, ErrorState, ListFooter, LoadingState, Screen, StackHeader } from '@/components/ui';
import { EventCard } from '@/features/events/EventCard';
import { eventsApi } from '@/features/events/api';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { EVENT_TYPES } from '@/utils/constants';

const SCOPES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

export default function EventsList() {
  const { colors } = useTheme();
  const router = useRouter();
  const [scope, setScope] = useState('upcoming');
  const [type, setType] = useState('');
  const list = usePagedList((page) => eventsApi.list({ page, limit: 9, scope, type }), [scope, type], { topics: ['events'] });

  return (
    <Screen header={<StackHeader title="Events" subtitle="Reunions, get-togethers and visit plans" />} padded={false}>
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <EventCard event={item} />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.filters}>
            <ChipRow options={SCOPES} value={scope} onChange={(next) => setScope(next || 'upcoming')} />
            <ChipRow options={EVENT_TYPES} value={type} onChange={setType} allLabel="All types" />
          </View>
        }
        ListEmptyComponent={
          list.status === 'loading' ? (
            <LoadingState label="Loading events…" />
          ) : list.status === 'error' ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title={scope === 'past' ? 'No past events' : 'No upcoming events'}
              message={scope === 'past' ? 'Events that have ended are listed here.' : 'Plan a reunion, a dinner or a visit and invite the batch.'}
              actionLabel={scope === 'past' ? undefined : 'Create an event'}
              onAction={() => router.push('/create/event')}
            />
          )
        }
        ListFooterComponent={<ListFooter loading={list.loadingMore} error={list.moreError} onRetry={list.loadMore} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />}
      />
      <Fab icon="calendar" label="New event" onPress={() => router.push('/create/event')} bottom={28} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8, marginBottom: 14 },
  row: { paddingHorizontal: space.lg, marginBottom: 12 },
  list: { paddingTop: space.lg, paddingBottom: 110, flexGrow: 1 },
});
