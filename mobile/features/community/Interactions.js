import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActionSheet,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Input,
  ListFooter,
  LoadingState,
  Sheet,
  Text,
} from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { usePagedList } from "@/hooks/usePagedList";
import { messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT_SLOP, space } from "@/theme/tokens";
import { REPORT_REASONS } from "@/utils/constants";
import { timeAgo } from "@/utils/format";
import { commentsApi, likesApi, reportsApi } from "./api";

// Heart with a count. The change shows at once and is rolled back if the API
// refuses it. Both API calls are idempotent, so a repeated tap is harmless.
export function LikeButton({
  targetType,
  targetId,
  liked,
  count,
  onChange,
  size = 20,
  compact = false,
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const toggle = async () => {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    scale.set(
      withSequence(
        withSpring(1.3, { damping: 8, stiffness: 400 }),
        withSpring(1),
      ),
    );
    onChange({ liked: next, likeCount: Math.max(0, count + (next ? 1 : -1)) });
    try {
      const { data } = await (next
        ? likesApi.like(targetType, targetId)
        : likesApi.unlike(targetType, targetId));
      onChange({ liked: data.liked, likeCount: data.likeCount });
    } catch (error) {
      onChange({ liked, likeCount: count });
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={HIT_SLOP}
      style={styles.action}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={`${liked ? "Unlike" : "Like"}, ${count} ${count === 1 ? "like" : "likes"}`}
    >
      <Animated.View style={animated}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={size}
          color={liked ? colors.danger : colors.muted}
        />
      </Animated.View>
      <Text variant="smallStrong" tone={liked ? "danger" : "muted"}>
        {compact ? String(count) : `${count} ${count === 1 ? "like" : "likes"}`}
      </Text>
    </Pressable>
  );
}

export function CommentCount({ count, onPress, compact = false }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={`${count} comments`}
    >
      <Ionicons name="chatbubble-outline" size={18} color={colors.muted} />
      <Text variant="smallStrong" tone="muted">
        {compact
          ? String(count)
          : `${count} ${count === 1 ? "comment" : "comments"}`}
      </Text>
    </Pressable>
  );
}

// The ⋯ menu on a piece of content: delete for its owner, report for everyone else.
// targetType: post | blog | memory | event | comment | poll
export function ContentMenu({
  targetType,
  targetId,
  isMine,
  onDelete,
  label = "item",
  color,
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      `Delete this ${label}?`,
      "It will be removed for everyone. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  const submitReport = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      const { data } = await reportsApi.create(
        targetType,
        targetId,
        reason,
        details.trim(),
      );
      toast.success(
        data.alreadyReported
          ? "You have already reported this."
          : "Thank you. The administrators will take a look.",
      );
      setReporting(false);
      setReason("");
      setDetails("");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const actions = isMine
    ? onDelete
      ? [
          {
            key: "delete",
            label: `Delete ${label}`,
            icon: "trash-outline",
            danger: true,
            onPress: confirmDelete,
          },
        ]
      : []
    : [
        {
          key: "report",
          label: `Report ${label}`,
          icon: "flag-outline",
          onPress: () => setReporting(true),
        },
      ];
  if (!actions.length) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`More options for this ${label}`}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={20}
          color={color || colors.muted}
        />
      </Pressable>
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        actions={actions}
      />
      <Sheet
        visible={reporting}
        onClose={() => setReporting(false)}
        title={`Report this ${label}`}
      >
        <View style={styles.report}>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              style={styles.reason}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === r.value }}
            >
              <Ionicons
                name={
                  reason === r.value ? "radio-button-on" : "radio-button-off"
                }
                size={20}
                color={reason === r.value ? colors.brand : colors.muted}
              />
              <Text style={styles.flex}>{r.label}</Text>
            </Pressable>
          ))}
          <Input
            value={details}
            onChangeText={setDetails}
            placeholder="Anything the administrators should know (optional)"
            multiline
            rows={2}
            maxLength={1000}
            style={styles.details}
          />
          <Button
            title="Send report"
            onPress={submitReport}
            loading={busy}
            disabled={!reason}
            full
          />
        </View>
      </Sheet>
    </>
  );
}

// Comment thread for a post, blog, memory or event, newest first, with a box
// to add one. A new comment is visible immediately — there is no approval step.
export function Comments({ targetType, targetId, onCountChange }) {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const list = usePagedList(
    (page) => commentsApi.list(targetType, targetId, { page, limit: 10 }),
    [targetType, targetId],
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const { data } = await commentsApi.create(targetType, targetId, body);
      list.setItems((items) => [data, ...items]);
      setDraft("");
      if (onCountChange) onCountChange(1);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (comment) => {
    try {
      await commentsApi.remove(comment.id);
      list.removeItem(comment.id);
      if (onCountChange) onCountChange(-1);
    } catch (error) {
      toast.error(messageOf(error));
    }
  };

  return (
    <View style={styles.comments}>
      <Text variant="h3">Comments</Text>
      <View style={styles.composer}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment…"
          multiline
          rows={1}
          maxLength={2000}
          style={styles.composerInput}
          accessibilityLabel="Write a comment"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || busy}
          style={[
            styles.send,
            { backgroundColor: draft.trim() ? colors.brand : colors.surface2 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={draft.trim() ? colors.brandFg : colors.muted}
          />
        </Pressable>
      </View>

      {list.status === "loading" ? (
        <LoadingState compact label="Loading comments…" />
      ) : null}
      {list.status === "error" ? (
        <ErrorState compact error={list.error} onRetry={list.reload} />
      ) : null}
      {list.status === "ready" && !list.items.length ? (
        <EmptyState
          compact
          icon="chatbubbles-outline"
          title="No comments yet"
          message="Be the first to say something."
        />
      ) : null}
      {list.items.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <Pressable
            onPress={() =>
              comment.author.id && router.push(`/doctors/${comment.author.id}`)
            }
            accessibilityRole="button"
            accessibilityLabel={`${comment.author.name}'s profile`}
          >
            <Avatar
              uri={comment.author.photoUrl}
              name={comment.author.name}
              size={34}
            />
          </Pressable>
          <View style={[styles.bubble, { backgroundColor: colors.surface2 }]}>
            <View style={styles.commentHead}>
              <Text variant="smallStrong" style={styles.flex} numberOfLines={1}>
                {comment.author.name}
              </Text>
              <Text variant="caption" tone="muted">
                {timeAgo(comment.createdAt)}
              </Text>
              <ContentMenu
                targetType="comment"
                targetId={comment.id}
                isMine={comment.isMine}
                onDelete={() => remove(comment)}
                label="comment"
              />
            </View>
            <Text variant="small" tone="soft">
              {comment.body}
            </Text>
          </View>
        </View>
      ))}
      {list.hasMore ? (
        <Button
          title="Show more comments"
          variant="ghost"
          size="sm"
          onPress={list.loadMore}
          loading={list.loadingMore}
          style={styles.more}
        />
      ) : null}
      <ListFooter error={list.moreError} onRetry={list.loadMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  report: { paddingHorizontal: space.xl, gap: 4 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  details: { marginTop: 8 },
  comments: { gap: 12, marginTop: space.xl },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerInput: { flex: 1, marginBottom: 0 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  comment: { flexDirection: "row", gap: 10 },
  bubble: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
  },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  more: { alignSelf: "center" },
});
