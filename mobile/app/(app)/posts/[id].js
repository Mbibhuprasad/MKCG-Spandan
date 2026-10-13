import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorState, LoadingState, Screen, StackHeader } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { Comments } from '@/features/community/Interactions';
import { PostCard } from '@/features/community/PostCard';
import { postsApi } from '@/features/community/api';
import { useResource } from '@/hooks/useResource';
import { messageOf } from '@/services/api';
import { invalidate } from '@/utils/events';

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const res = useResource(() => postsApi.get(String(id)), [id]);
  const post = res.data;

  const remove = async () => {
    try {
      await postsApi.remove(post.id);
      invalidate('posts');
      toast.success('Post deleted.');
      router.back();
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  const header = <StackHeader title="Post" />;
  if (res.status !== 'ready') {
    return (
      <Screen header={header}>{res.status === 'loading' ? <LoadingState label="Loading post…" /> : <ErrorState error={res.error} onRetry={res.reload} />}</Screen>
    );
  }

  return (
    <Screen header={header} scroll keyboard refreshing={res.refreshing} onRefresh={res.refresh}>
      <PostCard post={post} detail onChange={(patch) => res.setData((p) => ({ ...p, ...patch }))} onDelete={remove} />
      <Comments
        targetType="post"
        targetId={post.id}
        onCountChange={(delta) => {
          res.setData((p) => ({ ...p, commentCount: Math.max(0, p.commentCount + delta) }));
          invalidate('posts');
        }}
      />
    </Screen>
  );
}
