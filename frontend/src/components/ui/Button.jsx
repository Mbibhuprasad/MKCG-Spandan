import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/format';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 select-none ' +
  'disabled:opacity-55 disabled:pointer-events-none whitespace-nowrap';

const VARIANTS = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-strong shadow-soft',
  leaf: 'bg-leaf text-leaf-fg hover:bg-leaf-strong shadow-soft',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-2',
  outline: 'border border-brand text-brand-ink hover:bg-brand-soft',
  ghost: 'text-fg-soft hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-danger-fg hover:opacity-90',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

/**
 * Button or link with one consistent look.
 *  - pass `href` to render a Next.js <Link>
 *  - pass `loading` to show a spinner and block repeated submits
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = 'button',
  ...rest
}) {
  const classes = cn(BASE, VARIANTS[variant] || VARIANTS.primary, SIZES[size] || SIZES.md, className);
  const content = (
    <>
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
