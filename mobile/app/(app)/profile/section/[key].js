import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, Screen, StackHeader } from '@/components/ui';
import { SectionEditor } from '@/features/profile/SectionEditor';
import { sectionByKey } from '@/features/profile/sections';

export default function ProfileSection() {
  const { key } = useLocalSearchParams();
  const router = useRouter();
  const section = sectionByKey(String(key));
  if (!section) {
    return (
      <Screen header={<StackHeader title="Profile" />}>
        <EmptyState icon="help-circle-outline" title="Section not found" actionLabel="Back to profile" onAction={() => router.replace('/profile/edit')} />
      </Screen>
    );
  }
  return <SectionEditor section={section} onSaved={() => (router.canGoBack() ? router.back() : router.replace('/profile/edit'))} />;
}
