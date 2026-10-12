import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/format';

const ITEM =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-fg ' +
  'hover:bg-surface-2 aria-disabled:pointer-events-none aria-disabled:opacity-45 disabled:pointer-events-none disabled:opacity-45';

/**
 * Previous / next pagination.
 *  - client lists: pass `onPageChange(page)`
 *  - server-rendered lists (SEO): pass `hrefFor(page)` to render real links
 */
export default function Pagination({ page, totalPages, onPageChange, hrefFor, className }) {
  if (!totalPages || totalPages <= 1) return null;
  const prev = page - 1;
  const next = page + 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const control = (target, enabled, label, content) =>
    hrefFor ? (
      <Link
        href={enabled ? hrefFor(target) : '#'}
        aria-disabled={!enabled}
        tabIndex={enabled ? undefined : -1}
        aria-label={label}
        className={ITEM}
        scroll
      >
        {content}
      </Link>
    ) : (
      <button type="button" disabled={!enabled} onClick={() => onPageChange(target)} aria-label={label} className={ITEM}>
        {content}
      </button>
    );

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-3', className)}>
      {control(
        prev,
        hasPrev,
        'Previous page',
        <>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </>
      )}
      <span className="text-sm text-muted" aria-current="page">
        Page <strong className="text-fg">{page}</strong> of {totalPages}
      </span>
      {control(
        next,
        hasNext,
        'Next page',
        <>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </>
      )}
    </nav>
  );
}
