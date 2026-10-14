import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SelectField, StackHeader, Text } from '@/components/ui';
import { TravelPlanCard } from '@/features/events/TravelPlan';
import { eventsApi } from '@/features/events/api';
import { useResource } from '@/hooks/useResource';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { formatDate, formatDateTime, joinParts, plural } from '@/utils/format';

const ID_RE = /^[a-f\d]{24}$/i;

function ScheduleRow({ entry }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { doctor, travel } = entry;
  const canOpen = Boolean(doctor.id && !doctor.isAdmin);
  return (
    <Card
      style={styles.row}
      onPress={canOpen ? () => router.push(`/doctors/${doctor.id}`) : undefined}
      accessibilityLabel={`${doctor.name}, from ${travel.from}, arrives ${formatDateTime(travel.arrivalAt)}, leaves ${formatDateTime(travel.departureAt)}`}
    >
      <View style={styles.who}>
        <Avatar uri={doctor.photoUrl} name={doctor.name} size={46} square />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {doctor.name}
            {entry.isMine ? ' (you)' : ''}
          </Text>
          {doctor.specialization ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {doctor.specialization}
              {entry.status === 'MAYBE' ? ' · Maybe' : ''}
            </Text>
          ) : entry.status === 'MAYBE' ? (
            <Text variant="caption" tone="muted">
              Maybe
            </Text>
          ) : null}
          <View style={styles.from}>
            <Ionicons name="navigate-outline" size={13} color={colors.brandInk} />
            <Text variant="smallStrong" style={styles.flex} numberOfLines={2}>
              From {travel.from}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.times}>
        <View style={[styles.time, { backgroundColor: colors.leafSoft }]}>
          <Text variant="caption" color={colors.leafStrong}>
            Arrival
          </Text>
          <Text variant="smallStrong">{formatDateTime(travel.arrivalAt)}</Text>
        </View>
        <View style={[styles.time, { backgroundColor: colors.surface2 }]}>
          <Text variant="caption" tone="muted">
            Departure
          </Text>
          <Text variant="smallStrong">{formatDateTime(travel.departureAt)}</Text>
        </View>
      </View>
      {travel.note ? (
        <Text variant="small" tone="soft">
          {travel.note}
        </Text>
      ) : null}
    </Card>
  );
}

function EventSummary({ event }) {
  const { colors } = useTheme();
  const router = useRouter();
  const address = joinParts([event.address, event.city], ', ');
  const facts = [
    ['calendar-outline', 'When', formatDateTime(event.startsAt)],
    ['business-outline', 'Venue', event.venue || 'To be confirmed'],
    ['location-outline', 'Address', address],
  ];
  return (
    <Card style={styles.summary}>
      <Text variant="h3">{event.title}</Text>
      {facts.map(([icon, label, value]) => (
        <View key={label} style={styles.fact}>
          <View style={[styles.factIcon, { backgroundColor: colors.brandSoft }]}>
            <Ionicons name={icon} size={15} color={colors.brandInk} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" tone="muted">
              {label}
            </Text>
            <Text variant="smallStrong">{value}</Text>
          </View>
        </View>
      ))}
      <Button title="Event details" variant="ghost" size="sm" iconRight="chevron-forward" onPress={() => router.push(`/events/${event.id}`)} style={styles.start} />
    </Card>
  );
}

// Event Schedule: choose an event, see which doctors are coming, from where and
// when they arrive and leave, and add or update your own plan. Opened from the
// header button or from an event (`?event=ID`).
export default function EventScheduleScreen() {
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const requested = ID_RE.test(String(params.event || '')) ? String(params.event) : '';
  const [selected, setSelected] = useState(requested);

  const upcoming = useResource(() => eventsApi.list({ scope: 'upcoming', limit: 30 }), [], { topics: ['events'] });
  const past = useResource(() => eventsApi.list({ scope: 'past', limit: 10 }), [], { topics: ['events'] });
  const listed = [...(upcoming.data || []), ...(past.data || [])];
  const eventId = selected || (listed[0] && listed[0].id) || '';

  const detail = useResource(() => eventsApi.get(eventId), [eventId], { enabled: Boolean(eventId) });
  const schedule = useResource(() => eventsApi.schedule(eventId, { limit: 100 }), [eventId], { enabled: Boolean(eventId) });
  const event = detail.data;
  const rows = schedule.data || [];

  const options = listed.map((e) => ({ value: e.id, label: `${e.title} · ${formatDate(e.startsAt)}${e.isPast ? ' (past)' : ''}` }));
  if (event && !listed.some((e) => e.id === event.id)) options.unshift({ value: event.id, label: event.title });

  const header = <StackHeader title="Event Schedule" subtitle="Who is coming, and when" />;
  const listsLoading = upcoming.status === 'loading' || past.status === 'loading';

  if (!eventId) {
    return (
      <Screen header={header}>
        {listsLoading ? (
          <LoadingState label="Loading events…" />
        ) : upcoming.status === 'error' ? (
          <ErrorState error={upcoming.error} onRetry={upcoming.reload} />
        ) : (
          <EmptyState icon="calendar-outline" title="No events to schedule yet" message="Once a reunion or meetup is planned, members can share when they arrive and leave here." />
        )}
      </Screen>
    );
  }

  const onUpdated = (updated) => {
    detail.setData((e) => ({ ...e, ...updated }));
    schedule.reloadSilently();
  };

  return (
    <Screen header={header} padded={false}>
      <FlatList
        data={event ? rows : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <ScheduleRow entry={item} />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.head}>
            <SelectField label="Event" value={eventId} onChange={(next) => next && setSelected(next)} options={options} placeholder="Choose an event" icon="calendar-outline" searchable={options.length > 8} />
            {detail.status === 'loading' ? (
              <LoadingState label="Loading event…" compact />
            ) : detail.status === 'error' ? (
              <ErrorState error={detail.error} onRetry={detail.reload} compact />
            ) : event ? (
              <>
                <EventSummary event={event} />
                <TravelPlanCard key={event.id} event={event} onUpdated={onUpdated} />
                <Text variant="h3" style={styles.listTitle}>
                  Who is travelling{schedule.meta ? ` · ${plural(schedule.meta.total, 'plan')}` : ''}
                </Text>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !event ? null : schedule.status === 'loading' ? (
            <LoadingState label="Loading schedule…" compact />
          ) : schedule.status === 'error' ? (
            <ErrorState error={schedule.error} onRetry={schedule.reload} compact />
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="No travel schedules yet"
              message={event.isPast ? 'Nobody shared a travel plan for this event.' : 'Nobody has shared when they arrive and leave yet. Add yours above.'}
              compact
            />
          )
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={schedule.refreshing || detail.refreshing}
            onRefresh={() => {
              detail.refresh();
              schedule.refresh();
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
  list: { paddingTop: space.lg, paddingBottom: 40, flexGrow: 1 },
  head: { paddingHorizontal: space.lg, gap: 12, marginBottom: 12 },
  item: { paddingHorizontal: space.lg, marginBottom: 10 },
  listTitle: { marginTop: 4 },
  summary: { gap: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  start: { alignSelf: 'flex-start' },
  row: { gap: 10, padding: 12 },
  who: { flexDirection: 'row', gap: 12 },
  from: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  times: { flexDirection: 'row', gap: 8 },
  time: { flex: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7, gap: 1 },
});
