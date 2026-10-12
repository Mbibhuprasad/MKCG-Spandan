import Link from 'next/link';
import { site } from '@/lib/site';
import { cn } from '@/lib/format';

/**
 * The only place the logo is rendered. The artwork is a replaceable file
 * (see `site.logo` in src/lib/site.js), not markup baked into components.
 */
export default function Logo({ className, nameClassName, showName = true, href = '/' }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2.5', className)} aria-label={`${site.name} home`}>
      <img src={site.logo.mark} alt="" width={36} height={36} className="h-9 w-9 rounded-[0.7rem]" />
      {showName && (
        <span className={cn('text-[1.05rem] font-extrabold tracking-[0.04em] text-fg', nameClassName)}>
          MKCG<span className="text-leaf">SPANDAN</span>
        </span>
      )}
    </Link>
  );
}
