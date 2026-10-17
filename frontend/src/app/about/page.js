import {
  BookOpen,
  CalendarDays,
  HeartPulse,
  IdCard,
  Images,
  Lock,
  MessagesSquare,
  Scale,
  ShieldCheck,
  Stethoscope,
  UserRoundPlus,
  Users,
  Vote,
  Handshake,
  Share2,
  PartyPopper,
} from 'lucide-react';
import Link from 'next/link';
import { site } from '@/lib/site';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { PageHeader, SectionHeading } from '@/components/ui/Layout';

export const metadata = {
  title: 'About',
  description:
    'MKCGSPANDAN is a private, member-run community where doctors and medical Friends reconnect, share professional journeys, preserve memories and plan reunions.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: `About ${site.name}`,
    description:
      'Why MKCGSPANDAN exists, how it helps doctors reconnect with their Friends, and the standards of privacy and respect its members keep.',
    url: '/about',
    type: 'website',
  },
};

const features = [
  {
    icon: Stethoscope,
    title: 'Find your friends',
    text: 'Find Friends by name, specialization or city, and see where their careers have taken them through professional profile pages.',
  },
  {
    icon: MessagesSquare,
    title: 'A community feed',
    text: 'Share updates, achievements and reunion news, and respond to one another with likes and comments.',
  },
  {
    icon: BookOpen,
    title: 'Blogs by members',
    text: 'Write longer reflections on practice, research, careers and life in medicine. Blogs can be read by anyone.',
  },
  {
    icon: Images,
    title: 'Shared memories',
    text: 'Collect photos and videos from college days, reunions and celebrations in a gallery that only members can open.',
  },
  {
    icon: CalendarDays,
    title: 'Events and visit plans',
    text: 'Propose reunions, dinners and meetups, RSVP in a click, or simply let Friends know when you are visiting their city.',
  },
  {
    icon: Vote,
    title: 'Polls for planning',
    text: 'Settle dates, venues, activities and budgets together, with one vote per member.',
  },
];

const steps = [
  {
    icon: UserRoundPlus,
    title: 'Join',
    text: 'Register with your name, email address and phone number. Your account is active straight away — there is no waiting period.',
  },
  {
    icon: IdCard,
    title: 'Complete your profile',
    text: 'Add your specialization, hospital, city, education and experience whenever you are ready, and choose what other members can see.',
  },
  {
    icon: Share2,
    title: 'Share and respond',
    text: 'Share posts, blogs, memories, events and polls. They are published to the community straight away.',
  },
  {
    icon: PartyPopper,
    title: 'Meet again',
    text: 'RSVP to gatherings, vote on plans, and add the photographs afterwards so the next reunion has even more to look back on.',
  },
];

const commitments = [
  {
    icon: Lock,
    title: 'Privacy',
    text: 'Member posts, memories, events and the Friends section are visible only to signed-in members. Your email address and phone number stay hidden from other members unless you choose to show them.',
  },
  {
    icon: Handshake,
    title: 'Respect',
    text: 'This is a community of colleagues and friends. Harassment, discrimination, impersonation and abusive behaviour have no place here.',
  },
  {
    icon: Scale,
    title: 'Professional conduct',
    text: 'Patient confidentiality comes first. Identifiable patient records, prescriptions, reports and clinical details must never be shared.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderation',
    text: 'Members can report anything that concerns them, and administrators can remove content or suspend accounts.',
  },
];

