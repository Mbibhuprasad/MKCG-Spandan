'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Award,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  ExternalLink,
  EyeOff,
  Globe,
  House,
  Images,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  Play,
  Plus,
  ScrollText,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { site } from '@/lib/site';
import { CREDENTIAL_TYPES, DEFAULT_COUNTRY, DEGREE_LEVELS, EMPLOYMENT_TYPES, labelOf } from '@/lib/constants';
import { cn, formatDate, plural, yearRange } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import Reveal from '@/components/ui/Reveal';
import BlogCard from '@/components/cards/BlogCard';
import MemoryLightbox from '@/components/memories/MemoryLightbox';
import PortfolioHero from './portfolio/PortfolioHero';
import PortfolioNav, { PortfolioSidebar } from './portfolio/PortfolioNav';
import { HEADING, HiddenBadge, IconTile, InfoBox, LIFT, OVERLINE, Panel, PanelTitle, Private, Prose, Section, Tags, Timeline } from './portfolio/parts';

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Links were validated by the API; this is a second check before rendering an href.
const safeHref = (url) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : null);

// WhatsApp chat link for a stored "+<digits>" number.
const whatsappHref = (number) => {
  const digits = String(number || '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
};

// A map search for a saved practice address. Nothing is geocoded or stored:
// the link only carries the name and address the doctor entered.
const directionsHref = (...parts) => {
  const query = parts.filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

const joined = (...parts) => parts.filter(Boolean).join(' · ');
const place = (...parts) => parts.filter(Boolean).join(', ');
const levelLabel = (level) => (level ? labelOf(DEGREE_LEVELS, level).replace(/ \(.*\)$/, '') : '');

// Summary bar: its columns follow the number of facts the profile has.
const SUMMARY_COLUMNS = { 1: '', 2: 'grid-cols-2', 3: 'sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' };
const SUMMARY_TONES = ['text-fg', 'text-brand-ink', 'text-fg', 'text-leaf-strong'];

/** A row of the "at a glance" panel beside the biography. */
function GlanceRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <IconTile icon={icon} className="h-10 w-10" />
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-0.5 break-words font-bold leading-snug text-fg">{children}</dd>
      </div>
    </div>
  );
}

/** A hospital or clinic where the doctor practises. */
function ClinicCard({ main, name, designation, area, address, location, phone, email, directions }) {
  return (
    <li className={cn('flex h-full flex-col rounded-[1.5rem] border border-line bg-surface p-6 shadow-soft', LIFT)}>
      <div className="flex items-start gap-3.5">
        <IconTile icon={Building2} />
        <div className="min-w-0">
          <p className={cn('text-[0.68rem] font-extrabold uppercase tracking-[0.14em]', main ? 'text-leaf-strong' : 'text-muted')}>
            {main ? 'Main practice' : 'Also practises at'}
          </p>
          <h3 className={cn(HEADING, 'mt-1 break-words text-lg leading-snug')}>{name}</h3>
        </div>
      </div>
      {designation && <p className="mt-4 break-words font-bold text-brand-ink">{designation}</p>}
      {area && <p className={cn('break-words text-sm text-fg-soft', designation ? 'mt-1' : 'mt-4')}>{area}</p>}

      {(address || location || phone || email) && (
        <ul className="mt-4 space-y-3 text-sm text-fg-soft">
          {(address || location) && (
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-brand-ink" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {address && <span className="block">{address}</span>}
                {location && <span className="block">{location}</span>}
              </span>
            </li>
          )}
          {phone && (
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-leaf" aria-hidden="true" />
              <a href={`tel:${phone}`} className="min-w-0 break-words font-semibold text-fg hover:text-brand-ink hover:underline">
                {phone}
              </a>
            </li>
          )}
          {email && (
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-brand-ink" aria-hidden="true" />
              <a href={`mailto:${email}`} className="min-w-0 break-all font-semibold text-fg hover:text-brand-ink hover:underline">
                {email}
              </a>
            </li>
          )}
        </ul>
      )}

      {directions && (
        <div className="mt-auto pt-5">
          <p className="border-t border-line pt-4">
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink hover:underline"
            >
              <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
              Get directions
              <span className="sr-only">to {name} (opens a map in a new tab)</span>
            </a>
          </p>
        </div>
      )}
    </li>
  );
}

