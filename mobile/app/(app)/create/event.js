import { useRouter } from 'expo-router';
import { EventForm } from '@/features/events/EventForm';

export default function CreateEvent() {
  const router = useRouter();
  return <EventForm onDone={(event) => router.replace(`/events/${event.id}`)} />;
}
