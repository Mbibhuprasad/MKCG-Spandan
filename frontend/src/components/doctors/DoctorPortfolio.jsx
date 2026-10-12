'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Check,
  ExternalLink,
  EyeOff,
  House,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ScrollText,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { CREDENTIAL_TYPES, DEFAULT_COUNTRY, DEGREE_LEVELS, EMPLOYMENT_TYPES, labelOf } from '@/lib/constants';
import { cn, formatDate, initials, yearRange } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Reveal from '@/components/ui/Reveal';

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Links were validated by the API; this is a second check before rendering an href.
const safeHref = (url) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : null);

const joined = (...parts) => parts.filter(Boolean).join(' · ');
const place = (...parts) => parts.filter(Boolean).join(', ');
const levelLabel = (level) => (level ? labelOf(DEGREE_LEVELS, level).replace(/ \(.*\)$/, '') : '');

/**
 * One chapter of the portfolio: a heading column on the left and the content
 * beside it, separated from the next chapter by a rule rather than a box.
 * The chapters follow the order of the profile form.
 * `hidden` marks a section the owner has switched off for other members (the
 * API omits it for them).
 */
function Section({ id, number, title, hidden = false, action, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36 border-t border-line py-10 sm:py-14">
      <Reveal className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-36 lg:self-start">
          <p className="eyebrow" aria-hidden="true">
            {String(number).padStart(2, '0')}
          </p>
          <h2 id={`${id}-title`} className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-[1.7rem]">
            {title}
          </h2>
          {(hidden || action) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hidden && (
                <Badge tone="warn" icon={EyeOff}>
                  Hidden from other members
                </Badge>
              )}
              {action}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-9">{children}</div>
      </Reveal>
    </section>
  );
}

