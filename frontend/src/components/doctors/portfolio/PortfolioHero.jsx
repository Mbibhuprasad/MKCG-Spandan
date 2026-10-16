'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Activity } from 'lucide-react';
import { cn, initials } from '@/lib/format';
import HeroParticles from './HeroParticles';

const ACTION_BASE =
  'inline-flex h-12 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[0.95rem] font-bold transition-colors duration-150';
const ACTION_OUTLINE = 'border border-line-strong bg-surface/70 text-fg hover:border-brand hover:bg-brand-soft';

/** A pill button on the hero, linking to a page of the site. */
function HeroAction({ href, icon: Icon, className, children }) {
  return (
    <Link href={href} className={cn(ACTION_BASE, ACTION_OUTLINE, className)}>
      {Icon && <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />}
      {children}
    </Link>
  );
}

// The ground of the hero: the page's own background (white in the light theme) under two faint blue washes.
const HERO_BACKGROUND = [
  'radial-gradient(60rem 30rem at 88% -12%, rgba(59, 130, 246, 0.14), transparent 62%)',
  'radial-gradient(44rem 28rem at -6% 108%, rgba(56, 189, 248, 0.12), transparent 62%)',
].join(', ');

// The photograph's frame: a hairline blue border, a layered shadow with a blue glow, and the halo behind it.
const PHOTO_BORDER = 'linear-gradient(140deg, rgba(147, 197, 253, 0.95), rgba(37, 99, 235, 0.8) 45%, rgba(56, 189, 248, 0.9))';
const PHOTO_SHADOW =
  '0 32px 60px -26px rgba(20, 57, 138, 0.5), 0 14px 26px -14px rgba(20, 57, 138, 0.28), 0 0 64px -10px rgba(59, 130, 246, 0.45)';
const PHOTO_HALO = 'linear-gradient(135deg, rgba(59, 130, 246, 0.55), rgba(56, 189, 248, 0.45) 55%, rgba(37, 99, 235, 0.5))';

// How far the photograph leans and turns towards the pointer.
const PHOTO_REACH = 18; // px
const PHOTO_TILT = 9; // degrees

// "Dr Asha Rao" → ["Dr", "Asha Rao"], so the honorific can be set apart from the name.
const splitHonorific = (name) => {
  const match = /^((?:dr|prof)\.?)\s+(.+)$/i.exec(String(name || '').trim());
  return match ? [match[1], match[2]] : ['', String(name || '').trim()];
};

/**
 * The opening of a portfolio, on a clean light ground with drifting blue shapes
 * and particles: who the doctor is on the left, their photograph in a
 * square frame on the right (below the text on small screens). Every value is passed in from the
 * saved profile; anything missing is simply not rendered.
 *
 *  - `facts`    short facts under the text:  [{ icon, label, text }]
 *  - `actions`  buttons under the text:      [{ href, label, icon }] — the owner's "Edit profile",
 *               or "Send a message" (in-app chat) for other members; phone, email and WhatsApp
 *               buttons stay in the contact section
 */
