'use client';

import { useEffect, useRef, useState } from 'react';
import { site } from '@/lib/site';

/**
 * The logo artwork: the file named by `site.logo.image`, or the built-in mark
 * when that file is missing or cannot be shown — the header never carries a
 * broken image. The logo keeps its own proportions at the header's 36px height.
 */
export default function LogoImage() {
  const ref = useRef(null);
  const [failed, setFailed] = useState(!site.logo.image);

  // An image that failed before React attached its handlers never reports the error.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return <img src={site.logo.mark} alt={site.logo.alt} width={36} height={36} className="h-9 w-9 shrink-0 rounded-[0.7rem]" />;
  }
  return (
    <img
      ref={ref}
      src={site.logo.image}
      alt={site.logo.alt}
      width={site.logo.width}
      height={site.logo.height}
      onError={() => setFailed(true)}
      // text-transparent: no flash of the alt text if the file turns out to be missing
      className="h-9 w-auto max-w-[9rem] shrink-0 object-contain text-transparent"
    />
  );
}