/** A labelled group inside a chapter. */
function Block({ title, children }) {
  return (
    <div>
      <h3 className="mb-3.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Chips({ items, tone = 'neutral' }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge tone={tone} className="px-3.5 py-1.5 text-[0.82rem]">
            {item}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Label over value, set off by an accent rule (no tile). */
function Detail({ label, children }) {
  return (
    <div className="border-l-2 border-leaf/50 pl-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 break-words text-lg font-semibold leading-snug text-fg">{children}</dd>
    </div>
  );
}

/**
 * One dated line of a résumé-style list: the years (or other short marker) in
 * a narrow column, the entry beside it. Rows are separated by rules.
 */
function Row({ when, title, subtitle, badge, children }) {
  return (
    <li className="grid gap-x-8 gap-y-1 py-5 first:pt-0 last:pb-0 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <p className={cn('pt-0.5 text-sm font-semibold tabular-nums text-muted', !when && 'hidden sm:block')}>{when}</p>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h4 className="break-words text-[1.05rem] font-semibold leading-snug text-fg">{title}</h4>
          {badge}
        </div>
        {subtitle && <p className="mt-0.5 break-words text-fg-soft">{subtitle}</p>}
        {children}
      </div>
    </li>
  );
}

const Rows = ({ children }) => <ul className="divide-y divide-line">{children}</ul>;

function Prose({ children }) {
  if (!children) return null;
  return <p className="mt-2 whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-fg-soft">{children}</p>;
}

function Private({ children, show }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-soft">
      <span className="break-words">{children}</span>
      {show && <Badge icon={Lock}>Only you can see this</Badge>}
    </p>
  );
}

function ContactLine({ href, icon: Icon, label, children }) {
  return (
    <li>
      <a href={href} className="group inline-flex max-w-full items-center gap-3 text-fg-soft hover:text-brand-ink">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted">{label}</span>
          <span className="block truncate font-semibold group-hover:underline">{children}</span>
        </span>
      </a>
    </li>
  );
}

function HeroFact({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-[0.95rem] text-fg-soft">
      <dt className="sr-only">{label}</dt>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
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
    <div className="space-y-10 py-6" role="status" aria-label="Loading profile">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <Skeleton className="h-44 w-44 rounded-[2rem]" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-3/5" />
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * A doctor's professional portfolio, built entirely from their saved profile
 * and laid out like a personal site: a hero, then chapters in the order of the
 * profile form — about → expertise → practice and contact → education →
 * fellowship → awards → memberships → publications → gallery and blogs.
 * Chapters without data are not rendered.
 */
export default function DoctorPortfolio() {
  const { id } = useParams();
  const validId = typeof id === 'string' && OBJECT_ID.test(id);
  const { data: doctor, loading, error, reload } = useApi(validId ? `/doctors/${id}` : null, undefined, { enabled: validId });

  // Gallery = this doctor's memories; blogs = this doctor's community blogs.
  // The same records the Memories and Blogs pages show, selected by owner.
  const showContent = Boolean(doctor && !doctor.limited);
  const gallery = useApi(showContent ? '/memories' : null, { owner: id, limit: 12 }, { enabled: showContent });
  const blogs = useApi(showContent ? '/blogs' : null, { author: id, limit: 6 }, { enabled: showContent });

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
    const visibility = doctor.visibility || null; // present for the owner and administrators only
    const mine = Boolean(doctor.isMine);
    const list = (key) => p[key] || [];
    // Sections the owner switched off: other members never receive them, the owner sees a reminder.
    const hiddenFromOthers = (...keys) =>
      Boolean(mine && visibility && visibility.sections && keys.some((key) => visibility.sections[key] === false));
    const numbersPrivate = Boolean(mine && visibility && !visibility.showRegistration);

    const country = p.country && p.country.toLowerCase() !== DEFAULT_COUNTRY.toLowerCase() ? p.country : '';
    const location = place(p.city, p.state, country);
    const links = list('links')
      .map((l) => ({ ...l, href: safeHref(l.url) }))
      .filter((l) => l.href);
    const hasContact = Boolean(contact.email || contact.phone || contact.workEmail || contact.workPhone);
    const mailTo = contact.workEmail || contact.email;
    const callTo = contact.workPhone || contact.phone;
    const photos = gallery.data || [];
    const articles = blogs.data || [];

    // A few real figures for the hero, each shown only when there is something to count.
    const figures = [
      [list('expertise').length, 'Areas of expertise'],
      [list('procedures').length, 'Procedures'],
      [list('achievements').length, list('achievements').length === 1 ? 'Award' : 'Awards'],
      [list('publications').length, list('publications').length === 1 ? 'Publication' : 'Publications'],
    ].filter(([count]) => count > 0);

    // The chapters, in the order of the profile form. Each one renders only when it has content.
    const sections = [
      {
        id: 'about',
        nav: 'About',
        title: 'About',
        show: Boolean(p.bio || list('languages').length),
        render: () => (
          <>
            {p.bio && <p className="whitespace-pre-line break-words text-lg leading-relaxed text-fg-soft sm:text-[1.2rem] sm:leading-[1.75]">{p.bio}</p>}
            {list('languages').length > 0 && (
              <Block title="Languages">
                <Chips items={p.languages} />
              </Block>
            )}
          </>
        ),
      },
      {
        id: 'expertise',
        nav: 'Expertise',
        title: 'Field of work, expertise and procedures',
        hidden: hiddenFromOthers('experience'),
        show: Boolean(
          p.specialization ||
            p.subspecialty ||
            p.fieldOfWork ||
            list('expertise').length ||
            list('procedures').length ||
            list('interests').length ||
            list('experience').length
        ),
        render: () => (
          <>
            {(p.specialization || p.subspecialty || p.fieldOfWork) && (
              <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
                {p.specialization && <Detail label="Primary specialization">{p.specialization}</Detail>}
                {p.subspecialty && <Detail label="Subspecialization">{p.subspecialty}</Detail>}
                {p.fieldOfWork && <Detail label="Field of work">{p.fieldOfWork}</Detail>}
              </dl>
            )}
            {list('expertise').length > 0 && (
              <Block title="Areas of expertise">
                <Chips items={p.expertise} tone="brand" />
              </Block>
            )}
            {list('procedures').length > 0 && (
              <Block title="Procedures performed">
                <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                  {p.procedures.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-fg-soft">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-strong">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {list('interests').length > 0 && (
              <Block title="Clinical and professional interests">
                <Chips items={p.interests} tone="leaf" />
              </Block>
            )}
            {list('experience').length > 0 && (
              <Block title="Work experience">
                {/* Career timeline: a rail on the left, each position a marker on it. */}
                <ol className="ml-1.5 space-y-8 border-l-2 border-line">
                  {p.experience.map((item) => (
                    <li key={item.id} className="relative pl-7">
                      <span
                        className={cn(
                          'absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ring-bg',
                          item.current ? 'bg-leaf' : 'bg-line-strong'
                        )}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold tabular-nums text-muted">{yearRange(item.startYear, item.endYear, item.current)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <h4 className="break-words text-[1.05rem] font-semibold leading-snug text-fg">{item.role}</h4>
                        {item.current && <Badge tone="leaf">Current</Badge>}
                      </div>
                      <p className="mt-0.5 break-words text-fg-soft">
                        {joined(item.organization, place(item.city, item.state), item.employmentType && labelOf(EMPLOYMENT_TYPES, item.employmentType))}
                      </p>
                      <Prose>{item.description}</Prose>
                    </li>
                  ))}
                </ol>
              </Block>
            )}
          </>
        ),
      },
      {
        id: 'practice',
        nav: 'Practice & contact',
        title: 'Clinical practice, address and contact',
        hidden: hiddenFromOthers('links'),
        show: Boolean(p.practiceArea || p.hospital || p.workAddress || location || list('practiceLocations').length || links.length || hasContact),
        render: () => (
          <>
            <div className="grid gap-x-14 gap-y-10 md:grid-cols-2">
              {(p.practiceArea || p.hospital || p.workAddress || location) && (
                <Block title="Main practice">
                  {p.hospital && <p className="break-words font-display text-2xl font-semibold leading-snug text-fg">{p.hospital}</p>}
                  {p.practiceArea && <p className="mt-2 break-words text-fg-soft">{p.practiceArea}</p>}
                  {(p.workAddress || location) && (
                    <p className="mt-3 flex items-start gap-2.5 text-fg-soft">
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        {p.workAddress && <span className="block">{p.workAddress}</span>}
                        {location && <span className="block">{location}</span>}
                      </span>
                    </p>
                  )}
                </Block>
              )}

              {(hasContact || links.length > 0) && (
                <Block title="Contact">
                  {hasContact && (
                    <ul className="space-y-4">
                      {contact.workEmail && (
                        <ContactLine href={`mailto:${contact.workEmail}`} icon={Mail} label="Workplace email">
                          {contact.workEmail}
                        </ContactLine>
                      )}
                      {contact.workPhone && (
                        <ContactLine href={`tel:${contact.workPhone}`} icon={Phone} label="Workplace phone">
                          {contact.workPhone}
                        </ContactLine>
                      )}
                      {contact.email && (
                        <ContactLine href={`mailto:${contact.email}`} icon={Mail} label="Email">
                          {contact.email}
                        </ContactLine>
                      )}
                      {contact.phone && (
                        <ContactLine href={`tel:${contact.phone}`} icon={Phone} label="Phone">
                          {contact.phone}
                        </ContactLine>
                      )}
                    </ul>
                  )}
                  {links.length > 0 && (
                    <ul className={cn('flex flex-wrap gap-x-6 gap-y-2.5', hasContact && 'mt-6')}>
                      {links.map((link) => (
                        <li key={link.id} className="max-w-full">
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 font-semibold text-brand-ink underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                          >
                            <span className="truncate">{link.label}</span>
                            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mine && visibility && hasContact && (
                    <p className="mt-5 text-xs leading-relaxed text-muted">
                      Other members see{' '}
                      {visibility.showEmail && visibility.showPhone
                        ? 'both your account email and phone number'
                        : visibility.showEmail
                          ? 'your account email only'
                          : visibility.showPhone
                            ? 'your account phone number only'
                            : 'neither your account email nor your phone number'}
                      {(contact.workEmail || contact.workPhone) &&
                        (visibility.showWorkContact ? ', plus your workplace contact details' : '; your workplace contact details are hidden')}
                      . You can change this in your profile settings.
                    </p>
                  )}
                </Block>
              )}
            </div>

            {list('practiceLocations').length > 0 && (
              <Block title="Other practice locations">
                <ul className="divide-y divide-line">
                  {p.practiceLocations.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                      <div className="min-w-0">
                        <p className="flex items-start gap-2.5 break-words text-[1.05rem] font-semibold text-fg">
                          <Building2 className="mt-1 h-4 w-4 shrink-0 text-leaf" aria-hidden="true" />
                          {item.hospital}
                        </p>
                        {(item.area || item.address || item.city || item.state || item.country) && (
                          <p className="mt-0.5 break-words pl-[1.65rem] text-fg-soft">
                            {joined(item.area, place(item.address, item.city, item.state, item.country))}
                          </p>
                        )}
                      </div>
                      {item.phone && (
                        <a
                          href={`tel:${item.phone}`}
                          className="inline-flex shrink-0 items-center gap-1.5 pl-[1.65rem] text-sm font-semibold text-brand-ink hover:underline sm:pl-0"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        ),
      },
      {
        id: 'education',
        nav: 'Education',
        title: 'Education, degrees and certification',
        hidden: hiddenFromOthers('education', 'qualifications'),
        show: Boolean(list('education').length || list('qualifications').length || list('credentials').length),
        render: () => (
          <>
            {list('qualifications').length > 0 && <Chips items={p.qualifications} tone="brand" />}
            {list('education').length > 0 && (
              <Block title="Academic degrees">
                <Rows>
                  {p.education.map((item) => (
                    <Row
                      key={item.id}
                      when={yearRange(item.startYear, item.year)}
                      title={joined(item.degree, item.fieldOfStudy)}
                      subtitle={joined(item.institution, levelLabel(item.level))}
                    >
                      {item.certification && (
                        <p className="mt-2 flex items-start gap-2 text-sm font-medium text-leaf-strong">
                          <Award className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 break-words">{item.certification}</span>
                        </p>
                      )}
                      <Prose>{item.details}</Prose>
                    </Row>
                  ))}
                </Rows>
              </Block>
            )}
            {list('credentials').length > 0 && (
              <Block title="Professional qualifications and certifications">
                <Rows>
                  {p.credentials.map((item) => (
                    <Row
                      key={item.id}
                      when={item.year}
                      title={item.title}
                      subtitle={joined(item.type && labelOf(CREDENTIAL_TYPES, item.type), item.institution)}
                    >
                      {item.registration && <Private show={numbersPrivate}>Registration: {item.registration}</Private>}
                      <Prose>{item.details}</Prose>
                    </Row>
                  ))}
                </Rows>
              </Block>
            )}
          </>
        ),
      },
      {
        id: 'fellowships',
        nav: 'Fellowship',
        title: 'Fellowship and postdoctoral certification',
        hidden: hiddenFromOthers('fellowships'),
        show: list('fellowships').length > 0,
        render: () => (
          <Rows>
            {p.fellowships.map((item) => (
              <Row
                key={item.id}
                when={yearRange(item.startYear, item.endYear)}
                title={item.title}
                subtitle={joined(item.institution, item.specialty)}
                badge={item.certificate ? <Badge tone="brand">{item.certificate}</Badge> : null}
              >
                <Prose>{item.description}</Prose>
              </Row>
            ))}
          </Rows>
        ),
      },
      {
        id: 'awards',
        nav: 'Awards',
        title: 'Awards',
        hidden: hiddenFromOthers('achievements'),
        show: list('achievements').length > 0,
        render: () => (
          <ul className="divide-y divide-line">
            {p.achievements.map((item) => {
              const image = safeHref(item.imageUrl);
              return (
                <li key={item.id} className="flex gap-5 py-5 first:pt-0 last:pb-0">
                  {image ? (
                    <a
                      href={image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface-2 shadow-soft sm:h-28 sm:w-28"
                      aria-label={`Open the image for ${item.title} (opens in a new tab)`}
                    >
                      <img
                        src={safeHref(item.imageThumbUrl) || image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.05]"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-strong" aria-hidden="true">
                      <Award className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0 self-center">
                    {item.year && <p className="text-sm font-semibold tabular-nums text-muted">{item.year}</p>}
                    <h3 className="break-words font-display text-xl font-semibold leading-snug text-fg">{item.title}</h3>
                    {item.issuer && <p className="mt-0.5 break-words text-fg-soft">{item.issuer}</p>}
                    <Prose>{item.description}</Prose>
                  </div>
                </li>
              );
            })}
          </ul>
        ),
      },
      {
        id: 'memberships',
        nav: 'Membership',
        title: 'Membership',
        hidden: hiddenFromOthers('memberships'),
        show: list('memberships').length > 0,
        render: () => (
          <Rows>
            {p.memberships.map((item) => (
              <Row
                key={item.id}
                when={yearRange(item.startYear, item.endYear, item.current)}
                title={item.organization}
                subtitle={item.type}
                badge={item.current ? <Badge tone="leaf">Current member</Badge> : null}
              >
                {item.number && <Private show={numbersPrivate}>Membership no. {item.number}</Private>}
              </Row>
            ))}
          </Rows>
        ),
      },
      {
        id: 'publications',
        nav: 'Publications',
        title: 'Publications',
        hidden: hiddenFromOthers('publications'),
        show: list('publications').length > 0,
        render: () => (
          <ol className="divide-y divide-line">
            {p.publications.map((item, index) => {
              const href = safeHref(item.url);
              return (
                <li key={item.id} className="flex gap-5 py-5 first:pt-0 last:pb-0">
                  <span className="w-9 shrink-0 font-display text-2xl font-semibold tabular-nums leading-none text-line-strong" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words text-[1.05rem] font-semibold leading-snug text-fg">{item.title}</h3>
                    {item.authors && <p className="mt-1 break-words text-fg-soft">{item.authors}</p>}
                    {(item.journal || item.year) && <p className="break-words italic text-fg-soft">{joined(item.journal, item.year)}</p>}
                    <Prose>{item.description}</Prose>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mt-2.5 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{/doi\.org\//i.test(href) ? 'View DOI' : 'View publication'}</span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ),
      },
      {
        id: 'gallery',
        nav: 'Gallery & blogs',
        title: 'Gallery and blogs',
        hidden: hiddenFromOthers('gallery'),
        // The owner always gets this chapter, so there is somewhere to add from without opening the profile form.
        show: Boolean(photos.length || articles.length || mine),
        action: mine ? (
          <>
            <Button href="/dashboard/create/memory" variant="secondary" size="sm" icon={Plus}>
              Add photos
            </Button>
            <Button href="/dashboard/create/blog" variant="secondary" size="sm" icon={Plus}>
              Write a blog
            </Button>
          </>
        ) : null,
        render: () => (
          <>
            {(photos.length > 0 || mine) && (
              <Block title="Personal gallery">
                {photos.length === 0 ? (
                  <p className="text-fg-soft">Nothing in your gallery yet. Photos you add are published straight away.</p>
                ) : (
                  <>
                    {/* With three or more photos the first one leads at double size. */}
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {photos.map((memory, index) => {
                        const cover = memory.media && memory.media[0];
                        const lead = index === 0 && photos.length >= 3;
                        return (
                          <li key={memory.id} className={cn(lead && 'col-span-2 row-span-2')}>
                            <Link
                              href={`/memories?memory=${memory.id}`}
                              className="group relative block aspect-square overflow-hidden rounded-2xl bg-surface-2"
                              aria-label={`Open: ${memory.title}`}
                            >
                              {cover && (
                                <img
                                  src={cover.thumbUrl || cover.url}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                                  loading="lazy"
                                />
                              )}
                              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3.5 pb-3 pt-10 text-left">
                                <span className={cn('block truncate font-semibold text-white', lead ? 'text-base' : 'text-sm')}>{memory.title}</span>
                                {memory.memoryDate && <span className="block text-xs text-white/85">{formatDate(memory.memoryDate)}</span>}
                              </span>
                              {memory.media.length > 1 && (
                                <span className="absolute right-2.5 top-2.5 rounded-full bg-black/65 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                                  {memory.media.length}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {gallery.meta && gallery.meta.total > photos.length && (
                      <p className="mt-3 text-xs text-muted">
                        Showing the latest {photos.length} of {gallery.meta.total} items.
                      </p>
                    )}
                  </>
                )}
              </Block>
            )}
            {(articles.length > 0 || mine) && (
              <Block title="Blogs">
                {articles.length === 0 ? (
                  <p className="text-fg-soft">No blogs yet. A blog you write appears here and on the Blogs page at once.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {articles.map((blog) => (
                      <li key={blog.id} className="py-5 first:pt-0 last:pb-0">
                        <Link href={`/blogs/${blog.slug}`} className="group flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                          <span className="block aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-surface-2 sm:w-44">
                            {blog.cover ? (
                              <img
                                src={blog.cover.thumbUrl || blog.cover.url}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-leaf-soft text-brand-ink/60">
                                <BookOpen className="h-7 w-7" aria-hidden="true" />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="eyebrow block">{blog.category}</span>
                            <span className="mt-1.5 block break-words font-display text-xl font-semibold leading-snug text-fg group-hover:text-brand-ink">
                              {blog.title}
                            </span>
                            <span className="mt-1.5 line-clamp-2 block text-fg-soft">{blog.excerpt}</span>
                            <span className="mt-2 block text-xs text-muted">
                              {joined(blog.publishedAt && formatDate(blog.publishedAt), blog.readingMinutes && `${blog.readingMinutes} min read`)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
            )}
          </>
        ),
      },
    ].filter((section) => section.show);

    // Without profile details the owner's gallery prompt alone would look odd: show the invitation instead.
    const hasDetails = sections.some((section) => section.id !== 'gallery') || photos.length > 0 || articles.length > 0;

    body = (
      <>
        {/* ── Hero ── */}
        <header className="pb-10 pt-6 sm:pb-14 sm:pt-10">
          <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
            <div className="rise-in relative isolate mx-auto w-fit md:mx-0">
              <div
                className="absolute -inset-3 -z-10 rounded-[2.6rem] bg-gradient-to-br from-brand/25 via-transparent to-leaf/30 blur-xl"
                aria-hidden="true"
              />
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt={doctor.name}
                  className="h-44 w-44 rounded-[2rem] object-cover shadow-lift ring-1 ring-line sm:h-56 sm:w-56 lg:h-64 lg:w-64"
                  fetchPriority="high"
                />
              ) : (
                <div
                  role="img"
                  aria-label={doctor.name}
                  className="flex h-44 w-44 items-center justify-center rounded-[2rem] bg-gradient-to-br from-brand-soft to-leaf-soft font-display text-6xl font-semibold text-brand-ink shadow-lift ring-1 ring-line sm:h-56 sm:w-56 lg:h-64 lg:w-64"
                >
                  {initials(doctor.name)}
                </div>
              )}
            </div>

            <div className="min-w-0 text-center md:text-left">
              {(p.specialization || p.subspecialty) && (
                <p className="rise-in eyebrow" style={{ '--delay': '60ms' }}>
                  {joined(p.specialization, p.subspecialty)}
                </p>
              )}
              <h1
                className="rise-in mt-3 break-words font-display text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]"
                style={{ '--delay': '120ms' }}
              >
                {doctor.name}
              </h1>
              {(p.professionalTitle || p.designation) && (
                <p className="rise-in mt-3 break-words text-lg text-fg-soft sm:text-xl" style={{ '--delay': '180ms' }}>
                  {joined(p.professionalTitle, p.designation)}
                </p>
              )}

              <dl className="rise-in mt-6 flex flex-col items-center gap-x-7 gap-y-2.5 md:flex-row md:flex-wrap md:items-start" style={{ '--delay': '240ms' }}>
                {p.hospital && (
                  <HeroFact icon={Building2} label="Hospital or clinic">
                    {p.hospital}
                  </HeroFact>
                )}
                {location && (
                  <HeroFact icon={MapPin} label="Location">
                    {location}
                  </HeroFact>
                )}
                {p.address && (
                  <HeroFact icon={House} label="Address">
                    {p.address}
                  </HeroFact>
                )}
                {doctor.memberSince && (
                  <HeroFact icon={UserRound} label="Member since">
                    Member since {formatDate(doctor.memberSince, { month: 'long', year: 'numeric' })}
                  </HeroFact>
                )}
              </dl>

              {(mailTo || callTo || mine) && (
                <div className="rise-in mt-7 flex flex-wrap justify-center gap-3 md:justify-start" style={{ '--delay': '300ms' }}>
                  {mailTo && (
                    <Button href={`mailto:${mailTo}`} icon={Mail}>
                      Get in touch
                    </Button>
                  )}
                  {callTo && (
                    <Button href={`tel:${callTo}`} variant="secondary" icon={Phone}>
                      Call
                    </Button>
                  )}
                  {mine && (
                    <Button href="/dashboard/profile" variant="secondary" icon={Pencil}>
                      Edit profile
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {figures.length > 1 && (
            <dl className="rise-in mt-10 grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:mt-14 sm:flex sm:justify-between sm:gap-6" style={{ '--delay': '360ms' }}>
              {figures.map(([count, label]) => (
                <div key={label} className="flex flex-col-reverse items-center text-center sm:flex-1">
                  <dt className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
                  <dd className="font-display text-4xl font-semibold tabular-nums text-gradient-brand">{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {!hasDetails ? (
          <EmptyState
            icon={ScrollText}
            title={mine ? 'Your portfolio is waiting for you' : 'This profile is still being completed'}
            description={
              mine
                ? 'Add your expertise, practice, education and awards so batchmates can see your journey.'
                : 'This doctor has not added further details yet.'
            }
            action={mine ? <Button href="/dashboard/profile">Complete my profile</Button> : null}
          />
        ) : (
          <>
            {/* ── Chapter bar: stays in reach while reading ── */}
            {sections.length > 2 && (
              <nav
                aria-label="Sections of this profile"
                className="glass sticky top-[4.6rem] z-30 -mx-2 rounded-full px-2 py-1.5 shadow-soft sm:mx-0"
              >
                <ul className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sections.map((section) => (
                    <li key={section.id} className="shrink-0">
                      <a
                        href={`#${section.id}`}
                        className="inline-flex whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-fg-soft transition-colors hover:bg-brand-soft hover:text-brand-ink"
                      >
                        {section.nav}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="mt-6 [&>section:first-child]:border-t-0">
              {sections.map((section, index) => (
                <Section key={section.id} id={section.id} number={index + 1} title={section.title} hidden={section.hidden} action={section.action}>
                  {section.render()}
                </Section>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="relative">
      {/* Soft backdrop behind the hero: one restrained wash, as on the homepage. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem]"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(56rem 24rem at 10% -10%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%), radial-gradient(44rem 22rem at 92% 0%, color-mix(in srgb, var(--leaf) 12%, transparent), transparent 70%)',
        }}
      />
      <div className="container-page relative pb-12 pt-6 sm:pb-16 sm:pt-8">
        <BackLink />
        <div className="mt-2">{body}</div>
      </div>
    </div>
  );
}
