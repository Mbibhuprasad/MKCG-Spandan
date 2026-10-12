'use client';

import { useState } from 'react';
import { Check, CircleHelp, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime, plural } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { FormMessage, Select } from '@/components/ui/Form';

const CHOICES = [
  { value: 'GOING', label: 'Going', icon: Check },
  { value: 'MAYBE', label: 'Maybe', icon: CircleHelp },
  { value: 'NOT_GOING', label: "Can't go", icon: X },
];

const CONFIRMATION = {
  GOING: 'You are going. See you there!',
  MAYBE: 'Marked as maybe.',
  NOT_GOING: "Marked as can't go.",
};

/**
 * RSVP controls for one event. The API enforces every rule (one RSVP per
 * member, deadline, capacity); this panel explains why RSVPs are unavailable
 * and shows the API's message when a request is refused.
 */
export default function RsvpPanel({ event, onUpdated }) {
  const toast = useToast();
  const mine = event.rsvp.mine;
  const isVisit = event.eventType === 'VISIT_PLAN';
  const [guests, setGuests] = useState(mine ? mine.guests : 0);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  const approved = !event.moderation || event.moderation.status === 'APPROVED';
  let closedReason = '';
  if (!approved) closedReason = 'RSVPs are not available because this is not published.';
  else if (!event.rsvpEnabled) closedReason = 'The organiser is not collecting RSVPs here.';
  else if (event.isPast) closedReason = 'This has already taken place.';
  else if (event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < now) {
    closedReason = `The RSVP deadline passed on ${formatDateTime(event.rsvpDeadline)}.`;
  }
  const closed = Boolean(closedReason);

  async function send(status, guestCount) {
    if (pending || closed) return;
    setPending(status);
    setError('');
    try {
      const { data } = await api.put(`/events/${event.id}/rsvp`, {
        status,
        guests: status === 'GOING' ? guestCount : 0,
      });
      onUpdated(data);
      toast.success(CONFIRMATION[status]);
    } catch (err) {
      setError(err.message); // e.g. EVENT_FULL or RSVP_CLOSED explanations from the API
    } finally {
      setPending('');
    }
  }

  async function clear() {
    if (pending) return;
    setPending('CLEAR');
    setError('');
    try {
      const { data } = await api.delete(`/events/${event.id}/rsvp`);
      setGuests(0);
      onUpdated(data);
      toast.success('Your RSVP was removed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending('');
    }
  }

  function changeGuests(value) {
    const next = Number(value);
    setGuests(next);
    if (mine && mine.status === 'GOING' && !closed) send('GOING', next);
  }

  const { rsvp } = event;

  return (
    <section className="card p-5" aria-labelledby="rsvp-heading">
      <h2 id="rsvp-heading" className="text-base font-bold text-fg">
        {isVisit ? 'Planning to meet up?' : 'Will you be there?'}
      </h2>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Going', rsvp.going],
          ['Maybe', rsvp.maybe],
          ["Can't go", rsvp.notGoing],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2 px-2 py-2.5">
            <dd className="text-xl font-extrabold text-fg">{value}</dd>
            <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        {plural(rsvp.attending, 'person', 'people')} attending
        {rsvp.guests > 0 ? ` (including ${plural(rsvp.guests, 'guest')})` : ''}
        {event.capacity ? ` · ${event.capacity} places in total` : ''}
      </p>

      {closed ? (
        <p className="mt-4 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg-soft" role="status">
          {closedReason}
          {mine && (
            <span className="mt-1 block font-semibold text-fg">
              Your response: {CHOICES.find((c) => c.value === mine.status)?.label}
              {mine.guests > 0 ? ` (+${mine.guests})` : ''}
            </span>
          )}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Your RSVP">
            {CHOICES.map((choice) => {
              const active = mine && mine.status === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => send(choice.value, guests)}
                  disabled={Boolean(pending)}
                  aria-pressed={Boolean(active)}
                  className={cn(
                    'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition-colors disabled:opacity-60',
                    active
                      ? choice.value === 'NOT_GOING'
                        ? 'border-line-strong bg-surface-2 text-fg'
                        : 'border-leaf bg-leaf text-leaf-fg'
                      : 'border-line-strong bg-surface text-fg hover:bg-surface-2'
                  )}
                >
                  <choice.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {pending === choice.value ? 'Saving…' : choice.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="rsvp-guests" className="text-sm font-medium text-fg-soft">
              Guests coming with you
            </label>
            <Select
              id="rsvp-guests"
              value={guests}
              onChange={(e) => changeGuests(e.target.value)}
              disabled={Boolean(pending)}
              className="!h-10 w-20"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted">
            Guests are counted only when you choose “Going”.
            {event.rsvpDeadline ? ` Please respond by ${formatDateTime(event.rsvpDeadline)}.` : ''}
          </p>

          <FormMessage>{error}</FormMessage>

          {mine && (
            <Button variant="ghost" size="sm" onClick={clear} loading={pending === 'CLEAR'} disabled={Boolean(pending)}>
              Remove my RSVP
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
