"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Award,
  BriefcaseMedical,
  Building2,
  ExternalLink,
  EyeOff,
  Globe,
  GraduationCap,
  Images,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  Pencil,
  Phone,
  Play,
  Plus,
  ScrollText,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useApi } from "@/lib/hooks";
import { site } from "@/lib/site";
import {
  CREDENTIAL_TYPES,
  DEFAULT_COUNTRY,
  DEGREE_LEVELS,
  EMPLOYMENT_TYPES,
  labelOf,
} from "@/lib/constants";
import { cn, formatDate, plural, yearRange } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import {
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Feedback";
import Reveal from "@/components/ui/Reveal";
import BlogCard from "@/components/cards/BlogCard";
import MemoryLightbox from "@/components/memories/MemoryLightbox";
import PortfolioHero from "./portfolio/PortfolioHero";
import PortfolioNav from "./portfolio/PortfolioNav";
import {
  HEADING,
  HiddenBadge,
  IconTile,
  InfoBox,
  LIFT,
  OVERLINE,
  Panel,
  PanelTitle,
  Private,
  Prose,
  Section,
  Tags,
  Timeline,
} from "./portfolio/parts";

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Links were validated by the API; this is a second check before rendering an href.
const safeHref = (url) =>
  /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : null;

// WhatsApp chat link for a stored "+<digits>" number.
const whatsappHref = (number) => {
  const digits = String(number || "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
};

const joined = (...parts) => parts.filter(Boolean).join(" · ");
const place = (...parts) => parts.filter(Boolean).join(", ");
const levelLabel = (level) =>
  level ? labelOf(DEGREE_LEVELS, level).replace(/ \(.*\)$/, "") : "";

// Summary box under the hero: one container, its two groups side by side.
const SUMMARY_TONES = ["text-brand-ink", "text-leaf-strong"];

/**
 * One band of the clinical-practice sheet: its title (and a count of the
 * entries) above the entries, which use the full width of the sheet.
 */
function PracticeBand({ icon, title, note, children }) {
  return (
    <div className="grid gap-y-5 p-5 sm:p-7">
      <div className="flex items-center gap-3.5">
        <IconTile icon={icon} className="h-10 w-10" />
        <div className="min-w-0">
          <h3 className={cn(HEADING, "text-lg leading-snug")}>{title}</h3>
          {note && (
            <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
              {note}
            </p>
          )}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// A ruled list in columns. The rule above the first row is clipped by the wrapper, whatever the column count.
const RULED_LIST = "-mt-px grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3";
const RULED_ROW = "flex items-baseline gap-3.5 border-t border-line py-3";

/** A hospital, clinic or organisation the doctor is professionally affiliated with. */
function AffiliationCard({
  main,
  name,
  designation,
  area,
  address,
  location,
  phone,
  email,
}) {
  return (
    <li
      className={cn(
        "grid gap-x-10 gap-y-4 rounded-[1.5rem] border border-line bg-surface p-6 shadow-soft md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        LIFT,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3.5">
          <IconTile icon={Building2} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-[0.68rem] font-extrabold uppercase tracking-[0.14em]",
                main ? "text-leaf-strong" : "text-muted",
              )}
            >
              {main ? "Current affiliation" : "Also affiliated with"}
            </p>
            <h3 className={cn(HEADING, "mt-1 break-words text-lg leading-snug")}>
              {name}
            </h3>
          </div>
        </div>
        {designation && (
          <p className="mt-4 break-words font-bold text-brand-ink">
            {designation}
          </p>
        )}
        {area && (
          <p
            className={cn(
              "break-words text-sm text-fg-soft",
              designation ? "mt-1" : "mt-4",
            )}
          >
            {area}
          </p>
        )}
      </div>

      {(address || location || phone || email) && (
        <ul className="space-y-3 text-sm text-fg-soft md:self-center">
          {(address || location) && (
            <li className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-brand-ink"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">
                {address && <span className="block">{address}</span>}
                {location && <span className="block">{location}</span>}
              </span>
            </li>
          )}
          {phone && (
            <li className="flex items-start gap-3">
              <Phone
                className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-leaf"
                aria-hidden="true"
              />
              <a
                href={`tel:${phone}`}
                className="min-w-0 break-words font-semibold text-fg hover:text-brand-ink hover:underline"
              >
                {phone}
              </a>
            </li>
          )}
          {email && (
            <li className="flex items-start gap-3">
              <Mail
                className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-brand-ink"
                aria-hidden="true"
              />
              <a
                href={`mailto:${email}`}
                className="min-w-0 break-all font-semibold text-fg hover:text-brand-ink hover:underline"
              >
                {email}
              </a>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** A contact detail in the contact panel. */
function ContactBox({
  href,
  icon: Icon,
  label,
  tone = "brand",
  external = false,
  children,
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong"
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            tone === "leaf" ? "text-leaf" : "text-brand-ink",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wide text-fg-soft">
            {label}
          </span>
          <span className="mt-0.5 block truncate font-extrabold text-fg group-hover:text-brand-ink">
            {children}
          </span>
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
        aria-label={`Open: ${memory.title} (${plural(count, "file")})`}
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
        {cover && cover.resourceType === "video" && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
            </span>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-3.5 pt-12">
          <span className="block truncate text-sm font-bold text-white">
            {memory.title}
          </span>
          {memory.memoryDate && (
            <span className="block text-xs text-white/85">
              {formatDate(memory.memoryDate)}
            </span>
          )}
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
    <Link
      href="/doctors"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Friends
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
 * the hero, two summary cards (specialization, recently working at), then
 * about, current professional affiliations, professional experience, education
 * and qualifications, scope of practice (with procedures), fellowships and
 * postdoctoral qualifications, publications, awards and memberships, contact,
 * gallery and blogs — every card on a row of its own. It is read by fellow
 * members, not by patients.
 * Sections and cards without data are not rendered, and nothing is estimated.
 *
 * The API returns the repeated sections already in display order (highest or
 * most recent first) and with the doctor's visibility choices applied.
 */
export default function DoctorPortfolio() {
  const { id } = useParams();
  const validId = typeof id === "string" && OBJECT_ID.test(id);
  const {
    data: doctor,
    loading,
    error,
    reload,
  } = useApi(validId ? `/doctors/${id}` : null, undefined, {
    enabled: validId,
  });

  // Gallery = the photos this doctor added to their own profile (never the
  // community Memories); blogs = this doctor's community blogs.
  const showContent = Boolean(doctor && !doctor.limited);
  const gallery = useApi(
    showContent ? "/memories" : null,
    { owner: id, limit: 12 },
    { enabled: showContent },
  );
  const blogs = useApi(
    showContent ? "/blogs" : null,
    { author: id, limit: 6 },
    { enabled: showContent },
  );
  const [openMemory, setOpenMemory] = useState("");

  // The page is member-only and rendered in the browser, so the tab title is
  // set here from what this member was allowed to load — never in the HTML.
  const tabName = doctor ? doctor.name : "";
  const tabSpecialty =
    (doctor && doctor.profile && doctor.profile.specialization) || "";
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
        action={<Button href="/doctors">Explore Friends</Button>}
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
        <h1 className={cn(HEADING, "mt-4 text-2xl")}>{doctor.name}</h1>
        {p.professionalTitle && (
          <p className="mt-1 text-fg-soft">{p.professionalTitle}</p>
        )}
        {p.specialization && (
          <Badge tone="leaf" icon={Stethoscope} className="mt-3">
            {p.specialization}
          </Badge>
        )}
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm text-muted">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This member has chosen to share only a brief name card, so their
          portfolio is not shown.
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
    Boolean(
      mine &&
      visibility &&
      visibility.sections &&
      keys.some((key) => visibility.sections[key] === false),
    );
  const numbersPrivate = Boolean(
    mine && visibility && !visibility.showRegistration,
  );
  const bloodGroupPrivate = Boolean(
    mine && visibility && !visibility.showBloodGroup,
  );

  const country =
    p.country && p.country.toLowerCase() !== DEFAULT_COUNTRY.toLowerCase()
      ? p.country
      : "";
  const location = place(p.city, p.state, country);
  const links = list("links")
    .map((l) => ({ ...l, href: safeHref(l.url) }))
    .filter((l) => l.href);
  const whatsapp = whatsappHref(contact.whatsapp);
  const hasContact = Boolean(
    contact.email ||
    contact.phone ||
    contact.workEmail ||
    contact.workPhone ||
    whatsapp,
  );
  const photos = gallery.data || [];
  const articles = blogs.data || [];

  const education = list("education");
  const experience = list("experience");
  const qualifications = list("qualifications");
  const credentials = list("credentials");
  // A city alone is a location, not a practice: it is shown in the hero and the summary instead of on a card.
  const hasMainPractice = Boolean(
    p.hospital || p.practiceArea || p.workAddress,
  );
  // "Recently working at": the main hospital or clinic, otherwise the
  // organisation of the most recent position (the API lists current positions
  // first, then the most recently held).
  const recentRole = experience.find((item) => item.organization) || null;
  const recentlyWorkingAt = p.hospital || (recentRole && recentRole.organization) || "";
  // Its location: the practice location for the main hospital, otherwise the position's own.
  const recentlyWorkingHint = p.hospital
    ? location
    : recentRole
      ? place(recentRole.city, recentRole.state)
      : "";

  // Highest qualification. The API returns education by level (highest first),
  // so the first entry is the highest qualification; batchYear is shown only when saved.
  const highestEducation = education[0] || null;
  const highestQualification = highestEducation
    ? joined(highestEducation.degree, highestEducation.fieldOfStudy)
    : qualifications.join(", ");
  const batch = p.batchYear ? `Batch of ${p.batchYear}` : "";

  // Summary cards: specialization and where the doctor recently worked, each
  // built from saved data and left out when there is none.
  const summary = [
    p.specialization && {
      icon: Stethoscope,
      label: "Specialization",
      value: p.specialization,
      hint: p.subspecialty,
    },
    recentlyWorkingAt && {
      icon: Building2,
      label: "Recently working at",
      value: recentlyWorkingAt,
      hint: recentlyWorkingHint,
    },
  ].filter(Boolean);

  // Professional affiliations: the main hospital, clinic or organisation first, then every other one saved.
  const clinics = [
    hasMainPractice && {
      id: "main",
      main: true,
      name: p.hospital || p.practiceArea || p.workAddress,
      designation: p.hospital ? p.designation : "",
      area: p.hospital ? p.practiceArea : "",
      address: p.hospital || p.practiceArea ? p.workAddress : "",
      location,
      phone: contact.workPhone,
      email: contact.workEmail,
    },
    ...list("practiceLocations").map((item) => ({
      id: item.id,
      main: false,
      name: item.hospital,
      designation: item.designation,
      area: item.area,
      address: item.address,
      location: place(item.city, item.state, item.country),
      phone: item.phone,
    })),
  ].filter(Boolean);
  const hasContactPanel = hasContact || links.length > 0;

  const hasAboutText = Boolean(
    p.bio || list("languages").length || p.bloodGroup,
  );

  // Whether the owner has switched the academic or the qualifications half off for others.
  const educationHidden = hiddenFromOthers("education");
  const qualificationsHidden = hiddenFromOthers("qualifications");

  const hasServices = Boolean(
    p.fieldOfWork ||
    p.practiceArea ||
    list("expertise").length ||
    list("procedures").length,
  );
  const hasAwards = list("achievements").length > 0;
  const hasMemberships = list("memberships").length > 0;

  // In-page navigation, in the order the sections appear.
  const nav = [
    hasAboutText && { id: "about", label: "About" },
    clinics.length > 0 && { id: "locations", label: "Affiliations" },
    experience.length > 0 && { id: "experience", label: "Experience" },
    (education.length > 0 ||
      credentials.length > 0 ||
      qualifications.length > 0) && { id: "education", label: "Education" },
    hasServices && { id: "services", label: "Expertise" },
    list("fellowships").length > 0 && {
      id: "fellowships",
      label: "Fellowships",
    },
    list("publications").length > 0 && {
      id: "publications",
      label: "Publications",
    },
    (hasAwards || hasMemberships) && {
      id: "awards",
      label: "Awards & memberships",
    },
    hasContactPanel && { id: "contact", label: "Contact" },
    // The owner always gets these two, so there is somewhere to add from without opening the profile form.
    (photos.length > 0 || mine) && { id: "gallery", label: "Gallery" },
    (articles.length > 0 || mine) && { id: "blogs", label: "Blogs" },
  ].filter(Boolean);
  const shows = (sectionId) => nav.some((section) => section.id === sectionId);

  // Without profile details the owner's gallery and blog prompts alone would look odd: show the invitation instead.
  const hasDetails =
    nav.some((section) => section.id !== "gallery" && section.id !== "blogs") ||
    photos.length > 0 ||
    articles.length > 0;

  // The profile navigation links every section; Contact is its button.
  const navLinks = hasDetails
    ? nav.filter((section) => section.id !== "contact")
    : [];
  const contactHref = hasContactPanel ? "#contact" : null;

  // The hero is a professional summary: highest qualification, batch, where the
  // doctor recently worked and location. Members reach a colleague through the
  // contact section, so there are no phone or WhatsApp buttons here.
  const heroFacts = [
    highestQualification && {
      icon: GraduationCap,
      label: "Highest qualification",
      text: highestQualification,
    },
    batch && { icon: UsersRound, label: "Batch", text: batch },
    recentlyWorkingAt && {
      icon: Building2,
      label: "Recently working at",
      text: `Recently working at ${recentlyWorkingAt}`,
    },
    location && { icon: MapPin, label: "Location", text: location },
  ].filter(Boolean);
  const heroActions = [
    mine && { href: "/dashboard/profile", label: "Edit profile", icon: Pencil },
  ].filter(Boolean);

  return (
    <div className="relative bg-bg-soft">
      <PortfolioNav
        name={doctor.name}
        sections={navLinks}
        contactHref={contactHref}
      />
      <PortfolioHero
        name={doctor.name}
        photoUrl={p.photoUrl}
        eyebrow={joined(p.specialization, p.subspecialty)}
        title={p.designation}
        headline={p.headline}
        bio={p.bio}
        facts={heroFacts}
        actions={heroActions}
      />

      <div className="container-page relative pb-14 sm:pb-20">
        {/* ── Summary: one box overlapping the foot of the hero, its two
            groups side by side (stacked inside the same box on narrow screens) ── */}
        {summary.length > 0 ? (
          <dl
            className={cn(
              "rise-in relative -mt-14 grid divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-lift sm:-mt-16",
              summary.length > 1 && "md:grid-cols-2 md:divide-x md:divide-y-0",
            )}
            style={{ "--delay": "420ms" }}
          >
            {summary.map((item, index) => (
              <div
                key={item.label}
                className="flex min-w-0 items-center gap-4 px-5 py-4 sm:gap-5 sm:px-7 sm:py-5"
              >
                <IconTile
                  icon={item.icon}
                  tone={index === 1 ? "leaf" : "brand"}
                />
                <div className="flex min-w-0 flex-col">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-fg-soft">
                    {item.label}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 break-words font-sans text-lg font-extrabold leading-snug tracking-tight sm:text-xl",
                      SUMMARY_TONES[index],
                    )}
                  >
                    {item.value}
                  </dd>
                  {item.hint && (
                    <dd className="mt-0.5 break-words text-sm text-muted">
                      {item.hint}
                    </dd>
                  )}
                </div>
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
            title={
              mine
                ? "Your portfolio is waiting for you"
                : "This profile is still being completed"
            }
            description={
              mine
                ? "Add your expertise, practice, education and awards so batchmates can see your journey."
                : "This doctor has not added further details yet."
            }
            action={
              mine ? (
                <Button href="/dashboard/profile">Complete my profile</Button>
              ) : null
            }
          />
        ) : (
          <div className="pt-6 sm:pt-8">
            {/* ── About ── */}
            {shows("about") && (
              <section
                id="about"
                aria-labelledby="about-title"
                className="scroll-mt-40 py-9 sm:py-12"
              >
                <Reveal>
                  <div className="min-w-0">
                    <p className={OVERLINE}>Biography</p>
                    <h2
                      id="about-title"
                      className={cn(
                        HEADING,
                        "mt-2 break-words text-3xl leading-[1.12] sm:text-[2.4rem]",
                      )}
                    >
                      About {doctor.name}
                    </h2>
                    {p.bio && (
                      <p className="mt-5 max-w-3xl whitespace-pre-line break-words text-[1.05rem] leading-[1.8] text-fg-soft">
                        {p.bio}
                      </p>
                    )}
                    {list("languages").length > 0 && (
                      <div className="mt-6">
                        <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                          Languages
                        </p>
                        <Tags items={p.languages} />
                      </div>
                    )}
                    {p.bloodGroup && (
                      <div className="mt-4">
                        <Private show={bloodGroupPrivate}>
                          Blood group: {p.bloodGroup}
                        </Private>
                      </div>
                    )}
                  </div>
                </Reveal>
              </section>
            )}

            {/* ── Hospitals, clinics and organisations the doctor is affiliated with ── */}
            {shows("locations") && (
              <Section
                id="locations"
                overline="Professional affiliations"
                title="Current professional affiliations"
              >
                <ul className="grid gap-5">
                  {clinics.map(({ id: clinicId, ...clinic }) => (
                    <AffiliationCard key={clinicId} {...clinic} />
                  ))}
                </ul>
              </Section>
            )}

            {/* ── Professional experience: one full-width card per position ── */}
            {shows("experience") && (
              <Section
                id="experience"
                overline="Experience"
                title="Professional experience"
                hidden={hiddenFromOthers("experience")}
              >
                {/* Current positions first, then the most recently held. */}
                <Timeline items={experience}>
                  {(item) => (
                    <>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                          {item.role}
                        </h3>
                        {item.current && <Badge tone="leaf">Current</Badge>}
                      </div>
                      {item.organization && (
                        <p className="mt-1 break-words text-sm font-bold text-fg">
                          {item.organization}
                        </p>
                      )}
                      {(item.city || item.state || item.employmentType) && (
                        <p className="mt-0.5 break-words text-sm text-fg-soft">
                          {joined(
                            place(item.city, item.state),
                            item.employmentType &&
                              labelOf(
                                EMPLOYMENT_TYPES,
                                item.employmentType,
                              ),
                          )}
                        </p>
                      )}
                      {(item.startYear || item.endYear || item.current) && (
                        <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">
                          {yearRange(
                            item.startYear,
                            item.endYear,
                            item.current,
                          )}
                        </p>
                      )}
                      <Prose>{item.description}</Prose>
                    </>
                  )}
                </Timeline>
              </Section>
            )}

            {/* ── Education and qualifications: one full-width card per entry ── */}
            {shows("education") && (
              <Section
                id="education"
                overline="Education & qualifications"
                title="Education and qualifications"
                hidden={educationHidden || qualificationsHidden}
              >
                {qualifications.length > 0 && (
                  <div
                    className={cn(
                      education.length > 0 || credentials.length > 0
                        ? "mb-7"
                        : "",
                    )}
                  >
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                      Qualification letters
                    </p>
                    <Tags items={qualifications} />
                  </div>
                )}
                {/* Highest qualification first. */}
                {education.length > 0 && (
                  <Timeline items={education} accent="ink">
                    {(item) => (
                      <>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                            {item.degree}
                          </h3>
                          {item.level && (
                            <Badge>{levelLabel(item.level)}</Badge>
                          )}
                        </div>
                        {item.fieldOfStudy && (
                          <p className="mt-1 break-words text-sm font-bold text-fg">
                            {item.fieldOfStudy}
                          </p>
                        )}
                        {item.institution && (
                          <p className="mt-0.5 break-words text-sm text-fg-soft">
                            {item.institution}
                          </p>
                        )}
                        {(item.startYear || item.year) && (
                          <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">
                            {item.year && !item.startYear
                              ? `Class of ${item.year}`
                              : yearRange(item.startYear, item.year)}
                          </p>
                        )}
                        {item.certification && (
                          <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-leaf-strong">
                            <Award
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              {item.certification}
                            </span>
                          </p>
                        )}
                        <Prose>{item.details}</Prose>
                      </>
                    )}
                  </Timeline>
                )}
                {credentials.length > 0 && (
                  <ul
                    className={cn(
                      "grid gap-4",
                      education.length > 0 && "mt-7",
                    )}
                  >
                    {credentials.map((item) => (
                      <InfoBox
                        as="li"
                        key={item.id}
                        icon={ScrollText}
                        label={
                          item.type
                            ? labelOf(CREDENTIAL_TYPES, item.type)
                            : "Qualification"
                        }
                        value={item.title}
                        sub={joined(item.institution, item.year)}
                      >
                        {item.registration && (
                          <Private show={numbersPrivate}>
                            Registration: {item.registration}
                          </Private>
                        )}
                        <Prose>{item.details}</Prose>
                      </InfoBox>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {/* ── Clinical practice: one ruled sheet — scope, areas of expertise, procedures ── */}
            {shows("services") && (
              <Section
                id="services"
                overline="Clinical practice"
                title="Expertise and procedures"
              >
                <div className="relative divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-soft">
                  <span
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand to-leaf"
                    aria-hidden="true"
                  />
                  {(p.fieldOfWork || p.practiceArea) && (
                    <PracticeBand
                      icon={BriefcaseMedical}
                      title="Scope of practice"
                    >
                      <dl className="grid gap-4">
                        {p.fieldOfWork && (
                          <div className="min-w-0 rounded-xl border border-line border-l-4 border-l-brand bg-surface px-4 py-3.5">
                            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                              Field of work
                            </dt>
                            <dd className="mt-1 break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                              {p.fieldOfWork}
                            </dd>
                          </div>
                        )}
                        {p.practiceArea && (
                          <div className="min-w-0 rounded-xl border border-line border-l-4 border-l-leaf bg-surface px-4 py-3.5">
                            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                              Clinical practice area
                            </dt>
                            <dd className="mt-1 break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                              {p.practiceArea}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </PracticeBand>
                  )}
                  {list("expertise").length > 0 && (
                    <PracticeBand
                      icon={Stethoscope}
                      title="Areas of expertise"
                      note={plural(p.expertise.length, "area")}
                    >
                      <div className="overflow-hidden">
                        <ul className={RULED_LIST}>
                          {p.expertise.map((item) => (
                            <li key={item} className={RULED_ROW}>
                              <span
                                className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-leaf"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 break-words font-semibold leading-snug text-fg">
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </PracticeBand>
                  )}
                  {list("procedures").length > 0 && (
                    <PracticeBand
                      icon={Activity}
                      title="Procedures performed"
                      note={plural(p.procedures.length, "procedure")}
                    >
                      <div className="overflow-hidden">
                        <ol className={RULED_LIST}>
                          {p.procedures.map((item, index) => (
                            <li key={item} className={RULED_ROW}>
                              <span
                                className="w-6 shrink-0 text-xs font-extrabold tabular-nums text-brand-ink"
                                aria-hidden="true"
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="min-w-0 break-words font-semibold leading-snug text-fg">
                                {item}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </PracticeBand>
                  )}
                </div>
              </Section>
            )}

            {/* ── Fellowships and postdoctoral qualifications ── */}
            {shows("fellowships") && (
              <Section
                id="fellowships"
                overline="Advanced training"
                title="Fellowships and postdoctoral qualifications"
                hidden={hiddenFromOthers("fellowships")}
              >
                <ul className="grid gap-4">
                  {p.fellowships.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft",
                        LIFT,
                      )}
                    >
                      <IconTile icon={Medal} tone="leaf" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                          {item.title}
                        </h3>
                        {(item.institution || item.specialty) && (
                          <p className="mt-1 break-words text-sm font-bold text-fg">
                            {joined(item.institution, item.specialty)}
                          </p>
                        )}
                        {(item.startYear || item.endYear) && (
                          <p className="mt-1.5 text-xs font-semibold tabular-nums text-muted">
                            {yearRange(item.startYear, item.endYear)}
                          </p>
                        )}
                        <Prose>{item.description}</Prose>
                        {item.certificate && (
                          <p className="mt-auto pt-3">
                            <Badge
                              tone="brand"
                              className="max-w-full whitespace-normal break-words"
                            >
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

            {/* ── Publications ── */}
            {shows("publications") && (
              <Section
                id="publications"
                overline="Research"
                title="Publications"
                hidden={hiddenFromOthers("publications")}
              >
                <ol className="grid gap-4">
                  {p.publications.map((item) => {
                    const href = safeHref(item.url);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft",
                          LIFT,
                        )}
                      >
                        {item.year && (
                          <p className="mb-2">
                            <Badge tone="brand" className="tabular-nums">
                              {item.year}
                            </Badge>
                          </p>
                        )}
                        <h3 className="break-words text-[1.05rem] font-extrabold leading-snug text-fg">
                          {item.title}
                        </h3>
                        {item.journal && (
                          <p className="mt-1 break-words text-sm font-semibold italic text-fg-soft">
                            {item.journal}
                          </p>
                        )}
                        {item.authors && (
                          <p className="mt-0.5 break-words text-sm text-fg-soft">
                            {item.authors}
                          </p>
                        )}
                        <Prose>{item.description}</Prose>
                        {href && (
                          <p className="mt-auto pt-3">
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="inline-flex max-w-full items-center gap-1.5 text-sm font-bold text-brand-ink hover:underline"
                            >
                              <ExternalLink
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="truncate">
                                {/doi\.org\//i.test(href)
                                  ? "View DOI"
                                  : "View publication"}
                              </span>
                              <span className="sr-only">
                                (opens in a new tab)
                              </span>
                            </a>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Section>
            )}

            {/* ── Awards and memberships: two separate groups ── */}
            {shows("awards") && (
              <Section id="awards" icon={Award} title="Awards and memberships">
                <div
                  className={cn(
                    "grid items-start gap-5",
                    hasAwards && hasMemberships && "lg:grid-cols-2",
                  )}
                >
                  {hasAwards && (
                    <Panel>
                      <PanelTitle hidden={hiddenFromOthers("achievements")}>
                        Awards
                      </PanelTitle>
                      <ul className="divide-y divide-line">
                        {p.achievements.map((item) => {
                          const image = safeHref(item.imageUrl);
                          return (
                            <li
                              key={item.id}
                              className="flex gap-4 py-4 first:pt-0 last:pb-0"
                            >
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
                                <h4 className="break-words font-extrabold leading-snug text-fg">
                                  {item.title}
                                </h4>
                                {(item.issuer || item.year) && (
                                  <p className="mt-0.5 break-words text-sm text-fg-soft">
                                    {joined(item.issuer, item.year)}
                                  </p>
                                )}
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
                      <PanelTitle hidden={hiddenFromOthers("memberships")}>
                        Professional memberships
                      </PanelTitle>
                      <ul className="divide-y divide-line">
                        {p.memberships.map((item) => (
                          <li
                            key={item.id}
                            className="flex gap-4 py-4 first:pt-0 last:pb-0"
                          >
                            <IconTile icon={UsersRound} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <h4 className="break-words font-extrabold leading-snug text-fg">
                                  {item.organization}
                                </h4>
                                {item.current && (
                                  <Badge tone="leaf">Current member</Badge>
                                )}
                              </div>
                              {(item.type ||
                                item.startYear ||
                                item.endYear) && (
                                <p className="mt-0.5 break-words text-sm text-fg-soft">
                                  {joined(
                                    item.type,
                                    yearRange(
                                      item.startYear,
                                      item.endYear,
                                      item.current && Boolean(item.startYear),
                                    ),
                                  )}
                                </p>
                              )}
                              {item.number && (
                                <Private show={numbersPrivate}>
                                  Membership no. {item.number}
                                </Private>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  )}
                </div>
              </Section>
            )}

            {/* ── Contact ── */}
            {shows("contact") && (
              <section
                id="contact"
                aria-labelledby="contact-title"
                className="scroll-mt-40 py-9 sm:py-12"
              >
                <Reveal className="grid items-center gap-x-10 gap-y-7 rounded-[1.75rem] border border-line bg-surface-2/60 p-6 sm:p-10 lg:grid-cols-2">
                  <div className="min-w-0">
                    <p className={OVERLINE}>Shared with members</p>
                    <h2
                      id="contact-title"
                      className={cn(
                        HEADING,
                        "mt-2 break-words text-2xl leading-tight sm:text-[1.75rem]",
                      )}
                    >
                      Contact {doctor.name}
                    </h2>
                    <p className="mt-3 max-w-xl leading-relaxed text-fg-soft">
                      These are the contact details and professional links this
                      member has chosen to share with the community.
                    </p>
                    {mine && visibility && hasContact && (
                      <p className="mt-4 text-xs leading-relaxed text-muted">
                        Other members see{" "}
                        {visibility.showEmail && visibility.showPhone
                          ? "both your account email and phone number"
                          : visibility.showEmail
                            ? "your account email only"
                            : visibility.showPhone
                              ? "your account phone number only"
                              : "neither your account email nor your phone number"}
                        {(contact.workEmail || contact.workPhone) &&
                          (visibility.showWorkContact
                            ? ", plus your professional contact details"
                            : "; your professional contact details are hidden")}
                        {contact.whatsapp &&
                          (visibility.showWhatsapp
                            ? ", and your WhatsApp number"
                            : "; your WhatsApp number is hidden")}
                        . You can change this in your profile settings.
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    {hasContact && (
                      <ul className="space-y-3.5">
                        {/* Workplace contact is on the main practice card when there is one. */}
                        {!hasMainPractice && contact.workPhone && (
                          <ContactBox
                            href={`tel:${contact.workPhone}`}
                            icon={Phone}
                            label="Professional phone"
                          >
                            {contact.workPhone}
                          </ContactBox>
                        )}
                        {!hasMainPractice && contact.workEmail && (
                          <ContactBox
                            href={`mailto:${contact.workEmail}`}
                            icon={Mail}
                            label="Professional email"
                          >
                            {contact.workEmail}
                          </ContactBox>
                        )}
                        {contact.phone && (
                          <ContactBox
                            href={`tel:${contact.phone}`}
                            icon={Phone}
                            label="Phone"
                          >
                            {contact.phone}
                          </ContactBox>
                        )}
                        {contact.email && (
                          <ContactBox
                            href={`mailto:${contact.email}`}
                            icon={Mail}
                            label="Email address"
                          >
                            {contact.email}
                          </ContactBox>
                        )}
                        {whatsapp && (
                          <ContactBox
                            href={whatsapp}
                            icon={MessageCircle}
                            label="WhatsApp"
                            tone="leaf"
                            external
                          >
                            {contact.whatsapp}
                          </ContactBox>
                        )}
                      </ul>
                    )}
                    {links.length > 0 && (
                      <div className={cn(hasContact && "mt-5")}>
                        {hiddenFromOthers("links") && (
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
                                <Globe
                                  className="h-3.5 w-3.5 shrink-0 text-brand-ink"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{link.label}</span>
                                <span className="sr-only">
                                  (opens in a new tab)
                                </span>
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

            {/* ── Gallery: this doctor's own photos, separate from community Memories ── */}
            {shows("gallery") && (
              <Section
                id="gallery"
                icon={Images}
                title="Gallery"
                hidden={hiddenFromOthers("gallery")}
                action={
                  mine ? (
                    <Button
                      href="/dashboard/create/memory?gallery=1"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                    >
                      Add photos
                    </Button>
                  ) : null
                }
              >
                {photos.length === 0 ? (
                  <Panel>
                    <p className="text-fg-soft">
                      Nothing in your gallery yet. Photos you add here appear on
                      your profile only — not in the community Memories.
                    </p>
                  </Panel>
                ) : (
                  <>
                    <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                      {photos.map((memory) => (
                        <GalleryTile
                          key={memory.id}
                          memory={memory}
                          onOpen={setOpenMemory}
                        />
                      ))}
                    </ul>
                    {gallery.meta && gallery.meta.total > photos.length && (
                      <p className="mt-3 text-xs text-muted">
                        Showing the latest {photos.length} of{" "}
                        {gallery.meta.total} items.
                      </p>
                    )}
                  </>
                )}
              </Section>
            )}

            {/* ── Blogs: the same records as the Blogs page, selected by author — nothing is copied ── */}
            {shows("blogs") && (
              <Section
                id="blogs"
                icon={ScrollText}
                title="Blogs"
                action={
                  mine ? (
                    <Button
                      href="/dashboard/create/blog"
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                    >
                      Write a blog
                    </Button>
                  ) : null
                }
              >
                {articles.length === 0 ? (
                  <Panel>
                    <p className="text-fg-soft">
                      No blogs yet. A blog you write appears here and on the
                      Blogs page at once.
                    </p>
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
                        Showing the latest {articles.length} of{" "}
                        {blogs.meta.total} blogs.
                      </p>
                    )}
                  </>
                )}
              </Section>
            )}
          </div>
        )}
      </div>

      <MemoryLightbox
        memoryId={openMemory}
        preview={photos.find((memory) => memory.id === openMemory) || null}
        onClose={() => setOpenMemory("")}
        onDeleted={() => {
          setOpenMemory("");
          gallery.reload();
        }}
      />
    </div>
  );
}
