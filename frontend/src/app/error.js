'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';

// Route-level error boundary: a rendering failure shows this instead of a blank page.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center" role="alert">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <TriangleAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="font-display text-3xl font-semibold text-fg">Something went wrong</h1>
      <p className="mt-3 max-w-md text-fg-soft">This page could not be displayed. Please try again.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </div>
  );
}
