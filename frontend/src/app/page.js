import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  HeartPulse,
  IdCard,
  Images,
  Newspaper,
  ShieldCheck,
  UsersRound,
  Vote,
} from "lucide-react";
import { site, absoluteUrl } from "@/lib/site";
import { publicFetch } from "@/lib/server-api";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/Feedback";
import { SectionHeading } from "@/components/ui/Layout";
import DoctorCard from "@/components/cards/DoctorCard";
import BlogCard from "@/components/cards/BlogCard";
import EventCard from "@/components/cards/EventCard";
import Hero from "@/components/home/Hero";
import JourneySteps from "@/components/home/JourneySteps";
import HomeMemories from "@/components/home/HomeMemories";
import JoinCta from "@/components/home/JoinCta";

export const revalidate = 60;

export const metadata = {
  title: { absolute: `${site.name} — ${site.tagline}` },
  description: site.description,
  alternates: { canonical: "/" },
};

const benefits = [
  {
    icon: UsersRound,
    title: "Find your batchmates",
    text: "Search for friends by name, specialization and city, so you can see where everyone practises today.",
  },
  {
    icon: IdCard,
    title: "A professional portfolio",
    text: "Present your specialization, hospital, education, experience, achievements and publications in one clean profile.",
  },
  {
    icon: Images,
    title: "Memories that stay private",
    text: "Photos and videos from college days and reunions, visible only to signed-in members of the community.",
  },
  {
    icon: CalendarDays,
    title: "Reunions and visit plans",
    text: "Propose get-togethers, RSVP in a tap, and let friends know when you will be visiting their city.",
  },
  {
    icon: Vote,
    title: "Decide together",
    text: "Polls for reunion dates, venues, activities and budgets — one vote per doctor, counted fairly.",
  },
  {
    icon: BookOpenText,
    title: "Blogs worth reading",
    text: "Longer writing from members on practice, careers, research and life beyond the hospital.",
  },
];

const aboutPoints = [
  {
    icon: HeartPulse,
    title: "Built around belonging",
    text: "Spandan means heartbeat. The community exists to keep the pulse of a batch alive long after graduation.",
  },
  {
    icon: ShieldCheck,
    title: "Private and moderated",
    text: "Member content stays behind login, anything inappropriate can be reported, and administrators can remove it.",
  },
  {
    icon: Newspaper,
    title: "Professional, not clinical",
    text: "This is a place for colleagues and friends. It is not a patient platform, and patient information never belongs here.",
  },
];