function IconTile({ icon: Icon, tone = 'brand' }) {
  return (
    <span
      className={
        tone === 'leaf'
          ? 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-strong'
          : 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink'
      }
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow={`About ${site.name}`}
        title="A private home for a medical batch, long after graduation"
        description="MKCGSPANDAN brings doctors and medical Friends together in one place — to reconnect, to celebrate each other's work, to keep shared memories safe and to make the next reunion easier to plan."
        actions={
          <>
            <Button href="/register">Join the Community</Button>
            <Button href="/blogs" variant="secondary">
              Read member blogs
            </Button>
          </>
        }
      />

      {/* What it is */}
      <section className="container-page grid gap-10 py-14 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16" aria-labelledby="what-heading">
        <Reveal>
          <p className="eyebrow mb-2">What it is</p>
          <h2 id="what-heading" className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[2rem] sm:leading-tight">
            A community of doctors who trained together
          </h2>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-fg-soft">
            <p>
              MKCGSPANDAN is an online community for doctors and medical Friends. It combines a Friends section,
              a community feed, member blogs, a memories gallery, events and polls — everything a batch needs to stay
              in touch — inside a space that is private to its members.
            </p>
            <p>
              It is not a hospital system, a patient service or a general social network. There are no patient records
              here, no advertisements and no public timeline. It exists for one purpose: keeping people who shared the
              years of medical training connected throughout their careers.
            </p>
            <p className="text-sm text-muted">
              MKCGSPANDAN is an independent, member-run community. It does not represent, and is not presented as
              being endorsed by, any medical college, hospital, council or other institution.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="card relative overflow-hidden p-7 sm:p-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-strong">
              <HeartPulse className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold text-fg">Why &ldquo;Spandan&rdquo;?</h3>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-soft">
              Spandan means a heartbeat — a pulse. It is the first sign every doctor learns to look for, and a fitting
              name for what keeps a batch alive: the regular, quiet rhythm of people checking in on one another.
            </p>
            <svg viewBox="0 0 320 48" className="mt-6 h-10 w-full text-leaf" aria-hidden="true" preserveAspectRatio="none">
              <path
                d="M0 28h70l12-18 16 34 14-26 10 10h54l12-18 16 34 14-26 10 10h92"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Reveal>
      </section>

      {/* Why it exists */}
      <section className="border-y border-line bg-bg-soft" aria-labelledby="why-heading">
        <div className="container-page grid gap-10 py-14 sm:py-16 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="eyebrow mb-2">Why it exists</p>
            <h2 id="why-heading" className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[2rem] sm:leading-tight">
              Batches scatter. Friendships should not have to.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="space-y-4 text-base leading-relaxed text-fg-soft">
            <p>
              After graduation a batch spreads across specialties, cities and countries. Phone numbers change, group
              chats grow noisy, and photographs end up on devices nobody can find any more. Staying in touch slowly
              becomes something that only happens by chance.
            </p>
            <p>
              MKCGSPANDAN was created to give that shared history a permanent, well-kept place: one where it is easy
              to find a batchmate, to see what they are doing now, and to bring everyone back into the same room.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it helps */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="how-heading">
        <SectionHeading
          eyebrow="How it helps doctors reconnect"
          title={<span id="how-heading">Everything a batch needs, in one place</span>}
          description="Each part of the community is built around a simple question: how do people who trained together keep finding their way back to each other?"
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal as="li" key={feature.title} delay={Math.min(index, 5) * 0.05}>
              <div className="card h-full p-6">
                <IconTile icon={feature.icon} />
                <h3 className="mt-4 text-base font-bold text-fg">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">{feature.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Relationships and memories */}
      <section className="border-y border-line bg-bg-soft" aria-labelledby="value-heading">
        <div className="container-page grid gap-8 py-14 sm:py-16 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <div className="card h-full p-7 sm:p-8">
              <IconTile icon={Users} />
              <h2 id="value-heading" className="mt-5 font-display text-xl font-semibold text-fg sm:text-2xl">
                Professional relationships that last a career
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-soft">
                The people you trained with know how you think and how you work. Years later they are the colleagues
                you can ask for a second opinion on a career decision, an introduction in a new city, or an honest
                view on a difficult choice. A batch is a professional network built on trust that already exists —
                it only needs somewhere to live.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="card h-full p-7 sm:p-8">
              <IconTile icon={Images} tone="leaf" />
              <h2 className="mt-5 font-display text-xl font-semibold text-fg sm:text-2xl">Memories worth keeping together</h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-soft">
                Hostel corridors, first postings, convocation day, the reunion where everyone finally turned up.
                Those moments belong to the whole batch, not to one person&apos;s phone. The memories gallery keeps
                them in one place, linked to the events they came from, and visible only to members.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Participation */}
      <section className="container-page py-14 sm:py-16" aria-labelledby="participate-heading">
        <SectionHeading
          eyebrow="Taking part"
          title={<span id="participate-heading">From joining to the next reunion</span>}
          description="Any member can propose a gathering. Reunions, get-togethers, dinners, professional meetups and visit plans all follow the same simple path."
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.06}>
              <div className="card h-full p-6">
                <div className="flex items-center justify-between">
                  <IconTile icon={step.icon} tone="leaf" />
                  <span className="font-display text-3xl font-semibold text-line-strong" aria-hidden="true">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-fg">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
          Sharing a city or travel dates is always voluntary. The community never tracks where members are.
        </p>
      </section>

      {/* Commitments */}
      <section className="border-t border-line bg-bg-soft" aria-labelledby="commitment-heading">
        <div className="container-page py-14 sm:py-16">
          <SectionHeading
            eyebrow="Our commitment"
            title={<span id="commitment-heading">Privacy, respect and professional conduct</span>}
            description="A community of doctors is only useful if its members can trust it. These are the standards every member agrees to when they join."
          />
          <ul className="grid gap-5 sm:grid-cols-2">
            {commitments.map((item, index) => (
              <Reveal as="li" key={item.title} delay={index * 0.05}>
                <div className="card flex h-full gap-4 p-6">
                  <IconTile icon={item.icon} />
                  <div>
                    <h3 className="text-base font-bold text-fg">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">{item.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="mt-6 text-sm text-fg-soft">
            The details are set out in the{' '}
            <Link href="/community-guidelines" className="font-semibold text-brand-ink underline underline-offset-2">
              Community Guidelines
            </Link>
            ,{' '}
            <Link href="/privacy" className="font-semibold text-brand-ink underline underline-offset-2">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="font-semibold text-brand-ink underline underline-offset-2">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Call to action */}
      <section className="container-page py-14 sm:py-20" aria-labelledby="about-cta-heading">
        <Reveal>
          <div className="card flex flex-col items-center px-6 py-12 text-center sm:px-12">
            <h2 id="about-cta-heading" className="font-display text-2xl font-semibold text-fg sm:text-3xl">
              Your batch is waiting to hear from you
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-fg-soft">
              Create your doctor account in a couple of minutes. You can start exploring immediately and complete
              your profile whenever it suits you.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="/register" size="lg">
                Join the Community
              </Button>
              <Button href="/login" variant="secondary" size="lg">
                Log in
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
