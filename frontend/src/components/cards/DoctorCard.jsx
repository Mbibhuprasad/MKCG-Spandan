import Link from 'next/link';
import { ArrowRight, Building2, MapPin, Stethoscope } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { yearsLabel } from '@/lib/format';

/**
 * Doctor profile card.
 * `doctor` is either the member directory card or the public homepage card from
 * the API — only fields that are present are shown, and empty ones are skipped.
 */
export default function DoctorCard({ doctor, viewLabel = 'View Profile' }) {
  const location = [doctor.city, doctor.state].filter(Boolean).join(', ');
  return (
    <article className="card group flex h-full flex-col p-5 transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-start gap-4">
        <Avatar name={doctor.name} src={doctor.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-fg">{doctor.name}</h3>
          {(doctor.professionalTitle || doctor.designation) && (
            <p className="mt-0.5 line-clamp-2 text-sm text-fg-soft">{doctor.professionalTitle || doctor.designation}</p>
          )}
          {doctor.specialization && (
            <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-semibold text-leaf-strong">
              <Stethoscope className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{doctor.specialization}</span>
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm text-fg-soft">
        {doctor.hospital && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Hospital or clinic</dt>
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <dd className="line-clamp-1">{doctor.hospital}</dd>
          </div>
        )}
        {location && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <dd className="line-clamp-1">{location}</dd>
          </div>
        )}
        {doctor.yearsOfExperience !== null && doctor.yearsOfExperience !== undefined && (
          <div className="pl-6 text-xs text-muted">
            <dt className="sr-only">Experience</dt>
            <dd>{yearsLabel(doctor.yearsOfExperience)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-5">
        <Link
          href={`/doctors/${doctor.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
          aria-label={`${viewLabel}: ${doctor.name}`}
        >
          {viewLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
