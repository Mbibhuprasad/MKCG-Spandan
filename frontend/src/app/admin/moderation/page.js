import { Suspense } from 'react';
import ModerationQueue from '@/components/admin/ModerationQueue';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = { title: 'Community content' };

export default function AdminModerationPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ModerationQueue />
    </Suspense>
  );
}
