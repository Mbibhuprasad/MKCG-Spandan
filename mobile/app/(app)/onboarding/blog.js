import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { BlogForm } from '@/features/blogs/BlogForm';

// Step C — write a blog (optional). Finishing or skipping it ends onboarding.
export default function OnboardingBlog() {
  const router = useRouter();
  const { finishOnboarding } = useAuth();
  const finish = async () => {
    await finishOnboarding();
    router.replace('/');
  };
  return (
    <BlogForm
      step={3}
      steps={3}
      title="Write a blog"
      subtitle="Share an experience, an idea or a story with the community. It is published as soon as you save it."
      onDone={finish}
      onSkip={finish}
    />
  );
}
