import Link from 'next/link';
import { site } from '@/lib/site';
import { cn } from '@/lib/format';
import LogoImage from './LogoImage';

/**
 * The only place the logo is rendered. The artwork is a replaceable file
 * (see `site.logo` in src/lib/site.js), not markup baked into components.
 */
// The header row has no spare width, so it keeps the 36px logo; the footer passes a larger one.
export default function Logo({ className, nameClassName, showName = true, href = '/', logoSize = 36 }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5', className)} aria-label={`${site.name} home`}>
      <LogoImage size={logoSize} />
      {showName && (
        <span className={cn('text-[1.05rem] font-extrabold tracking-[0.04em] text-fg', nameClassName)}>
          MKCG<span className="text-leaf">SPANDAN</span>
        </span>
      )}
    </Link>
  );
}
