import { Compass } from 'lucide-react';
import Button from '@/components/ui/Button';

export const metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-fg">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-fg-soft">
        It may have been moved or removed, or it may only be visible to signed-in members.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button href="/">Back to home</Button>
        <Button href="/login" variant="secondary">
          Log in
        </Button>
      </div>
    </div>
  );
}
