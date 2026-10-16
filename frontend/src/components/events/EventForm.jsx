'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CalendarClock, Plane, Send } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { EVENT_TYPES } from '@/lib/constants';
import { fromLocalInputValue, toLocalInputValue } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Checkbox, Field, FormMessage, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import { ErrorState, ModerationNotice, PageLoader } from '@/components/ui/Feedback';
import MediaUploader from '@/components/content/MediaUploader';
import { EMPTY_TRAVEL, TravelFields, travelPayload, travelToValues, validateTravel } from './TravelPlan';

const ID_RE = /^[a-f\d]{24}$/i;
const TYPE_VALUES = EVENT_TYPES.map((t) => t.value);

function initialValues(event, presetType) {
  if (!event) {
    return {
      title: '',
      description: '',
      eventType: presetType || 'REUNION',
      venue: '',
      address: '',
      city: '',
      startsAt: '',
      endsAt: '',
      budgetNote: '',
      rsvpEnabled: true,
      rsvpDeadline: '',
      capacity: '',
      showOnPublicSite: false,
    };
  }
  const sameMoment = new Date(event.startsAt).getTime() === new Date(event.endsAt).getTime();
  return {
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    venue: event.venue || '',
    address: event.address || '',
    city: event.city,
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: sameMoment ? '' : toLocalInputValue(event.endsAt),
    budgetNote: event.budgetNote || '',
    rsvpEnabled: event.rsvpEnabled,
    rsvpDeadline: toLocalInputValue(event.rsvpDeadline),
    capacity: event.capacity ? String(event.capacity) : '',
    showOnPublicSite: event.showOnPublicSite,
  };
}

// Mirrors the server rules for quick feedback. The API validates everything again.
function validate(values, { datesChanged }) {
  const errors = {};
  if (values.title.trim().length < 5) errors.title = 'Use a title of at least 5 characters.';
  if (values.description.trim().length < 10) errors.description = 'Describe the plan in at least 10 characters.';
  if (values.city.trim().length < 2) errors.city = 'Enter the city.';

  const start = values.startsAt ? new Date(values.startsAt).getTime() : NaN;
  const end = values.endsAt ? new Date(values.endsAt).getTime() : null;
  const deadline = values.rsvpDeadline ? new Date(values.rsvpDeadline).getTime() : null;

  if (Number.isNaN(start)) errors.startsAt = 'Choose a start date and time.';
  else if (datesChanged && start < Date.now()) errors.startsAt = 'Choose a start time in the future.';
  if (!Number.isNaN(start) && end !== null && (Number.isNaN(end) || end < start)) {
    errors.endsAt = 'The end cannot be before the start.';
  }
  if (!Number.isNaN(start) && deadline !== null && (Number.isNaN(deadline) || deadline > start)) {
    errors.rsvpDeadline = 'The RSVP deadline must be before the start.';
  }
  if (values.capacity !== '') {
    const capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) errors.capacity = 'Enter a whole number of places.';
  }
  return errors;
}

