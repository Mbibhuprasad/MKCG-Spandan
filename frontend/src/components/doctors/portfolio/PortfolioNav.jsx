'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/format';

// Distance from the top of the window at which a section counts as being read (site header + the bar).
const READING_LINE = 200;

/**
 * Scroll spy: the id of the section being read — the last one whose top has
 * passed the reading line — or '' above the first section.
 */
function useActiveSection(sections) {
  const [active, setActive] = useState('');
  const ids = sections.map((section) => section.id).join(',');

  useEffect(() => {
    if (!ids) return undefined;
    const targets = ids
      .split(',')
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = '';
      let reached = -Infinity;
      for (const target of targets) {
        const top = target.getBoundingClientRect().top;
        // Sections that sit side by side share a top: the first of them wins.
        if (top <= READING_LINE && top > reached) {
          reached = top;
          current = target.id;
        }
      }
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atEnd && targets.length) current = targets[targets.length - 1].id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ids]);

  return active;
}

/**
 * Profile navigation below the desktop breakpoint: a dark pill that floats over
 * the portfolio with back to the directory, the doctor's name, a sideways-
 * scrolling link to each section and — when the doctor shares contact details —
 * a Contact button (which is why Contact is not also in the links). It stays
 * below the site header while scrolling and marks the section being read. Wide
 * screens use <PortfolioSidebar> instead.
 */
export default function PortfolioNav({ name, sections, contactHref }) {
  const active = useActiveSection(sections);
  const list = useRef(null);

  // Keep the current link in view when the links overflow (small screens).
  useEffect(() => {
    const row = list.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const link = active ? row.querySelector('[aria-current="true"]') : null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Back above the first section the row returns to its start.
    row.scrollTo({ left: link ? link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2 : 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [active]);

  return (
    <div className="pointer-events-none sticky top-[4.25rem] z-30 xl:hidden">
      <div className="container-page pt-3">
        <nav
          aria-label="Sections of this profile"
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full border border-white/10 bg-[#0a1b42]/90 pl-2 pr-2 text-white shadow-lift backdrop-blur-md sm:gap-3 sm:pl-3"
        >
          <Link
            href="/doctors"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
            aria-label="Back to the directory"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="hidden min-w-0 max-w-[13rem] shrink-0 items-center gap-2 lg:flex" aria-hidden="true">
            <Activity className="h-4 w-4 shrink-0 text-[#22bef2]" />
            <span className="truncate text-sm font-extrabold uppercase tracking-[0.08em]">{name}</span>
          </p>

          {sections.length > 1 ? (
            <ul ref={list} className="relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-2 [mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sections.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? 'true' : undefined}
                    className={cn(
                      'inline-flex whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition-colors',
                      active === section.id ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-extrabold uppercase tracking-[0.08em] lg:hidden">{name}</p>
          )}

          {contactHref && (
            <a
              href={contactHref}
              className="ml-auto inline-flex h-10 shrink-0 items-center rounded-full bg-[#1a4fff] px-4 text-sm font-extrabold text-white shadow-[0_4px_18px_rgba(26,79,255,0.45)] transition-colors hover:bg-[#3d6bff] sm:px-5"
            >
              Contact
            </a>
          )}
        </nav>
      </div>
    </div>
  );
}

/**
 * Profile navigation on wide screens: a vertical panel in the right-hand column
 * of the portfolio with the same contents as the pill — back to the directory,
 * the doctor's name, a link to each section and the Contact button. It stays in
 * view while the sections scroll past and marks the one being read.
 */
export function PortfolioSidebar({ name, sections, contactHref }) {
  const active = useActiveSection(sections);

  return (
    <aside
      className="sticky top-[5.5rem] mt-12 hidden max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a1b42] text-white shadow-lift xl:flex"
      style={{ backgroundImage: 'linear-gradient(165deg, #06173f 0%, #0a1b42 55%, #0e3a4d 100%)' }}
    >
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <Link href="/doctors" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to the directory
        </Link>
        <p className="mt-3 flex items-start gap-2">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#2dd4bf]" aria-hidden="true" />
          <span className="min-w-0 break-words text-sm font-extrabold uppercase leading-snug tracking-[0.08em]">{name}</span>
        </p>
      </div>

      {sections.length > 0 && (
        <nav aria-label="Sections of this profile" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {sections.map((section) => {
              const current = active === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                      current ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
                    )}
                  >
                    <span className={cn('h-4 w-[3px] shrink-0 rounded-full transition-colors', current ? 'bg-[#2dd4bf]' : 'bg-white/15')} aria-hidden="true" />
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {contactHref && (
        <div className="border-t border-white/10 p-3">
          <a
            href={contactHref}
            className="flex h-10 items-center justify-center rounded-full bg-[#1a4fff] px-5 text-sm font-extrabold text-white shadow-[0_4px_18px_rgba(26,79,255,0.45)] transition-colors hover:bg-[#3d6bff]"
          >
            Contact
          </a>
        </div>
      )}
    </aside>
  );
}
