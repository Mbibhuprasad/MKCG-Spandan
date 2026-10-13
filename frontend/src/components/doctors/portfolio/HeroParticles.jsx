'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/format';

// Blues that read on the light ground and on the dark theme alike.
const BLUE = '#2563eb';
const AZURE = '#3b82f6';
const SKY = '#38bdf8';
const PALE = '#93c5fd';

// Where each particle sits, in percent of the hero. Fixed values, so rendering
// never depends on a random number. `depth` 1 is the nearer layer (it moves
// further with the pointer); `wide` particles are left out on small screens.
const PARTICLES = [
  { x: 5, y: 22, size: 6, color: BLUE, alpha: 0.9, depth: 0 },
  { x: 14, y: 70, size: 8, color: AZURE, alpha: 0.75, depth: 1 },
  { x: 22, y: 12, size: 5, color: PALE, alpha: 0.7, depth: 0, wide: true },
  { x: 31, y: 86, size: 6, color: SKY, alpha: 0.7, depth: 0 },
  { x: 38, y: 30, size: 7, color: BLUE, alpha: 0.65, depth: 1, wide: true },
  { x: 46, y: 62, size: 5, color: PALE, alpha: 0.75, depth: 0 },
  { x: 52, y: 14, size: 7, color: AZURE, alpha: 0.8, depth: 1 },
  { x: 58, y: 80, size: 6, color: BLUE, alpha: 0.7, depth: 0, wide: true },
  { x: 64, y: 40, size: 5, color: SKY, alpha: 0.75, depth: 1, wide: true },
  { x: 70, y: 9, size: 6, color: PALE, alpha: 0.65, depth: 0 },
  { x: 76, y: 68, size: 8, color: AZURE, alpha: 0.7, depth: 1 },
  { x: 82, y: 24, size: 5, color: BLUE, alpha: 0.85, depth: 0, wide: true },
  { x: 88, y: 84, size: 7, color: SKY, alpha: 0.65, depth: 1 },
  { x: 93, y: 46, size: 6, color: PALE, alpha: 0.7, depth: 0 },
  { x: 97, y: 14, size: 5, color: AZURE, alpha: 0.8, depth: 1, wide: true },
  { x: 9, y: 48, size: 5, color: SKY, alpha: 0.65, depth: 1, wide: true },
];
const LAYERS = [0, 1];

/**
 * A few softly glowing blue particles behind the hero's content. Framer Motion fades
 * each one in; GSAP then lets it drift and dim slowly, and on a desktop pointer
 * shifts the two layers slightly for depth. The layer ignores the pointer, is
 * hidden from assistive technology, pauses while the hero is off screen and
 * stays still for visitors who prefer reduced motion.
 */
export default function HeroParticles() {
  const root = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      let observer;
      const ctx = gsap.context(() => {
        // One timeline for every particle, so it can be paused as a whole.
        const drift = gsap.timeline();
        gsap.utils.toArray('[data-particle]').forEach((dot) => {
          drift.to(
            dot,
            {
              x: gsap.utils.random(-44, 44),
              y: gsap.utils.random(-52, 52),
              opacity: Number(dot.dataset.alpha) * 0.45,
              duration: gsap.utils.random(6, 11),
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
            },
            0
          );
        });
        observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? drift.play() : drift.pause()));
        observer.observe(el);
      }, el);
      return () => {
        if (observer) observer.disconnect();
        ctx.revert();
      };
    });

    // Parallax: only with a mouse on a large screen.
    mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 1024px)', () => {
      const host = el.parentElement;
      if (!host) return undefined;
      let movers = [];
      const ctx = gsap.context(() => {
        movers = gsap.utils.toArray('[data-layer]').map((layer) => ({
          reach: layer.dataset.layer === '1' ? 26 : 12,
          x: gsap.quickTo(layer, 'x', { duration: 1.4, ease: 'power3.out' }),
          y: gsap.quickTo(layer, 'y', { duration: 1.4, ease: 'power3.out' }),
        }));
      }, el);
      const onMove = (event) => {
        const box = host.getBoundingClientRect();
        const dx = (event.clientX - box.left) / box.width - 0.5;
        const dy = (event.clientY - box.top) / box.height - 0.5;
        movers.forEach((mover) => {
          mover.x(-dx * mover.reach);
          mover.y(-dy * mover.reach);
        });
      };
      host.addEventListener('pointermove', onMove, { passive: true });
      return () => {
        host.removeEventListener('pointermove', onMove);
        ctx.revert();
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {LAYERS.map((depth) => (
        <div key={depth} data-layer={depth} className="absolute inset-0">
          {PARTICLES.filter((particle) => particle.depth === depth).map((particle, index) => {
            const dot = (
              <span
                data-particle
                data-alpha={particle.alpha}
                className="block rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  opacity: particle.alpha,
                  boxShadow: `0 0 ${particle.size * 3}px ${particle.size / 2}px ${particle.color}66`,
                }}
              />
            );
            const className = cn('absolute', particle.wide && 'hidden sm:block');
            const style = { left: `${particle.x}%`, top: `${particle.y}%` };
            const key = `${particle.x}-${particle.y}`;
            return reduce ? (
              <span key={key} className={className} style={style}>
                {dot}
              </span>
            ) : (
              <motion.span
                key={key}
                className={className}
                style={style}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.4, delay: 0.35 + index * 0.12, ease: 'easeOut' }}
              >
                {dot}
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
