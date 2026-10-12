import { MemberGate } from '@/components/auth/Guards';
import EventDetail from '@/components/events/EventDetail';

// Deliberately static metadata: event details are member-only, so nothing about
// the event is fetched on the server or placed in public HTML.
export const metadata = {
  title: 'Event',
  robots: { index: false, follow: false },
};

export default function EventPage() {
  return (
    <MemberGate
      title="Event details are for members"
      description="Log in or join MKCGSPANDAN to see this event, RSVP and join the discussion."
    >
      <EventDetail />
    </MemberGate>
  );
}
