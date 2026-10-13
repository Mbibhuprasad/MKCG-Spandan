"use client";

import Link from "next/link";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { formatDate, formatDateTime, yearsLabel } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Feedback";
import { AccountStatusBadge, Switch } from "./shared";

function Section({ title, children }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-fg">{value}</dd>
    </div>
  );
}

function TagList({ items }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Badge>{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

const CONTENT_PLURALS = {
  post: "Posts",
  blog: "Blogs",
  comment: "Comments",
  memory: "Memories",
  event: "Events",
  poll: "Polls",
};

const yearRange = (entry) => {
  const end = entry.current ? "Present" : entry.endYear;
  return [entry.startYear, end].filter(Boolean).join(" – ");
};

/**
 * Full admin view of one doctor account (GET /admin/doctors/:id).
 * Only sections that have data are shown.
 */
export default function DoctorDetail({ doctor, busy, onToggleVisibility }) {
  const p = doctor.profile;
  const location = [p.city, p.state].filter(Boolean).join(", ");
  const counts = doctor.contentCounts || {};
  const completion = doctor.profileCompletion;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={doctor.name} src={p.photoUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold text-fg">{doctor.name}</p>
            <AccountStatusBadge status={doctor.status} />
            {doctor.featured && <Badge tone="brand">Featured</Badge>}
          </div>
          {(p.professionalTitle || p.designation) && (
            <p className="mt-1 text-sm text-fg-soft">
              {[p.professionalTitle, p.designation].filter(Boolean).join(" · ")}
            </p>
          )}
          <ul className="mt-3 space-y-1 text-sm text-fg-soft">
            <li className="flex items-center gap-2">
              <Mail
                className="h-4 w-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <a
                href={`mailto:${doctor.email}`}
                className="break-all hover:underline"
              >
                {doctor.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone
                className="h-4 w-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <span>{doctor.phone}</span>
            </li>
          </ul>
          <Link
            href={`/doctors/${doctor.id}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
          >
            Open member-facing portfolio
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {doctor.suspension && (
        <div
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          role="note"
        >
          <p className="font-semibold">
            Suspended
            {doctor.suspension.at
              ? ` on ${formatDateTime(doctor.suspension.at)}`
              : ""}
          </p>
          <p className="mt-0.5">
            {doctor.suspension.reason
              ? `Reason: ${doctor.suspension.reason}`
              : "No reason was recorded."}
          </p>
        </div>
      )}

      <Section title="Account">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Fact label="Joined" value={formatDate(doctor.createdAt)} />
          <Fact
            label="Last login"
            value={
              doctor.lastLoginAt ? formatDateTime(doctor.lastLoginAt) : "Never"
            }
          />
          <Fact label="Profile completion" value={`${completion.percent}%`} />
        </dl>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-leaf"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        {completion.missing.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Not filled in yet: {completion.missing.join(", ")}.
          </p>
        )}
      </Section>

      <Section title="Visibility">
        <div className="space-y-4">
          <Switch
            label="Listed in the member directory"
            description="When off, other members only see a name card for this doctor."
            checked={doctor.visibility.directory}
            disabled={busy}
            onChange={() => onToggleVisibility("directory")}
          />
          <Switch
            label="Featured on the public homepage"
            description={
              doctor.visibility.publicListing
                ? "This doctor has consented to a public listing, so featuring takes effect immediately."
                : "This doctor has NOT consented to a public listing. Featuring has no effect until they enable it in their own profile settings."
            }
            checked={doctor.featured}
            disabled={busy}
            onChange={() => onToggleVisibility("featured")}
          />
        </div>
        <dl className="mt-4 grid gap-3 rounded-xl bg-surface-2 p-3.5 sm:grid-cols-3">
          <Fact
            label="Public listing consent"
            value={doctor.visibility.publicListing ? "Given" : "Not given"}
          />
          <Fact
            label="Email shown to members"
            value={doctor.visibility.showEmail ? "Yes" : "No"}
          />
          <Fact
            label="Phone shown to members"
            value={doctor.visibility.showPhone ? "Yes" : "No"}
          />
        </dl>
      </Section>

      <Section title="Content owned">
        <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Object.keys(CONTENT_PLURALS)
            .filter((type) => type in counts)
            .map((type) => (
              <div
                key={type}
                className="rounded-xl bg-surface-2 px-3 py-2.5 text-center"
              >
                <dd className="text-lg font-extrabold tabular-nums text-fg">
                  {counts[type]}
                </dd>
                <dt className="text-xs text-muted">{CONTENT_PLURALS[type]}</dt>
              </div>
            ))}
        </dl>
      </Section>

      <Section title="Professional profile">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Specialization" value={p.specialization} />
          <Fact label="Subspecialty" value={p.subspecialty} />
          <Fact label="Hospital or clinic" value={p.hospital} />
          <Fact label="Location" value={location} />
          <Fact label="Batch year" value={p.batchYear} />
          <Fact label="Experience" value={yearsLabel(p.yearsOfExperience)} />
        </dl>
        {p.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-fg-soft">
            {p.bio}
          </p>
        )}
        {!p.specialization && !p.hospital && !location && !p.bio && (
          <p className="text-sm text-muted">
            This doctor has not filled in their profile yet.
          </p>
        )}
      </Section>

      {p.qualifications.length > 0 && (
        <Section title="Qualifications">
          <TagList items={p.qualifications} />
        </Section>
      )}

      {p.education.length > 0 && (
        <Section title="Medical education">
          <ul className="space-y-2 text-sm">
            {p.education.map((item) => (
              <li key={item.id}>
                <span className="font-semibold text-fg">{item.degree}</span>
                <span className="text-fg-soft">
                  {[item.institution, item.year].filter(Boolean).length
                    ? ` — ${[item.institution, item.year].filter(Boolean).join(", ")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.experience.length > 0 && (
        <Section title="Professional experience">
          <ul className="space-y-3 text-sm">
            {p.experience.map((item) => (
              <li key={item.id}>
                <p className="font-semibold text-fg">{item.role}</p>
                <p className="text-fg-soft">
                  {[item.organization, item.city, yearRange(item)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-muted">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.achievements.length > 0 && (
        <Section title="Achievements">
          <ul className="space-y-2 text-sm">
            {p.achievements.map((item) => (
              <li key={item.id}>
                <span className="font-semibold text-fg">{item.title}</span>
                {item.year && (
                  <span className="text-fg-soft"> ({item.year})</span>
                )}
                {item.description && (
                  <p className="text-muted">{item.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.publications.length > 0 && (
        <Section title="Publications">
          <ul className="space-y-2 text-sm">
            {p.publications.map((item) => (
              <li key={item.id}>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-semibold text-brand-ink hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="font-semibold text-fg">{item.title}</span>
                )}
                <span className="text-fg-soft">
                  {[item.journal, item.year].filter(Boolean).length
                    ? ` — ${[item.journal, item.year].filter(Boolean).join(", ")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(p.interests.length > 0 || p.languages.length > 0) && (
        <Section title="Interests and languages">
          <div className="space-y-3">
            {p.interests.length > 0 && <TagList items={p.interests} />}
            {p.languages.length > 0 && <TagList items={p.languages} />}
          </div>
        </Section>
      )}

      {p.links.length > 0 && (
        <Section title="Professional links">
          <ul className="space-y-1.5 text-sm">
            {p.links.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 text-brand-ink hover:underline"
                >
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
