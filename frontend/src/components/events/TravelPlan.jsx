'use client';

import { useState } from 'react';
import { CalendarClock, MapPin, Pencil, PlaneLanding, PlaneTakeoff, Trash2 } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { FormMessage, TextAreaField, TextField } from '@/components/ui/Form';

// A member's own arrival and departure for one event (PUT /events/:id/schedule).
// The plan is stored on their RSVP, so the API only ever writes the signed-in
// member's plan; the venue always comes from the event itself.

export const EMPTY_TRAVEL = { travelFrom: '', arrivalAt: '', departureAt: '', note: '' };

/** The saved plan (`event.rsvp.mine.travel`) → form values. */
export function travelToValues(travel) {
  if (!travel) return { ...EMPTY_TRAVEL };
  return {
    travelFrom: travel.from || '',
    arrivalAt: toLocalInputValue(travel.arrivalAt),
    departureAt: toLocalInputValue(travel.departureAt),
    note: travel.note || '',
  };
}

export const travelPayload = (values) => ({
  travelFrom: values.travelFrom.trim(),
  arrivalAt: fromLocalInputValue(values.arrivalAt),
  departureAt: fromLocalInputValue(values.departureAt),
  note: values.note.trim(),
});

/**
 * Mirrors the API's rules for quick feedback: an origin, both moments, the
 * departure after the arrival, the arrival before the event ends and the
 * departure after it starts. `startsAt`/`endsAt` are ISO strings or datetime-local values.
 */
export function validateTravel(values, { startsAt, endsAt }) {
  const errors = {};
  if (values.travelFrom.trim().length < 2) errors.travelFrom = 'Enter the city or area you are travelling from.';
  const arrival = values.arrivalAt ? new Date(values.arrivalAt).getTime() : NaN;
  const departure = values.departureAt ? new Date(values.departureAt).getTime() : NaN;
  const start = startsAt ? new Date(startsAt).getTime() : NaN;
  const end = endsAt ? new Date(endsAt).getTime() : start;
  if (Number.isNaN(arrival)) errors.arrivalAt = 'Choose your arrival date and time.';
  if (Number.isNaN(departure)) errors.departureAt = 'Choose your departure date and time.';
  if (!errors.arrivalAt && !Number.isNaN(end) && arrival > end) errors.arrivalAt = 'Your arrival must be before the event ends.';
  if (!errors.arrivalAt && !errors.departureAt) {
    if (departure <= arrival) errors.departureAt = 'Departure must be after your arrival.';
    else if (!Number.isNaN(start) && departure < start) errors.departureAt = 'Your departure cannot be before the event starts.';
  }
  return errors;
}

/** The four inputs of a travel plan. */
export function TravelFields({ values, errors = {}, onChange, idPrefix = 'travel' }) {
  const set = (key) => (event) => onChange(key, event.target.value);
  return (
    <div className="space-y-4">
      <TextField
        label="Travelling from"
        name={`${idPrefix}-from`}
        value={values.travelFrom}
        onChange={set('travelFrom')}
        error={errors.travelFrom}
        placeholder="e.g. Bhubaneswar or Salt Lake, Kolkata"
        hint="A city or area you choose to share — your location is never tracked."
        maxLength={120}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Arrival"
          name={`${idPrefix}-arrival`}
          type="datetime-local"
          value={values.arrivalAt}
          onChange={set('arrivalAt')}
          error={errors.arrivalAt}
          hint="In your local time."
          required
        />
        <TextField
          label="Departure"
          name={`${idPrefix}-departure`}
          type="datetime-local"
          min={values.arrivalAt || undefined}
          value={values.departureAt}
          onChange={set('departureAt')}
          error={errors.departureAt}
          required
        />
      </div>
      <TextAreaField
        label="Travel notes"
        name={`${idPrefix}-note`}
        rows={2}
        value={values.note}
        onChange={set('note')}
        error={errors.note}
        placeholder="e.g. Arriving by the Puri Express, happy to share a cab"
        maxLength={300}
        optional
      />
    </div>
  );
}

