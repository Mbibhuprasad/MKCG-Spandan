import { useRouter } from 'expo-router';
import { BlogForm } from '@/features/blogs/BlogForm';

export default function CreateBlog() {
  const router = useRouter();
  return <BlogForm onDone={(blog) => router.replace(`/blogs/${blog.slug}`)} />;
}
