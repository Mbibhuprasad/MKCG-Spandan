import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/Feedback';
import PollForm from '@/components/community/PollForm';

export const metadata = { title: 'Start a poll' };

export default function CreatePollPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PollForm />
    </Suspense>
  );
}
