import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { EVENT_TYPES, RSVP_OPTIONS } from '@/utils/constants';
import { dateParts, formatTime, joinParts, labelOf, plural } from '@/utils/format';

// "Going", "Maybe", "Can't go", or an invitation to answer.
export function rsvpLabel(event) {
  if (!event.rsvpEnabled) return 'No RSVP needed';
  if (event.rsvp.mine) return `You: ${labelOf(RSVP_OPTIONS, event.rsvp.mine.status)}`;
  return event.isPast ? 'No response' : 'RSVP open';
}

export function EventCard({ event, width, style }) {
  const { colors } = useTheme();
  const router = useRouter();
  const date = dateParts(event.startsAt);
  const mine = event.rsvp.mine;
  const going = mine && mine.status === 'GOING';

  return (
    <Card onPress={() => router.push(`/events/${event.id}`)} style={[styles.card, width ? { width } : null, style]} accessibilityLabel={`View event: ${event.title}`}>
      <View style={[styles.date, { backgroundColor: colors.brandSoft }]}>
        <Text variant="caption" tone="brand" style={styles.month}>
          {date ? date.month.toUpperCase() : ''}
        </Text>
        <Text variant="h1" tone="brand">
          {date ? date.day : ''}
        </Text>
        <Text variant="caption" tone="muted">
          {date ? date.weekday : ''}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text variant="eyebrow" tone="leaf" numberOfLines={1}>
          {labelOf(EVENT_TYPES, event.eventType)}
        </Text>
        <Text variant="h3" numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {formatTime(event.startsAt)}
            {date ? ` · ${date.year}` : ''}
          </Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {joinParts([event.venue, event.city], ', ')}
          </Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="person-outline" size={13} color={colors.muted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            Organised by {event.organizer.name}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={[styles.rsvp, { backgroundColor: going ? colors.leafSoft : colors.surface2 }]}>
            <Ionicons name={going ? 'checkmark-circle' : 'calendar-outline'} size={12} color={going ? colors.leafStrong : colors.fgSoft} />
            <Text variant="caption" color={going ? colors.leafStrong : colors.fgSoft}>
              {rsvpLabel(event)}
            </Text>
          </View>
          {event.rsvpEnabled && event.rsvp.attending ? (
            <Text variant="caption" tone="muted">
              {plural(event.rsvp.attending, 'person', 'people')} going
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', gap: 12, padding: 12 },
  date: { width: 62, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, alignSelf: 'flex-start' },
  month: { fontWeight: '800', letterSpacing: 0.8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  rsvp: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 23, borderRadius: 12 },
});
