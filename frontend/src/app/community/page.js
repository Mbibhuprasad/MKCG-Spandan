import { Suspense } from 'react';
import { MemberGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/ui/Layout';
import { PageLoader } from '@/components/ui/Feedback';
import CommunityView from '@/components/community/CommunityView';

// Member-only content: nothing here is rendered on the server or indexed.
export const metadata = {
  title: 'Community',
  description: 'The private MKCGSPANDAN feed: updates, achievements, reunion news and polls shared between members.',
  alternates: { canonical: '/community' },
  robots: { index: false, follow: false },
};

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Community"
        title="What the batch is sharing"
        description="Updates, achievements and reunion news from fellow doctors — and polls to help everyone decide together."
      />
      <MemberGate
        title="The community feed is for members"
        description="Posts and polls are shared privately between doctors in the community. Sign in or join to take part."
      >
        <Suspense fallback={<PageLoader />}>
          <CommunityView />
        </Suspense>
      </MemberGate>
    </>
  );
}
