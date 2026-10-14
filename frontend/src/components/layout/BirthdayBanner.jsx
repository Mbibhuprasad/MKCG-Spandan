'use client';

import Link from 'next/link';
import { Cake, PartyPopper, Sparkles } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import Avatar from '@/components/ui/Avatar';

// "Dr Asha Rao" and "Asha Rao" both greet as "Dr Asha Rao".
const greetingName = (name) => (/^(dr|prof)\.?\s/i.test(name) ? name : `Dr ${name}`);

// Each half of the track repeats the greetings until it has at least this many,
// so a single birthday still fills the strip as it scrolls.
const MIN_PER_HALF = 4;
const SECONDS_PER_GREETING = 7;

function Greeting({ doctor, copy }) {
  return (
    <li className="shrink-0" aria-hidden={copy || undefined} data-copy={copy ? '' : undefined}>
      <Link
        href={`/doctors/${doctor.id}`}
        tabIndex={copy ? -1 : undefined}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-1 text-sm font-semibold text-fg transition-colors hover:bg-leaf-soft hover:text-leaf-strong"
      >
        <Avatar name={doctor.name} src={doctor.photoUrl} size="xs" />
        <span>Happy Birthday, {greetingName(doctor.name)}!</span>
        <Cake className="h-4 w-4 text-leaf" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * Today's Birthday Celebrations: a slim strip under the main navbar with a
 * greeting for every doctor whose saved date of birth falls on today (worked
 * out by the API from real profiles, day and month in the community's time
 * zone). It scrolls sideways continuously and opens a doctor's profile on
 * click. Birthdays are member information, so the strip is only shown to
 * signed-in members; nothing is requested for visitors.
 */
export default function BirthdayBanner() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const { data, error } = useApi(signedIn ? '/doctors/birthdays' : null, undefined, { enabled: signedIn });

  if (!signedIn || error || !data) return null;
  const doctors = data.doctors || [];

  const repeat = doctors.length ? Math.ceil(MIN_PER_HALF / doctors.length) : 0;
  const half = Array.from({ length: repeat }, () => doctors).flat();
  const duration = `${Math.max(24, half.length * SECONDS_PER_GREETING)}s`;

  return (
    <section
      aria-labelledby="birthday-banner-title"
      className="border-b border-leaf/20 bg-gradient-to-r from-leaf-soft via-bg to-brand-soft"
    >
      <div className="container-page flex h-11 items-center gap-3">
        <h2
          id="birthday-banner-title"
          className="flex shrink-0 items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-leaf-strong"
        >
          <PartyPopper className="h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">Birthdays</span>
          <span className="hidden sm:inline">Today&apos;s Birthday Celebrations</span>
        </h2>
        <span className="h-5 w-px shrink-0 bg-leaf/25" aria-hidden="true" />

        {doctors.length === 0 ? (
          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-fg-soft">
            <Sparkles className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">No birthdays today — wishing everyone a wonderful day.</span>
          </p>
        ) : (
          <div
            className="birthday-marquee-viewport relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]"
          >
            <div className="birthday-marquee flex w-max" style={{ '--marquee-duration': duration }}>
              <ul className="flex shrink-0 items-center gap-6 pr-6" aria-label={`${doctors.length} birthday${doctors.length === 1 ? '' : 's'} today`}>
                {half.map((doctor, index) => (
                  // Repeats within the first half are for the scroll only.
                  <Greeting key={`${doctor.id}-${index}`} doctor={doctor} copy={index >= doctors.length} />
                ))}
              </ul>
              <ul className="flex shrink-0 items-center gap-6 pr-6" aria-hidden="true" data-copy="">
                {half.map((doctor, index) => (
                  <Greeting key={`copy-${doctor.id}-${index}`} doctor={doctor} copy />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
