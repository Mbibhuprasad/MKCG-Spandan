import { useState } from 'react';
import { FormScreen } from '@/components/FormScreen';
import { MediaPicker, mediaState } from '@/components/MediaPicker';
import { Checkbox, DateField, Input, SelectField, SwitchRow, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { fieldErrors, messageOf } from '@/services/api';
import { EVENT_TYPES } from '@/utils/constants';
import { invalidate } from '@/utils/events';
import { eventsApi } from './api';
import { TravelFields } from './TravelPlan';
import { emptyTravel, travelPayload, validateTravel } from './travel';

function validate(form, media) {
  const errors = {};
  if (form.title.trim().length < 5) errors.title = 'Title must be at least 5 characters.';
  if (form.description.trim().length < 10) errors.description = 'Describe the event in at least 10 characters.';
  if (!form.eventType) errors.eventType = 'Choose the kind of event.';
  if (form.city.trim().length < 2) errors.city = 'Enter the city.';
  if (!form.startsAt) errors.startsAt = 'Choose when it starts.';
  else if (form.startsAt.getTime() <= Date.now()) errors.startsAt = 'The start must be in the future.';
  if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) errors.endsAt = 'The end cannot be before the start.';
  if (form.rsvpEnabled && form.rsvpDeadline && form.startsAt && form.rsvpDeadline > form.startsAt) errors.rsvpDeadline = 'The RSVP deadline cannot be after the start.';
  if (form.capacity && !/^\d{1,6}$/.test(form.capacity.trim())) errors.capacity = 'Enter a whole number.';
  if (media.uploading) errors.cover = 'Please wait for the image to finish uploading.';
  else if (media.failed) errors.cover = 'Remove the image that failed, or retry it.';
  return errors;
}

// Saves through POST /events — the same events the website lists. Published
// immediately; only the organiser (or an admin) can change or delete it, which
// the API enforces.
export function EventForm({ onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventType: '',
    city: '',
    venue: '',
    address: '',
    startsAt: null,
    endsAt: null,
    budgetNote: '',
    rsvpEnabled: true,
    rsvpDeadline: null,
    capacity: '',
  });
  const [cover, setCover] = useState([]);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [soon] = useState(() => new Date(Date.now() + 60 * 60 * 1000)); // earliest start offered by the picker
  // The organiser's own attendance and travel plan, saved once the event exists.
  const [withTravel, setWithTravel] = useState(false);
  const [travel, setTravel] = useState(emptyTravel);
  const [travelErrors, setTravelErrors] = useState({});

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    if (busy) return;
    const media = mediaState(cover);
    const found = validate(form, media);
    const travelFound = withTravel ? validateTravel(travel) : {};
    setErrors(found);
    setTravelErrors(travelFound);
    setFailure(null);
    if (Object.keys(found).length || Object.keys(travelFound).length) return;
    setBusy(true);
    try {
      const { data } = await eventsApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        eventType: form.eventType,
        city: form.city.trim(),
        venue: form.venue.trim(),
        address: form.address.trim(),
        startsAt: form.startsAt.toISOString(),
        endsAt: form.endsAt ? form.endsAt.toISOString() : null,
        budgetNote: form.budgetNote.trim(),
        coverId: media.ids[0] || null,
        rsvpEnabled: form.rsvpEnabled,
        rsvpDeadline: form.rsvpEnabled && form.rsvpDeadline ? form.rsvpDeadline.toISOString() : null,
        capacity: form.capacity.trim() ? Number(form.capacity.trim()) : null,
      });
      // The event is saved either way; a refused travel plan can be fixed on the event screen.
      if (withTravel) {
        try {
          await eventsApi.saveTravel(data.id, travelPayload(travel));
        } catch (travelError) {
          toast.error(`Your travel plan was not saved: ${messageOf(travelError)}`);
        }
      }
      invalidate('events');
      toast.success('Your event is published.');
      onDone(data);
    } catch (error) {
      const details = fieldErrors(error);
      setErrors({ ...details, cover: details.coverId });
      setFailure(error);
      setBusy(false);
    }
  };


  return (
    <FormScreen title="Create an event" submitLabel="Publish Event" submitIcon="calendar" onSubmit={submit} busy={busy} failure={failure} note="Events are visible to members as soon as they are published.">
      <Input label="Title" required value={form.title} onChangeText={set('title')} error={errors.title} placeholder="Silver jubilee reunion" maxLength={140} counter />
      <SelectField label="Kind of event" required value={form.eventType} onChange={set('eventType')} options={EVENT_TYPES} placeholder="Choose one" error={errors.eventType} />
      <Input label="Description" required value={form.description} onChangeText={set('description')} error={errors.description} placeholder="What is planned, and who is it for?" multiline rows={4} maxLength={4000} counter />
      <DateField label="Starts" required mode="datetime" value={form.startsAt} onChange={set('startsAt')} minimumDate={soon} error={errors.startsAt} clearable={false} />
      <DateField label="Ends" mode="datetime" value={form.endsAt} onChange={set('endsAt')} minimumDate={form.startsAt || soon} error={errors.endsAt} placeholder="Optional" />
      <Input label="City" required value={form.city} onChangeText={set('city')} error={errors.city} placeholder="Berhampur" maxLength={80} icon="location-outline" />
      <Input label="Venue name" value={form.venue} onChangeText={set('venue')} error={errors.venue} placeholder="Hall or hotel" maxLength={200} />
      <Input label="Venue address" value={form.address} onChangeText={set('address')} error={errors.address} placeholder="Optional — street, area and PIN code" maxLength={300} icon="map-outline" />
      <Input label="Budget" value={form.budgetNote} onChangeText={set('budgetNote')} error={errors.budgetNote} placeholder="e.g. about ₹2,500 per person" maxLength={140} icon="wallet-outline" />
      <MediaPicker label="Event image" hint="Optional" purpose="event" value={cover} onChange={setCover} max={1} error={errors.cover} />
      <SwitchRow label="Collect RSVPs" description="Members can answer Going, Maybe or Can't go." value={form.rsvpEnabled} onValueChange={set('rsvpEnabled')} icon="checkmark-done-outline" />
      {form.rsvpEnabled ? (
        <>
          <DateField label="RSVP deadline" mode="datetime" value={form.rsvpDeadline} onChange={set('rsvpDeadline')} maximumDate={form.startsAt || undefined} error={errors.rsvpDeadline} placeholder="Optional" />
          <Input label="Capacity" value={form.capacity} onChangeText={set('capacity')} error={errors.capacity} placeholder="Optional — number of places" keyboardType="number-pad" maxLength={6} />
        </>
      ) : null}
      <Checkbox
        checked={withTravel}
        onChange={(next) => {
          setWithTravel(next);
          setTravelErrors({});
        }}
      >
        <Text variant="bodyStrong">I am attending — add my arrival and departure</Text>
        <Text variant="caption" tone="muted">
          Shown on the Event Schedule. The venue comes from this event, and you can change your plan later.
        </Text>
      </Checkbox>
      {withTravel ? (
        <TravelFields
          form={travel}
          errors={travelErrors}
          onChange={(key, value) => {
            setTravel((t) => ({ ...t, [key]: value }));
            if (travelErrors[key]) setTravelErrors((e) => ({ ...e, [key]: undefined }));
          }}
        />
      ) : null}
    </FormScreen>
  );
}
