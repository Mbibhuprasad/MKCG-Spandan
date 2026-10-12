'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { IdCard, MessagesSquare, PartyPopper, UserPlus } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: 'Join in a minute',
    text: 'Register as a doctor and step straight into the community. There is no waiting for account approval.',
  },
  {
    icon: IdCard,
    title: 'Shape your portfolio',
    text: 'Add your specialization, hospital, education and achievements whenever you are ready — or skip it for now.',
  },
  {
    icon: MessagesSquare,
    title: 'Share and reconnect',
    text: 'Post updates, write blogs and add memories. What you share is published straight away; members can report anything that is not respectful.',
  },
  {
    icon: PartyPopper,
    title: 'Meet again',
    text: 'Propose reunions, share visit plans when you travel, and vote together on dates, venues and budgets.',
  },
];

/**
 * "From sign-up to reunion" — a short scroll story.
 * GSAP scrubs the connecting line with the scroll position and brings each
 * step in as it arrives. Without motion (or JavaScript) the full line and all
 * four steps are simply visible.
 */
export default function JourneySteps() {
  const root = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          root.current,
          { '--progress': 0 },
          {
            '--progress': 1,
            ease: 'none',
            scrollTrigger: { trigger: root.current, start: 'top 78%', end: 'bottom 62%', scrub: 0.5 },
          }
        );
        gsap.from('[data-step]', {
          opacity: 0,
          y: 26,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.14,
          scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="relative" style={{ '--progress': 1 }}>
      {/* Track + animated fill: vertical on small screens, horizontal from lg. */}
      <div className="absolute bottom-6 left-6 top-6 w-0.5 rounded-full bg-line lg:bottom-auto lg:left-[12.5%] lg:right-[12.5%] lg:top-6 lg:h-0.5 lg:w-auto" aria-hidden="true">
        <div
          className="h-full w-full origin-top rounded-full bg-gradient-to-b from-brand to-leaf lg:hidden"
          style={{ transform: 'scaleY(var(--progress))' }}
        />
        <div
          className="hidden h-full w-full origin-left rounded-full bg-gradient-to-r from-brand to-leaf lg:block"
          style={{ transform: 'scaleX(var(--progress))' }}
        />
      </div>

      <ol className="relative grid gap-8 lg:grid-cols-4 lg:gap-6">
        {steps.map((step, index) => (
          <li key={step.title} data-step className="flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
            <span className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-surface text-brand-ink shadow-soft">
              <step.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="lg:mt-5 lg:px-2">
              <p className="text-xs font-bold uppercase tracking-widest text-leaf">Step {index + 1}</p>
              <h3 className="mt-1 text-lg font-bold text-fg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-soft">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
