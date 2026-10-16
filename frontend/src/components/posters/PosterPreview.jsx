'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/format';
import { POSTER_HEIGHT, POSTER_WIDTH } from './model';
import PosterCanvas from './PosterCanvas';

/**
 * The full-size poster scaled down to the available width. Scaling is a CSS
 * transform only, so the poster is laid out (and fitted) exactly as exported.
 */
export default function PosterPreview({ data, onFit, className, label }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = width / POSTER_WIDTH;
  return (
    <div ref={wrap} className={cn('w-full', className)}>
      <div
        className="relative overflow-hidden rounded-xl bg-surface-2 shadow-lift ring-1 ring-line"
        style={{ height: Math.round(POSTER_HEIGHT * scale) || undefined, aspectRatio: width ? undefined : `${POSTER_WIDTH} / ${POSTER_HEIGHT}` }}
      >
        <div
          style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          className="absolute left-0 top-0"
        >
          <PosterCanvas data={data} onFit={onFit} label={label} />
        </div>
      </div>
    </div>
  );
}
