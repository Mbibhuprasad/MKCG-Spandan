"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Download,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import { site } from "@/lib/site";
import HeroVisual from "./HeroVisual";

const assurances = [
  { icon: Stethoscope, text: "For doctors and Friends" },
  { icon: ShieldCheck, text: "Private and moderated" },
  { icon: UsersRound, text: "Join and enter straight away" },
];

export default function Hero() {
  const root = useRef(null);
  const { isAuthenticated } = useAuth();

  // GSAP: scroll-linked parallax between the artwork layers and the drawn
  // heartbeat line. Skipped entirely when the visitor prefers reduced motion.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.utils.toArray("[data-parallax]").forEach((layer) => {
          gsap.to(layer, {
            y: () => Number(layer.dataset.parallax) * 2.2,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        });
        gsap.fromTo(
          "[data-pulse]",
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            duration: 2.4,
            ease: "power2.inOut",
            delay: 0.7,
            repeat: -1,
            repeatDelay: 2.6,
          },
        );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={root}
      className="relative overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Soft backdrop: one restrained wash, not a full-bleed gradient. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(60rem 26rem at 12% -10%, color-mix(in srgb, var(--brand) 13%, transparent), transparent 70%), radial-gradient(44rem 22rem at 92% 0%, color-mix(in srgb, var(--leaf) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="container-page relative grid items-center gap-12 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-24 lg:pt-16">
        <div className="max-w-xl">
          <p
            className="rise-in inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-bold tracking-wide text-fg-soft shadow-soft"
            style={{ "--delay": "0ms" }}
          >
            <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
            A private community for medical Friends
          </p>

          <h1
            id="hero-title"
            className="rise-in mt-5 font-display text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-fg sm:text-[3.4rem]"
            style={{ "--delay": "70ms" }}
          >
            Together in Medicine.{" "}
            <span className="text-gradient-brand">
              Connected Beyond Medicine.
            </span>
          </h1>

          <p
            className="rise-in mt-5 text-lg leading-relaxed text-fg-soft"
            style={{ "--delay": "140ms" }}
          >
            MKCGSPANDAN brings doctors back to the people they trained with — to
            reconnect with Friends, celebrate each other&apos;s professional
            journeys, preserve shared memories and organise reunions that are
            worth travelling for.
          </p>

          <div
            className="rise-in mt-8 flex flex-wrap gap-3"
            style={{ "--delay": "210ms" }}
          >
            {isAuthenticated ? (
              <Button href="/dashboard" size="lg" icon={LayoutDashboard}>
                Go to your dashboard
              </Button>
            ) : (
              <Button href="/register" size="lg" iconRight={ArrowRight}>
                Join the Community
              </Button>
            )}
            <Button href="/doctors" variant="secondary" size="lg">
              Explore Friends
            </Button>
          </div>

          {/* Android app: a link only once its address is configured (site.androidApkUrl). */}
          <div
            className="rise-in mt-3 flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{ "--delay": "245ms" }}
          >
            {site.androidApkUrl ? (
              <a
                href={site.androidApkUrl}
                rel="noopener"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
              >
                <Download className="h-4 w-4 text-leaf" aria-hidden="true" />
                Download App
                <span className="text-xs font-medium text-muted">Android</span>
              </a>
            ) : (
              <Button variant="secondary" size="sm" icon={Download} disabled className="h-10">
                Download App 
              </Button>
            )}
          </div>

          <ul
            className="rise-in mt-8 flex flex-wrap gap-x-6 gap-y-2.5"
            style={{ "--delay": "280ms" }}
          >
            {assurances.map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-2 text-sm font-medium text-fg-soft"
              >
                <item.icon className="h-4 w-4 text-leaf" aria-hidden="true" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-3 pb-6 sm:px-8 lg:px-6">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
