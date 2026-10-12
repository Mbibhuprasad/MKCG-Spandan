import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { EVENT_TYPES, labelOf } from '@/lib/constants';
import { dateParts, formatDateRange, formatTime, cn } from '@/lib/format';
import { Badge, ModerationBadge } from '@/components/ui/Feedback';

function DateTile({ date }) {
  const d = dateParts(date) || { month: '', day: '' };
  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand text-brand-fg"
      aria-hidden="true"
    >
      <span className="text-[0.65rem] font-bold uppercase tracking-widest opacity-85">
        {d.month}
      </span>
      <span className="text-2xl font-extrabold leading-none">{d.day}</span>
    </div>
  );
}

/**
 * Event / visit-plan card.
 *  - members: pass the full API event (links to the detail page, shows RSVP count)
 *  - public homepage: pass the public summary with `publicView` (no link, no details)
 */
export default function EventCard({ event, publicView = false, className }) {
  const typeLabel = labelOf(EVENT_TYPES, event.eventType);
  const title = publicView ? (
    event.title
  ) : (
    <Link href={`/events/${event.id}`} className="hover:text-brand-ink">
      {event.title}
    </Link>
  );

  return (
    <article className={cn('card flex h-full gap-4 p-5 transition-shadow duration-200 hover:shadow-lift', className)}>
      <DateTile date={event.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={event.eventType === 'VISIT_PLAN' ? 'leaf' : 'brand'}>{typeLabel}</Badge>
          {event.isPast && <Badge>Past</Badge>}
          {event.moderation && event.moderation.status !== 'APPROVED' && <ModerationBadge status={event.moderation.status} />}
        </div>
        <h3 className="mt-2 text-base font-bold leading-snug text-fg">{title}</h3>
        <ul className="mt-2 space-y-1 text-sm text-fg-soft">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span>
              {formatDateRange(event.startsAt, event.endsAt)}
              {!publicView && ` · ${formatTime(event.startsAt)}`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{publicView ? event.city : [event.venue, event.city].filter(Boolean).join(', ')}</span>
          </li>
          {!publicView && event.rsvp && event.rsvpEnabled && (
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {event.rsvp.attending} attending
                {event.rsvp.mine ? ` · You: ${event.rsvp.mine.status === 'GOING' ? 'Going' : event.rsvp.mine.status === 'MAYBE' ? 'Maybe' : "Can't go"}` : ''}
              </span>
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
