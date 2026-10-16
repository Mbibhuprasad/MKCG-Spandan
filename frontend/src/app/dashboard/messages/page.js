import { Suspense } from 'react';
import MessagesView from '@/components/chat/MessagesView';
import { PageLoader } from '@/components/ui/Feedback';

export const metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MessagesView />
    </Suspense>
  );
}
