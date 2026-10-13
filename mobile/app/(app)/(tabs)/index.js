import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppHeader, SectionHeader } from "@/components/AppHeader";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { PulsingLogo } from "@/components/Logo";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  SkeletonCard,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { BlogTile } from "@/features/blogs/BlogCard";
import { blogsApi } from "@/features/blogs/api";
import { PostCard } from "@/features/community/PostCard";
import { postsApi } from "@/features/community/api";
import { DoctorTile } from "@/features/doctors/DoctorCard";
import { doctorsApi } from "@/features/doctors/api";
import { EventCard } from "@/features/events/EventCard";
import { eventsApi } from "@/features/events/api";
import { MemoryTile } from "@/features/memories/MemoryCard";
import { memoriesApi } from "@/features/memories/api";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { useResource } from "@/hooks/useResource";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, shadow, space } from "@/theme/tokens";
import { site } from "@/utils/constants";
import { joinParts } from "@/utils/format";

// Section 1 — profile completion, from the percentage the API computes out of
// the saved profile (never a number made up on the phone).
function ProfileCard({ user }) {
  const { colors } = useTheme();
  const router = useRouter();
  const completion = user.profileCompletion;
  const done = completion.percent >= 100;

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[styles.hero, shadow(colors, 2)]}
    >
      <LinearGradient
        colors={colors.gradientHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroFill}
      >
        <View style={styles.heroTop}>
          <Avatar uri={user.profile.photoUrl} name={user.name} size={52} ring />
          <View style={styles.flex}>
            <Text variant="caption" color="rgba(255,255,255,0.8)">
              Welcome back
            </Text>
            <Text variant="h2" color="#ffffff" numberOfLines={1}>
              {user.name}
            </Text>
            {joinParts([user.profile.specialization, user.profile.city]) ? (
              <Text
                variant="caption"
                color="rgba(255,255,255,0.8)"
                numberOfLines={1}
              >
                {joinParts([user.profile.specialization, user.profile.city])}
              </Text>
            ) : null}
          </View>
        </View>

        {done ? (
          <View style={styles.heroDone}>
            <Ionicons name="checkmark-circle" size={18} color="#6fe3ad" />
            <Text
              variant="small"
              color="rgba(255,255,255,0.9)"
              style={styles.flex}
            >
              Your professional profile is complete. Batchmates can find and
              recognise you.
            </Text>
          </View>
        ) : (
          <View style={styles.heroProgress}>
            <View style={styles.heroProgressHead}>
              <Text variant="smallStrong" color="#ffffff" style={styles.flex}>
                Complete your professional profile
              </Text>
              <Text variant="h3" color="#6fe3ad">
                {completion.percent}%
              </Text>
            </View>
            <ProgressBar
              value={completion.percent / 100}
              trackColor="rgba(255,255,255,0.22)"
            />
            {completion.missing.length ? (
              <Text
                variant="caption"
                color="rgba(255,255,255,0.78)"
                numberOfLines={2}
              >
                Still to add: {completion.missing.slice(0, 3).join(", ")}
                {completion.missing.length > 3
                  ? ` and ${completion.missing.length - 3} more`
                  : ""}
              </Text>
            ) : null}
          </View>
        )}
        <Button
          title={done ? "View my profile" : "Continue profile"}
          iconRight="arrow-forward"
          variant="leaf"
          size="sm"
          onPress={() => router.push(done ? "/profile" : "/profile/edit")}
        />
      </LinearGradient>
    </Animated.View>
  );
}

// A Home section backed by one request, with its own loading, error and empty states.
function Section({
  title,
  eyebrow,
  actionLabel,
  onAction,
  resource,
  empty,
  horizontal = true,
  skeleton,
  children,
}) {
  const items = resource.data || [];
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        actionLabel={items.length ? actionLabel : undefined}
        onAction={onAction}
      />
      {resource.status === "loading" ? (
        <View style={[styles.skeletons, !horizontal && styles.column]}>
          {skeleton}
        </View>
      ) : resource.status === "error" ? (
        <Card style={styles.inset} padded={false}>
          <ErrorState
            compact
            error={resource.error}
            onRetry={resource.reload}
          />
        </Card>
      ) : !items.length ? (
        <Card style={styles.inset} padded={false}>
          <EmptyState compact {...empty} />
        </Card>
      ) : horizontal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {children(items)}
        </ScrollView>
      ) : (
        <View style={styles.column}>{children(items)}</View>
      )}
    </View>
  );
}

