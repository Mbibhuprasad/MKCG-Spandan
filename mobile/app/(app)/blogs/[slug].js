import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HtmlContent } from "@/components/HtmlContent";
import {
  Avatar,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  Screen,
  StackHeader,
  Text,
} from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { blogsApi } from "@/features/blogs/api";
import {
  Comments,
  ContentMenu,
  LikeButton,
} from "@/features/community/Interactions";
import { useResource } from "@/hooks/useResource";
import { messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { invalidate } from "@/utils/events";
import { formatDate, joinParts } from "@/utils/format";

export default function BlogDetail() {
  const { slug } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const res = useResource(() => blogsApi.bySlug(String(slug)), [slug]);
  const blog = res.data;

  const remove = async () => {
    try {
      await blogsApi.remove(blog.id);
      invalidate("blogs");
      toast.success("Blog deleted.");
      router.back();
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  const header = (
    <StackHeader
      title="Blog"
      right={
        blog ? (
          <ContentMenu
            targetType="blog"
            targetId={blog.id}
            isMine={blog.isMine}
            onDelete={remove}
            label="blog"
          />
        ) : null
      }
    />
  );

  if (res.status !== "ready") {
    return (
      <Screen header={header}>
        {res.status === "loading" ? (
          <LoadingState label="Loading blog…" />
        ) : (
          <ErrorState error={res.error} onRetry={res.reload} />
        )}
      </Screen>
    );
  }

  const author = blog.author;
  return (
    <Screen
      header={header}
      scroll
      padded={false}
      keyboard
      refreshing={res.refreshing}
      onRefresh={res.refresh}
    >
      {blog.cover ? (
        <Image
          source={{ uri: blog.cover.url }}
          placeholder={{ uri: blog.cover.thumbUrl }}
          style={styles.cover}
          contentFit="cover"
          transition={250}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.body}>
        <Text variant="eyebrow" tone="leaf">
          {blog.category} · {blog.readingMinutes} min read
        </Text>
        <Text variant="display" accessibilityRole="header">
          {blog.title}
        </Text>
        <Text tone="muted" style={styles.excerpt}>
          {blog.excerpt}
        </Text>

        <Card
          soft
          onPress={
            author.id && !author.isAdmin
              ? () => router.push(`/doctors/${author.id}`)
              : undefined
          }
          style={styles.author}
          accessibilityLabel={`Profile of ${author.name}`}
        >
          <Avatar uri={author.photoUrl} name={author.name} size={46} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {author.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {joinParts([author.professionalTitle, author.specialization]) ||
                "Member"}
            </Text>
            <Text variant="caption" tone="muted">
              Published {formatDate(blog.publishedAt || blog.createdAt)}
            </Text>
          </View>
          {author.id && !author.isAdmin ? (
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          ) : null}
        </Card>

        <HtmlContent html={blog.bodyHtml} />

        {blog.tags.length ? (
          <View style={styles.tags}>
            {blog.tags.map((tag) => (
              <Chip key={tag} label={`#${tag}`} small />
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.actions,
            { borderTopColor: colors.line, borderBottomColor: colors.line },
          ]}
        >
          <LikeButton
            targetType="blog"
            targetId={blog.id}
            liked={blog.likedByMe}
            count={blog.likeCount}
            onChange={({ liked, likeCount }) =>
              res.setData((b) => ({ ...b, likedByMe: liked, likeCount }))
            }
          />
          <Text variant="smallStrong" tone="muted">
            {blog.commentCount}{" "}
            {blog.commentCount === 1 ? "comment" : "comments"}
          </Text>
        </View>

        <Comments
          targetType="blog"
          targetId={blog.id}
          onCountChange={(delta) =>
            res.setData((b) => ({
              ...b,
              commentCount: Math.max(0, b.commentCount + delta),
            }))
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { width: "100%", aspectRatio: 16 / 9 },
  body: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 10 },
  excerpt: { fontSize: 16, lineHeight: 24 },
  author: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    marginVertical: 8,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    marginTop: 10,
  },
});
