import { MemberGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/ui/Layout';
import EventsBrowser from '@/components/events/EventsBrowser';

// Event details are for members only: not indexed, and nothing is requested
// from the API until the visitor is signed in.
export const metadata = {
  title: 'Events & reunions',
  description: 'Reunions, get-togethers and visit plans organised by MKCGSPANDAN members.',
  alternates: { canonical: '/events' },
  robots: { index: false, follow: false },
};

export default function EventsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Events"
        title="Reunions, get-togethers and visit plans"
        description="See what the batch is planning, RSVP, and let friends know when you are travelling to their city."
      />
      <MemberGate
        title="Events are for members"
        description="Reunion plans, venues and attendee lists are visible only to signed-in members. Log in or join the community to take part."
      >
        <EventsBrowser />
      </MemberGate>
    </>
  );
}
