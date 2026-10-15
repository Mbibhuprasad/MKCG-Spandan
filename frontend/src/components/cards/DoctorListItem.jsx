import { ArrowRight, MapPin, Phone, Stethoscope } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";

/**
 * A doctor as one horizontal row of the Friends list view. Uses the same
 * directory card from the API as <DoctorCard>; the contact number is present
 * only when the doctor's privacy settings allow it (the API leaves it out
 * otherwise).
 */
export default function DoctorListItem({ doctor }) {
  const location = [doctor.city, doctor.state].filter(Boolean).join(", ");
  const contact = doctor.contact || {};
  const phone = contact.phone || contact.workPhone || "";
  const title = doctor.professionalTitle || doctor.designation;

  return (
    <article className="card flex flex-col gap-4 p-3 transition-shadow duration-200 hover:shadow-lift sm:flex-row sm:items-center sm:p-3">
      <div className="flex min-w-0 items-center gap-4 sm:w-[16rem] sm:shrink-0 lg:w-[18rem]">
        <Avatar name={doctor.name} src={doctor.photoUrl} size="md" />
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-fg">
            {doctor.name}
          </h3>
          {title && (
            <p className="mt-0.5 line-clamp-2 text-[0.8rem] text-fg-soft">{title}</p>
          )}
        </div>
      </div>

      {/* On phones the specialization takes a row of its own and location and phone share the next one. */}
      <dl className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm text-fg-soft md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
        <div className="col-span-2 flex min-w-0 items-start gap-2 md:col-span-1">
          <dt className="sr-only">Specialization</dt>
          <Stethoscope
            className="mt-0.5 h-4 w-4 shrink-0 text-leaf"
            aria-hidden="true"
          />
          <dd className="min-w-0 break-words font-semibold text-fg">
            {doctor.specialization || "Specialization not added"}
          </dd>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <dt className="sr-only">Location</dt>
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <dd className="min-w-0 break-words">
            {location || "Location not added"}
          </dd>
        </div>
        {phone && (
          <div className="flex min-w-0 items-start gap-2">
            <dt className="sr-only">Contact number</dt>
            <Phone
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink"
              aria-hidden="true"
            />
            <dd className="min-w-0">
              <a
                href={`tel:${phone}`}
                className="whitespace-nowrap font-semibold text-fg hover:text-brand-ink hover:underline md:whitespace-normal md:break-all"
              >
                {phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <Button
        href={`/doctors/${doctor.id}`}
        variant="outline"
        size="sm"
        iconRight={ArrowRight}
        className="w-full shrink-0 sm:w-auto"
        aria-label={`View More: ${doctor.name}`}
      >
        View More
      </Button>
    </article>
  );
}
