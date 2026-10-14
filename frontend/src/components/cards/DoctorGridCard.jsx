import { ArrowRight, MapPin, Phone, Stethoscope } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";

/**
 * A doctor in the Friends grid view: the same directory card from the API and
 * the same facts as the list row (<DoctorListItem>), laid out as a card. The
 * contact number is present only when the doctor's privacy settings allow it
 * (the API leaves it out otherwise).
 */
export default function DoctorGridCard({ doctor }) {
  const location = [doctor.city, doctor.state].filter(Boolean).join(", ");
  const contact = doctor.contact || {};
  const phone = contact.phone || contact.workPhone || "";
  const title = doctor.professionalTitle || doctor.designation;

  return (
    <article className="card flex h-full flex-col items-center p-5 text-center transition-shadow duration-200 hover:shadow-lift">
      <Avatar name={doctor.name} src={doctor.photoUrl} size="xl" />
      <h3 className="mt-4 w-full break-words text-base font-bold text-fg">
        {doctor.name}
      </h3>
      {title && (
        <p className="mt-0.5 line-clamp-1 w-full text-sm text-fg-soft">
          {title}
        </p>
      )}
      {doctor.specialization && (
        <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-semibold text-leaf-strong">
          <Stethoscope className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{doctor.specialization}</span>
        </p>
      )}

      <dl className="mt-4 w-full space-y-1.5 border-t border-line pt-4 text-sm text-fg-soft">
        <div className="flex items-center justify-center gap-2">
          <dt className="sr-only">Location</dt>
          <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <dd className="min-w-0 truncate">{location || "Location not added"}</dd>
        </div>
        {phone && (
          <div className="flex items-center justify-center gap-2">
            <dt className="sr-only">Contact number</dt>
            <Phone
              className="h-4 w-4 shrink-0 text-brand-ink"
              aria-hidden="true"
            />
            <dd className="min-w-0 truncate">
              <a
                href={`tel:${phone}`}
                className="font-semibold text-fg hover:text-brand-ink hover:underline"
              >
                {phone}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto w-full pt-5">
        <Button
          href={`/doctors/${doctor.id}`}
          variant="outline"
          size="sm"
          iconRight={ArrowRight}
          className="w-full"
          aria-label={`View More: ${doctor.name}`}
        >
          View More
        </Button>
      </div>
    </article>
  );
}
