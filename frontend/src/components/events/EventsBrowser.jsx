'use client';

import { useState } from 'react';
import { CalendarDays, CalendarPlus, Plane } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { EVENT_TYPES, labelOf } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Layout';
import { Select } from '@/components/ui/Form';
import { CardSkeletons, EmptyState, ErrorState } from '@/components/ui/Feedback';
import EventCard from '@/components/cards/EventCard';

const PAGE_SIZE = 9;
const SCOPES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

/** Members-only list of approved events and visit plans. Rendered inside <MemberGate>. */
export default function EventsBrowser() {
  const [scope, setScope] = useState('upcoming');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, meta, loading, error, reload } = useApi('/events', { scope, type, page, limit: PAGE_SIZE });
  const events = data || [];
  const typeLabel = type ? labelOf(EVENT_TYPES, type).toLowerCase() : '';

  function changeScope(next) {
    setScope(next);
    setPage(1);
  }

  function changeType(next) {
    setType(next);
    setPage(1);
  }

  function changePage(next) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const createActions = (
    <>
      <Button href="/dashboard/create/event" icon={CalendarPlus}>
        Propose an event
      </Button>
      <Button href="/dashboard/create/event?type=VISIT_PLAN" variant="secondary" icon={Plane}>
        Share a visit plan
      </Button>
    </>
  );

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Tabs tabs={SCOPES} value={scope} onChange={changeScope} label="Upcoming or past events" className="self-start" />
          <div className="w-full sm:w-64">
            <label htmlFor="event-type-filter" className="mb-1.5 block text-sm font-semibold text-fg">
              Type
            </label>
            <Select id="event-type-filter" value={type} onChange={(e) => changeType(e.target.value)}>
              <option value="">All types</option>
              {EVENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">{createActions}</div>
      </div>

      {loading && !events.length ? (
        <CardSkeletons count={6} height="h-40" />
      ) : error ? (
        <ErrorState title="Events could not be loaded" message={error.message} onRetry={reload} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            scope === 'upcoming'
              ? type
                ? `No upcoming ${typeLabel} entries`
                : 'No upcoming events yet'
              : type
                ? `No past ${typeLabel} entries`
                : 'No past events yet'
          }
          description={
            scope === 'upcoming'
              ? 'Propose a reunion, a dinner or a meetup — or let Friends know when you are visiting their city. They appear here as soon as they are published.'
              : 'Events move here after they have taken place.'
          }
          action={scope === 'upcoming' ? createActions : undefined}
        />
      ) : (
        <>
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-8"
            page={meta ? meta.page : page}
            totalPages={meta ? meta.totalPages : 1}
            onPageChange={changePage}
          />
        </>
      )}
    </div>
  );
}
