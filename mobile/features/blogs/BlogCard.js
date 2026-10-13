import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { formatDate } from '@/utils/format';

export function BlogCover({ blog, style }) {
  const { colors } = useTheme();
  if (blog.cover) {
    return <Image source={{ uri: blog.cover.thumbUrl || blog.cover.url }} style={style} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />;
  }
  // No cover uploaded: a quiet brand panel instead of a stock picture.
  return (
    <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[style, styles.noCover]}>
      <Ionicons name="book-outline" size={26} color="rgba(255,255,255,0.75)" />
    </LinearGradient>
  );
}

const published = (blog) => formatDate(blog.publishedAt || blog.createdAt);

// Horizontal card for "Recent blogs" on Home.
export function BlogTile({ blog, width = 264 }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card padded={false} onPress={() => router.push(`/blogs/${blog.slug}`)} style={[styles.tile, { width }]} accessibilityLabel={`Read ${blog.title}`}>
      <BlogCover blog={blog} style={styles.tileCover} />
      <View style={styles.body}>
        <Text variant="eyebrow" tone="leaf" numberOfLines={1}>
          {blog.category}
        </Text>
        <Text variant="h3" numberOfLines={2}>
          {blog.title}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {blog.excerpt}
        </Text>
        <View style={styles.byline}>
          <Avatar uri={blog.author.photoUrl} name={blog.author.name} size={22} />
          <Text variant="caption" tone="soft" numberOfLines={1} style={styles.flex}>
            {blog.author.name} · {published(blog)}
          </Text>
        </View>
        <Text variant="smallStrong" color={colors.brandInk}>
          Read more ›
        </Text>
      </View>
    </Card>
  );
}

// Full-width card for blog lists.
export function BlogRow({ blog }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card padded={false} onPress={() => router.push(`/blogs/${blog.slug}`)} style={styles.tile} accessibilityLabel={`Read ${blog.title}`}>
      <BlogCover blog={blog} style={styles.rowCover} />
      <View style={styles.body}>
        <Text variant="eyebrow" tone="leaf" numberOfLines={1}>
          {blog.category} · {blog.readingMinutes} min read
        </Text>
        <Text variant="h3" numberOfLines={2}>
          {blog.title}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {blog.excerpt}
        </Text>
        <View style={styles.byline}>
          <Avatar uri={blog.author.photoUrl} name={blog.author.name} size={22} />
          <Text variant="caption" tone="soft" numberOfLines={1} style={styles.flex}>
            {blog.author.name} · {published(blog)}
          </Text>
          <Ionicons name="heart-outline" size={13} color={colors.muted} />
          <Text variant="caption" tone="muted">
            {blog.likeCount}
          </Text>
          <Ionicons name="chatbubble-outline" size={12} color={colors.muted} />
          <Text variant="caption" tone="muted">
            {blog.commentCount}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  tile: { overflow: 'hidden' },
  tileCover: { width: '100%', height: 132, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  rowCover: { width: '100%', height: 150, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  body: { padding: 14, gap: 5 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
});