/** Arrival/departure facts of a saved plan. */
export function TravelSummary({ travel, className }) {
  return (
    <dl className={className || 'space-y-2 text-sm'}>
      <div className="flex items-start gap-2.5">
        <dt className="sr-only">Travelling from</dt>
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
        <dd className="min-w-0 break-words font-semibold text-fg">From {travel.from}</dd>
      </div>
      <div className="flex items-start gap-2.5">
        <dt className="sr-only">Arrival</dt>
        <PlaneLanding className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
        <dd className="text-fg-soft">
          Arrives <span className="font-semibold text-fg">{formatDateTime(travel.arrivalAt)}</span>
        </dd>
      </div>
      <div className="flex items-start gap-2.5">
        <dt className="sr-only">Departure</dt>
        <PlaneTakeoff className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <dd className="text-fg-soft">
          Leaves <span className="font-semibold text-fg">{formatDateTime(travel.departureAt)}</span>
        </dd>
      </div>
      {travel.note && (
        <div>
          <dt className="sr-only">Travel notes</dt>
          <dd className="whitespace-pre-line break-words rounded-xl bg-surface-2 px-3 py-2 text-fg-soft">{travel.note}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * "Your travel plan" card for one event: shows the member's saved plan with
 * Edit / Remove, or a form to add one. `onUpdated` receives the event returned
 * by the API (its `rsvp` reflects the change).
 */
export default function TravelPlanPanel({ event, onUpdated, className }) {
  const toast = useToast();
  const mine = event.rsvp && event.rsvp.mine;
  const saved = (mine && mine.travel) || null;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => travelToValues(saved));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const approved = !event.moderation || event.moderation.status === 'APPROVED';
  const attending = Boolean(mine && mine.status !== 'NOT_GOING');
  // The organiser may always add their plan; anyone else needs RSVPs to be open.
  const [now] = useState(() => Date.now());
  const rsvpClosed =
    !event.rsvpEnabled || (event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < now);
  let closedReason = '';
  if (!approved) closedReason = 'Travel plans can be added once this event is published.';
  else if (event.isPast) closedReason = 'This event has already taken place.';
  else if (!attending && !event.isMine && rsvpClosed) closedReason = 'RSVPs are closed for this event, so new travel plans cannot be added.';

  function change(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function startEditing() {
    setValues(travelToValues(saved));
    setErrors({});
    setMessage('');
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const found = validateTravel(values, event);
    setErrors(found);
    setMessage('');
    if (Object.keys(found).length) return;
    setBusy('save');
    try {
      const { data } = await api.put(`/events/${event.id}/schedule`, travelPayload(values));
      onUpdated(data);
      setEditing(false);
      toast.success(saved ? 'Your travel plan was updated.' : 'Your travel plan was added to the schedule.');
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (busy) return;
    setBusy('remove');
    setMessage('');
    try {
      const { data } = await api.delete(`/events/${event.id}/schedule`);
      onUpdated(data);
      setValues({ ...EMPTY_TRAVEL });
      toast.success('Your travel plan was removed. Your RSVP is unchanged.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className={className || 'card p-5'} aria-labelledby={`travel-heading-${event.id}`}>
      <h2 id={`travel-heading-${event.id}`} className="flex items-center gap-2 text-base font-bold text-fg">
        <CalendarClock className="h-4 w-4 text-brand-ink" aria-hidden="true" />
        Your travel plan
      </h2>

      {editing ? (
        <form onSubmit={save} noValidate className="mt-4 space-y-4">
          <FormMessage>{message}</FormMessage>
          <TravelFields values={values} errors={errors} onChange={change} idPrefix={`travel-${event.id}`} />
          {!attending && (
            <p className="text-xs leading-relaxed text-muted">Saving your plan also marks you as going to this event.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy === 'save'}>
              {saved ? 'Save changes' : 'Save my plan'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={Boolean(busy)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : saved ? (
        <div className="mt-4 space-y-4">
          <TravelSummary travel={saved} />
          <FormMessage>{message}</FormMessage>
          {!event.isPast && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={startEditing} disabled={Boolean(busy)}>
                Edit
              </Button>
              <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={remove} loading={busy === 'remove'}>
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : closedReason ? (
        <p className="mt-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg-soft" role="status">
          {closedReason}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-fg-soft">
            Let batchmates know where you are travelling from and when you arrive and leave, so you can plan to meet.
          </p>
          <Button size="sm" icon={CalendarClock} onClick={startEditing}>
            Add my travel plan
          </Button>
        </div>
      )}
    </section>
  );
}
