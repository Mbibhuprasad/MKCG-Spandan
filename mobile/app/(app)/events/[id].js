import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Banner, Button, Card, ErrorState, LoadingState, PressableScale, Screen, StackHeader, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { Comments, ContentMenu } from '@/features/community/Interactions';
import { AuthorLine } from '@/features/community/PostCard';
import { TravelPlanCard } from '@/features/events/TravelPlan';
import { eventsApi } from '@/features/events/api';
import { useResource } from '@/hooks/useResource';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { EVENT_TYPES, RSVP_OPTIONS } from '@/utils/constants';
import { invalidate } from '@/utils/events';
import { formatDate, formatDateTime, joinParts, labelOf, plural } from '@/utils/format';

function Fact({ icon, label, value }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <View style={[styles.factIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={16} color={colors.brandInk} />
      </View>
      <View style={styles.flex}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const res = useResource(() => eventsApi.get(String(id)), [id]);
  const attendees = useResource(() => eventsApi.attendees(String(id), { limit: 30 }), [id]);
  const [busy, setBusy] = useState('');
  const [openedAt] = useState(() => Date.now());
  const event = res.data;

  const remove = async () => {
    try {
      await eventsApi.remove(event.id);
      invalidate('events');
      toast.success('Event deleted.');
      router.back();
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  // One RSVP per member; choosing the current answer again withdraws it.
  const answer = async (status) => {
    if (busy) return;
    setBusy(status);
    try {
      const current = event.rsvp.mine && event.rsvp.mine.status;
      const { data } = current === status ? await eventsApi.cancelRsvp(event.id) : await eventsApi.rsvp(event.id, status, 0);
      res.setData((e) => ({ ...e, ...data }));
      attendees.reloadSilently();
      invalidate('events');
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy('');
    }
  };

  const header = (
    <StackHeader
      title="Event"
      right={event ? <ContentMenu targetType="event" targetId={event.id} isMine={event.isMine} onDelete={remove} label="event" /> : null}
    />
  );
  if (res.status !== 'ready') {
    return (
      <Screen header={header}>{res.status === 'loading' ? <LoadingState label="Loading event…" /> : <ErrorState error={res.error} onRetry={res.reload} />}</Screen>
    );
  }

  const mine = event.rsvp.mine;
  const deadlinePassed = event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < openedAt;
  const rsvpOpen = event.rsvpEnabled && !event.isPast && !deadlinePassed;
  const people = attendees.data || [];

  return (
    <Screen header={header} scroll padded={false} keyboard refreshing={res.refreshing} onRefresh={res.refresh}>
      {event.cover ? (
        <Image source={{ uri: event.cover.url }} placeholder={{ uri: event.cover.thumbUrl }} style={styles.cover} contentFit="cover" transition={250} accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, styles.noCover]}>
          <Ionicons name="calendar" size={40} color="rgba(255,255,255,0.8)" />
        </LinearGradient>
      )}
      <View style={styles.body}>
        <Text variant="eyebrow" tone="leaf">
          {labelOf(EVENT_TYPES, event.eventType)}
          {event.isPast ? ' · Ended' : ''}
        </Text>
        <Text variant="display" accessibilityRole="header">
          {event.title}
        </Text>

        <Card style={styles.facts}>
          <Fact icon="time-outline" label="Starts" value={formatDateTime(event.startsAt)} />
          <Fact icon="flag-outline" label="Ends" value={event.endsAt && event.endsAt !== event.startsAt ? formatDateTime(event.endsAt) : ''} />
          <Fact icon="location-outline" label="Where" value={joinParts([event.venue, event.address, event.city], ', ')} />
          <Fact icon="wallet-outline" label="Budget" value={event.budgetNote} />
          <Fact icon="people-outline" label="Capacity" value={event.capacity ? plural(event.capacity, 'place') : ''} />
        </Card>

        <Text variant="caption" tone="muted">
          Organised by
        </Text>
        <AuthorLine author={event.organizer} date={event.publishedAt || event.createdAt} />

        <Text tone="soft" selectable>
          {event.description}
        </Text>

        {/* RSVP */}
        {event.rsvpEnabled ? (
          <Card style={styles.rsvp}>
            <View style={styles.rsvpHead}>
              <Text variant="h3" style={styles.flex}>
                Will you be there?
              </Text>
              <Text variant="caption" tone="muted">
                {event.rsvp.going} going · {event.rsvp.maybe} maybe
              </Text>
            </View>
            {rsvpOpen ? (
              <View style={styles.options}>
                {RSVP_OPTIONS.map((option) => {
                  const selected = mine && mine.status === option.value;
                  return (
                    <PressableScale
                      key={option.value}
                      onPress={() => answer(option.value)}
                      disabled={Boolean(busy)}
                      style={[
                        styles.option,
                        { borderColor: selected ? colors.leaf : colors.line, backgroundColor: selected ? colors.leafSoft : colors.bgSoft },
                        busy && busy !== option.value && styles.dim,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: Boolean(selected) }}
                      accessibilityLabel={`${option.label}${selected ? ', selected. Tap to withdraw' : ''}`}
                    >
                      <Ionicons name={selected ? option.icon : `${option.icon}-outline`} size={20} color={selected ? colors.leafStrong : colors.muted} />
                      <Text variant="smallStrong" color={selected ? colors.leafStrong : colors.fgSoft}>
                        {option.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : (
              <Banner tone="info" message={event.isPast ? 'This event has ended.' : 'The RSVP deadline has passed.'} />
            )}
            {event.rsvpDeadline && rsvpOpen ? (
              <Text variant="caption" tone="muted">
                Please answer by {formatDate(event.rsvpDeadline)}. Tap your answer again to withdraw it.
              </Text>
            ) : null}
            {people.length ? (
              <View style={styles.attendees}>
                {people.map((row) => (
                  <View key={`${row.doctor.id}-${row.status}`} style={styles.attendee}>
                    <Avatar uri={row.doctor.photoUrl} name={row.doctor.name} size={30} />
                    <Text variant="small" style={styles.flex} numberOfLines={1}>
                      {row.doctor.name}
                      {row.guests ? ` +${row.guests}` : ''}
                    </Text>
                    <Text variant="caption" tone={row.status === 'GOING' ? 'leaf' : 'muted'}>
                      {labelOf(RSVP_OPTIONS, row.status)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : (
          <Banner tone="info" message="The organiser is not collecting RSVPs for this event." />
        )}

        {/* Travel plan and the event's schedule */}
        <TravelPlanCard
          key={`travel-${event.id}`}
          event={event}
          onUpdated={(data) => {
            res.setData((e) => ({ ...e, ...data }));
            attendees.reloadSilently();
          }}
        />
        <Button title="View the event schedule" icon="time-outline" variant="secondary" onPress={() => router.push(`/events/schedule?event=${event.id}`)} full />

        <Comments targetType="event" targetId={event.id} onCountChange={(delta) => res.setData((e) => ({ ...e, commentCount: Math.max(0, e.commentCount + delta) }))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { width: '100%', aspectRatio: 16 / 8 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 12 },
  facts: { gap: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rsvp: { gap: 12 },
  rsvpHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1 },
  dim: { opacity: 0.5 },
  attendees: { gap: 8, marginTop: 4 },
  attendee: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
