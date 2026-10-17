import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Banner, Button, Card, DateField, Input, Sheet, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { fieldErrors, messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';
import { invalidate } from '@/utils/events';
import { eventsApi } from './api';
import { emptyTravel, travelPayload, travelToForm, validateTravel } from './travel';

// The doctor's travel plan for an event: the fields, a summary and the card
// with its edit sheet. The rules and conversions live in ./travel.

export function TravelFields({ form, errors = {}, onChange }) {
  return (
    <>
      <Input
        label="Travelling from"
        required
        value={form.travelFrom}
        onChangeText={(v) => onChange('travelFrom', v)}
        error={errors.travelFrom}
        placeholder="Bhubaneswar"
        help="A city or area you choose to share — your location is never tracked."
        maxLength={120}
        icon="navigate-outline"
      />
      <DateField label="Arrival" required mode="datetime" value={form.arrivalAt} onChange={(v) => onChange('arrivalAt', v)} error={errors.arrivalAt} clearable={false} />
      <DateField
        label="Departure"
        required
        mode="datetime"
        value={form.departureAt}
        onChange={(v) => onChange('departureAt', v)}
        minimumDate={form.arrivalAt || undefined}
        error={errors.departureAt}
        clearable={false}
      />
      <Input label="Travel notes" value={form.note} onChangeText={(v) => onChange('note', v)} error={errors.note} placeholder="Optional — e.g. arriving by train" multiline rows={2} maxLength={300} />
    </>
  );
}

function Line({ icon, color, children }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="small" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

export function TravelSummary({ travel }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summary}>
      <Line icon="navigate-outline" color={colors.brandInk}>
        From {travel.from}
      </Line>
      <Line icon="log-in-outline" color={colors.leafStrong}>
        Arrives {formatDateTime(travel.arrivalAt)}
      </Line>
      <Line icon="log-out-outline" color={colors.muted}>
        Leaves {formatDateTime(travel.departureAt)}
      </Line>
      {travel.note ? (
        <Text variant="small" tone="soft">
          {travel.note}
        </Text>
      ) : null}
    </View>
  );
}

// "Your travel plan" card with an edit sheet. `onUpdated` receives the event
// returned by the API (its `rsvp.mine` reflects the change).
export function TravelPlanCard({ event, onUpdated }) {
  const toast = useToast();
  const mine = event.rsvp && event.rsvp.mine;
  const saved = (mine && mine.travel) || null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyTravel);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState('');
  const [openedAt] = useState(() => Date.now());

  const attending = Boolean(mine && mine.status !== 'NOT_GOING');
  const rsvpClosed = !event.rsvpEnabled || (event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < openedAt);
  const closedReason = event.isPast
    ? 'This event has ended.'
    : !attending && !event.isMine && rsvpClosed
      ? 'RSVPs are closed, so new travel plans cannot be added.'
      : '';

  const open = () => {
    setForm(travelToForm(saved));
    setErrors({});
    setFailure('');
    setEditing(true);
  };

  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    if (busy) return;
    const found = validateTravel(form);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length) return;
    setBusy('save');
    try {
      const { data } = await eventsApi.saveTravel(event.id, travelPayload(form));
      onUpdated(data);
      invalidate('events');
      setEditing(false);
      toast.success(saved ? 'Your travel plan was updated.' : 'Your travel plan was added to the schedule.');
    } catch (error) {
      setErrors(fieldErrors(error));
      setFailure(messageOf(error));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    try {
      const { data } = await eventsApi.removeTravel(event.id);
      onUpdated(data);
      invalidate('events');
      toast.success('Your travel plan was removed.');
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy('');
    }
  };

  return (
    <Card style={styles.card}>
      <Text variant="h3">Your travel plan</Text>
      {saved ? (
        <>
          <TravelSummary travel={saved} />
          {!event.isPast ? (
            <View style={styles.actions}>
              <Button
                title="Edit"
                icon="create-outline"
                variant="secondary"
                size="sm"
                onPress={open}
                disabled={Boolean(busy)}
              />
              <Button
                title="Remove"
                icon="trash-outline"
                variant="danger"
                size="sm"
                onPress={remove}
                loading={busy === "remove"}
              />
            </View>
          ) : null}
        </>
      ) : closedReason ? (
        <Banner tone="info" message={closedReason} />
      ) : (
        <>
          <Text variant="small" tone="soft">
            Share where you are travelling from and when you arrive and leave,
            so Friends can plan to meet.
          </Text>
          <Button
            title="Add my travel plan"
            icon="airplane-outline"
            size="sm"
            onPress={open}
            style={styles.start}
          />
        </>
      )}

      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title={saved ? "Edit travel plan" : "Add travel plan"}
        maxHeight="90%"
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {failure ? (
            <Banner tone="danger" message={failure} style={styles.gap} />
          ) : null}
          <TravelFields form={form} errors={errors} onChange={change} />
          {!attending ? (
            <Text variant="caption" tone="muted" style={styles.gap}>
              Saving your plan also marks you as going to this event.
            </Text>
          ) : null}
          <Button
            title={saved ? "Save changes" : "Save my plan"}
            onPress={save}
            loading={busy === "save"}
            full
          />
        </ScrollView>
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 10 },
  summary: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  start: { alignSelf: 'flex-start' },
  sheet: { paddingHorizontal: space.xl, paddingBottom: 12 },
  gap: { marginBottom: 12 },
});
