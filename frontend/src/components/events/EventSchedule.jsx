'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarClock, CalendarDays, MapPin, PlaneLanding, PlaneTakeoff, Stethoscope } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { cn, formatDateRange, formatDateTime, plural } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { SelectField } from '@/components/ui/Form';
import { Badge, CardSkeletons, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import TravelPlanPanel from './TravelPlan';

const ID_RE = /^[a-f\d]{24}$/i;
const PAGE_SIZE = 50;

/** One doctor on the schedule: who, from where, arriving and leaving when. */
function ScheduleRow({ entry }) {
  const { doctor, travel } = entry;
  const profileHref = doctor.id && !doctor.isAdmin ? `/doctors/${doctor.id}` : null;
  return (
    <li className="card p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar name={doctor.name} src={doctor.photoUrl} size="md" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {profileHref ? (
                <Link href={profileHref} className="break-words font-bold text-fg hover:text-brand-ink hover:underline">
                  {doctor.name}
                </Link>
              ) : (
                <span className="break-words font-bold text-fg">{doctor.name}</span>
              )}
              {entry.isMine && <Badge tone="brand">You</Badge>}
              {entry.status === 'MAYBE' && <Badge>Maybe</Badge>}
            </p>
            {doctor.specialization && (
              <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-fg-soft">
                <Stethoscope className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden="true" />
                <span className="truncate">{doctor.specialization}</span>
              </p>
            )}
            <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-fg">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden="true" />
              <span className="min-w-0 break-words">From {travel.from}</span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-leaf-soft/60 px-3.5 py-2.5">
          <PlaneLanding className="mt-0.5 h-4 w-4 shrink-0 text-leaf-strong" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-leaf-strong">Arrival</p>
            <p className="text-sm font-semibold text-fg">{formatDateTime(travel.arrivalAt)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5">
          <PlaneTakeoff className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">Departure</p>
            <p className="text-sm font-semibold text-fg">{formatDateTime(travel.departureAt)}</p>
          </div>
        </div>
      </div>
      {travel.note && (
        <p className="mt-3 whitespace-pre-line break-words border-t border-line pt-3 text-sm text-fg-soft">{travel.note}</p>
      )}
    </li>
  );
}

/** Venue and dates of the chosen event — the event itself is the source of truth. */
function EventSummary({ event }) {
  const address = [event.address, event.city].filter(Boolean).join(', ');
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="schedule-event-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="schedule-event-title" className="break-words text-xl font-bold text-fg">
            {event.title}
          </h2>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-fg-soft">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
            {formatDateRange(event.startsAt, event.endsAt)} · starts {formatDateTime(event.startsAt)}
          </p>
        </div>
        <Button href={`/events/${event.id}`} variant="secondary" size="sm" iconRight={ArrowRight} className="self-start">
          Event details
        </Button>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Building2 className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Venue</dt>
            <dd className="mt-0.5 break-words font-medium text-fg">{event.venue || 'To be confirmed'}</dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <MapPin className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Address</dt>
            <dd className="mt-0.5 break-words font-medium text-fg">{address}</dd>
          </div>
        </div>
      </dl>
    </section>
  );
}

/**
 * Event Schedule (/events/schedule): pick an event, see which doctors are
 * coming, from where and when they arrive and leave, and add or update your
 * own plan. Rendered inside <MemberGate>. `?event=ID` opens a given event.
 */
