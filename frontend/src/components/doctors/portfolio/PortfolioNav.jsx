"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/format";

// Distance from the top of the window at which a section counts as being read (site header + the bar).
const READING_LINE = 200;

/**
 * Scroll spy: the id of the section being read — the last one whose top has
 * passed the reading line — or '' above the first section.
 */
function useActiveSection(sections) {
  const [active, setActive] = useState("");
  const ids = sections.map((section) => section.id).join(",");

  useEffect(() => {
    if (!ids) return undefined;
    const targets = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = "";
      let reached = -Infinity;
      for (const target of targets) {
        const top = target.getBoundingClientRect().top;
        // Sections that sit side by side share a top: the first of them wins.
        if (top <= READING_LINE && top > reached) {
          reached = top;
          current = target.id;
        }
      }
      const atEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atEnd && targets.length) current = targets[targets.length - 1].id;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return active;
}

/**
 * Profile navigation: a dark pill that floats over the portfolio with back to
 * the directory, the doctor's name, a sideways-scrolling link to each section
 * and — when the doctor shares contact details — a Contact button (which is why
 * Contact is not also in the links). It stays below the site header while
 * scrolling and marks the section being read.
 */
export default function PortfolioNav({ name, sections, contactHref }) {
  const active = useActiveSection(sections);
  const list = useRef(null);

  // Keep the current link in view when the links overflow (small screens).
  useEffect(() => {
    const row = list.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const link = active ? row.querySelector('[aria-current="true"]') : null;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Back above the first section the row returns to its start.
    row.scrollTo({
      left: link
        ? link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2
        : 0,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [active]);

  return (
    <div className="pointer-events-none sticky top-[4.25rem] z-30">
      <div className="container-page pt-3">
        <nav
          aria-label="Sections of this profile"
          className="pointer-events-auto flex h-14 items-center gap-2 rounded-full border border-white/10 bg-[#0a1b42]/90 pl-2 pr-2 text-white shadow-lift backdrop-blur-md sm:gap-3 sm:pl-3"
        >
          <Link
            href="/doctors"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
            aria-label="Back to Friends"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p
            className="hidden min-w-0 max-w-[13rem] shrink-0 items-center gap-2 lg:flex"
            aria-hidden="true"
          >
            <Activity className="h-4 w-4 shrink-0 text-[#22bef2]" />
            <span className="truncate text-sm font-extrabold uppercase tracking-[0.08em]">
              {name}
            </span>
          </p>

          {sections.length > 1 ? (
            <ul
              ref={list}
              className="relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-2 [mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sections.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? "true" : undefined}
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition-colors",
                      active === section.id
                        ? "bg-white/15 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-extrabold uppercase tracking-[0.08em] lg:hidden">
              {name}
            </p>
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