export default async function HomePage() {
  // Only public endpoints are read on the server. Each returns exactly the
  // fields that are allowed on a public page; member content is loaded later,
  // in the browser, and only for signed-in members.
  const [featured, blogs, events] = await Promise.all([
    publicFetch("/doctors/featured"),
    publicFetch("/blogs", { query: { limit: 3 } }),
    publicFetch("/events/public"),
  ]);
  const doctors = featured.data || [];
  const recentBlogs = blogs.data || [];
  const upcoming = (events.data || []).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: absoluteUrl("/"),
    description: site.description,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* 1 — Hero */}
      <Hero />

      {/* 2 — About */}
      <section
        className="border-y border-line bg-bg-soft py-16 sm:py-20"
        aria-labelledby="about-title"
      >
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
          <Reveal>
            <p className="eyebrow mb-2">About MKCGSPANDAN</p>
            <h2
              id="about-title"
              className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[2rem] sm:leading-tight"
            >
              The people who knew you as a student are still your people
            </h2>
            <p className="mt-4 text-base leading-relaxed text-fg-soft">
              Years of training together create friendships that careers, cities
              and time zones slowly pull apart. MKCGSPANDAN is a private home
              for a medical batch — a place to find one another again, follow
              each other&apos;s work, and turn &ldquo;we should meet
              sometime&rdquo; into an actual date on the calendar.
            </p>
            <Button
              href="/about"
              variant="outline"
              className="mt-6"
              iconRight={ArrowRight}
            >
              Read our story
            </Button>
          </Reveal>

          <ul className="grid gap-4">
            {aboutPoints.map((point, i) => (
              <Reveal
                as="li"
                key={point.title}
                delay={i * 0.08}
                className="card flex items-start gap-4 p-5"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-strong">
                  <point.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-fg">{point.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-soft">
                    {point.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 — Community benefits */}
      <section className="py-16 sm:py-20" aria-labelledby="benefits-title">
        <div className="container-page">
          <SectionHeading
            eyebrow="What you can do here"
            title={
              <span id="benefits-title">
                Everything a batch needs to stay close
              </span>
            }
            description="One place for your friends, the conversations, the photographs and the plans."
            align="center"
          />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, i) => (
              <Reveal
                as="li"
                key={benefit.title}
                delay={(i % 3) * 0.07}
                className="card h-full p-6 transition-shadow hover:shadow-lift"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                  <benefit.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-fg">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                  {benefit.text}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 — Featured doctors (real, consenting, admin-featured members only) */}
      <section
        className="border-y border-line bg-bg-soft py-16 sm:py-20"
        aria-labelledby="doctors-title"
      >
        <div className="container-page">
          <SectionHeading
            eyebrow="Members"
            title={<span id="doctors-title">Featured Friends profiles</span>}
            description="Members who have chosen to be introduced publicly. Every friend's profile is open to signed-in members."
            action={
              <Button
                href="/doctors"
                variant="secondary"
                iconRight={ArrowRight}
              >
                Explore Friends
              </Button>
            }
          />
          {doctors.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {doctors.map((doctor, i) => (
                <Reveal as="li" key={doctor.id} delay={(i % 4) * 0.06}>
                  <DoctorCard doctor={doctor} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={UsersRound}
              title="Featured profiles will appear here"
              description="Profiles are shown publicly only when the member has agreed to it. Sign in to find all your friends."
              action={
                <>
                  <Button href="/register">Join the Community</Button>
                  <Button href="/doctors" variant="secondary">
                    Explore Friends
                  </Button>
                </>
              }
            />
          )}
        </div>
      </section>

      {/* 5 — Recent approved blogs */}
      <section className="py-16 sm:py-20" aria-labelledby="blogs-title">
        <div className="container-page">
          <SectionHeading
            eyebrow="From the community"
            title={<span id="blogs-title">Recent blogs by members</span>}
            description="Reflections on practice, careers and the years we shared."
            action={
              <Button href="/blogs" variant="secondary" iconRight={ArrowRight}>
                All blogs
              </Button>
            }
          />
          {recentBlogs.length ? (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentBlogs.map((blog, i) => (
                <Reveal as="li" key={blog.id} delay={i * 0.07}>
                  <BlogCard blog={blog} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpenText}
              title="No blogs have been published yet"
              description="Members can write about their work and experiences. Published blogs will be listed here."
              action={
                <Button href="/dashboard/create/blog" variant="secondary">
                  Write a blog
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* 6 — Community memories (members only; rendered in the browser) */}
      <section
        className="border-y border-line bg-bg-soft py-16 sm:py-20"
        aria-labelledby="memories-title"
      >
        <div className="container-page">
          <SectionHeading
            eyebrow="Memories"
            title={
              <span id="memories-title">The moments that made a batch</span>
            }
            description="Hostel corridors, first postings, convocation day and every reunion since."
            action={
              <Button
                href="/memories"
                variant="secondary"
                iconRight={ArrowRight}
              >
                Open memories
              </Button>
            }
          />
          <HomeMemories />
        </div>
      </section>

      {/* 7 — Upcoming events (public summary only) */}
      <section className="py-16 sm:py-20" aria-labelledby="events-title">
        <div className="container-page">
          <SectionHeading
            eyebrow="Events & reunions"
            title={<span id="events-title">Upcoming gatherings</span>}
            description="A brief look at what is being planned. Venues, attendees and discussions are visible to members."
            action={
              <Button href="/events" variant="secondary" iconRight={ArrowRight}>
                All events
              </Button>
            }
          />
          {upcoming.length ? (
            <ul className="grid gap-5 md:grid-cols-2">
              {upcoming.map((event, i) => (
                <Reveal as="li" key={event.id} delay={(i % 2) * 0.07}>
                  <EventCard event={event} publicView />
                </Reveal>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No public events at the moment"
              description="When members plan a reunion or get-together and choose to announce it, it will be listed here."
              action={
                <Button href="/dashboard/create/event" variant="secondary">
                  Propose an event
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* 8 — Connection / reunion story */}
      <section
        className="border-y border-line bg-bg-soft py-16 sm:py-20"
        aria-labelledby="journey-title"
      >
        <div className="container-page">
          <SectionHeading
            eyebrow="How it comes together"
            title={
              <span id="journey-title">From sign-up to the next reunion</span>
            }
            description="Four small steps between an old friendship and a table booked for the whole batch."
            align="center"
          />
          <JourneySteps />
          <p className="mt-10 text-center text-sm text-muted">
            By joining you agree to the{" "}
            <Link
              href="/community-guidelines"
              className="font-semibold text-brand-ink hover:underline"
            >
              Community Guidelines
            </Link>
            , which keep this space respectful and free of patient information.
          </p>
        </div>
      </section>

      {/* 9 — Join */}
      <section className="py-16 sm:py-20" aria-label="Join the community">
        <div className="container-page">
          <JoinCta />
        </div>
      </section>
    </>
  );
}
