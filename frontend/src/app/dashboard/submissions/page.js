import { Suspense } from 'react';
import Submissions from '@/components/dashboard/Submissions';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = { title: 'My submissions' };

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Submissions />
    </Suspense>
  );
}
