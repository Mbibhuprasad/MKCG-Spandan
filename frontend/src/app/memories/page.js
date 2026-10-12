import { Suspense } from 'react';
import { MemberGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/ui/Layout';
import { PageLoader } from '@/components/ui/Feedback';
import MemoriesGallery from '@/components/memories/MemoriesGallery';

// Memories are private to members: this page is not indexed, and nothing is
// requested from the API until the visitor is signed in.
export const metadata = {
  title: 'Memories',
  description: 'Photos and videos shared privately among MKCGSPANDAN members.',
  alternates: { canonical: '/memories' },
  robots: { index: false, follow: false },
};

export default function MemoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Memories"
        title="The moments that made us a batch"
        description="Photos and videos from college days, reunions and celebrations — shared by members, for members."
      />
      <MemberGate
        title="Memories are shared privately"
        description="Photos and videos on MKCGSPANDAN are visible only to signed-in members. Log in or join the community to relive them."
      >
        <Suspense fallback={<PageLoader label="Loading memories…" />}>
          <MemoriesGallery />
        </Suspense>
      </MemberGate>
    </>
  );
}