/** A contact detail in the "get in touch" panel. */
function ContactBox({ href, icon: Icon, label, tone = 'brand', external = false, children }) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="group flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
      >
        <Icon className={cn('h-5 w-5 shrink-0', tone === 'leaf' ? 'text-leaf' : 'text-brand-ink')} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-fg-soft">{label}</span>
          <span className="mt-0.5 block truncate font-extrabold text-fg group-hover:text-brand-ink">{children}</span>
        </span>
        {external && <span className="sr-only">(opens in a new tab)</span>}
      </a>
    </li>
  );
}

/** A gallery photo. Opens the memory it belongs to in the lightbox. */
function GalleryTile({ memory, onOpen }) {
  const cover = memory.media && memory.media[0];
  const src = cover && (cover.thumbUrl || cover.url);
  const count = memory.media ? memory.media.length : 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(memory.id)}
        className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] border border-line bg-surface-2 text-left shadow-soft transition-shadow duration-200 hover:shadow-lift"
        aria-label={`Open: ${memory.title} (${plural(count, 'file')})`}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted">
            <Images className="h-8 w-8" aria-hidden="true" />
          </span>
        )}
        {cover && cover.resourceType === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
            </span>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-3.5 pt-12">
          <span className="block truncate text-sm font-bold text-white">{memory.title}</span>
          {memory.memoryDate && <span className="block text-xs text-white/85">{formatDate(memory.memoryDate)}</span>}
        </span>
        {count > 1 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
            <Images className="h-3 w-3" aria-hidden="true" />
            {count}
          </span>
        )}
      </button>
    </li>
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
        <div className="flex-1 space-y-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-12 w-3/5" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <Skeleton className="h-52 w-52 rounded-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-[1.75rem]" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * A doctor's professional portfolio, built entirely from their saved profile:
 * a navy hero, a bar of summary figures, then — on a light ground — about,
 * credentials, clinical services, experience and education as two timelines,
 * fellowships, awards and memberships, publications, practice locations and
 * contact, gallery and blogs. Sections and cards without data are not rendered,
 * and nothing is estimated.
 *
 * The API returns the repeated sections already in display order (highest or
 * most recent first) and with the doctor's visibility choices applied.
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
  const [openMemory, setOpenMemory] = useState('');

  // The page is member-only and rendered in the browser, so the tab title is
  // set here from what this member was allowed to load — never in the HTML.
  const tabName = doctor ? doctor.name : '';
  const tabSpecialty = (doctor && doctor.profile && doctor.profile.specialization) || '';
  useEffect(() => {
    if (!tabName) return undefined;
    const previous = document.title;
    document.title = `${joined(tabName, tabSpecialty)} | ${site.name}`;
    return () => {
      document.title = previous;
    };
  }, [tabName, tabSpecialty]);

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
        <h1 className={cn(HEADING, 'mt-4 text-2xl')}>{doctor.name}</h1>
        {p.professionalTitle && <p className="mt-1 text-fg-soft">{p.professionalTitle}</p>}
        {p.specialization && (
          <Badge tone="leaf" icon={Stethoscope} className="mt-3">
            {p.specialization}
          </Badge>
        )}
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm text-muted">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This member has chosen to share only a brief name card, so their portfolio is not shown.
        </p>
      </div>
    );
  }

  if (body) {
    return (
      <div className="container-page pb-12 pt-6 sm:pb-16 sm:pt-8">
        <BackLink />
        <div className="mt-4">{body}</div>
      </div>
    );
  }

  const p = doctor.profile || {};
  const contact = doctor.contact || {};
  const visibility = doctor.visibility || null; // present for the owner and administrators only
  const mine = Boolean(doctor.isMine);
  const list = (key) => p[key] || [];
  // Sections the owner switched off: other members never receive them, the owner sees a reminder.
  const hiddenFromOthers = (...keys) =>
    Boolean(mine && visibility && visibility.sections && keys.some((key) => visibility.sections[key] === false));
  const numbersPrivate = Boolean(mine && visibility && !visibility.showRegistration);
  const bloodGroupPrivate = Boolean(mine && visibility && !visibility.showBloodGroup);

  const country = p.country && p.country.toLowerCase() !== DEFAULT_COUNTRY.toLowerCase() ? p.country : '';
  const location = place(p.city, p.state, country);
  const links = list('links')
    .map((l) => ({ ...l, href: safeHref(l.url) }))
    .filter((l) => l.href);
  const whatsapp = whatsappHref(contact.whatsapp);
  const hasContact = Boolean(contact.email || contact.phone || contact.workEmail || contact.workPhone || whatsapp);
  const mailTo = contact.workEmail || contact.email;
  const callTo = contact.workPhone || contact.phone;
  const photos = gallery.data || [];
  const articles = blogs.data || [];

  const education = list('education');
  const experience = list('experience');
  const qualifications = list('qualifications');
  const credentials = list('credentials');
  // A city alone is a location, not a practice: it is shown in the hero and the summary instead of on a card.
  const hasMainPractice = Boolean(p.hospital || p.practiceArea || p.workAddress);
  const currentRole = experience.find((item) => item.current);
  const career = (doctor.summary && doctor.summary.experience) || {};
  const years = career.years >= 1 ? career.years : 0;

  // Summary bar: each figure is built from saved data and left out when there is none.
  const summary = [
    years > 0 && {
      label: years === 1 ? 'Year of experience' : 'Years of experience',
      value: String(years),
      hint: `In practice since ${career.since}`,
      figure: true,
    },
    p.specialization && { label: 'Specialization', value: p.specialization, hint: p.subspecialty },
    (p.hospital || (currentRole && currentRole.organization)) && {
      label: 'Current practice',
      value: p.hospital || currentRole.organization,
      hint: p.hospital ? joined(p.designation, location) : currentRole.role,
    },
    (qualifications.length > 0 || education.length > 0) && {
      label: 'Qualifications',
      value: qualifications.length ? qualifications.join(', ') : joined(education[0].degree, education[0].fieldOfStudy),
      hint: education.length ? education[0].institution : '',
    },
  ].filter(Boolean);

  // Practice locations: the main hospital or clinic first, then every other one saved.
  const clinics = [
    hasMainPractice && {
      id: 'main',
      main: true,
      name: p.hospital || p.practiceArea || p.workAddress,
      designation: p.hospital ? p.designation : '',
      area: p.hospital ? p.practiceArea : '',
      address: p.hospital || p.practiceArea ? p.workAddress : '',
      location,
      phone: contact.workPhone,
      email: contact.workEmail,
      directions: p.workAddress || p.city ? directionsHref(p.hospital, p.workAddress, p.city, p.state, p.country) : null,
    },
    ...list('practiceLocations').map((item) => ({
      id: item.id,
      main: false,
      name: item.hospital,
      designation: item.designation,
      area: item.area,
      address: item.address,
      location: place(item.city, item.state, item.country),
      phone: item.phone,
      directions: item.address || item.city ? directionsHref(item.hospital, item.address, item.city, item.state, item.country) : null,
    })),
  ].filter(Boolean);
  const hasContactPanel = hasContact || links.length > 0;

  // "At a glance", beside the biography.
  const glance = [
    p.hospital && { icon: Building2, label: 'Current practice', text: p.hospital },
    location && { icon: MapPin, label: 'Location', text: location },
    p.address && { icon: House, label: 'Address', text: p.address },
    doctor.memberSince && {
      icon: CalendarDays,
      label: `Member of ${site.name}`,
      text: `Since ${formatDate(doctor.memberSince, { month: 'long', year: 'numeric' })}`,
    },
  ].filter(Boolean);
  const hasAboutText = Boolean(p.bio || list('languages').length || p.bloodGroup);

  // Credential boxes: facts of the profile first, then each detailed qualification.
  const credentialsHidden = hiddenFromOthers('qualifications');
  const credentialFacts = [
    qualifications.length > 0 && { icon: Award, label: 'Medical degrees', value: qualifications.join(', ') },
    p.specialization && { icon: Activity, label: 'Specialization', value: p.specialization },
    p.subspecialty && { icon: Stethoscope, label: 'Subspecialization', value: p.subspecialty },
    p.designation && { icon: BriefcaseMedical, label: 'Current designation', value: p.designation, sub: p.hospital },
  ].filter(Boolean);

  const hasServices = Boolean(p.fieldOfWork || p.practiceArea || list('expertise').length || list('procedures').length);
  const hasAwards = list('achievements').length > 0;
  const hasMemberships = list('memberships').length > 0;

  // In-page navigation, in the order the sections appear.
  const nav = [
    (hasAboutText || glance.length > 0) && { id: 'about', label: 'About' },
    // The specialization alone is already in the hero and the summary bar.
    (credentials.length > 0 || credentialFacts.some((fact) => fact.label !== 'Specialization')) && { id: 'credentials', label: 'Credentials' },
    hasServices && { id: 'services', label: 'Services' },
    experience.length > 0 && { id: 'experience', label: 'Experience' },
    education.length > 0 && { id: 'education', label: 'Education' },
    list('fellowships').length > 0 && { id: 'fellowships', label: 'Fellowships' },
    (hasAwards || hasMemberships) && { id: 'awards', label: 'Awards' },
    list('publications').length > 0 && { id: 'publications', label: 'Publications' },
    clinics.length > 0 && { id: 'locations', label: 'Locations' },
    hasContactPanel && { id: 'contact', label: 'Contact' },
    // The owner always gets these two, so there is somewhere to add from without opening the profile form.
    (photos.length > 0 || mine) && { id: 'gallery', label: 'Gallery' },
    (articles.length > 0 || mine) && { id: 'blogs', label: 'Blogs' },
  ].filter(Boolean);
  const shows = (sectionId) => nav.some((section) => section.id === sectionId);

  // Without profile details the owner's gallery and blog prompts alone would look odd: show the invitation instead.
  const hasDetails = nav.some((section) => section.id !== 'gallery' && section.id !== 'blogs') || photos.length > 0 || articles.length > 0;

  // Both forms of the profile navigation get the same links; Contact is their button.
  const navLinks = hasDetails ? nav.filter((section) => section.id !== 'contact') : [];
  const contactHref = hasContactPanel ? '#contact' : null;

  const heroFacts = [
    years > 0 && { icon: BriefcaseMedical, label: 'Experience', text: `${plural(years, 'year')} of experience` },
    p.hospital && { icon: Building2, label: 'Hospital or clinic', text: p.hospital },
    location && { icon: MapPin, label: 'Location', text: location },
  ].filter(Boolean);
  const heroActions = [
    mailTo
      ? { href: `mailto:${mailTo}`, label: 'Get in touch', icon: Mail }
      : hasContactPanel && { href: '#contact', label: 'Contact details', icon: Mail },
    mine && { href: '/dashboard/profile', label: 'Edit profile', icon: Pencil },
  ].filter(Boolean);
  const heroQuick = [
    callTo && { href: `tel:${callTo}`, label: 'Call', icon: Phone, tone: 'cyan' },
    whatsapp && { href: whatsapp, label: 'WhatsApp', icon: MessageCircle, tone: 'light', external: true },
  ].filter(Boolean);

  return (
    <div className="relative bg-bg-soft">
      <PortfolioNav name={doctor.name} sections={navLinks} contactHref={contactHref} />
      <PortfolioHero
        name={doctor.name}
        photoUrl={p.photoUrl}
        eyebrow={joined(p.specialization, p.subspecialty)}
        title={joined(p.professionalTitle, p.designation)}
        headline={p.headline}
        bio={p.bio}
        facts={heroFacts}
        actions={heroActions}
        quick={heroQuick}
      />

      <div className="container-page relative pb-14 sm:pb-20">
        {/* ── Summary bar: overlaps the foot of the hero ── */}
        {summary.length > 0 ? (
          <dl
            className={cn(
              'rise-in relative -mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line shadow-lift sm:-mt-16',
              SUMMARY_COLUMNS[summary.length]
            )}
            style={{ '--delay': '420ms' }}
          >
            {summary.map((item, index) => (
              <div key={item.label} className="flex flex-col items-center bg-surface px-4 py-5 text-center sm:px-6 sm:py-6">
                <dt className="order-2 mt-1 text-sm font-semibold text-fg-soft">{item.label}</dt>
                <dd
                  className={cn(
                    'order-1 line-clamp-3 break-words font-sans font-extrabold leading-tight tracking-tight',
                    item.figure ? 'text-3xl sm:text-[2rem]' : 'text-base sm:text-lg',
                    SUMMARY_TONES[index]
                  )}
                >
                  {item.value}
                </dd>
                {item.hint && <dd className="order-3 mt-1 line-clamp-2 break-words text-xs text-muted">{item.hint}</dd>}
              </div>
            ))}
          </dl>
        ) : (
          <div className="h-6" />
        )}

        {!hasDetails ? (
          <EmptyState
            className="mt-10"
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
          <div className="pt-6 sm:pt-8 xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:items-start xl:gap-x-12">
            <div className="min-w-0">
              {/* ── About ── */}
              {shows('about') && (
                <section id="about" aria-labelledby="about-title" className="scroll-mt-40 py-9 sm:py-12 xl:scroll-mt-24">
                  <Reveal className={cn('grid gap-x-12 gap-y-8', hasAboutText && glance.length > 0 && 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]')}>
                    <div className="min-w-0">
                      <p className={OVERLINE}>Biography</p>
                      <h2 id="about-title" className={cn(HEADING, 'mt-2 break-words text-3xl leading-[1.12] sm:text-[2.4rem]')}>
                        About {doctor.name}
                      </h2>
                      {p.bio && <p className="mt-5 max-w-3xl whitespace-pre-line break-words text-[1.05rem] leading-[1.8] text-fg-soft">{p.bio}</p>}
                      {list('languages').length > 0 && (
                        <div className="mt-6">
                          <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">Languages</p>
                          <Tags items={p.languages} />
                        </div>
                      )}
                      {p.bloodGroup && (
                        <div className="mt-4">
                          <Private show={bloodGroupPrivate}>Blood group: {p.bloodGroup}</Private>
                        </div>
                      )}
                    </div>
                    {glance.length > 0 && (
                      <Panel className={cn('self-start', !hasAboutText && 'max-w-3xl')}>
                        <h3 className={cn(HEADING, 'text-lg')}>At a glance</h3>
                        <dl className="mt-4 divide-y divide-line">
                          {glance.map((item) => (
                            <GlanceRow key={item.label} icon={item.icon} label={item.label}>
                              {item.text}
                            </GlanceRow>
                          ))}
                        </dl>
                      </Panel>
                    )}
                  </Reveal>
                </section>
              )}

              {/* ── Professional credentials ── */}
              {shows('credentials') && (
                <Section id="credentials" overline="Credentials" title="Professional credentials" hidden={credentialsHidden}>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {credentialFacts.map((item) => (
                      <InfoBox as="li" key={item.label} {...item} />
                    ))}
                    {credentials.map((item) => (
                      <InfoBox
                        as="li"
                        key={item.id}
                        icon={ScrollText}
                        label={item.type ? labelOf(CREDENTIAL_TYPES, item.type) : 'Qualification'}
                        value={item.title}
                        sub={joined(item.institution, item.year)}
                      >
                        {item.registration && <Private show={numbersPrivate}>Registration: {item.registration}</Private>}
                        <Prose>{item.details}</Prose>
                      </InfoBox>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Clinical services and procedures ── */}
              {shows('services') && (
                <Section id="services" overline="Clinical services" title="Expertise and procedures" align="center">
                  <div className="space-y-5">
                    {(p.fieldOfWork || p.practiceArea) && (
                      <ul className="grid gap-4 sm:grid-cols-2">
                        {p.fieldOfWork && <InfoBox as="li" icon={BriefcaseMedical} label="Field of work" value={p.fieldOfWork} />}
                        {p.practiceArea && <InfoBox as="li" icon={Stethoscope} label="Clinical practice area" value={p.practiceArea} />}
                      </ul>
                    )}
                    {list('expertise').length > 0 && (
                      <Panel>
                        <PanelTitle>Areas of expertise</PanelTitle>
                        <Tags items={p.expertise} />
                      </Panel>
                    )}
                    {list('procedures').length > 0 && (
                      <div>
                        <h3 className={cn(HEADING, 'mb-4 text-lg')}>Procedures performed</h3>
                        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {p.procedures.map((item) => (
                            <li key={item} className={cn('flex h-full items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-soft', LIFT)}>
                              <IconTile icon={Activity} />
                              <span className="min-w-0 break-words font-bold leading-snug text-fg">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Experience and education: two timelines, side by side on wide screens ── */}
              {(shows('experience') || shows('education')) && (
                <div className={cn('grid gap-x-12', shows('experience') && shows('education') && 'lg:grid-cols-2')}>
                  {shows('experience') && (
                    <Section id="experience" overline="Experience" title="Professional experience" hidden={hiddenFromOthers('experience')}>
                      {/* Current positions first, then the most recently held. */}
                      <Timeline items={experience}>
                        {(item) => (
                          <>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">{item.role}</h3>
                              {item.current && <Badge tone="leaf">Current</Badge>}
                            </div>
                            {item.organization && <p className="mt-1 break-words text-sm font-bold text-fg">{item.organization}</p>}
                            {(item.city || item.state || item.employmentType) && (
                              <p className="mt-0.5 break-words text-sm text-fg-soft">
                                {joined(place(item.city, item.state), item.employmentType && labelOf(EMPLOYMENT_TYPES, item.employmentType))}
                              </p>
                            )}
                            {(item.startYear || item.endYear || item.current) && (
                              <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">{yearRange(item.startYear, item.endYear, item.current)}</p>
                            )}
                            <Prose>{item.description}</Prose>
                          </>
                        )}
                      </Timeline>
                    </Section>
                  )}
                  {shows('education') && (
                    <Section id="education" overline="Education" title="Academic degrees" hidden={hiddenFromOthers('education')}>
                      {/* Highest qualification first. */}
                      <Timeline items={education} accent="ink">
                        {(item) => (
                          <>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">{item.degree}</h3>
                              {item.level && <Badge>{levelLabel(item.level)}</Badge>}
                            </div>
                            {item.fieldOfStudy && <p className="mt-1 break-words text-sm font-bold text-fg">{item.fieldOfStudy}</p>}
                            {item.institution && <p className="mt-0.5 break-words text-sm text-fg-soft">{item.institution}</p>}
                            {(item.startYear || item.year) && (
                              <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">
                                {item.year && !item.startYear ? `Class of ${item.year}` : yearRange(item.startYear, item.year)}
                              </p>
                            )}
                            {item.certification && (
                              <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-leaf-strong">
                                <Award className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 break-words">{item.certification}</span>
                              </p>
                            )}
                            <Prose>{item.details}</Prose>
                          </>
                        )}
                      </Timeline>
                    </Section>
                  )}
                </div>
              )}

              {/* ── Fellowships and postdoctoral qualifications ── */}
              {shows('fellowships') && (
                <Section
                  id="fellowships"
                  overline="Advanced training"
                  title="Fellowships and postdoctoral qualifications"
                  hidden={hiddenFromOthers('fellowships')}
                >
                  <ul className="grid gap-4 md:grid-cols-2">
                    {p.fellowships.map((item) => (
                      <li key={item.id} className={cn('flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft', LIFT)}>
                        <IconTile icon={Medal} tone="leaf" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">{item.title}</h3>
                          {(item.institution || item.specialty) && (
                            <p className="mt-1 break-words text-sm font-bold text-fg">{joined(item.institution, item.specialty)}</p>
                          )}
                          {(item.startYear || item.endYear) && (
                            <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">{yearRange(item.startYear, item.endYear)}</p>
                          )}
                          <Prose>{item.description}</Prose>
                          {item.certificate && (
                            <p className="mt-auto pt-3">
                              <Badge tone="brand" className="max-w-full whitespace-normal break-words">
                                {item.certificate}
                              </Badge>
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Awards and memberships: two separate groups ── */}
              {shows('awards') && (
                <Section id="awards" icon={Award} title="Awards and memberships">
                  <div className={cn('grid items-start gap-5', hasAwards && hasMemberships && 'lg:grid-cols-2')}>
                    {hasAwards && (
                      <Panel>
                        <PanelTitle hidden={hiddenFromOthers('achievements')}>Awards</PanelTitle>
                        <ul className="divide-y divide-line">
                          {p.achievements.map((item) => {
                            const image = safeHref(item.imageUrl);
                            return (
                              <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                                {image ? (
                                  <a
                                    href={image}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-20 sm:w-20"
                                    aria-label={`Open the image for ${item.title} (opens in a new tab)`}
                                  >
                                    <img
                                      src={safeHref(item.imageThumbUrl) || image}
                                      alt=""
                                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.05]"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </a>
                                ) : (
                                  <IconTile icon={Award} tone="leaf" />
                                )}
                                <div className="min-w-0">
                                  <h4 className="break-words font-extrabold leading-snug text-fg">{item.title}</h4>
                                  {(item.issuer || item.year) && <p className="mt-0.5 break-words text-sm text-fg-soft">{joined(item.issuer, item.year)}</p>}
                                  <Prose>{item.description}</Prose>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </Panel>
                    )}
                    {hasMemberships && (
                      <Panel>
                        <PanelTitle hidden={hiddenFromOthers('memberships')}>Professional memberships</PanelTitle>
                        <ul className="divide-y divide-line">
                          {p.memberships.map((item) => (
                            <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                              <IconTile icon={UsersRound} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                  <h4 className="break-words font-extrabold leading-snug text-fg">{item.organization}</h4>
                                  {item.current && <Badge tone="leaf">Current member</Badge>}
                                </div>
                                {(item.type || item.startYear || item.endYear) && (
                                  <p className="mt-0.5 break-words text-sm text-fg-soft">
                                    {joined(item.type, yearRange(item.startYear, item.endYear, item.current && Boolean(item.startYear)))}
                                  </p>
                                )}
                                {item.number && <Private show={numbersPrivate}>Membership no. {item.number}</Private>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Publications ── */}
              {shows('publications') && (
                <Section id="publications" overline="Research" title="Publications" hidden={hiddenFromOthers('publications')}>
                  <ol className="grid gap-4 lg:grid-cols-2">
                    {p.publications.map((item) => {
                      const href = safeHref(item.url);
                      return (
                        <li key={item.id} className={cn('flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft', LIFT)}>
                          {item.year && (
                            <p className="mb-2">
                              <Badge tone="brand" className="tabular-nums">
                                {item.year}
                              </Badge>
                            </p>
                          )}
                          <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">{item.title}</h3>
                          {item.journal && <p className="mt-1 break-words text-sm font-semibold italic text-fg-soft">{item.journal}</p>}
                          {item.authors && <p className="mt-0.5 break-words text-sm text-fg-soft">{item.authors}</p>}
                          <Prose>{item.description}</Prose>
                          {href && (
                            <p className="mt-auto pt-3">
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex max-w-full items-center gap-1.5 text-sm font-bold text-brand-ink hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{/doi\.org\//i.test(href) ? 'View DOI' : 'View publication'}</span>
                                <span className="sr-only">(opens in a new tab)</span>
                              </a>
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              )}

              {/* ── Clinical practice locations ── */}
              {shows('locations') && (
                <Section id="locations" overline="Clinic locations" title="Where to find the practice">
                  <ul className="grid gap-5 md:grid-cols-2">
                    {clinics.map(({ id: clinicId, ...clinic }) => (
                      <ClinicCard key={clinicId} {...clinic} />
                    ))}
                  </ul>
                </Section>
              )}

              {/* ── Contact ── */}
              {shows('contact') && (
                <section id="contact" aria-labelledby="contact-title" className="scroll-mt-40 py-9 sm:py-12 xl:scroll-mt-24">
                  <Reveal className="grid items-center gap-x-10 gap-y-7 rounded-[1.75rem] border border-line bg-surface-2/60 p-6 sm:p-10 lg:grid-cols-2">
                    <div className="min-w-0">
                      <p className={OVERLINE}>Get in touch</p>
                      <h2 id="contact-title" className={cn(HEADING, 'mt-2 break-words text-2xl leading-tight sm:text-[1.75rem]')}>
                        Contact {doctor.name}
                      </h2>
                      <p className="mt-3 max-w-xl leading-relaxed text-fg-soft">
                        These are the contact details and professional links this member has chosen to share with the community.
                      </p>
                      {mine && visibility && hasContact && (
                        <p className="mt-4 text-xs leading-relaxed text-muted">
                          Other members see{' '}
                          {visibility.showEmail && visibility.showPhone
                            ? 'both your account email and phone number'
                            : visibility.showEmail
                              ? 'your account email only'
                              : visibility.showPhone
                                ? 'your account phone number only'
                                : 'neither your account email nor your phone number'}
                          {(contact.workEmail || contact.workPhone) &&
                            (visibility.showWorkContact ? ', plus your professional contact details' : '; your professional contact details are hidden')}
                          {contact.whatsapp && (visibility.showWhatsapp ? ', and your WhatsApp number' : '; your WhatsApp number is hidden')}. You can
                          change this in your profile settings.
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      {hasContact && (
                        <ul className="space-y-3.5">
                          {/* Workplace contact is on the main practice card when there is one. */}
                          {!hasMainPractice && contact.workPhone && (
                            <ContactBox href={`tel:${contact.workPhone}`} icon={Phone} label="Professional phone">
                              {contact.workPhone}
                            </ContactBox>
                          )}
                          {!hasMainPractice && contact.workEmail && (
                            <ContactBox href={`mailto:${contact.workEmail}`} icon={Mail} label="Professional email">
                              {contact.workEmail}
                            </ContactBox>
                          )}
                          {contact.phone && (
                            <ContactBox href={`tel:${contact.phone}`} icon={Phone} label="Phone">
                              {contact.phone}
                            </ContactBox>
                          )}
                          {contact.email && (
                            <ContactBox href={`mailto:${contact.email}`} icon={Mail} label="Email address">
                              {contact.email}
                            </ContactBox>
                          )}
                          {whatsapp && (
                            <ContactBox href={whatsapp} icon={MessageCircle} label="WhatsApp" tone="leaf" external>
                              {contact.whatsapp}
                            </ContactBox>
                          )}
                        </ul>
                      )}
                      {links.length > 0 && (
                        <div className={cn(hasContact && 'mt-5')}>
                          {hiddenFromOthers('links') && (
                            <p className="mb-3">
                              <HiddenBadge />
                            </p>
                          )}
                          <ul className="flex flex-wrap gap-2.5">
                            {links.map((link) => (
                              <li key={link.id} className="max-w-full">
                                <a
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-sm font-bold text-fg transition-colors hover:border-brand hover:text-brand-ink"
                                >
                                  <Globe className="h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden="true" />
                                  <span className="truncate">{link.label}</span>
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Reveal>
                </section>
              )}

              {/* ── Gallery: the doctor's memories ── */}
              {shows('gallery') && (
                <Section
                  id="gallery"
                  icon={Images}
                  title="Gallery"
                  hidden={hiddenFromOthers('gallery')}
                  action={
                    mine ? (
                      <Button href="/dashboard/create/memory" variant="secondary" size="sm" icon={Plus}>
                        Add photos
                      </Button>
                    ) : null
                  }
                >
                  {photos.length === 0 ? (
                    <Panel>
                      <p className="text-fg-soft">Nothing in your gallery yet. Photos you add are published straight away.</p>
                    </Panel>
                  ) : (
                    <>
                      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                        {photos.map((memory) => (
                          <GalleryTile key={memory.id} memory={memory} onOpen={setOpenMemory} />
                        ))}
                      </ul>
                      {gallery.meta && gallery.meta.total > photos.length && (
                        <p className="mt-3 text-xs text-muted">
                          Showing the latest {photos.length} of {gallery.meta.total} items.
                        </p>
                      )}
                    </>
                  )}
                </Section>
              )}

              {/* ── Blogs: the same records as the Blogs page, selected by author — nothing is copied ── */}
              {shows('blogs') && (
                <Section
                  id="blogs"
                  icon={ScrollText}
                  title="Blogs"
                  action={
                    mine ? (
                      <Button href="/dashboard/create/blog" variant="secondary" size="sm" icon={Plus}>
                        Write a blog
                      </Button>
                    ) : null
                  }
                >
                  {articles.length === 0 ? (
                    <Panel>
                      <p className="text-fg-soft">No blogs yet. A blog you write appears here and on the Blogs page at once.</p>
                    </Panel>
                  ) : (
                    <>
                      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {articles.map((blog) => (
                          <li key={blog.id}>
                            <BlogCard blog={blog} />
                          </li>
                        ))}
                      </ul>
                      {blogs.meta && blogs.meta.total > articles.length && (
                        <p className="mt-3 text-xs text-muted">
                          Showing the latest {articles.length} of {blogs.meta.total} blogs.
                        </p>
                      )}
                    </>
                  )}
                </Section>
              )}
            </div>
            {/* Wide screens: the profile navigation as a column on the right. */}
            <PortfolioSidebar name={doctor.name} sections={navLinks} contactHref={contactHref} />
          </div>
        )}
      </div>

      <MemoryLightbox
        memoryId={openMemory}
        preview={photos.find((memory) => memory.id === openMemory) || null}
        onClose={() => setOpenMemory('')}
        onDeleted={() => {
          setOpenMemory('');
          gallery.reload();
        }}
      />
    </div>
  );
}