function EventFormInner({ initial, presetType }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);

  const [startValues] = useState(() => initialValues(initial, presetType));
  const [values, setValues] = useState(startValues);
  const [cover, setCover] = useState(initial && initial.cover ? [initial.cover] : []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // The organiser's own attendance and travel plan, saved on their RSVP through
  // PUT /events/:id/schedule once the event itself is saved.
  const savedTravel = (initial && initial.rsvp && initial.rsvp.mine && initial.rsvp.mine.travel) || null;
  const [withTravel, setWithTravel] = useState(Boolean(savedTravel));
  const [travel, setTravel] = useState(() => (savedTravel ? travelToValues(savedTravel) : { ...EMPTY_TRAVEL }));
  const [travelErrors, setTravelErrors] = useState({});

  const isVisit = values.eventType === 'VISIT_PLAN';
  const noun = isVisit ? 'visit plan' : 'event';

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || uploading) return;

    // When editing, unchanged dates are not re-sent, so a plan that has already
    // started can still have its other details corrected.
    const datesChanged = !isEdit || values.startsAt !== startValues.startsAt || values.endsAt !== startValues.endsAt;

    const fieldErrors = validate(values, { datesChanged });
    const travelFound = withTravel
      ? validateTravel(travel)
      : {};
    setErrors(fieldErrors);
    setTravelErrors(travelFound);
    setMessage('');
    if (Object.keys(fieldErrors).length || Object.keys(travelFound).length) {
      setMessage('Please check the highlighted fields.');
      return;
    }

    const body = {
      title: values.title,
      description: values.description,
      eventType: values.eventType,
      venue: values.venue,
      address: values.address,
      city: values.city,
      budgetNote: values.budgetNote,
      coverId: cover[0] ? cover[0].id : null,
      rsvpEnabled: values.rsvpEnabled,
      rsvpDeadline: values.rsvpEnabled ? fromLocalInputValue(values.rsvpDeadline) : null,
      capacity: values.capacity === '' ? null : Number(values.capacity),
      showOnPublicSite: values.showOnPublicSite,
    };
    if (datesChanged) {
      body.startsAt = fromLocalInputValue(values.startsAt);
      body.endsAt = fromLocalInputValue(values.endsAt);
    }

    setBusy(true);
    try {
      const { data } = isEdit ? await api.patch(`/events/${initial.id}`, body) : await api.post('/events', body);
      const label = isVisit ? 'Visit plan' : 'Event';
      toast.success(isEdit ? 'Changes saved.' : `${label} published. Members can see it now.`);
      // The event is saved either way; a travel plan the API refuses can be
      // corrected on the event page, which has the same form.
      try {
        if (withTravel) await api.put(`/events/${data.id}/schedule`, travelPayload(travel));
        else if (savedTravel) await api.delete(`/events/${data.id}/schedule`);
      } catch (travelError) {
        toast.error(`Your travel plan was not saved: ${travelError.message}`);
      }
      router.push(`/events/${data.id}`);
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/create" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-fg">
        {isEdit ? `Edit ${noun}` : isVisit ? 'Share a visit plan' : 'Propose an event'}
      </h1>
      <p className="mt-2 text-fg-soft">
        {isVisit
          ? 'Travelling to another city? Tell Friends there when you will be around so you can meet.'
          : 'Plan a reunion, get-together, dinner or meetup and let the Friends RSVP.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="card mt-6 space-y-5 p-5 sm:p-7">
        {isEdit && <ModerationNotice moderation={initial.moderation} />}
        <FormMessage>{message}</FormMessage>

        {isVisit && (
          <div className="flex items-start gap-3 rounded-xl border border-leaf/25 bg-leaf-soft px-4 py-3 text-sm text-leaf-strong">
            <Plane className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Sharing a visit plan is entirely voluntary. Only the city and dates you type here are shared with members —
              MKCGSPANDAN never tracks your location.
            </p>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[1fr_15rem]">
          <TextField
            label="Title"
            name="title"
            value={values.title}
            onChange={set('title')}
            error={errors.title}
            placeholder={isVisit ? 'e.g. In Bengaluru for a conference — dinner?' : 'e.g. Silver jubilee batch reunion'}
            maxLength={140}
            required
          />
          <SelectField label="Type" name="eventType" value={values.eventType} onChange={set('eventType')} error={errors.eventType} required>
            {EVENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <TextAreaField
          label={isVisit ? 'Your plans' : 'Description'}
          name="description"
          rows={6}
          value={values.description}
          onChange={set('description')}
          error={errors.description}
          placeholder={
            isVisit
              ? 'Why you are visiting, when you are free and who you would love to meet'
              : 'What is planned, who it is for, and anything attendees should know'
          }
          maxLength={4000}
          required
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={isVisit ? 'City you are visiting' : 'City'}
            name="city"
            value={values.city}
            onChange={set('city')}
            error={errors.city}
            placeholder="e.g. Bhubaneswar"
            maxLength={80}
            required
          />
          <TextField
            label={isVisit ? 'Area or place to meet' : 'Venue name'}
            name="venue"
            value={values.venue}
            onChange={set('venue')}
            error={errors.venue}
            placeholder={isVisit ? 'e.g. Near Indiranagar' : 'e.g. College auditorium'}
            maxLength={200}
            optional
          />
        </div>

        {!isVisit && (
          <TextField
            label="Venue address"
            name="address"
            value={values.address}
            onChange={set('address')}
            error={errors.address}
            placeholder="e.g. MKCG Medical College, Ganjam Road, Berhampur 760004"
            hint="The full address shown on the Event Schedule. The city above is added after it."
            maxLength={300}
            optional
          />
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={isVisit ? 'Arriving' : 'Starts'}
            name="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={set('startsAt')}
            error={errors.startsAt}
            hint="In your local time."
            required
          />
          <TextField
            label={isVisit ? 'Leaving' : 'Ends'}
            name="endsAt"
            type="datetime-local"
            min={values.startsAt || undefined}
            value={values.endsAt}
            onChange={set('endsAt')}
            error={errors.endsAt}
            optional
          />
        </div>

        <TextField
          label="Proposed budget"
          name="budgetNote"
          value={values.budgetNote}
          onChange={set('budgetNote')}
          error={errors.budgetNote}
          placeholder="e.g. Around ₹2,000 per person"
          hint="A note for attendees only — no payments are collected here."
          maxLength={140}
          optional
        />

        <Field
          label="Cover image"
          error={errors.coverId}
          hint="One photo for the top of the page. Visible to members only."
          optional
        >
          {(props) => (
            <div id={props.id} aria-describedby={props['aria-describedby']} className="max-w-sm">
              <MediaUploader
                purpose="event"
                value={cover}
                onChange={setCover}
                max={1}
                label="Add a cover image"
                onBusyChange={setUploading}
              />
            </div>
          )}
        </Field>

        <fieldset className="space-y-4 rounded-xl border border-line p-4">
          <legend className="px-1.5 text-sm font-bold text-fg">RSVPs</legend>
          <Checkbox
            checked={values.rsvpEnabled}
            onChange={set('rsvpEnabled')}
            label="Let members RSVP"
            description={`Members can answer Going, Maybe or Can't go and see who else is ${isVisit ? 'meeting up' : 'coming'}.`}
          />
          {values.rsvpEnabled && (
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="RSVP deadline"
                name="rsvpDeadline"
                type="datetime-local"
                max={values.startsAt || undefined}
                value={values.rsvpDeadline}
                onChange={set('rsvpDeadline')}
                error={errors.rsvpDeadline}
                optional
              />
              <TextField
                label="Capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={values.capacity}
                onChange={set('capacity')}
                error={errors.capacity}
                hint="Total places, including guests."
                placeholder="No limit"
                optional
              />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-line p-4">
          <legend className="flex items-center gap-1.5 px-1.5 text-sm font-bold text-fg">
            <CalendarClock className="h-4 w-4 text-brand-ink" aria-hidden="true" />
            Your attendance and travel
          </legend>
          <Checkbox
            checked={withTravel}
            onChange={(e) => {
              setWithTravel(e.target.checked);
              setTravelErrors({});
            }}
            label={savedTravel ? 'Keep my travel plan on the Event Schedule' : 'I am attending — add my arrival and departure'}
            description={`Friends see where you travel from and when you arrive and leave on the Event Schedule. The venue comes from this ${noun}. You can change it later.`}
          />
          {withTravel && (
            <TravelFields
              values={travel}
              errors={travelErrors}
              onChange={(key, value) => {
                setTravel((t) => ({ ...t, [key]: value }));
                if (travelErrors[key]) setTravelErrors((e) => ({ ...e, [key]: undefined }));
              }}
              idPrefix="organiser-travel"
            />
          )}
        </fieldset>

        <Checkbox
          checked={values.showOnPublicSite}
          onChange={set('showOnPublicSite')}
          error={errors.showOnPublicSite}
          label="Mention this on the public homepage"
          description={`If ticked, visitors who are not signed in can see only the title, type, city and dates of this ${noun}. The description, venue, budget, cover image and attendee list always stay members-only.`}
        />

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted">
            {isEdit
              ? 'Your changes are visible to members as soon as you save.'
              : `Your ${noun} is published to members as soon as you save it, and they are notified.`}
          </p>
          <div className="flex shrink-0 gap-3">
            <Button href="/dashboard/submissions" variant="secondary">
              Cancel
            </Button>
            <Button type="submit" icon={Send} loading={busy} disabled={uploading}>
              {uploading ? 'Uploading…' : isEdit ? 'Save changes' : 'Publish'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Create an event or visit plan (?type=VISIT_PLAN), or edit your own with ?edit=ID. */
export default function EventForm() {
  const params = useSearchParams();
  const editParam = params.get('edit') || '';
  const editId = ID_RE.test(editParam) ? editParam : '';
  const typeParam = params.get('type') || '';
  const presetType = TYPE_VALUES.includes(typeParam) ? typeParam : '';

  const existing = useApi(editId ? `/events/${editId}` : null, undefined, { enabled: Boolean(editId) });

  if (editParam && !editId) {
    return <ErrorState title="This event could not be found" message="The link you followed is not valid." />;
  }
  // Keyed by the preset type so switching between "event" and "visit plan" links starts a fresh form.
  if (!editId) return <EventFormInner key={presetType || 'new'} initial={null} presetType={presetType} />;

  if (existing.error) {
    return (
      <ErrorState
        title="This event could not be opened"
        message={existing.error.status === 404 ? 'It may have been deleted.' : existing.error.message}
        onRetry={existing.error.status === 404 ? undefined : existing.reload}
      />
    );
  }
  if (!existing.data || existing.data.id !== editId) return <PageLoader label="Loading your event…" />;
  if (!existing.data.isMine) {
    return <ErrorState title="You can only edit your own events" message="This was organised by another member." />;
  }
  return <EventFormInner key={existing.data.id} initial={existing.data} presetType="" />;
}
