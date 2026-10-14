import { Suspense } from 'react';
import { MemberGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/ui/Layout';
import { PageLoader } from '@/components/ui/Feedback';
import EventSchedule from '@/components/events/EventSchedule';

// Travel plans are member-only: nothing is rendered on the server or indexed.
export const metadata = {
  title: 'Event Schedule',
  description: 'Who is coming to each MKCGSPANDAN event, where they are travelling from and when they arrive and leave.',
  alternates: { canonical: '/events/schedule' },
  robots: { index: false, follow: false },
};

export default function EventSchedulePage() {
  return (
    <>
      <PageHeader
        eyebrow="Events"
        title="Event Schedule"
        description="Choose an event to see which batchmates are coming, where they are travelling from and when they arrive and leave — and share your own plan."
      />
      <MemberGate
        title="The event schedule is for members"
        description="Travel plans are shared only between signed-in members. Log in or join the community to see who is coming."
      >
        <Suspense fallback={<PageLoader />}>
          <EventSchedule />
        </Suspense>
      </MemberGate>
    </>
  );
}
