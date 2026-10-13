import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MediaGrid } from "@/components/MediaGallery";
import { Avatar, Card, Text } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { POST_TYPES } from "@/utils/constants";
import { joinParts, timeAgo } from "@/utils/format";
import { CommentCount, ContentMenu, LikeButton } from "./Interactions";

const typeOf = (value) =>
  POST_TYPES.find((t) => t.value === value) || POST_TYPES[0];

// Who posted, with a link to their profile. Shared by posts, memories and events.
export function AuthorLine({ author, date, extra, right }) {
  const router = useRouter();
  const open = () =>
    author.id && !author.isAdmin && router.push(`/doctors/${author.id}`);
  return (
    <View style={styles.author}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Profile of ${author.name}`}
      >
        <Avatar uri={author.photoUrl} name={author.name} size={42} />
      </Pressable>
      <Pressable onPress={open} style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {author.name}
          {author.isAdmin ? (
            <Text variant="caption" tone="leaf">
              {"  ·  Admin"}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {joinParts([
            author.specialization || author.professionalTitle,
            date ? timeAgo(date) : "",
            extra,
          ])}
        </Text>
      </Pressable>
      {right}
    </View>
  );
}

// A community post. `onChange(patch)` receives like/comment count updates and
// `onDelete()` is offered to the author only (the API enforces ownership).
export function PostCard({ post, onChange, onDelete, detail = false }) {
  const { colors } = useTheme();
  const router = useRouter();
  const type = typeOf(post.type);
  const open = () => !detail && router.push(`/posts/${post.id}`);

  return (
    <Card style={styles.card}>
      <AuthorLine
        author={post.author}
        date={post.publishedAt || post.createdAt}
        right={
          <ContentMenu
            targetType="post"
            targetId={post.id}
            isMine={post.isMine}
            onDelete={onDelete}
            label="post"
          />
        }
      />
      {post.type !== "GENERAL" ? (
        <View style={[styles.type, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name={type.icon} size={12} color={colors.brandInk} />
          <Text variant="caption" tone="brand">
            {type.label}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={open}
        disabled={detail}
        accessibilityRole={detail ? undefined : "button"}
        accessibilityLabel={detail ? undefined : "Open post"}
      >
        <Text
          tone="soft"
          numberOfLines={detail ? undefined : 6}
          selectable={detail}
        >
          {post.body}
        </Text>
      </Pressable>
      <MediaGrid media={post.media} />
      <View style={[styles.actions, { borderTopColor: colors.line }]}>
        <LikeButton
          targetType="post"
          targetId={post.id}
          liked={post.likedByMe}
          count={post.likeCount}
          onChange={({ liked, likeCount }) =>
            onChange({ likedByMe: liked, likeCount })
          }
        />
        <CommentCount count={post.commentCount} onPress={open} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 12 },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  type: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 22,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
});
