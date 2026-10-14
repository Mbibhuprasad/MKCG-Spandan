'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CalendarClock, CalendarDays, Clock, Images, MapPin, Pencil, Plane, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { EVENT_TYPES, labelOf } from '@/lib/constants';
import { formatDateRange, formatDateTime, formatTime, plural } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge, ErrorState, ModerationNotice, PageLoader } from '@/components/ui/Feedback';
import AuthorLine from '@/components/content/AuthorLine';
import CommentSection from '@/components/content/CommentSection';
import ReportButton from '@/components/content/ReportButton';
import RsvpPanel from './RsvpPanel';
import EventAttendees from './EventAttendees';
import TravelPlanPanel from './TravelPlan';

const ID_RE = /^[a-f\d]{24}$/i;

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-[0.95rem] font-medium text-fg">{children}</dd>
      </div>
    </div>
  );
}

/** Event / visit-plan page for members. Rendered inside <MemberGate>. */
export default function EventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const validId = typeof id === 'string' && ID_RE.test(id);

  const { data: event, loading, error, reload, setData } = useApi(validId ? `/events/${id}` : null, undefined, {
    enabled: validId,
  });
  const [attendeeVersion, setAttendeeVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!validId || (error && error.status === 404)) {
    return (
      <div className="container-page py-14">
        <ErrorState
          title="This event could not be found"
          message="It may have been removed."
        />
        <div className="mt-6 text-center">
          <Button href="/events" variant="secondary" icon={ArrowLeft}>
            All events
          </Button>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container-page py-14">
        <ErrorState title="This event could not be loaded" message={error.message} onRetry={reload} />
      </div>
    );
  }
  if (loading || !event || event.id !== id) return <PageLoader label="Loading event…" />;

  const isVisit = event.eventType === 'VISIT_PLAN';
  const approved = !event.moderation || event.moderation.status === 'APPROVED';
  const noun = isVisit ? 'visit plan' : 'event';
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const fullAddress = [event.address, event.city].filter(Boolean).join(', ');
  const startTime = formatTime(event.startsAt);
  const endTime = formatTime(event.endsAt);
  const sameMoment = new Date(event.startsAt).getTime() === new Date(event.endsAt).getTime();

  // RSVP responses return the event without the memory count, so keep ours.
  function handleRsvpUpdated(updated) {
    setData((current) => ({ ...current, ...updated, memoryCount: current.memoryCount }));
    setAttendeeVersion((v) => v + 1);
  }

  async function handleDelete() {
    try {
      await api.delete(`/events/${event.id}`);
      toast.success(isVisit ? 'Visit plan deleted.' : 'Event deleted.');
      router.replace(event.isMine ? '/dashboard/submissions' : '/events');
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="container-page py-8 sm:py-10">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All events
      </Link>

      {event.cover && event.cover.url && (
        <div className="mt-5 overflow-hidden rounded-[1.125rem] border border-line bg-surface-2">
          <img src={event.cover.url} alt={`Cover for ${event.title}`} className="max-h-[26rem] w-full object-cover" />
        </div>
      )}

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isVisit ? 'leaf' : 'brand'} icon={isVisit ? Plane : undefined}>
            {labelOf(EVENT_TYPES, event.eventType)}
          </Badge>
          {event.isPast && <Badge>Past</Badge>}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{event.title}</h1>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {isVisit ? 'Shared by' : 'Organised by'}
            </p>
            <AuthorLine author={event.organizer} date={event.publishedAt || event.createdAt} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {event.isMine && (
              <>
                <Button variant="secondary" size="sm" icon={Pencil} href={`/dashboard/create/event?edit=${event.id}`}>
                  Edit
                </Button>
                <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </>
            )}
            {approved && !event.isMine && <ReportButton targetType="event" targetId={event.id} />}
          </div>
        </div>
        {event.isMine && <ModerationNotice moderation={event.moderation} className="mt-5" />}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <section className="card p-5 sm:p-6" aria-label="Details">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Fact icon={CalendarDays} label={isVisit ? 'Travel dates' : 'Date'}>
                {formatDateRange(event.startsAt, event.endsAt)}
              </Fact>
              <Fact icon={Clock} label={isVisit ? 'Arriving' : 'Time'}>
                {sameMoment ? startTime : `${startTime} – ${endTime}`}
              </Fact>
              <Fact icon={MapPin} label={isVisit ? 'Visiting' : 'Where'}>
                {event.address ? (
                  <>
                    {event.venue && <span className="block">{event.venue}</span>}
                    <span className="block text-fg-soft">{fullAddress}</span>
                  </>
                ) : (
                  place
                )}
              </Fact>
              {event.budgetNote && (
                <Fact icon={Wallet} label="Proposed budget">
                  {event.budgetNote}
                </Fact>
              )}
              {event.capacity && (
                <Fact icon={Users} label="Capacity">
                  {plural(event.capacity, 'place')}
                </Fact>
              )}
              {event.rsvpEnabled && event.rsvpDeadline && (
                <Fact icon={Clock} label="RSVP by">
                  {formatDateTime(event.rsvpDeadline)}
                </Fact>
              )}
            </dl>
            {isVisit && (
              <p className="mt-5 rounded-xl bg-leaf-soft px-3.5 py-2.5 text-xs leading-relaxed text-leaf-strong">
                This is a travel plan the doctor chose to share. Only the city and dates above are shared — nobody&apos;s
                location is tracked.
              </p>
            )}
          </section>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-lg font-bold text-fg">
              {isVisit ? 'About this visit' : 'About this event'}
            </h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-[0.975rem] leading-relaxed text-fg-soft">
              {event.description}
            </p>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="mb-4 text-lg font-bold text-fg">
              Discussion
            </h2>
            {approved ? (
              <CommentSection
                targetType="event"
                targetId={event.id}
                onCountChange={(delta) => setData((current) => ({ ...current, commentCount: Math.max(0, current.commentCount + delta) }))}
              />
            ) : (
              <p className="text-sm text-muted">Comments are available once this {noun} is published.</p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <RsvpPanel event={event} onUpdated={handleRsvpUpdated} />
          {approved && (
            <TravelPlanPanel key={`travel-${event.id}`} event={event} onUpdated={handleRsvpUpdated} />
          )}
          {approved && (
            <Button href={`/events/schedule?event=${event.id}`} variant="secondary" icon={CalendarClock} className="w-full">
              View the event schedule
            </Button>
          )}
          {approved && event.rsvpEnabled && <EventAttendees key={attendeeVersion} eventId={event.id} />}

          {approved && (
            <section className="card p-5" aria-labelledby="event-memories-heading">
              <h2 id="event-memories-heading" className="flex items-center gap-2 text-base font-bold text-fg">
                <Images className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                Memories
              </h2>
              <p className="mt-2 text-sm text-fg-soft">
                {event.memoryCount > 0
                  ? `${plural(event.memoryCount, 'memory', 'memories')} shared from this ${noun}.`
                  : `No photos or videos have been shared from this ${noun} yet.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.memoryCount > 0 && (
                  <Button href={`/memories?eventId=${event.id}`} variant="secondary" size="sm">
                    View memories
                  </Button>
                )}
                <Button href={`/dashboard/create/memory?eventId=${event.id}`} variant="ghost" size="sm" icon={Plus}>
                  Add a memory
                </Button>
              </div>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={isVisit ? 'Delete this visit plan?' : 'Delete this event?'}
        message="RSVPs and comments will be removed with it. Memories linked to it are kept. This cannot be undone."
        confirmLabel="Delete"
      />
    </article>
  );
}
