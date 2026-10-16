'use client';

import { ArrowRight, Frame } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';

/** Entry point to the Batch Profile Poster Maker, shown on the profile page (doctors only). */
export default function PosterEntryCard() {
  const { user } = useAuth();
  if (!user || user.role !== 'DOCTOR') return null;
  return (
    <section
      aria-labelledby="poster-entry-title"
      className="card mb-6 flex flex-col gap-4 bg-gradient-to-r from-brand-soft to-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg">
          <Frame className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="poster-entry-title" className="text-base font-bold text-fg">
            Batch profile poster
          </h2>
          <p className="mt-0.5 text-sm text-fg-soft">
            Turn your profile and a personal message into a poster for your Friends — private to you until you download it.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button href="/dashboard/posters" variant="secondary" size="sm">
          My posters
        </Button>
        <Button href="/dashboard/posters/new" size="sm" iconRight={ArrowRight}>
          Create My Batch Poster
        </Button>
      </div>
    </section>
  );
}
