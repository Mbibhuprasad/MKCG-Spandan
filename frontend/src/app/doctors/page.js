import { Suspense } from 'react';
import { MemberGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/ui/Layout';
import { PageLoader } from '@/components/ui/Feedback';
import DoctorsDirectory from '@/components/doctors/DoctorsDirectory';

// The directory is member-only: nothing about members is rendered on the
// server, and search engines are asked not to index this URL.
export const metadata = {
  title: 'Doctors',
  description: 'The MKCGSPANDAN member directory — find batchmates by name, specialization and city.',
  alternates: { canonical: '/doctors' },
  robots: { index: false, follow: false },
};

export default function DoctorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Member directory"
        title="Doctors"
        description="Find batchmates by name, specialization or city, and see where their journeys in medicine have taken them."
      />
      <MemberGate
        title="The doctor directory is for members"
        description="Profiles are shared only among signed-in members of MKCGSPANDAN. Join or log in to find your batchmates."
      >
        <Suspense fallback={<PageLoader />}>
          <DoctorsDirectory />
        </Suspense>
      </MemberGate>
    </>
  );
}