export default function PortfolioHero({ id, name, photoUrl, eyebrow, title, headline, bio, facts = [], actions = [] }) {
  const root = useRef(null);
  const photo = useRef(null);
  const [honorific, rest] = splitHonorific(name);

  // GSAP: the blue shapes drift, the halo behind the photograph breathes, and
  // with a mouse the photograph leans and turns towards the pointer while it
  // is over the hero (and grows a little when the pointer is on it). Never
  // when the visitor prefers reduced motion. The text and photograph enter
  // with the CSS `rise-in` used across the site.
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.to('[data-halo]', { opacity: 0.85, scale: 1.06, duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        gsap.utils.toArray('[data-orb]').forEach((orb, index) => {
          gsap.to(orb, {
            xPercent: index % 2 ? -12 : 10,
            yPercent: index % 3 ? 9 : -11,
            scale: 1.1,
            duration: 8 + index * 1.7,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        });
      }, root);
      return () => ctx.revert();
    });
    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
      const hero = root.current;
      const frame = photo.current;
      if (!hero || !frame) return undefined;
      let move = {};
      const ctx = gsap.context(() => {
        gsap.set(frame, { transformPerspective: 900 });
        const follow = (property) => gsap.quickTo(frame, property, { duration: 0.6, ease: 'power3.out' });
        move = { x: follow('x'), y: follow('y'), turn: follow('rotationY'), nod: follow('rotationX') };
      }, root);
      const grow = (scale) => gsap.to(frame, { scale, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
      const clamp = gsap.utils.clamp(-1, 1);
      const onMove = (event) => {
        // The slot keeps its place, so the centre is read from it and not from the moving frame.
        const slot = frame.parentElement.getBoundingClientRect();
        const box = hero.getBoundingClientRect();
        const dx = clamp((event.clientX - (slot.left + slot.width / 2)) / (box.width / 2));
        const dy = clamp((event.clientY - (slot.top + slot.height / 2)) / (box.height / 2));
        move.x(dx * PHOTO_REACH);
        move.y(dy * PHOTO_REACH);
        move.turn(dx * PHOTO_TILT);
        move.nod(-dy * PHOTO_TILT);
      };
      const onLeave = () => {
        move.x(0);
        move.y(0);
        move.turn(0);
        move.nod(0);
      };
      const onOver = () => grow(1.04);
      const onOut = () => grow(1);
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave);
      frame.addEventListener('pointerenter', onOver);
      frame.addEventListener('pointerleave', onOut);
      return () => {
        hero.removeEventListener('pointermove', onMove);
        hero.removeEventListener('pointerleave', onLeave);
        frame.removeEventListener('pointerenter', onOver);
        frame.removeEventListener('pointerleave', onOut);
        gsap.killTweensOf(frame);
        ctx.revert();
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <header ref={root} id={id} className="relative -mt-[4.25rem] scroll-mt-40 overflow-hidden border-b border-line bg-bg text-fg" style={{ backgroundImage: HERO_BACKGROUND }}>
      {/* Soft blue shapes that drift, then the particles; the content sits above both. */}
      <div data-orb className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#3b82f6]/[0.12] blur-3xl sm:bg-[#3b82f6]/[0.2]" aria-hidden="true" />
      <div data-orb className="pointer-events-none absolute -bottom-36 -left-20 h-[24rem] w-[24rem] rounded-full bg-[#38bdf8]/[0.2] blur-3xl" aria-hidden="true" />
      <div data-orb className="pointer-events-none absolute left-[36%] top-[16%] h-56 w-56 rounded-full bg-[#2563eb]/[0.12] blur-3xl" aria-hidden="true" />
      <div data-orb className="pointer-events-none absolute -right-28 -top-44 h-[31rem] w-[31rem] rounded-full border border-[#2563eb]/[0.14]" aria-hidden="true" />
      <div
        data-orb
        className="pointer-events-none absolute right-[40%] top-12 hidden h-36 w-36 rotate-12 rounded-[2rem] border border-[#2563eb]/[0.16] bg-[#3b82f6]/[0.05] lg:block"
        aria-hidden="true"
      />
      <HeroParticles />

      <div className="container-page relative grid items-center gap-x-12 gap-y-10 pb-28 pt-[6.75rem] sm:pb-32 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:pt-32">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="rise-in flex items-start gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink sm:text-[0.8rem]"
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
            {honorific && <span className="text-fg">{honorific} </span>}
            <span className="text-[#1d5fe0] dark:text-[#6ea8ff]">{rest}</span>
          </h1>
          {title && (
            <p
              className="rise-in mt-4 break-words font-sans text-lg font-bold uppercase leading-snug tracking-wide text-fg sm:text-xl lg:text-[1.4rem]"
              style={{ '--delay': '160ms' }}
            >
              {title}
            </p>
          )}
          {headline && (
            <p className="rise-in mt-6 flex max-w-2xl gap-3" style={{ '--delay': '210ms' }}>
              <span className="-mt-1 font-display text-5xl leading-none text-[#3b82f6]" aria-hidden="true">
                “
              </span>
              <span className="min-w-0 break-words text-lg italic leading-relaxed text-fg-soft">{headline}</span>
            </p>
          )}
          {bio && (
            <p className="rise-in mt-5 line-clamp-3 max-w-2xl break-words leading-relaxed text-muted" style={{ '--delay': '250ms' }}>
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

          {/* {facts.length > 0 && (
            <dl className="rise-in mt-8 flex flex-col gap-x-6 gap-y-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ '--delay': '360ms' }}>
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-2 text-sm font-bold text-fg sm:border-r sm:border-line-strong sm:pr-6 sm:last:border-r-0 sm:last:pr-0">
                  <dt className="sr-only">{fact.label}</dt>
                  <fact.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                  <dd className="min-w-0 break-words">{fact.text}</dd>
                </div>
              ))}
            </dl>
          )} */}
        </div>

        <div className="rise-in flex justify-center" style={{ '--delay': '220ms' }}>
          <div ref={photo} className="relative h-60 w-60 will-change-transform sm:h-72 sm:w-72 lg:h-80 lg:w-80">
            <span data-halo className="absolute -inset-4 rounded-[2.5rem] opacity-50 blur-2xl" style={{ backgroundImage: PHOTO_HALO }} aria-hidden="true" />
            <span className="absolute -inset-3 rounded-[2.25rem] border border-[#2563eb]/20" aria-hidden="true" />
            <div className="relative h-full w-full rounded-[1.75rem] p-px" style={{ backgroundImage: PHOTO_BORDER, boxShadow: PHOTO_SHADOW }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name}
                  className="h-full w-full rounded-[calc(1.75rem-1px)] bg-surface-2 object-cover object-[50%_25%]"
                  fetchPriority="high"
                />
              ) : (
                <div
                  role="img"
                  aria-label={name}
                  className="flex h-full w-full items-center justify-center rounded-[calc(1.75rem-1px)] bg-gradient-to-br from-[#1d4ed8] to-[#0b2a6b] font-sans text-7xl font-bold text-white sm:text-8xl"
                >
                  {initials(name)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
