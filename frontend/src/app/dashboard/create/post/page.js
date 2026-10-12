import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/Feedback';
import PostForm from '@/components/community/PostForm';

export const metadata = { title: 'Create a post' };

export default function CreatePostPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PostForm />
    </Suspense>
  );
}
