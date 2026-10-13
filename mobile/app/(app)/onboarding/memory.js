import { useRouter } from 'expo-router';
import { MemoryForm } from '@/features/memories/MemoryForm';

// Step B — share a memory (optional).
export default function OnboardingMemory() {
  const router = useRouter();
  const next = () => router.push('/onboarding/blog');
  return (
    <MemoryForm
      step={2}
      steps={3}
      title="Share a memory"
      subtitle="A photo or video from college, a reunion or your career. It is visible to members as soon as you share it."
      onDone={next}
      onSkip={next}
    />
  );
}
