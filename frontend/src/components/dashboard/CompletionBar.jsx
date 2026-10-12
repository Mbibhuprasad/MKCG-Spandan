import { cn } from '@/lib/format';

/** Profile completion as an accessible progress bar. `percent` comes from the API. */
export default function CompletionBar({ percent = 0, label = 'Profile completion', className }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
        <span className="text-fg-soft">{label}</span>
        <span className={value >= 70 ? 'text-leaf-strong' : 'text-fg'}>{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', value >= 70 ? 'bg-leaf' : 'bg-brand')}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