export default function EventSchedule() {
  const params = useSearchParams();
  const requested = ID_RE.test(params.get('event') || '') ? params.get('event') : '';
  const [selectedId, setSelectedId] = useState(requested);
  const [page, setPage] = useState(1);

  const upcoming = useApi('/events', { scope: 'upcoming', limit: 30 });
  const past = useApi('/events', { scope: 'past', limit: 10 });
  const options = useMemo(() => [...(upcoming.data || []), ...(past.data || [])], [upcoming.data, past.data]);

  // Without a choice, the next upcoming event (or else the most recent one).
  const fallbackId = options.length ? options[0].id : '';
  const eventId = selectedId || fallbackId;
  const listed = options.find((e) => e.id === eventId) || null;

  // The chosen event is always loaded on its own: an event opened by link may
  // not be among the listed ones, and the panel needs the freshest RSVP state.
  const detail = useApi(eventId ? `/events/${eventId}` : null, undefined, { enabled: Boolean(eventId) });
  const event = detail.data && detail.data.id === eventId ? detail.data : null;
  const schedule = useApi(
    eventId ? `/events/${eventId}/schedule` : null,
    { page, limit: PAGE_SIZE },
    { enabled: Boolean(eventId) }
  );
  const rows = schedule.data || [];

  useEffect(() => {
    if (!eventId) return;
    window.history.replaceState(null, '', `/events/schedule?event=${eventId}`);
  }, [eventId]);

  // A saved or removed plan comes back on the event; the list is read again.
  function handleUpdated(updated) {
    detail.setData((current) => ({ ...current, ...updated, memoryCount: current.memoryCount }));
    schedule.reload();
  }

  function choose(nextId) {
    setSelectedId(nextId);
    setPage(1);
  }

  const listsLoading = (upcoming.loading && !upcoming.data) || (past.loading && !past.data);
  const listsError = upcoming.error || past.error;

  if (listsLoading && !requested) {
    return (
      <div className="container-page space-y-5 py-8 sm:py-10" role="status" aria-label="Loading events">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <CardSkeletons count={3} className="space-y-4" height="h-28" />
      </div>
    );
  }
  if (listsError && !requested) {
    return (
      <div className="container-page py-8 sm:py-10">
        <ErrorState
          title="Events could not be loaded"
          message={listsError.message}
          onRetry={() => {
            upcoming.reload();
            past.reload();
          }}
        />
      </div>
    );
  }
  if (!eventId) {
    return (
      <div className="container-page py-8 sm:py-10">
        <EmptyState
          icon={CalendarClock}
          title="No events to schedule yet"
          description="Once a reunion, dinner or meetup is planned, members can share when they arrive and leave here."
          action={<Button href="/dashboard/create/event">Propose an event</Button>}
        />
      </div>
    );
  }

  const upcomingList = upcoming.data || [];
  const pastList = past.data || [];
  const unlisted = !listed && event ? event : null;

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="card p-4 sm:p-5">
        <SelectField
          label="Event"
          name="schedule-event"
          value={eventId}
          onChange={(e) => choose(e.target.value)}
          hint="Choose an event to see who is coming and when."
        >
          {unlisted && <option value={unlisted.id}>{unlisted.title}</option>}
          {!listed && !unlisted && <option value={eventId}>Loading…</option>}
          {upcomingList.length > 0 && (
            <optgroup label="Upcoming">
              {upcomingList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {formatDateRange(item.startsAt, item.endsAt)}
                </option>
              ))}
            </optgroup>
          )}
          {pastList.length > 0 && (
            <optgroup label="Past">
              {pastList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {formatDateRange(item.startsAt, item.endsAt)}
                </option>
              ))}
            </optgroup>
          )}
        </SelectField>
      </div>

      {detail.error ? (
        <ErrorState
          className="mt-6"
          title="This event could not be opened"
          message={detail.error.status === 404 ? 'It may have been removed.' : detail.error.message}
          onRetry={detail.error.status === 404 ? undefined : detail.reload}
        />
      ) : !event ? (
        <div className="mt-6 space-y-4" role="status" aria-label="Loading schedule">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <CardSkeletons count={3} className="space-y-4" height="h-28" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <EventSummary event={event} />

            <section aria-labelledby="schedule-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="schedule-heading" className="text-lg font-bold text-fg">
                  Who is travelling
                </h2>
                {schedule.meta && !schedule.error && (
                  <p className="text-sm text-muted" aria-live="polite">
                    {plural(schedule.meta.total, 'travel plan')}
                  </p>
                )}
              </div>
              <div className="mt-4">
                {schedule.loading && !schedule.data ? (
                  <CardSkeletons count={3} className="space-y-4" height="h-28" />
                ) : schedule.error ? (
                  <ErrorState title="The schedule could not be loaded" message={schedule.error.message} onRetry={schedule.reload} />
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No travel schedules yet"
                    description={
                      event.isPast
                        ? 'Nobody shared a travel plan for this event.'
                        : 'Nobody has shared when they arrive and leave yet. Add yours so Friends can plan to meet.'
                    }
                  />
                ) : (
                  <ul className={cn('space-y-4', schedule.loading && 'opacity-60')} aria-busy={schedule.loading}>
                    {rows.map((entry) => (
                      <ScheduleRow key={entry.id} entry={entry} />
                    ))}
                  </ul>
                )}
              </div>
              {schedule.meta && !schedule.error && schedule.meta.totalPages > 1 && (
                <Pagination page={schedule.meta.page} totalPages={schedule.meta.totalPages} onPageChange={setPage} className="mt-6" />
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <TravelPlanPanel key={event.id} event={event} onUpdated={handleUpdated} />
          </aside>
        </div>
      )}
    </div>
  );
}
