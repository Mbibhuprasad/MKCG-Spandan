import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/Feedback';
import EventForm from '@/components/events/EventForm';

export const metadata = { title: 'Propose an event or visit plan' };

export default function CreateEventPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <EventForm />
    </Suspense>
  );
}
