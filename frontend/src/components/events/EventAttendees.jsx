'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import Avatar from '@/components/ui/Avatar';
import Pagination from '@/components/ui/Pagination';
import { Badge, Skeleton } from '@/components/ui/Feedback';

const PAGE_SIZE = 30;

/** Members who answered "Going" or "Maybe" — names only, never contact details. */
export default function EventAttendees({ eventId }) {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi(`/events/${eventId}/attendees`, { page, limit: PAGE_SIZE });
  const attendees = data || [];

  return (
    <section className="card p-5" aria-labelledby="attendees-heading">
      <h2 id="attendees-heading" className="text-base font-bold text-fg">
        Who&apos;s coming{meta && meta.total ? ` (${meta.total})` : ''}
      </h2>

      {loading && !attendees.length ? (
        <div className="mt-4 space-y-3" role="status" aria-label="Loading attendees">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          The attendee list could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={reload}>
            Retry
          </button>
        </p>
      ) : attendees.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No one has responded yet. Be the first.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {attendees.map((row, i) => {
            const doctor = row.doctor;
            const name = <span className="truncate text-sm font-semibold text-fg">{doctor.name}</span>;
            return (
              <li key={doctor.id || `former-${i}`} className="flex items-center gap-3">
                <Avatar name={doctor.name} src={doctor.photoUrl} size="sm" />
                <div className="min-w-0 flex-1 leading-tight">
                  {doctor.id && !doctor.isAdmin ? (
                    <Link href={`/doctors/${doctor.id}`} className="block truncate hover:underline">
                      {name}
                    </Link>
                  ) : (
                    <span className="block truncate">{name}</span>
                  )}
                  {doctor.specialization && <p className="truncate text-xs text-muted">{doctor.specialization}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {row.guests > 0 && <Badge>+{row.guests}</Badge>}
                  {row.status === 'MAYBE' ? <Badge tone="warn">Maybe</Badge> : <Badge tone="leaf">Going</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination className="mt-4" page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </section>
  );
}
