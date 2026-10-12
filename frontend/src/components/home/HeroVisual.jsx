'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { CalendarHeart, HeartPulse, Images, UsersRound } from 'lucide-react';
import { site } from '@/lib/site';

/* One stylised doctor: white coat, scrubs and stethoscope. Purely illustrative —
   no real person, name or statistic is depicted. */
function Doctor({ x, y, scale = 1, skin, hair, scrubs, longHair = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {longHair && <path d="M34 62c-4 26 0 44 8 52h36c8-8 12-26 8-52z" fill={hair} />}
      <path d="M8 172c0-52 20-76 52-76s52 24 52 76z" fill="#ffffff" stroke="#b7c4d8" strokeWidth="1.6" />
      <path d="M45 98l15 28 15-28z" fill={scrubs} />
      <path d="M45 98l10 44M75 98l-10 44" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="52" y="80" width="16" height="20" rx="6" fill={skin} />
      <circle cx="60" cy="62" r="24" fill={skin} />
      <path d="M36 62c-2-22 10-32 24-32s26 10 24 32c-5-11-13-16-24-16s-19 5-24 16z" fill={hair} />
      <path d="M47 101c-5 22 3 37 13 37s18-15 13-37" stroke="#334155" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="141" r="4.5" fill="#334155" />
      <circle cx="60" cy="141" r="1.8" fill="#94a3b8" />
    </g>
  );
}

function Scene() {
  return (
    <svg viewBox="0 0 480 330" className="h-full w-full" role="img" aria-labelledby="hero-art-title">
      <title id="hero-art-title">
        Illustration of five doctors standing together as batchmates, linked by lines that show them staying connected
      </title>
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.20" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--leaf)" />
        </linearGradient>
      </defs>

      <ellipse cx="240" cy="170" rx="230" ry="150" fill="url(#hero-glow)" />

      {/* Connections reaching beyond the group */}
      <g fill="none" stroke="url(#hero-arc)" strokeWidth="1.6" strokeDasharray="3 7" strokeLinecap="round" opacity="0.75">
        <path d="M70 120C120 40 200 26 240 60" />
        <path d="M410 120C360 40 280 26 240 60" />
        <path d="M40 210C20 150 40 110 70 120" />
        <path d="M440 210C460 150 440 110 410 120" />
      </g>
      <g>
        {[
          [240, 60, 7],
          [70, 120, 5],
          [410, 120, 5],
          [40, 210, 4],
          [440, 210, 4],
        ].map(([cx, cy, r]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={r + 5} fill="var(--leaf)" opacity="0.16" />
            <circle cx={cx} cy={cy} r={r} fill="var(--leaf)" />
          </g>
        ))}
      </g>

      {/* The batch, back row first */}
      <Doctor x={52} y={150} scale={0.92} skin="#c98d62" hair="#2b2118" scrubs="#14864f" />
      <Doctor x={318} y={150} scale={0.92} skin="#e2b48c" hair="#3a2a1d" scrubs="#14398a" longHair />
      <Doctor x={118} y={132} skin="#e8c19e" hair="#1f2937" scrubs="#14398a" longHair />
      <Doctor x={246} y={132} skin="#b97a50" hair="#111827" scrubs="#14864f" />
      <Doctor x={176} y={112} scale={1.1} skin="#d9a577" hair="#4b5563" scrubs="#1f57c8" />

      <rect x="0" y="318" width="480" height="12" fill="var(--bg)" />
    </svg>
  );
}

