import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MediaCarousel } from '@/components/MediaGallery';
import { ErrorState, LoadingState, Screen, StackHeader, Text } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { Comments, ContentMenu, LikeButton } from '@/features/community/Interactions';
import { AuthorLine } from '@/features/community/PostCard';
import { memoriesApi } from '@/features/memories/api';
import { useResource } from '@/hooks/useResource';
import { messageOf } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { invalidate } from '@/utils/events';
import { formatDate } from '@/utils/format';

export default function MemoryDetail() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const res = useResource(() => memoriesApi.get(String(id)), [id]);
  const memory = res.data;

  const remove = async () => {
    try {
      await memoriesApi.remove(memory.id);
      invalidate('memories');
      toast.success(memory.showInCommunity ? 'Memory deleted.' : 'Removed from your gallery.');
      router.back();
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  const header = (
    <StackHeader
      title={memory && !memory.showInCommunity ? 'Gallery' : 'Memory'}
      right={memory ? <ContentMenu targetType="memory" targetId={memory.id} isMine={memory.isMine} onDelete={remove} label="memory" /> : null}
    />
  );

  if (res.status !== 'ready') {
    return (
      <Screen header={header}>{res.status === 'loading' ? <LoadingState label="Loading memory…" /> : <ErrorState error={res.error} onRetry={res.reload} />}</Screen>
    );
  }

  return (
    <Screen header={header} scroll padded={false} keyboard refreshing={res.refreshing} onRefresh={res.refresh}>
      <MediaCarousel media={memory.media} height={360} />
      <View style={styles.body}>
        <AuthorLine author={memory.owner} date={memory.publishedAt || memory.createdAt} />
        <Text variant="h1" accessibilityRole="header">
          {memory.title}
        </Text>
        {memory.caption ? (
          <Text tone="soft" selectable>
            {memory.caption}
          </Text>
        ) : null}
        <View style={styles.facts}>
          {memory.memoryDate ? (
            <View style={styles.fact}>
              <Ionicons name="calendar-outline" size={15} color={colors.muted} />
              <Text variant="small" tone="muted">
                {formatDate(memory.memoryDate)}
              </Text>
            </View>
          ) : null}
          {memory.event ? (
            <View style={styles.fact}>
              <Ionicons name="flag-outline" size={15} color={colors.brandInk} />
              <Text variant="smallStrong" tone="brand" onPress={() => router.push(`/events/${memory.event.id}`)} accessibilityRole="link">
                {memory.event.title}
              </Text>
            </View>
          ) : null}
          {!memory.showInCommunity ? (
            <View style={styles.fact}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
              <Text variant="small" tone="muted">
                Profile gallery
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.actions, { borderTopColor: colors.line, borderBottomColor: colors.line }]}>
          <LikeButton
            targetType="memory"
            targetId={memory.id}
            liked={memory.likedByMe}
            count={memory.likeCount}
            onChange={({ liked, likeCount }) => res.setData((m) => ({ ...m, likedByMe: liked, likeCount }))}
          />
          <Text variant="smallStrong" tone="muted">
            {memory.commentCount} {memory.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </View>
        <Comments targetType="memory" targetId={memory.id} onCountChange={(delta) => res.setData((m) => ({ ...m, commentCount: Math.max(0, m.commentCount + delta) }))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 12 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
});
