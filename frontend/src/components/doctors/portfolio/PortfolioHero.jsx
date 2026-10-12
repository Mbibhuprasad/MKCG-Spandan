'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Activity, ArrowLeft } from 'lucide-react';
import { cn, initials } from '@/lib/format';
import HeroParticles from './HeroParticles';

const ACTION_BASE =
  'inline-flex h-12 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[0.95rem] font-bold transition-colors duration-150';
const ACTION_TONES = {
  outline: 'border border-white/40 text-white hover:border-white/70 hover:bg-white/10',
  cyan: 'bg-[#22bef2] text-[#001a4a] shadow-[0_6px_20px_rgba(0,0,0,0.28)] hover:bg-[#5fd2f7]',
  light: 'bg-[#e3f1fb] text-[#001a4a] shadow-[0_6px_20px_rgba(0,0,0,0.28)] hover:bg-white',
};

/** A pill button on the hero. Site pages use <Link>; mailto, tel and external links a plain anchor. */
function HeroAction({ href, icon: Icon, tone = 'outline', external = false, className, children }) {
  const classes = cn(ACTION_BASE, ACTION_TONES[tone], className);
  const content = (
    <>
      {Icon && <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />}
      {children}
    </>
  );
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {content}
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

// The ground of the hero: navy running into blue and a grey-teal, under three soft glows and a grey veil.
const HERO_BACKGROUND = [
  'radial-gradient(56rem 32rem at 92% -12%, rgba(45, 212, 191, 0.26), transparent 62%)',
  'radial-gradient(44rem 30rem at -10% 110%, rgba(37, 99, 235, 0.38), transparent 62%)',
  'radial-gradient(38rem 22rem at 58% 118%, rgba(16, 185, 129, 0.16), transparent 66%)',
  'linear-gradient(180deg, rgba(148, 163, 184, 0.1) 0%, transparent 38%)',
  'linear-gradient(120deg, #044304 0%, #186c15 36%, #0a2c5c 62%, #0e4257 84%, #27505a 100%)',
].join(', ');

// The photograph's frame: a hairline gradient border, a layered shadow with a blue and teal glow, and the halo behind it.
const PHOTO_BORDER = 'linear-gradient(140deg, rgba(255, 255, 255, 0.75), rgba(45, 212, 191, 0.65) 45%, rgba(59, 130, 246, 0.7))';
const PHOTO_SHADOW =
  '0 30px 60px -22px rgba(0, 0, 0, 0.7), 0 12px 24px -12px rgba(3, 10, 32, 0.7), 0 0 56px -8px rgba(34, 190, 242, 0.45), 0 0 110px -20px rgba(45, 212, 191, 0.4)';
const PHOTO_HALO = 'linear-gradient(135deg, rgba(34, 190, 242, 0.6), rgba(45, 212, 191, 0.5) 55%, rgba(37, 99, 235, 0.55))';

// "Dr Asha Rao" → ["Dr", "Asha Rao"], so the honorific can be set apart from the name.
const splitHonorific = (name) => {
  const match = /^((?:dr|prof)\.?)\s+(.+)$/i.exec(String(name || '').trim());
  return match ? [match[1], match[2]] : ['', String(name || '').trim()];
};

/**
 * The opening of a portfolio, on a navy, blue and teal ground with a few
 * drifting particles: who the doctor is on the left, their photograph in a
 * square frame on the right (below the text on small screens). Every value is passed in from the
 * saved profile; anything missing is simply not rendered.
 *
 *  - `facts`    short facts under the buttons: [{ icon, label, text }]
 *  - `actions`  buttons beside the name:        [{ href, label, icon, tone, external }]
 *  - `quick`    buttons below the photograph, same shape
 */
export default function PortfolioHero({ name, photoUrl, eyebrow, title, headline, bio, facts = [], actions = [], quick = [] }) {
  const root = useRef(null);
  const [honorific, rest] = splitHonorific(name);

  // GSAP: the halo behind the photograph breathes, and on large screens the
  // backdrop shapes drift. Never when the visitor prefers reduced motion. The
  // text and photograph enter with the CSS `rise-in` used across the site.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.to('[data-halo]', { opacity: 1, scale: 1.05, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }, root);
      return () => ctx.revert();
    });
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 1024px)', () => {
      const ctx = gsap.context(() => {
        gsap.to('[data-orb]', { xPercent: 5, yPercent: -6, duration: 10, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.8 });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <header ref={root} className="relative -mt-[4.25rem] overflow-hidden bg-[#06173f] text-white xl:mt-0" style={{ backgroundImage: HERO_BACKGROUND }}>
      {/* Translucent shapes for depth, then the particles; the content sits above both. */}
      <div
        data-orb
        className="pointer-events-none absolute -right-28 -top-44 h-[31rem] w-[31rem] rounded-full border border-white/[0.06] bg-[#2dd4bf]/[0.09]"
        aria-hidden="true"
      />
      <div data-orb className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#1a4fff]/[0.13]" aria-hidden="true" />
      <div
        data-orb
        className="pointer-events-none absolute right-[40%] top-12 hidden h-36 w-36 rotate-12 rounded-[2rem] border border-white/[0.08] bg-white/[0.025] lg:block"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -bottom-28 left-[28%] h-64 w-[34rem] rounded-full bg-[#94a3b8]/[0.09] blur-3xl" aria-hidden="true" />
      <HeroParticles />

      <div className="container-page relative grid items-center gap-x-12 gap-y-10 pb-28 pt-[6.75rem] sm:pb-32 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:pt-32 xl:pt-12">
        <div className="min-w-0">
          {/* Below this width the back link is in the section bar. */}
          <Link href="/doctors" className="mb-9 hidden items-center gap-1.5 text-sm font-bold text-white/70 transition-colors hover:text-white xl:inline-flex">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the directory
          </Link>
          {eyebrow && (
            <p
              className="rise-in flex items-start gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#5fd2f7] sm:text-[0.8rem]"
              style={{ '--delay': '40ms' }}
            >
              <Activity className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{eyebrow}</span>
            </p>
          )}
          <h1
            className="rise-in mt-4 break-words font-sans text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.1rem]"
            style={{ '--delay': '100ms' }}
          >
            {honorific && <span className="text-white">{honorific} </span>}
            <span className="text-[#34c3f5]">{rest}</span>
          </h1>
          {title && (
            <p
              className="rise-in mt-4 break-words font-sans text-lg font-bold uppercase leading-snug tracking-wide text-white/90 sm:text-xl lg:text-[1.4rem]"
              style={{ '--delay': '160ms' }}
            >
              {title}
            </p>
          )}
          {headline && (
            <p className="rise-in mt-6 flex max-w-2xl gap-3" style={{ '--delay': '210ms' }}>
              <span className="-mt-1 font-display text-5xl leading-none text-[#4d7dff]" aria-hidden="true">
                “
              </span>
              <span className="min-w-0 break-words text-lg italic leading-relaxed text-white/85">{headline}</span>
            </p>
          )}
          {bio && (
            <p className="rise-in mt-5 line-clamp-3 max-w-2xl break-words leading-relaxed text-white/70" style={{ '--delay': '250ms' }}>
              {bio}
            </p>
          )}

          {actions.length > 0 && (
            <div className="rise-in mt-8 flex flex-wrap gap-3" style={{ '--delay': '300ms' }}>
              {actions.map((action) => (
                <HeroAction key={action.label} {...action} className="max-sm:flex-1">
                  {action.label}
                </HeroAction>
              ))}
            </div>
          )}

          {facts.length > 0 && (
            <dl className="rise-in mt-8 flex flex-col gap-x-6 gap-y-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ '--delay': '360ms' }}>
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-2 text-sm font-bold text-white sm:border-r sm:border-white/20 sm:pr-6 sm:last:border-r-0 sm:last:pr-0">
                  <dt className="sr-only">{fact.label}</dt>
                  <fact.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#5fd2f7]" aria-hidden="true" />
                  <dd className="min-w-0 break-words">{fact.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="rise-in flex flex-col items-center gap-8" style={{ '--delay': '220ms' }}>
          <div className="relative h-60 w-60 sm:h-72 sm:w-72 lg:h-80 lg:w-80">
            <span data-halo className="absolute -inset-4 rounded-[2.5rem] opacity-60 blur-2xl" style={{ backgroundImage: PHOTO_HALO }} aria-hidden="true" />
            <span className="absolute -inset-3 rounded-[2.25rem] border border-white/10" aria-hidden="true" />
            <div className="relative h-full w-full rounded-[1.75rem] p-px" style={{ backgroundImage: PHOTO_BORDER, boxShadow: PHOTO_SHADOW }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name}
                  className="h-full w-full rounded-[calc(1.75rem-1px)] bg-[#06173f] object-cover object-[50%_25%]"
                  fetchPriority="high"
                />
              ) : (
                <div
                  role="img"
                  aria-label={name}
                  className="flex h-full w-full items-center justify-center rounded-[calc(1.75rem-1px)] bg-[#06173f] font-sans text-7xl font-bold text-white sm:text-8xl"
                >
                  {initials(name)}
                </div>
              )}
            </div>
          </div>

          {quick.length > 0 && (
            <div className="flex w-full flex-wrap justify-center gap-3">
              {quick.map((action) => (
                <HeroAction key={action.label} {...action} className="h-11 px-5 text-sm max-sm:flex-1">
                  {action.label}
                </HeroAction>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