function FloatingCard({ className, depth, parallax, delay, children }) {
  return (
    <div className={`absolute ${className}`} style={{ transform: `translateZ(${depth}px)` }}>
      <div className="rise-in" style={{ '--delay': `${delay}ms` }}>
        <div data-parallax={parallax}>
          <div className="glass float-slow rounded-2xl px-3.5 py-3 shadow-lift" style={{ '--delay': `${delay * 3}ms` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hero artwork with depth. Three animation responsibilities are kept on
 * separate elements so they never fight over the same transform:
 *   • CSS  — entrance (.rise-in) and the gentle idle float
 *   • GSAP — scroll parallax on [data-parallax] layers (driven by Hero.jsx)
 *   • Framer Motion — pointer tilt on the outer stage only
 */
export default function HeroVisual() {
  const reduce = useReducedMotion();
  const stage = useRef(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 18 });

  useEffect(() => {
    const el = stage.current;
    if (!el || reduce) return undefined;
    // Tilt only for precise pointers; touch devices keep a still image.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      px.set((event.clientX - rect.left) / rect.width - 0.5);
      py.set((event.clientY - rect.top) / rect.height - 0.5);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [px, py, reduce]);

  // A real photograph can replace the illustration via site.heroImage.
  if (site.heroImage) {
    return (
      <div className="rise-in overflow-hidden rounded-[2rem] border border-line shadow-lift" style={{ '--delay': '120ms' }}>
        <img
          src={site.heroImage}
          alt="Doctors from the batch together at a reunion"
          className="aspect-[5/4] w-full object-cover"
          fetchPriority="high"
        />
      </div>
    );
  }

  return (
    <div ref={stage} className="relative mx-auto w-full max-w-[34rem]" style={{ perspective: 1100 }}>
      <motion.div
        className="relative aspect-[5/4] w-full"
        style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY, transformStyle: 'preserve-3d' }}
      >
        {/* Base plate */}
        <div className="absolute inset-0" style={{ transform: 'translateZ(0px)' }}>
          <div className="rise-in h-full" style={{ '--delay': '80ms' }}>
            <div
              data-parallax="6"
              className="relative h-full overflow-hidden rounded-[2rem] border border-line bg-gradient-to-b from-surface-2 to-surface shadow-lift"
            >
              <div
                className="absolute inset-0 opacity-60"
                aria-hidden="true"
                style={{
                  backgroundImage: 'radial-gradient(var(--line-strong) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                  maskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
                  WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 top-[6%]">
                <Scene />
              </div>
            </div>
          </div>
        </div>

        <FloatingCard className="-left-2 top-[9%] sm:-left-6" depth={60} parallax="-14" delay={260}>
          <p className="flex items-center gap-2 text-xs font-bold text-fg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-fg">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
            </span>
            Batchmates, reconnected
          </p>
        </FloatingCard>

        <FloatingCard className="-right-2 top-[30%] sm:-right-7" depth={85} parallax="-22" delay={380}>
          <p className="flex items-center gap-2 text-xs font-bold text-fg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-leaf text-leaf-fg">
              <Images className="h-4 w-4" aria-hidden="true" />
            </span>
            Memories, kept private
          </p>
        </FloatingCard>

        <FloatingCard className="-left-1 bottom-[20%] sm:-left-8" depth={95} parallax="-30" delay={480}>
          <p className="flex items-center gap-2 text-xs font-bold text-fg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <CalendarHeart className="h-4 w-4" aria-hidden="true" />
            </span>
            Reunions, planned together
          </p>
        </FloatingCard>

        {/* Spandan = heartbeat: the line is drawn by GSAP (see Hero.jsx) */}
        <div className="absolute inset-x-[9%] -bottom-5" style={{ transform: 'translateZ(70px)' }}>
          <div className="rise-in" style={{ '--delay': '560ms' }}>
            <div data-parallax="-10" className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lift">
              <HeartPulse className="h-5 w-5 shrink-0 text-leaf" aria-hidden="true" />
              <svg viewBox="0 0 240 36" className="h-8 flex-1" fill="none" aria-hidden="true" preserveAspectRatio="none">
                <path
                  data-pulse
                  pathLength="1"
                  d="M0 20h46l8-12 10 24 9-30 9 26 7-8h38l8-10 9 20 8-16 7 6h71"
                  stroke="var(--leaf)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1"
                  strokeDashoffset="0"
                />
              </svg>
              <span className="shrink-0 text-[0.7rem] font-bold uppercase tracking-widest text-muted">Spandan</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
