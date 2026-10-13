import { useLocalSearchParams, useRouter } from 'expo-router';
import { MemoryForm } from '@/features/memories/MemoryForm';

// /create/memory shares a community memory; /create/memory?gallery=1 adds a
// photo to the Gallery on the member's own profile instead.
export default function CreateMemory() {
  const router = useRouter();
  const { gallery } = useLocalSearchParams();
  return <MemoryForm gallery={gallery === '1'} onDone={(memory) => router.replace(`/memories/${memory.id}`)} />;
}
