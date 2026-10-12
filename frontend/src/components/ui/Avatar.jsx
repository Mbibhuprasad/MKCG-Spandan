import { cn, initials } from '@/lib/format';

const SIZES = {
  xs: 'h-7 w-7 text-[0.65rem]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  '2xl': 'h-32 w-32 text-3xl',
};

/** Profile photo, or the doctor's initials when no photo has been uploaded. */
export default function Avatar({ name = '', src, size = 'md', className }) {
  const base = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-bold text-brand-ink ring-1 ring-line',
    SIZES[size] || SIZES.md,
    className
  );
  if (src) {
    return (
      <span className={base}>
        <img src={src} alt={name ? `Photo of ${name}` : ''} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <span className={base} aria-hidden={name ? undefined : true} role={name ? 'img' : undefined} aria-label={name || undefined}>
      {initials(name)}
    </span>
  );
}
