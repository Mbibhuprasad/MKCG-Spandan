import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/Feedback';
import MemoryForm from '@/components/memories/MemoryForm';

export const metadata = { title: 'Share a memory' };

export default function CreateMemoryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MemoryForm />
    </Suspense>
  );
}
