'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/format';
import { site } from '@/lib/site';

/**
 * The official logo (`site.logo.image`) on a white rounded tile — the artwork
 * itself is on white, so the tile keeps it legible in the dark theme. It keeps
 * its own proportions (object-contain, never stretched or cropped). Next.js
 * serves a resized copy of the file. If the file is missing, nothing is drawn,
 * so the header never shows a broken image; the wordmark beside it remains.
 */
export default function LogoImage({ size = 36, className }) {
  const [failed, setFailed] = useState(!site.logo.image);
  if (failed) return null;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 ring-1 ring-line', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={site.logo.image}
        alt={site.logo.alt}
        width={size * 2}
        height={Math.round((size * 2 * site.logo.height) / site.logo.width)}
        sizes={`${size}px`}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
