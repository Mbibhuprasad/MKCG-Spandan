'use client';

import { CircleAlert, Pencil } from 'lucide-react';
import { CREDENTIAL_TYPES, DEGREE_LEVELS, EMPLOYMENT_TYPES, PROFILE_SECTIONS, labelOf } from '@/lib/constants';
import { plural, yearRange } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/AuthProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Feedback';
import { STEPS } from './model';

const joined = (...parts) => parts.filter(Boolean).join(' · ');
const place = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');

function Row({ label, children }) {
  if (children === '' || children === null || children === undefined) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words text-sm text-fg">{children}</dd>
    </div>
  );
}

function Tags({ items }) {
  if (!items.length) return null;
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

const tagRow = (items) => (items.length ? <Tags items={items} /> : '');

function Entries({ heading, items, render }) {
  if (!items.length) return null;
  return (
    <div>
      {heading && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{heading}</p>}
      <ul className="space-y-3">
        {items.map((item) => {
          const { title, subtitle, meta, note, image } = render(item);
          return (
            <li key={item.key} className="flex gap-3 border-l-2 border-line pl-3">
              {image && <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" />}
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-fg">{title}</p>
                {subtitle && <p className="break-words text-sm text-fg-soft">{subtitle}</p>}
                {meta && <p className="break-words text-xs font-medium text-muted">{meta}</p>}
                {note && <p className="mt-1 whitespace-pre-line break-words text-sm text-fg-soft">{note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const onOff = (value) => (value ? 'On' : 'Off');

// What each earlier step contributes to the summary. `null` means "nothing entered".
function summaries(form, user, isAdmin, counts) {
  const v = form.visibility;
  const any = (...values) => values.some((value) => (Array.isArray(value) ? value.length : String(value || '').trim()));
  const hidden = PROFILE_SECTIONS.filter((s) => !v.sections[s.key]).map((s) => s.label);
  const privacy = v.showRegistration ? 'shown to members' : 'private';

  return {
    basic: (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={form.name} src={user.profile ? user.profile.photoUrl : ''} size="lg" />
        <dl className="min-w-0 flex-1 space-y-2">
          <Row label="Full name">{form.name}</Row>
          <Row label="Professional title">{form.professionalTitle}</Row>
          <Row label="Current designation">{form.designation}</Row>
          <Row label="Address">{form.address}</Row>
          <Row label="Biography">{form.bio}</Row>
          <Row label="Languages">{tagRow(form.languages)}</Row>
        </dl>
      </div>
    ),
    expertise: any(form.specialization, form.subspecialty, form.fieldOfWork, form.expertise, form.procedures, form.interests, form.experience) ? (
      <div className="space-y-3">
        <dl className="space-y-2">
          <Row label="Primary specialization">{form.specialization}</Row>
          <Row label="Subspecialization">{form.subspecialty}</Row>
          <Row label="Field of work">{form.fieldOfWork}</Row>
          <Row label="Areas of expertise">{tagRow(form.expertise)}</Row>
          <Row label="Procedures performed">{tagRow(form.procedures)}</Row>
          <Row label="Interests">{tagRow(form.interests)}</Row>
        </dl>
        <Entries
          heading="Positions"
          items={form.experience}
          render={(e) => ({
            title: e.role,
            subtitle: joined(e.organization, place(e.city, e.state)),
            meta: joined(yearRange(e.startYear, e.endYear, e.current), e.employmentType && labelOf(EMPLOYMENT_TYPES, e.employmentType)),
            note: e.description,
          })}
        />
      </div>
    ) : null,
    practice: any(form.practiceArea, form.hospital, form.workAddress, form.city, form.state, form.workEmail, form.workPhone, form.practiceLocations, form.links) ? (
      <div className="space-y-3">
        <dl className="space-y-2">
          <Row label="Clinical practice area">{form.practiceArea}</Row>
          <Row label="Hospital or clinic">{form.hospital}</Row>
          <Row label="Workplace address">{form.workAddress}</Row>
          <Row label="Location">{place(form.city, form.state, form.country)}</Row>
          <Row label="Workplace email">{form.workEmail}</Row>
          <Row label="Workplace phone">{form.workPhone}</Row>
        </dl>
        <Entries
          heading="Other practice locations"
          items={form.practiceLocations}
          render={(l) => ({ title: l.hospital, subtitle: joined(l.area, place(l.city, l.state, l.country)), meta: joined(l.address, l.phone) })}
        />
        <Entries heading="Links" items={form.links} render={(l) => ({ title: l.label, subtitle: l.url })} />
      </div>
    ) : null,
    education: any(form.education, form.qualifications, form.credentials) ? (
      <div className="space-y-3">
        <dl className="space-y-2">
          <Row label="Qualification letters">{tagRow(form.qualifications)}</Row>
        </dl>
        <Entries
          heading="Academic degrees"
          items={form.education}
          render={(e) => ({
            title: joined(e.degree, e.fieldOfStudy),
            subtitle: e.institution,
            meta: joined(yearRange(e.startYear, e.year), e.level && labelOf(DEGREE_LEVELS, e.level).replace(/ \(.*\)$/, ''), e.certification),
            note: e.details,
          })}
        />
        <Entries
          heading="Professional qualifications and certifications"
          items={form.credentials}
          render={(c) => ({
            title: c.title,
            subtitle: joined(c.type && labelOf(CREDENTIAL_TYPES, c.type), c.institution),
            meta: joined(c.year, c.registration && `Registration: ${c.registration} (${privacy})`),
            note: c.details,
          })}
        />
      </div>
    ) : null,
    fellowships: form.fellowships.length ? (
      <Entries
        items={form.fellowships}
        render={(f) => ({
          title: f.title,
          subtitle: joined(f.certificate, f.institution, f.specialty),
          meta: yearRange(f.startYear, f.endYear),
          note: f.description,
        })}
      />
    ) : null,
    awards: form.achievements.length ? (
      <Entries
        items={form.achievements}
        render={(a) => ({ title: a.title, subtitle: a.issuer, meta: a.year, note: a.description, image: a.imageUrl })}
      />
    ) : null,
    memberships: form.memberships.length ? (
      <Entries
        items={form.memberships}
        render={(m) => ({
          title: m.organization,
          subtitle: m.type,
          meta: joined(yearRange(m.startYear, m.endYear, m.current), m.number && `Number: ${m.number} (${privacy})`),
        })}
      />
    ) : null,
    publications: form.publications.length ? (
      <Entries
        items={form.publications}
        render={(x) => ({ title: x.title, subtitle: joined(x.journal, x.year), meta: joined(x.authors, x.url), note: x.description })}
      />
    ) : null,
    gallery:
      counts.gallery || counts.blogs ? (
        <dl className="space-y-2">
          <Row label="Personal gallery">{counts.gallery ? `${plural(counts.gallery, 'item')} — already published` : 'No items'}</Row>
          <Row label="Personal blogs">{counts.blogs ? `${plural(counts.blogs, 'blog')} — already published` : 'No blogs'}</Row>
        </dl>
      ) : null,
    visibility: isAdmin ? (
      <p className="text-sm text-muted">Not applicable to administrator accounts.</p>
    ) : (
      <dl className="space-y-2">
        <Row label="Doctor directory">{v.directory ? 'Listed — members can find you' : 'Not listed — members see a name card only'}</Row>
        <Row label="Public homepage mention">{v.publicListing ? 'Allowed, if an administrator features you' : 'Not allowed'}</Row>
        <Row label="Account email">{onOff(v.showEmail)}</Row>
        <Row label="Account phone">{onOff(v.showPhone)}</Row>
        <Row label="Workplace contact">{onOff(v.showWorkContact)}</Row>
        <Row label="Registration and membership numbers">{onOff(v.showRegistration)}</Row>
        <Row label="Hidden sections">{hidden.length ? hidden.join(', ') : 'None — every section is shown'}</Row>
      </dl>
    ),
  };
}

/**
 * Final step: a read-only summary of every earlier step, each with an Edit
 * button that returns to that step (the entered data is kept).
 *   problems — per step index: validation messages that block submission
 */
export default function ReviewStep({ form, isAdmin, problems, onEdit }) {
  const { user } = useAuth();
  // Gallery items and blogs are saved by their own modules; only the totals are needed here.
  const memories = useApi('/memories/mine', { limit: 1 });
  const blogs = useApi('/blogs/mine', { limit: 1 });
  const counts = { gallery: memories.meta ? memories.meta.total : 0, blogs: blogs.meta ? blogs.meta.total : 0 };
  const content = summaries(form, user, isAdmin, counts);

  return (
    <div className="space-y-4">
      {STEPS.slice(0, -1).map((step, index) => {
        const Icon = step.icon;
        const issues = problems[index] || [];
        const body = content[step.id];
        return (
          <section
            key={step.id}
            aria-labelledby={`review-${step.id}`}
            className={`rounded-2xl border p-4 sm:p-5 ${issues.length ? 'border-danger/50' : 'border-line'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={`review-${step.id}`} className="flex min-w-0 items-center gap-2.5 text-base font-bold text-fg">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="truncate">{step.short}</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                icon={Pencil}
                onClick={() => onEdit(index)}
                aria-label={`Edit ${step.short}`}
                className="shrink-0"
              >
                Edit
              </Button>
            </div>

            {issues.length > 0 && (
              <ul className="mt-3 space-y-1" role="alert">
                {issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-1.5 text-xs font-medium text-danger">
                    <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              {body || <p className="text-sm text-muted">Nothing added{step.optional ? ' — this step is optional.' : ' yet.'}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
