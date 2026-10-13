import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Avatar,
  Banner,
  EmptyState,
  ErrorState,
  IconButton,
  KeyboardView,
  LoadingState,
  Screen,
  StackHeader,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  RESYNC_TOPIC,
  useChat,
  useConversationMessages,
} from "@/features/chat/ChatContext";
import { chatApi } from "@/features/chat/api";
import { ConnectionBanner } from "@/features/chat/components";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space, type } from "@/theme/tokens";
import { subscribe } from "@/utils/events";
import {
  dayLabel,
  formatTime,
  isSameDay,
  joinParts,
  newClientId,
} from "@/utils/format";
import { openWhatsApp } from "@/utils/phone";

const PAGE = 30;
const MAX_LENGTH = 4000; // MESSAGE_MAX_LENGTH on the API

// Adds messages to a newest-first list without ever showing one twice: a
// message is matched by its server id, or by the clientId this phone gave it.
function merge(current, incoming) {
  let list = current;
  for (const message of incoming) {
    const at = list.findIndex(
      (m) =>
        m.id === message.id ||
        (message.clientId && m.clientId === message.clientId),
    );
    if (at === -1) list = [message, ...list];
    else if (list[at].status || list[at].id !== message.id)
      list = list.map((m, i) => (i === at ? message : m));
  }
  return list === current
    ? current
    : [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function Bubble({ message, mine, group, showName, showAvatar, onRetry }) {
  const { colors } = useTheme();
  const failed = message.status === "failed";
  const sending = message.status === "sending";
  return (
    <View style={[styles.messageRow, mine ? styles.rowMine : styles.rowTheirs]}>
      {group && !mine ? (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            <Avatar
              uri={message.sender.photoUrl}
              name={message.sender.name}
              size={30}
            />
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPress={failed ? onRetry : undefined}
        disabled={!failed}
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 6 }
            : {
                backgroundColor: colors.bubbleTheirs,
                borderBottomLeftRadius: 6,
              },
          failed && { backgroundColor: colors.dangerSoft },
          sending && styles.sending,
        ]}
        accessibilityLabel={`${mine ? "You" : message.sender.name}: ${message.body}. ${failed ? "Not sent. Tap to retry." : formatTime(message.createdAt)}`}
      >
        {group && !mine && showName ? (
          <Text
            variant="caption"
            tone="leaf"
            style={styles.sender}
            numberOfLines={1}
          >
            {message.sender.name}
          </Text>
        ) : null}
        <Text
          color={
            failed
              ? colors.danger
              : mine
                ? colors.bubbleMineFg
                : colors.bubbleTheirsFg
          }
          selectable
        >
          {message.body}
        </Text>
        <View style={styles.meta}>
          {failed ? (
            <>
              <Ionicons name="alert-circle" size={12} color={colors.danger} />
              <Text variant="caption" color={colors.danger}>
                {message.error || "Not sent"} · Tap to retry
              </Text>
            </>
          ) : (
            <>
              <Text
                variant="caption"
                color={mine ? "rgba(255,255,255,0.72)" : colors.muted}
                style={styles.time}
              >
                {sending ? "Sending…" : formatTime(message.createdAt)}
              </Text>
              {mine && !sending ? (
                <Ionicons
                  name="checkmark"
                  size={12}
                  color="rgba(255,255,255,0.72)"
                />
              ) : null}
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

export default function Conversation() {
  const { id } = useLocalSearchParams();
  const conversationId = String(id);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const {
    conversations,
    connection,
    sendMessage,
    markRead,
    setActiveConversation,
    upsertConversation,
  } = useChat();

  const listed = conversations.find((c) => c.id === conversationId);
  const [fetched, setFetched] = useState(null);
  const conversation = listed || fetched;

  const [messages, setMessages] = useState([]); // newest first (the list is inverted)
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(null);
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState(null); // a server rule that stops sending (e.g. WHATSAPP_REQUIRED)
  const cursor = useRef(null);
  const focused = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // History comes from the server, which checks that this doctor is a member
  // of the conversation; an id that is not theirs simply answers "not found".
  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const [page, details] = await Promise.all([
        chatApi.messages(conversationId, { limit: PAGE }),
        listed ? null : chatApi.conversation(conversationId),
      ]);
      if (!mounted.current) return;
      if (details) {
        setFetched(details.data);
        upsertConversation(details.data);
      }
      setMessages([...page.data].reverse());
      setHasMore(Boolean(page.meta && page.meta.hasMore));
      cursor.current = page.meta ? page.meta.nextBefore : null;
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      setError(err);
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || !cursor.current || status !== "ready")
      return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await chatApi.messages(conversationId, {
        before: cursor.current,
        limit: PAGE,
      });
      if (!mounted.current) return;
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        return [
          ...current,
          ...[...page.data].reverse().filter((m) => !known.has(m.id)),
        ];
      });
      setHasMore(Boolean(page.meta && page.meta.hasMore));
      cursor.current = page.meta ? page.meta.nextBefore : null;
    } catch (err) {
      if (mounted.current) setOlderError(err);
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  };

  // Live messages for this conversation.
  useConversationMessages(conversationId, (message) => {
    setMessages((current) => merge(current, [message]));
    if (focused.current && message.sender && message.sender.id !== user.id)
      markRead(conversationId);
  });

  // After a reconnect, fetch the newest page again: anything sent while the
  // connection was down is merged in, and nothing is duplicated.
  useEffect(
    () =>
      subscribe(RESYNC_TOPIC, async () => {
        try {
          const page = await chatApi.messages(conversationId, { limit: PAGE });
          if (mounted.current)
            setMessages((current) => merge(current, page.data));
        } catch {
          // the banner already says the connection is down
        }
      }),
    [conversationId],
  );

  // While this screen is open its messages count as read and raise no alert.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setActiveConversation(conversationId);
      markRead(conversationId);
      return () => {
        focused.current = false;
        setActiveConversation(null);
      };
    }, [conversationId, markRead, setActiveConversation]),
  );

  const deliver = async (local) => {
    try {
      const saved = await sendMessage(
        conversationId,
        local.body,
        local.clientId,
      );
      if (mounted.current) setMessages((current) => merge(current, [saved]));
    } catch (err) {
      if (!mounted.current) return;
      if (err.code === "WHATSAPP_REQUIRED" || err.code === "PEER_UNAVAILABLE")
        setBlocked(err);
      if (err.code === "RATE_LIMITED") toast.error(err.message);
      setMessages((current) =>
        current.map((m) =>
          m.clientId === local.clientId && m.status
            ? {
                ...m,
                status: "failed",
                error: err.isNetwork
                  ? "No connection"
                  : err.code === "RATE_LIMITED"
                    ? "Too fast"
                    : "Not sent",
              }
            : m,
        ),
      );
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const clientId = newClientId();
    const local = {
      id: `local:${clientId}`,
      clientId,
      conversationId,
      body,
      createdAt: new Date().toISOString(),
      status: "sending",
      sender: {
        id: user.id,
        name: user.name,
        photoUrl: user.profile.photoUrl,
        isAdmin: user.role === "ADMIN",
      },
    };
    setMessages((current) => [local, ...current]);
    setDraft("");
    deliver(local);
  };

  // A failed message is sent again with the SAME clientId, so if the first
  // attempt did reach the server it is recognised and not stored twice.
  const retry = (message) => {
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id ? { ...m, status: "sending", error: undefined } : m,
      ),
    );
    deliver(message);
  };

  const group = conversation ? conversation.type === "GROUP" : false;
  const peer = conversation ? conversation.peer : null;
  const canSend = conversation ? conversation.canSend : true;

  const header = useMemo(() => {
    if (!conversation) return <StackHeader title="Conversation" />;
    const subtitle = group
      ? conversation.memberCount
        ? `${conversation.memberCount} ${conversation.memberCount === 1 ? "member" : "members"}`
        : conversation.description
      : joinParts([peer && peer.specialization, peer && peer.city]);
    const openProfile = () =>
      !group &&
      peer &&
      peer.id &&
      !peer.isAdmin &&
      router.push(`/doctors/${peer.id}`);
    return (
      <StackHeader
        right={
          !group && peer && peer.whatsapp ? (
            <IconButton
              name="logo-whatsapp"
              color={colors.leaf}
              onPress={async () => {
                if (!(await openWhatsApp(peer.whatsapp)))
                  toast.error("WhatsApp could not be opened on this phone.");
              }}
              accessibilityLabel={`Open WhatsApp chat with ${conversation.name}`}
            />
          ) : null
        }
      >
        <Pressable
          onPress={openProfile}
          style={styles.headerPeer}
          accessibilityRole={group ? undefined : "button"}
          accessibilityLabel={
            group ? conversation.name : `Profile of ${conversation.name}`
          }
        >
          <Avatar
            uri={conversation.avatarUrl}
            name={conversation.name}
            size={38}
            icon={group ? "people" : undefined}
          />
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={1}>
              {conversation.name}
            </Text>
            {subtitle ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </StackHeader>
    );
  }, [conversation, group, peer, colors.leaf, router, toast]);

  const renderItem = ({ item, index }) => {
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const mine = item.sender && item.sender.id === user.id;
    const firstOfDay = !older || !isSameDay(older.createdAt, item.createdAt);
    const sameAsOlder =
      older &&
      !firstOfDay &&
      older.sender &&
      item.sender &&
      older.sender.id === item.sender.id;
    const sameAsNewer =
      newer &&
      isSameDay(newer.createdAt, item.createdAt) &&
      newer.sender &&
      item.sender &&
      newer.sender.id === item.sender.id;
    const bubble = (
      <Bubble
        message={item}
        mine={mine}
        group={group}
        showName={!sameAsOlder}
        showAvatar={!sameAsNewer}
        onRetry={() => retry(item)}
      />
    );
    return (
      <View style={{ marginTop: sameAsOlder ? 3 : 10 }}>
        {firstOfDay ? (
          <View style={styles.day}>
            <View
              style={[styles.dayPill, { backgroundColor: colors.surface2 }]}
            >
              <Text variant="caption" tone="muted">
                {dayLabel(item.createdAt)}
              </Text>
            </View>
          </View>
        ) : null}
        {item.fresh || item.status ? (
          <Animated.View entering={FadeIn.duration(160)}>
            {bubble}
          </Animated.View>
        ) : (
          bubble
        )}
      </View>
    );
  };

  return (
    <Screen header={header} padded={false} bottomInset={false}>
      <ConnectionBanner connection={connection} />
      <KeyboardView>
        {status === "loading" ? (
          <LoadingState label="Loading messages…" style={styles.flex} />
        ) : status === "error" ? (
          <ErrorState error={error} onRetry={load} style={styles.flex} />
        ) : !messages.length ? (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No messages yet"
            message={
              group
                ? "Say hello to the community."
                : "Start the conversation. Only the two of you can read it."
            }
            style={styles.flex}
          />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              loadingOlder ? (
                <ActivityIndicator color={colors.brand} style={styles.older} />
              ) : olderError ? (
                <Text
                  variant="caption"
                  tone="danger"
                  center
                  style={styles.older}
                  onPress={loadOlder}
                  accessibilityRole="button"
                >
                  Older messages could not be loaded. Tap to retry.
                </Text>
              ) : !hasMore ? (
                <Text
                  variant="caption"
                  tone="muted"
                  center
                  style={styles.older}
                >
                  {group
                    ? "This is the start of the group conversation."
                    : "This is the start of your conversation."}
                </Text>
              ) : null
            }
          />
        )}

        {blocked ? (
          <Banner
            tone="warn"
            message={blocked.message}
            actionLabel={
              blocked.code === "WHATSAPP_REQUIRED"
                ? "Add WhatsApp number"
                : undefined
            }
            onAction={() => router.push("/profile/section/practice")}
            style={styles.blocked}
          />
        ) : null}

        {canSend ? (
          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.line,
                backgroundColor: colors.bg,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.surface2, borderColor: colors.line },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={colors.muted}
                selectionColor={colors.brand}
                cursorColor={colors.brand}
                multiline
                maxLength={MAX_LENGTH}
                style={[styles.input, { color: colors.fg }]}
                accessibilityLabel="Type a message"
              />
            </View>
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              style={[
                styles.send,
                {
                  backgroundColor: draft.trim()
                    ? colors.brand
                    : colors.surface2,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons
                name="send"
                size={19}
                color={draft.trim() ? colors.brandFg : colors.muted}
              />
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.closed,
              {
                borderTopColor: colors.line,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Text variant="small" tone="muted" center>
              This member is no longer available, so new messages cannot be
              sent.
            </Text>
          </View>
        )}
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPeer: { flexDirection: "row", alignItems: "center", gap: 10 },
  list: { paddingHorizontal: space.md, paddingVertical: 10 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatarSlot: { width: 30 },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.xl,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sending: { opacity: 0.7 },
  sender: { fontWeight: "700", marginBottom: 2 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  time: { fontSize: 10.5 },
  day: { alignItems: "center", marginBottom: 10 },
  dayPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  older: { paddingVertical: 14 },
  blocked: { marginHorizontal: space.md, marginBottom: 8 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: space.md,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  inputBox: {
    flex: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    minHeight: 44,
    maxHeight: 130,
    justifyContent: "center",
  },
  input: { ...type.body, paddingVertical: 9 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  closed: {
    paddingHorizontal: space.xl,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
});
