'use client';

import Link from 'next/link';
import { Cake, PartyPopper } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Feedback';

// "Dr Asha Rao" and "Asha Rao" both greet as "Dr Asha Rao".
const greetingName = (name) => (/^(dr|prof)\.?\s/i.test(name) ? name : `Dr ${name}`);

/**
 * Today's Birthdays: friends whose date of birth falls on today (day and month
 * in the community's time zone, worked out by the API from saved profiles).
 * Scrolls sideways when there are several. Members only.
 */
export default function TodaysBirthdays() {
  const { data, loading, error } = useApi('/doctors/birthdays');
  const doctors = (data && data.doctors) || [];
  // Shown as a calendar date: noon UTC keeps it on the same day in every time zone.
  const today = data ? formatDate(`${data.date}T12:00:00Z`, { day: 'numeric', month: 'long' }) : '';

  // A strip that failed to load is left out rather than pushing the feed down with an error.
  if (error) return null;

  return (
    <section className="card mb-6 overflow-hidden" aria-labelledby="birthdays-title">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="birthdays-title" className="flex items-center gap-2 text-base font-bold text-fg">
          <Cake className="h-[1.1rem] w-[1.1rem] text-leaf" aria-hidden="true" />
          Today&apos;s Birthdays
        </h2>
        {today && <p className="text-xs font-semibold text-muted">{today}</p>}
      </div>

      {loading && !data ? (
        <div className="flex gap-3 overflow-hidden p-4 sm:px-5" role="status" aria-label="Loading birthdays">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-52 shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <p className="flex items-center gap-2.5 px-4 py-4 text-sm text-fg-soft sm:px-5">
          <PartyPopper className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          No birthdays today. Check back tomorrow!
        </p>
      ) : (
        <ul
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain p-4 [scrollbar-width:thin] sm:px-5"
          aria-label={`${doctors.length} birthday${doctors.length === 1 ? '' : 's'} today`}
        >
          {doctors.map((doctor) => (
            <li key={doctor.id} className="w-56 shrink-0 snap-start">
              <Link
                href={`/doctors/${doctor.id}`}
                className="group flex h-full flex-col items-center rounded-2xl border border-leaf/25 bg-leaf-soft/60 px-4 py-4 text-center transition-colors hover:border-leaf/50 hover:bg-leaf-soft"
              >
                <Avatar name={doctor.name} src={doctor.photoUrl} size="lg" className="ring-2 ring-leaf/40" />
                <p className="mt-3 line-clamp-2 break-words text-sm font-bold leading-snug text-fg">
                  Happy Birthday, {greetingName(doctor.name)}!
                </p>
                {doctor.specialization && <p className="mt-1 line-clamp-1 text-xs text-fg-soft">{doctor.specialization}</p>}
                <span className="mt-2 text-xs font-semibold text-brand-ink group-hover:underline">View profile</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
