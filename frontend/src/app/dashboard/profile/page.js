import ProfileWizard from '@/components/dashboard/profile-wizard/ProfileWizard';
import PosterEntryCard from '@/components/posters/PosterEntryCard';

export const metadata = { title: 'My profile' };

export default function ProfilePage() {
  return (
    <>
      <PosterEntryCard />
      <ProfileWizard />
    </>
  );
}
