import { useRouter } from 'expo-router';
import { PostForm } from '@/features/community/PostForm';

export default function CreatePost() {
  const router = useRouter();
  return <PostForm onDone={(post) => router.replace(`/posts/${post.id}`)} />;
}