export default function Home() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { refreshUnread } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  // Real data only. Each list is the API's own (published, permitted) content.
  const doctors = useResource(() => doctorsApi.list({ limit: 10 }), []);
  const blogs = useResource(() => blogsApi.list({ limit: 10 }), [], {
    topics: ["blogs"],
  });
  const memories = useResource(() => memoriesApi.list({ limit: 8 }), [], {
    topics: ["memories"],
  });
  const posts = useResource(() => postsApi.list({ limit: 3 }), [], {
    topics: ["posts"],
  });
  const events = useResource(
    () => eventsApi.list({ scope: "upcoming", limit: 5 }),
    [],
    { topics: ["events"] },
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      doctors.refresh(),
      blogs.refresh(),
      memories.refresh(),
      posts.refresh(),
      events.refresh(),
      refreshUser().catch(() => {}),
      refreshUnread(),
    ]);
    setRefreshing(false);
  }, [doctors, blogs, memories, posts, events, refreshUser, refreshUnread]);

  const others = (doctors.data || []).filter((d) => d.id !== user.id);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppHeader showThemeToggle />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ProfileCard user={user} />

        <Section
          title="Discover friends"
          eyebrow="Your batchmates"
          actionLabel="View all friends"
          onAction={() => router.push("/doctors")}
          resource={{ ...doctors, data: doctors.data ? others : null }}
          empty={{
            icon: "people-outline",
            title: "No other members yet",
            message: "Friends appear here as they join the community.",
          }}
          skeleton={[0, 1, 2].map((i) => (
            <SkeletonCard key={i} width={168} media={false} lines={3} />
          ))}
        >
          {(items) =>
            items.map((doctor) => (
              <DoctorTile key={doctor.id} doctor={doctor} />
            ))
          }
        </Section>

        <Section
          title="Recent blogs"
          eyebrow="From members"
          actionLabel="View all blogs"
          onAction={() =>
            router.push({ pathname: "/library", params: { tab: "blogs" } })
          }
          resource={blogs}
          empty={{
            icon: "book-outline",
            title: "No blogs yet",
            message: "Be the first to write about your work or your journey.",
            actionLabel: "Write a blog",
            onAction: () => router.push("/create/blog"),
          }}
          skeleton={[0, 1].map((i) => (
            <SkeletonCard key={i} width={264} />
          ))}
        >
          {(items) =>
            items.map((blog) => <BlogTile key={blog.id} blog={blog} />)
          }
        </Section>

        <Section
          title="Memories"
          eyebrow="Shared moments"
          actionLabel="View all memories"
          onAction={() =>
            router.push({ pathname: "/library", params: { tab: "memories" } })
          }
          resource={memories}
          empty={{
            icon: "images-outline",
            title: "No memories yet",
            message:
              "Share a photo or video from your college days or a reunion.",
            actionLabel: "Share a memory",
            onAction: () => router.push("/create/memory"),
          }}
          skeleton={[0, 1, 2].map((i) => (
            <SkeletonCard key={i} width={150} lines={1} />
          ))}
        >
          {(items) =>
            items.map((memory) => (
              <MemoryTile
                key={memory.id}
                memory={memory}
                width={156}
                height={200}
              />
            ))
          }
        </Section>

        <Section
          title="Community"
          eyebrow="Latest posts"
          actionLabel="Open community"
          onAction={() => router.push("/community")}
          resource={posts}
          horizontal={false}
          empty={{
            icon: "chatbubbles-outline",
            title: "Nothing posted yet",
            message: "Share an update, an achievement or a reunion plan.",
            actionLabel: "Write a post",
            onAction: () => router.push("/create/post"),
          }}
          skeleton={[0, 1].map((i) => (
            <SkeletonCard key={i} media={false} lines={3} />
          ))}
        >
          {(items) =>
            items.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onChange={(patch) =>
                  posts.setData((list) =>
                    list.map((p) =>
                      p.id === post.id ? { ...p, ...patch } : p,
                    ),
                  )
                }
                onDelete={async () => {
                  await postsApi.remove(post.id).catch(() => {});
                  posts.reloadSilently();
                }}
              />
            ))
          }
        </Section>

        <Section
          title="Upcoming events"
          eyebrow="Reunions and visits"
          actionLabel="View all events"
          onAction={() => router.push("/events")}
          resource={events}
          horizontal={false}
          empty={{
            icon: "calendar-outline",
            title: "No upcoming events",
            message:
              "Plan a reunion, a dinner or a visit and invite the batch.",
            actionLabel: "Create an event",
            onAction: () => router.push("/create/event"),
          }}
          skeleton={[0, 1].map((i) => (
            <SkeletonCard key={i} media={false} lines={2} />
          ))}
        >
          {(items) =>
            items.map((event) => <EventCard key={event.id} event={event} />)
          }
        </Section>

        {/* Section 7 — About */}
        <View style={styles.section}>
          <Card style={[styles.inset, styles.about]}>
            <View style={styles.aboutHead}>
              <PulsingLogo size={44} />
              <View style={styles.flex}>
                <Text variant="eyebrow" tone="leaf">
                  About {site.name}
                </Text>
                <Text variant="h3">{site.tagline}</Text>
              </View>
            </View>
            <Text variant="small" tone="soft">
              MKCGSPANDAN helps doctors reconnect with batchmates, share
              achievements, preserve memories and organise reunions — in a space
              that is private to its members.
            </Text>
            <Button
              title="About the community"
              variant="secondary"
              size="sm"
              iconRight="arrow-forward"
              onPress={() => router.push("/about")}
            />
          </Card>
        </View>

        <DeveloperCredit />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: space.lg, paddingBottom: space.xxxl },
  hero: { marginHorizontal: space.lg, borderRadius: radius.xxl },
  heroFill: { borderRadius: radius.xxl, padding: space.xl, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroProgress: { gap: 8 },
  heroProgressHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroDone: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  section: { marginTop: space.xxl },
  rail: { paddingHorizontal: space.lg, gap: 12, paddingBottom: 6 },
  skeletons: { flexDirection: "row", gap: 12, paddingHorizontal: space.lg },
  column: { flexDirection: "column", paddingHorizontal: space.lg, gap: 12 },
  inset: { marginHorizontal: space.lg },
  about: { gap: 12 },
  aboutHead: { flexDirection: "row", alignItems: "center", gap: 4 },
});
