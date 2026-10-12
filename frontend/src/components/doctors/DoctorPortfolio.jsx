'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Clock,
  ExternalLink,
  EyeOff,
  GraduationCap,
  Languages,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ScrollText,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { formatDate, yearsLabel } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Links were validated by the API; this is a second check before rendering an href.
const safeHref = (url) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : null);

function yearRange(item) {
  const end = item.current ? 'Present' : item.endYear;
  if (item.startYear && end) return `${item.startYear} – ${end}`;
  return item.startYear || end || '';
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-fg">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chips({ items, tone = 'neutral' }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge tone={tone} className="px-3 py-1 text-[0.8rem]">
            {item}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-fg-soft">
      <dt className="sr-only">{label}</dt>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/doctors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to the directory
    </Link>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <Skeleton className="h-52 w-full rounded-[1.125rem]" />
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Skeleton className="h-72 w-full rounded-[1.125rem]" />
        <Skeleton className="h-72 w-full rounded-[1.125rem]" />
      </div>
    </div>
  );
}

/** A doctor's professional portfolio, built entirely from their saved profile. */
export default function DoctorPortfolio() {
  const { id } = useParams();
  const validId = typeof id === 'string' && OBJECT_ID.test(id);
  const { data: doctor, loading, error, reload } = useApi(validId ? `/doctors/${id}` : null, undefined, { enabled: validId });

  let body;
  if (!validId || (error && (error.status === 404 || error.status === 400))) {
    body = (
      <EmptyState
        icon={UserRound}
        title="Profile not found"
        description="This profile does not exist or is no longer available."
        action={<Button href="/doctors">Browse the directory</Button>}
      />
    );
  } else if (error) {
    body = <ErrorState message={error.message} onRetry={reload} />;
  } else if (loading || !doctor) {
    body = <PortfolioSkeleton />;
  } else if (doctor.limited) {
    const p = doctor.profile || {};
    body = (
      <div className="card mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <Avatar name={doctor.name} src={p.photoUrl} size="xl" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-fg">{doctor.name}</h1>
        {p.professionalTitle && <p className="mt-1 text-fg-soft">{p.professionalTitle}</p>}
        {p.specialization && (
          <Badge tone="leaf" icon={Stethoscope} className="mt-3">
            {p.specialization}
          </Badge>
        )}
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm text-muted">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This member has chosen not to be listed in the directory, so only a brief name card is shown.
        </p>
      </div>
    );
  } else {
    const p = doctor.profile || {};
    const contact = doctor.contact || {};
    const location = [p.city, p.state].filter(Boolean).join(', ');
    const links = (p.links || []).map((l) => ({ ...l, href: safeHref(l.url) })).filter((l) => l.href);
    const hasContact = Boolean(contact.email || contact.phone);
    const hasExperienceYears = p.yearsOfExperience !== null && p.yearsOfExperience !== undefined;
    const hasSide = Boolean(
      (p.qualifications || []).length || (p.interests || []).length || (p.languages || []).length || links.length || hasContact
    );
    const hasMain = Boolean(
      p.bio || (p.experience || []).length || (p.education || []).length || (p.achievements || []).length || (p.publications || []).length
    );

    body = (
      <div className="space-y-6">
        <header className="card overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-brand to-leaf opacity-90 sm:h-24" aria-hidden="true" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <Avatar name={doctor.name} src={p.photoUrl} size="2xl" className="ring-4 ring-surface" />
              {doctor.isMine && (
                <Button href="/dashboard/profile" variant="secondary" icon={Pencil} className="w-fit">
                  Edit profile
                </Button>
              )}
            </div>

            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg">{doctor.name}</h1>
            {(p.professionalTitle || p.designation) && (
              <p className="mt-1 text-base text-fg-soft">{[p.professionalTitle, p.designation].filter(Boolean).join(' · ')}</p>
            )}
            {(p.specialization || p.subspecialty) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.specialization && (
                  <Badge tone="leaf" icon={Stethoscope} className="px-3 py-1 text-[0.8rem]">
                    {p.specialization}
                  </Badge>
                )}
                {p.subspecialty && (
                  <Badge tone="brand" className="px-3 py-1 text-[0.8rem]">
                    {p.subspecialty}
                  </Badge>
                )}
              </div>
            )}

            <dl className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {p.hospital && (
                <Fact icon={Building2} label="Hospital or clinic">
                  {p.hospital}
                </Fact>
              )}
              {location && (
                <Fact icon={MapPin} label="Location">
                  {location}
                </Fact>
              )}
              {hasExperienceYears && (
                <Fact icon={Clock} label="Experience">
                  {yearsLabel(p.yearsOfExperience)}
                </Fact>
              )}
              {p.batchYear && (
                <Fact icon={Users} label="Batch">
                  Batch of {p.batchYear}
                </Fact>
              )}
              {doctor.memberSince && (
                <Fact icon={UserRound} label="Member since">
                  Member since {formatDate(doctor.memberSince, { month: 'long', year: 'numeric' })}
                </Fact>
              )}
            </dl>
          </div>
        </header>

        {!hasMain && !hasSide ? (
          <EmptyState
            icon={ScrollText}
            title={doctor.isMine ? 'Your portfolio is waiting for you' : 'This profile is still being completed'}
            description={
              doctor.isMine
                ? 'Add your education, experience and achievements so batchmates can see your journey.'
                : 'This doctor has not added further details yet.'
            }
            action={doctor.isMine ? <Button href="/dashboard/profile">Complete my profile</Button> : null}
          />
        ) : (
          <div className={hasMain && hasSide ? 'grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]' : ''}>
            {hasMain && (
              <div className="space-y-6">
                {p.bio && (
                  <Section icon={UserRound} title="About">
                    <p className="whitespace-pre-line break-words leading-relaxed text-fg-soft">{p.bio}</p>
                  </Section>
                )}

                {(p.experience || []).length > 0 && (
                  <Section icon={Briefcase} title="Professional experience">
                    <ol className="space-y-5">
                      {p.experience.map((item) => (
                        <li key={item.id} className="border-l-2 border-line pl-4">
                          <h3 className="font-semibold text-fg">{item.role}</h3>
                          <p className="text-sm text-fg-soft">{[item.organization, item.city].filter(Boolean).join(', ')}</p>
                          {yearRange(item) && <p className="mt-0.5 text-xs font-medium text-muted">{yearRange(item)}</p>}
                          {item.description && (
                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-fg-soft">{item.description}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}

                {(p.education || []).length > 0 && (
                  <Section icon={GraduationCap} title="Medical education">
                    <ul className="space-y-4">
                      {p.education.map((item) => (
                        <li key={item.id} className="border-l-2 border-line pl-4">
                          <h3 className="font-semibold text-fg">{item.degree}</h3>
                          {(item.institution || item.year) && (
                            <p className="text-sm text-fg-soft">{[item.institution, item.year].filter(Boolean).join(' · ')}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {(p.achievements || []).length > 0 && (
                  <Section icon={Award} title="Achievements">
                    <ul className="space-y-4">
                      {p.achievements.map((item) => (
                        <li key={item.id}>
                          <h3 className="font-semibold text-fg">
                            {item.title}
                            {item.year ? <span className="ml-2 text-sm font-medium text-muted">{item.year}</span> : null}
                          </h3>
                          {item.description && (
                            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-fg-soft">{item.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {(p.publications || []).length > 0 && (
                  <Section icon={BookOpen} title="Publications">
                    <ul className="space-y-4">
                      {p.publications.map((item) => {
                        const href = safeHref(item.url);
                        return (
                          <li key={item.id}>
                            <h3 className="font-semibold text-fg">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-start gap-1.5 hover:text-brand-ink hover:underline"
                                >
                                  <span>{item.title}</span>
                                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              ) : (
                                item.title
                              )}
                            </h3>
                            {(item.journal || item.year) && (
                              <p className="text-sm text-fg-soft">{[item.journal, item.year].filter(Boolean).join(' · ')}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                )}
              </div>
            )}

            {hasSide && (
              <div className="space-y-6">
                {(p.qualifications || []).length > 0 && (
                  <Section icon={ScrollText} title="Qualifications">
                    <Chips items={p.qualifications} tone="brand" />
                  </Section>
                )}
                {(p.interests || []).length > 0 && (
                  <Section icon={Lightbulb} title="Professional interests">
                    <Chips items={p.interests} tone="leaf" />
                  </Section>
                )}
                {(p.languages || []).length > 0 && (
                  <Section icon={Languages} title="Languages">
                    <Chips items={p.languages} />
                  </Section>
                )}
                {links.length > 0 && (
                  <Section icon={Link2} title="Links">
                    <ul className="space-y-2.5">
                      {links.map((link) => (
                        <li key={link.id}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{link.label}</span>
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {hasContact && (
                  <Section icon={Mail} title="Contact">
                    <ul className="space-y-2.5 text-sm">
                      {contact.email && (
                        <li>
                          <a href={`mailto:${contact.email}`} className="inline-flex max-w-full items-center gap-2 text-fg-soft hover:text-brand-ink hover:underline">
                            <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        </li>
                      )}
                      {contact.phone && (
                        <li>
                          <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 text-fg-soft hover:text-brand-ink hover:underline">
                            <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            {contact.phone}
                          </a>
                        </li>
                      )}
                    </ul>
                    {doctor.isMine && doctor.visibility && (
                      <p className="mt-3 text-xs text-muted">
                        Other members see{' '}
                        {doctor.visibility.showEmail && doctor.visibility.showPhone
                          ? 'both your email and phone number'
                          : doctor.visibility.showEmail
                            ? 'your email only'
                            : doctor.visibility.showPhone
                              ? 'your phone number only'
                              : 'neither of these'}
                        . You can change this in your profile settings.
                      </p>
                    )}
                  </Section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-5">
        <BackLink />
      </div>
      {body}
    </div>
  );
}
