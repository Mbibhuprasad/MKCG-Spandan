'use client';

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { POSTER_HEIGHT, POSTER_WIDTH, defaultPalette } from './model';
import { posterFontClasses } from './fonts';
import { fitPoster } from './fit';
import { derive } from './templates/shared';
import ClassicTribute from './templates/ClassicTribute';
import SilverJubilee from './templates/SilverJubilee';
import ModernProfessional from './templates/ModernProfessional';
import CollegeMemories from './templates/CollegeMemories';
import FriendsForever from './templates/FriendsForever';
import MedicalBlue from './templates/MedicalBlue';
import styles from './poster.module.css';

const TEMPLATE_COMPONENTS = {
  'classic-tribute': ClassicTribute,
  'silver-jubilee': SilverJubilee,
  'modern-professional': ModernProfessional,
  'college-memories': CollegeMemories,
  'friends-forever': FriendsForever,
  'medical-blue': MedicalBlue,
};

/**
 * The poster itself, at full size (1240 × 1754 CSS px), drawn from the form
 * data. The same component is used for the live preview, the template
 * thumbnails and the export, so the preview is exactly what is downloaded.
 *
 *   onFit(result) — called after every layout with the fitting result (fit.js)
 *   ref           — { node, fit() } for the exporter
 */
export default function PosterCanvas({ data, onFit, ref, label = 'Poster preview' }) {
  const root = useRef(null);
  const onFitRef = useRef(onFit);
  useEffect(() => {
    onFitRef.current = onFit;
  });

  const derived = useMemo(() => derive(data), [data]);
  const Template = TEMPLATE_COMPONENTS[data.template] || ClassicTribute;
  const palette = data.settings.palette || defaultPalette(data.template);

  const refit = useCallback(() => {
    const result = fitPoster(root.current);
    if (result && onFitRef.current) onFitRef.current(result);
    return result;
  }, []);

  // Fit synchronously after each render, before the browser paints.
  useLayoutEffect(() => {
    refit();
  }, [derived, Template, palette, data.settings.portraitPlacement, refit]);

  // Fonts arriving later change the metrics; so does becoming visible after
  // being laid out at zero size (a collapsed preview on small screens).
  useEffect(() => {
    const el = root.current;
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    let cancelled = false;
    const rerun = () => {
      if (!cancelled) refit();
    };
    if (fonts) {
      fonts.ready.then(rerun);
      fonts.addEventListener('loadingdone', rerun);
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(rerun) : null;
    if (observer && el) observer.observe(el);
    return () => {
      cancelled = true;
      if (fonts) fonts.removeEventListener('loadingdone', rerun);
      if (observer) observer.disconnect();
    };
  }, [refit]);

  useImperativeHandle(ref, () => ({ node: root.current, fit: refit }), [refit]);

  return (
    <div
      ref={root}
      role="img"
      aria-label={label}
      className={`${styles.poster} ${posterFontClasses}`}
      style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}
    >
      <Template d={derived} palette={palette} placement={data.settings.portraitPlacement} />
    </div>
  );
}
