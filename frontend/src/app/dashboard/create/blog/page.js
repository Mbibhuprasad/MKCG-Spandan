import { Suspense } from 'react';
import { PageLoader } from '@/components/ui/Feedback';
import BlogForm from '@/components/community/BlogForm';

export const metadata = { title: 'Write a blog' };

export default function CreateBlogPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BlogForm />
    </Suspense>
  );
}
