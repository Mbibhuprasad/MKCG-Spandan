import LogoImage from '@/components/layout/LogoImage';
import { Spinner } from '@/components/ui/Feedback';

// Shown while a page is being prepared: the logo above the usual spinner.
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted">
      <LogoImage size={64} className="motion-safe:animate-pulse" />
      <Spinner className="h-6 w-6" label="Loading…" />
    </div>
  );
}
