import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Avatar,
  Banner,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  Sheet,
  StackHeader,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  RESYNC_TOPIC,
  useChat,
  useConversationDeletions,
  useConversationMessages,
  useConversationReactions,
} from "@/features/chat/ChatContext";
import { REACTIONS, chatApi } from "@/features/chat/api";
import { ConnectionBanner } from "@/features/chat/components";
import { saveChatImage, shareChatImage } from "@/features/chat/media";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space, type } from "@/theme/tokens";
import { UPLOAD_LIMITS } from "@/utils/constants";
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
const PHOTO_WIDTH = 228;
// A menu opened by a long press appears under the finger that is still down.
// Presses inside it during this window are the end of that same gesture, not a
// choice, so they are ignored (otherwise lifting the finger could pick an
// emoji or close the menu by itself).
const MENU_SETTLE_MS = 350;

// What may have changed in a message the list already shows.
const versionKey = (message) =>
  JSON.stringify([message.reactions || [], Boolean(message.deleted)]);

// The reactions after this doctor sets `emoji` ('' removes theirs): one per person.
function withReaction(reactions = [], userId, emoji) {
  const next = reactions
    .map((group) => ({
      ...group,
      userIds: group.userIds.filter((id) => id !== userId),
    }))
    .filter((group) => group.userIds.length);
  if (!emoji) return next;
  const at = next.findIndex((group) => group.emoji === emoji);
  if (at === -1) return [...next, { emoji, userIds: [userId] }];
  return next.map((group, i) =>
    i === at ? { ...group, userIds: [...group.userIds, userId] } : group,
  );
}

const myReactionOf = (message, userId) => {
  const group = (message.reactions || []).find((g) =>
    g.userIds.includes(userId),
  );
  return group ? group.emoji : "";
};

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
    else if (
      list[at].status ||
      list[at].id !== message.id ||
      versionKey(list[at]) !== versionKey(message)
    )
      list = list.map((m, i) => (i === at ? message : m));
  }
  return list === current
    ? current
    : [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Bubble size for a photo, keeping its proportions within sensible bounds.
function photoSize(image) {
  const ratio =
    image && image.width && image.height ? image.width / image.height : 4 / 3;
  const clamped = Math.min(Math.max(ratio, 0.6), 1.9);
  return { width: PHOTO_WIDTH, height: Math.round(PHOTO_WIDTH / clamped) };
}

function MessagePhoto({ message, onOpen, onLongPress }) {
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = message.image;
  const size = photoSize(image);
  const uploading = message.status === "sending" && message.progress != null;
  return (
    <Pressable
      onPress={message.status ? undefined : onOpen}
      onLongPress={message.status ? undefined : onLongPress}
      delayLongPress={300}
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo. Tap to open, long press for options"
      style={[styles.photo, size, { backgroundColor: colors.surface2 }]}
    >
      {failed ? (
        <View style={styles.photoState}>
          <Ionicons name="image-outline" size={26} color={colors.muted} />
          <Text variant="caption" tone="muted">
            Photo could not be loaded
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: image.previewUrl || image.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={message.id}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      )}
      {!loaded && !failed ? (
        <View style={styles.photoState} pointerEvents="none">
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : null}
      {uploading ? (
        <View style={styles.photoUpload} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text variant="caption" color="#fff" style={styles.photoUploadText}>
            {Math.round((message.progress || 0) * 100)}%
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Bubble({
  message,
  mine,
  group,
  showName,
  showAvatar,
  onRetry,
  myId,
  onMenu,
  onOpenPhoto,
  onToggleReaction,
  onReactionDetails,
}) {
  const { colors } = useTheme();
  const failed = message.status === "failed";
  const sending = message.status === "sending";
  const deleted = Boolean(message.deleted);
  // Only a message the server has stored has a menu.
  const hasMenu = !message.status;
  const reactions = deleted ? [] : message.reactions || [];
  const isPhoto = !deleted && message.type === "IMAGE" && message.image;
  const textColor = failed
    ? colors.danger
    : mine
      ? colors.bubbleMineFg
      : colors.bubbleTheirsFg;
  const metaColor = mine && !failed ? "rgba(255,255,255,0.72)" : colors.muted;
  const label = deleted
    ? "This message was deleted"
    : isPhoto
      ? `Photo${message.body ? `: ${message.body}` : ""}`
      : message.body;
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
      <View
        style={[
          styles.bubbleColumn,
          mine ? styles.alignMine : styles.alignTheirs,
        ]}
      >
        <Pressable
          onPress={failed ? onRetry : undefined}
          onLongPress={hasMenu ? onMenu : undefined}
          delayLongPress={300}
          disabled={!failed && !hasMenu}
          accessibilityHint={hasMenu ? "Long press for message options" : undefined}
          accessibilityActions={
            hasMenu ? [{ name: "longpress", label: "Message options" }] : undefined
          }
          onAccessibilityAction={hasMenu ? onMenu : undefined}
          style={({ pressed }) => [
            styles.bubble,
            isPhoto && styles.photoBubble,
            mine
              ? {
                  backgroundColor: colors.bubbleMine,
                  borderBottomRightRadius: 6,
                }
              : {
                  backgroundColor: colors.bubbleTheirs,
                  borderBottomLeftRadius: 6,
                },
            deleted && {
              backgroundColor: "transparent",
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.line,
            },
            failed && { backgroundColor: colors.dangerSoft },
            sending && styles.sending,
            pressed && hasMenu && styles.pressed,
          ]}
          accessibilityLabel={`${mine ? "You" : message.sender.name}: ${label}. ${failed ? "Not sent. Tap to retry." : formatTime(message.createdAt)}`}
        >
          {group && !mine && showName ? (
            <Text
              variant="caption"
              tone="leaf"
              style={[styles.sender, isPhoto && styles.photoCaptionPad]}
              numberOfLines={1}
            >
              {message.sender.name}
            </Text>
          ) : null}
          {deleted ? (
            <View style={styles.deletedRow}>
              <Ionicons name="ban-outline" size={14} color={colors.muted} />
              <Text variant="small" tone="muted" style={styles.deletedText}>
                This message was deleted
              </Text>
            </View>
          ) : isPhoto ? (
            <MessagePhoto
              message={message}
              onOpen={onOpenPhoto}
              onLongPress={onMenu}
            />
          ) : null}
          {!deleted && message.body ? (
            <Text
              color={textColor}
              style={isPhoto ? [styles.photoCaption, styles.photoCaptionPad] : null}
            >
              {message.body}
            </Text>
          ) : null}
          <View style={[styles.meta, isPhoto && styles.photoCaptionPad]}>
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
                  color={deleted ? colors.muted : metaColor}
                  style={styles.time}
                >
                  {sending ? "Sending…" : formatTime(message.createdAt)}
                </Text>
                {mine && !sending && !deleted ? (
                  <Ionicons name="checkmark" size={12} color={metaColor} />
                ) : null}
              </>
            )}
          </View>
        </Pressable>
        {reactions.length ? (
          <View style={styles.reactions}>
            {reactions.map((reaction) => {
              const own = reaction.userIds.includes(myId);
              const count = reaction.userIds.length;
              return (
                <Pressable
                  key={reaction.emoji}
                  onPress={() => onToggleReaction(reaction.emoji)}
                  onLongPress={() => onReactionDetails(reaction)}
                  hitSlop={4}
                  style={[
                    styles.reaction,
                    {
                      backgroundColor: own ? colors.brandSoft : colors.surface,
                      borderColor: own ? colors.brand : colors.line,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: own }}
                  accessibilityHint="Long press to see who reacted"
                  accessibilityLabel={`${reaction.emoji} ${count}${own ? ", including you. Tap to remove yours" : ". Tap to add yours"}`}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  {count > 1 ? (
                    <Text variant="caption" tone={own ? "brand" : "muted"}>
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Full-screen view of a photo with Save and Share.
function PhotoViewer({ message, onClose, onSave, onShare, busy, notice }) {
  const insets = useSafeAreaInsets();
  const visible = Boolean(message);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {message ? (
        <View style={styles.viewer}>
          <Image
            source={{ uri: message.image.url || message.image.previewUrl }}
            placeholder={{ uri: message.image.previewUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            accessibilityLabel={message.body ? `Photo: ${message.body}` : "Photo"}
          />
          <View style={[styles.viewerTop, { paddingTop: insets.top + 8 }]}>
            <IconButton
              name="close"
              color="#fff"
              tint="glass"
              onPress={onClose}
              accessibilityLabel="Close photo"
            />
          </View>
          <View
            style={[
              styles.viewerBottom,
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            {message.body ? (
              <Text color="#fff" numberOfLines={3} style={styles.viewerCaption}>
                {message.body}
              </Text>
            ) : null}
            {/* Toasts render beneath this full-screen modal, so results are shown here. */}
            {notice ? (
              <View
                style={[
                  styles.viewerNotice,
                  { backgroundColor: notice.tone === "error" ? "rgba(184,38,63,0.92)" : "rgba(22,128,82,0.92)" },
                ]}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                <Ionicons
                  name={notice.tone === "error" ? "alert-circle" : "checkmark-circle"}
                  size={18}
                  color="#fff"
                />
                <Text variant="small" color="#fff" style={styles.flex}>
                  {notice.text}
                </Text>
              </View>
            ) : null}
            <View style={styles.viewerActions}>
              <Pressable
                onPress={onSave}
                disabled={Boolean(busy)}
                style={styles.viewerButton}
                accessibilityRole="button"
                accessibilityLabel="Download image to this phone"
              >
                {busy === "save" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="#fff" />
                )}
                <Text variant="bodyStrong" color="#fff">
                  Download image
                </Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                disabled={Boolean(busy)}
                style={styles.viewerButton}
                accessibilityRole="button"
                accessibilityLabel="Share image"
              >
                {busy === "share" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                )}
                <Text variant="bodyStrong" color="#fff">
                  Share
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function MenuAction({ icon, label, onPress, danger, busy }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.sheetAction,
        pressed && { backgroundColor: colors.surface2 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.fgSoft}
        />
      )}
      <Text variant="bodyStrong" tone={danger ? "danger" : "default"}>
        {label}
      </Text>
    </Pressable>
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
    reactToMessage,
    deleteMessage,
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
  const [photo, setPhoto] = useState(null); // a picked photo waiting to be sent
  const [blocked, setBlocked] = useState(null); // a server rule that stops sending (e.g. WHATSAPP_REQUIRED)
  const [menuFor, setMenuFor] = useState(null); // the message whose options are open
  const [details, setDetails] = useState(null); // { emoji, userIds } of a reaction badge
  const [viewing, setViewing] = useState(null); // the photo message shown full screen
  const [busy, setBusy] = useState(null); // 'save' | 'share' while a download runs
  const [viewerNotice, setViewerNotice] = useState(null); // { tone, text } inside the photo viewer
  const body = useRef(null);
  // Lifts the message box above the keyboard (see hooks/useKeyboardOverlap.js).
  const keyboardOverlap = useKeyboardOverlap(body);
  const cursor = useRef(null);
  const focused = useRef(false);
  const mounted = useRef(true);
  const menuOpenedAt = useRef(0);
  const pendingReactions = useRef(new Set()); // messages with a reaction request in flight

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
    // Starts a request; the loading flag it sets first is part of that request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Reactions added or removed by anyone in this conversation.
  useConversationReactions(conversationId, ({ messageId, reactions }) => {
    setMessages((current) =>
      current.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
    );
  });

  // Messages deleted for everyone (by this phone or another device).
  useConversationDeletions(conversationId, (deleted) => {
    setMessages((current) =>
      current.map((m) => (m.id === deleted.id ? { ...m, ...deleted } : m)),
    );
    setMenuFor((open) => (open && open.id === deleted.id ? null : open));
    setViewing((open) => (open && open.id === deleted.id ? null : open));
  });

  // After a reconnect, fetch the newest page again: anything sent, deleted or
  // reacted to while the connection was down is merged in, and nothing is duplicated.
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

  const patchLocal = (clientId, patch) =>
    setMessages((current) =>
      current.map((m) =>
        m.clientId === clientId && m.status ? { ...m, ...patch } : m,
      ),
    );

  const deliver = async (local) => {
    let mediaId = local.mediaId;
    try {
      // A photo is uploaded first (with progress); a retry after the upload
      // succeeded reuses it instead of uploading again.
      if (local.type === "IMAGE" && !mediaId) {
        const uploaded = await chatApi.uploadImage(conversationId, local.asset, {
          onProgress: (progress) => mounted.current && patchLocal(local.clientId, { progress }),
        });
        mediaId = uploaded.id;
        if (mounted.current) patchLocal(local.clientId, { mediaId });
      }
      const saved = await sendMessage(
        conversationId,
        local.body,
        local.clientId,
        mediaId,
      );
      if (mounted.current) setMessages((current) => merge(current, [saved]));
    } catch (err) {
      if (!mounted.current) return;
      if (err.code === "WHATSAPP_REQUIRED" || err.code === "PEER_UNAVAILABLE")
        setBlocked(err);
      if (
        err.code === "RATE_LIMITED" ||
        err.code === "FILE_TOO_LARGE" ||
        err.code === "UNSUPPORTED_MEDIA_TYPE" ||
        err.code === "MEDIA_NOT_CONFIGURED" ||
        err.code === "UPLOAD_FAILED"
      )
        toast.error(err.message);
      // A photo the server refused can never succeed: upload it again on retry.
      const reupload = err.code === "MEDIA_INVALID";
      patchLocal(local.clientId, {
        status: "failed",
        progress: undefined,
        ...(reupload ? { mediaId: undefined } : null),
        error: err.isNetwork
          ? "No connection"
          : err.code === "RATE_LIMITED"
            ? "Too fast"
            : err.code === "FILE_TOO_LARGE"
              ? "Too large"
              : "Not sent",
      });
    }
  };

  const localMessage = (fields) => {
    const clientId = newClientId();
    return {
      id: `local:${clientId}`,
      clientId,
      conversationId,
      type: "TEXT",
      body: "",
      reactions: [],
      createdAt: new Date().toISOString(),
      status: "sending",
      sender: {
        id: user.id,
        name: user.name,
        photoUrl: user.profile.photoUrl,
        isAdmin: user.role === "ADMIN",
      },
      ...fields,
    };
  };

  const send = () => {
    const text = draft.trim();
    if (!text && !photo) return;
    const local = photo
      ? localMessage({
          type: "IMAGE",
          body: text,
          asset: photo,
          progress: 0,
          image: {
            previewUrl: photo.uri,
            width: photo.width,
            height: photo.height,
          },
        })
      : localMessage({ body: text });
    setMessages((current) => [local, ...current]);
    setDraft("");
    setPhoto(null);
    deliver(local);
  };

  // Picks one photo from the gallery (Android's photo picker: no permission
  // needed). It is shown above the message box until sent or removed.
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.85,
        exif: false, // location and device details embedded in photos are not read
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > UPLOAD_LIMITS.imageMb * 1024 * 1024) {
        toast.error(`That photo is larger than ${UPLOAD_LIMITS.imageMb} MB.`);
        return;
      }
      setPhoto(asset);
    } catch {
      toast.error("The photo library could not be opened.");
    }
  };

  // Shown at once; the server's answer (or the live event) then confirms it.
  // If it fails, the message's previous reactions come back. A second tap
  // while the first request is still on its way is ignored.
  const react = async (message, emoji) => {
    setMenuFor(null);
    if (pendingReactions.current.has(message.id)) return;
    // The menu may have been open while others reacted: start from the newest copy.
    const latest = messages.find((m) => m.id === message.id) || message;
    if (latest.deleted) return;
    const before = latest.reactions || [];
    const update = (reactions) =>
      setMessages((current) =>
        current.map((m) => (m.id === message.id ? { ...m, reactions } : m)),
      );
    update(withReaction(before, user.id, emoji));
    pendingReactions.current.add(message.id);
    try {
      await reactToMessage(conversationId, message.id, emoji);
    } catch (err) {
      if (!mounted.current) return;
      update(before);
      toast.error(
        err.isNetwork
          ? "No connection — the reaction was not saved."
          : err.message,
      );
    } finally {
      pendingReactions.current.delete(message.id);
    }
  };

  // Tapping a reaction under a message adds that one, or removes it if it is yours.
  const toggleReaction = (message, emoji) =>
    react(message, myReactionOf(message, user.id) === emoji ? "" : emoji);

  const openMenu = useCallback((message) => {
    menuOpenedAt.current = Date.now();
    setMenuFor(message);
  }, []);
  // Runs a menu choice, ignoring the release of the long press that opened the menu.
  const fromMenu = useCallback((action) => {
    if (Date.now() - menuOpenedAt.current < MENU_SETTLE_MS) return;
    action();
  }, []);

  const copyText = async (message) => {
    setMenuFor(null);
    try {
      await Clipboard.setStringAsync(message.body);
      toast.success("Message copied.");
    } catch {
      toast.error("The message could not be copied.");
    }
  };

  const confirmDelete = (message) => {
    setMenuFor(null);
    Alert.alert(
      "Delete for everyone?",
      'Everyone in this chat will see "This message was deleted" instead. This cannot be undone.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMessage(conversationId, message.id);
            } catch (err) {
              if (mounted.current)
                toast.error(
                  err.isNetwork
                    ? "No connection — the message was not deleted."
                    : err.message,
                );
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  // From the menu the result is a toast; inside the photo viewer (which covers
  // toasts) it is shown in the viewer itself.
  const runDownload = async (message, kind, { inViewer = false } = {}) => {
    if (busy) return;
    setBusy(kind);
    setViewerNotice(null);
    const report = (tone, text) => {
      if (!mounted.current) return;
      if (inViewer) setViewerNotice({ tone, text });
      else toast[tone](text);
    };
    try {
      if (kind === "save") {
        const saved = await saveChatImage(conversationId, message);
        if (saved) report("success", "Photo saved.");
      } else {
        await shareChatImage(conversationId, message);
      }
    } catch (err) {
      report("error", err.message || "The photo could not be downloaded.");
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  // Names for the "who reacted" list: the people in this conversation that
  // this phone already knows about.
  const nameOf = (userId) => {
    if (userId === user.id) return "You";
    if (conversation && conversation.peer && conversation.peer.id === userId)
      return conversation.peer.name;
    const known = messages.find((m) => m.sender && m.sender.id === userId);
    return known ? known.sender.name : "A member";
  };

  // A failed message is sent again with the SAME clientId, so if the first
  // attempt did reach the server it is recognised and not stored twice.
  const retry = (message) => {
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id
          ? {
              ...m,
              status: "sending",
              error: undefined,
              progress: m.type === "IMAGE" && !m.mediaId ? 0 : undefined,
            }
          : m,
      ),
    );
    deliver(message);
  };

  const group = conversation ? conversation.type === "GROUP" : false;
  const peer = conversation ? conversation.peer : null;
  const canSend = conversation ? conversation.canSend : true;
  const canSubmit = Boolean(draft.trim() || photo);

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
    // Every handler below is bound to this item's own message id, so a
    // reaction or menu can never land on a neighbouring message.
    const bubble = (
      <Bubble
        message={item}
        mine={mine}
        group={group}
        showName={!sameAsOlder}
        showAvatar={!sameAsNewer}
        onRetry={() => retry(item)}
        myId={user.id}
        onMenu={() => openMenu(item)}
        onOpenPhoto={() => setViewing(item)}
        onToggleReaction={(emoji) => toggleReaction(item, emoji)}
        onReactionDetails={(reaction) => setDetails(reaction)}
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

  // The menu always works on the newest copy of the message.
  const menuMessage = menuFor
    ? messages.find((m) => m.id === menuFor.id) || menuFor
    : null;
  const menuMine = Boolean(
    menuMessage && menuMessage.sender && menuMessage.sender.id === user.id,
  );
  const menuIsPhoto = Boolean(
    menuMessage && menuMessage.type === "IMAGE" && menuMessage.image,
  );

  return (
    <Screen header={header} padded={false} bottomInset={false}>
      <ConnectionBanner connection={connection} />
      <View
        ref={body}
        style={[styles.flex, { paddingBottom: keyboardOverlap }]}
      >
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
              styles.composerWrap,
              {
                borderTopColor: colors.line,
                backgroundColor: colors.bg,
                // Over the keyboard there is no navigation bar to clear, just a small gap.
                paddingBottom: keyboardOverlap
                  ? 12
                  : Math.max(insets.bottom, 10),
              },
            ]}
          >
            {photo ? (
              <View
                style={[
                  styles.pending,
                  { backgroundColor: colors.surface2, borderColor: colors.line },
                ]}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.pendingImage}
                  contentFit="cover"
                  accessibilityLabel="Selected photo"
                />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">Photo ready to send</Text>
                  <Text variant="caption" tone="muted">
                    Add a caption below, or send it as it is.
                  </Text>
                </View>
                <IconButton
                  name="close"
                  onPress={() => setPhoto(null)}
                  accessibilityLabel="Remove the selected photo"
                />
              </View>
            ) : null}
            <View style={styles.composer}>
              <Pressable
                onPress={pickPhoto}
                style={[styles.attach, { backgroundColor: colors.surface2 }]}
                accessibilityRole="button"
                accessibilityLabel="Attach a photo"
                hitSlop={4}
              >
                <Ionicons name="image-outline" size={21} color={colors.fgSoft} />
              </Pressable>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: colors.surface2, borderColor: colors.line },
                ]}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={photo ? "Add a caption" : "Message"}
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.brand}
                  cursorColor={colors.brand}
                  multiline
                  maxLength={MAX_LENGTH}
                  style={[styles.input, { color: colors.fg }]}
                  accessibilityLabel={photo ? "Photo caption" : "Type a message"}
                />
              </View>
              <Pressable
                onPress={send}
                disabled={!canSubmit}
                style={[
                  styles.send,
                  {
                    backgroundColor: canSubmit ? colors.brand : colors.surface2,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={photo ? "Send photo" : "Send message"}
              >
                <Ionicons
                  name="send"
                  size={19}
                  color={canSubmit ? colors.brandFg : colors.muted}
                />
              </Pressable>
            </View>
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
      </View>

      <Sheet
        visible={Boolean(menuMessage)}
        onClose={() => setMenuFor(null)}
        title="Message options"
      >
        {menuMessage ? (
          <View style={styles.sheetBody}>
            {!menuMessage.deleted && canSend ? (
              <View style={styles.emojiRow} accessibilityLabel="React to message">
                {REACTIONS.map((emoji) => {
                  const chosen = myReactionOf(menuMessage, user.id) === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => fromMenu(() => react(menuMessage, chosen ? "" : emoji))}
                      style={({ pressed }) => [
                        styles.emojiButton,
                        {
                          backgroundColor: chosen
                            ? colors.brandSoft
                            : pressed
                              ? colors.surface2
                              : "transparent",
                          borderColor: chosen ? colors.brand : "transparent",
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chosen }}
                      accessibilityLabel={
                        chosen
                          ? `Remove your ${emoji} reaction`
                          : `React with ${emoji}`
                      }
                    >
                      <Text style={styles.emojiChoice}>{emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {/* The text can also be selected and copied here. */}
            <View
              style={[
                styles.quote,
                { backgroundColor: colors.surface2, borderColor: colors.line },
              ]}
            >
              <Text variant="caption" tone="muted" style={styles.quoteName}>
                {menuMine ? "You" : menuMessage.sender ? menuMessage.sender.name : ""}
                {" · "}
                {formatTime(menuMessage.createdAt)}
              </Text>
              {menuMessage.deleted ? (
                <Text tone="muted">This message was deleted</Text>
              ) : menuMessage.body ? (
                <Text selectable numberOfLines={8}>
                  {menuMessage.body}
                </Text>
              ) : menuIsPhoto ? (
                <Text tone="muted">📷 Photo</Text>
              ) : null}
            </View>
            <View>
              {!menuMessage.deleted && menuMessage.body ? (
                <MenuAction
                  icon="copy-outline"
                  label="Copy text"
                  onPress={() => fromMenu(() => copyText(menuMessage))}
                />
              ) : null}
              {!menuMessage.deleted && menuIsPhoto ? (
                <>
                  <MenuAction
                    icon="download-outline"
                    label="Download image"
                    busy={busy === "save"}
                    onPress={() => fromMenu(() => runDownload(menuMessage, "save"))}
                  />
                  <MenuAction
                    icon="share-social-outline"
                    label="Share image"
                    busy={busy === "share"}
                    onPress={() => fromMenu(() => runDownload(menuMessage, "share"))}
                  />
                </>
              ) : null}
              {!menuMessage.deleted && myReactionOf(menuMessage, user.id) ? (
                <MenuAction
                  icon="close-circle-outline"
                  label="Remove my reaction"
                  onPress={() => fromMenu(() => react(menuMessage, ""))}
                />
              ) : null}
              {menuMine && !menuMessage.deleted ? (
                <MenuAction
                  icon="trash-outline"
                  label="Delete for everyone"
                  danger
                  onPress={() => fromMenu(() => confirmDelete(menuMessage))}
                />
              ) : null}
              <MenuAction
                icon="close-outline"
                label="Cancel"
                onPress={() => setMenuFor(null)}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={Boolean(details)}
        onClose={() => setDetails(null)}
        title={details ? `${details.emoji} Reactions` : "Reactions"}
      >
        {details ? (
          <View style={styles.sheetBody}>
            {details.userIds.map((userId) => (
              <View key={userId} style={styles.reactor}>
                <Text style={styles.reactionEmoji}>{details.emoji}</Text>
                <Text variant="bodyStrong">{nameOf(userId)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Sheet>

      <PhotoViewer
        message={viewing}
        busy={busy}
        notice={viewerNotice}
        onClose={() => {
          setViewing(null);
          setViewerNotice(null);
        }}
        onSave={() => viewing && runDownload(viewing, "save", { inViewer: true })}
        onShare={() => viewing && runDownload(viewing, "share", { inViewer: true })}
      />
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
  alignMine: { alignItems: "flex-end" },
  alignTheirs: { alignItems: "flex-start" },
  avatarSlot: { width: 30 },
  bubbleColumn: { maxWidth: "80%" },
  bubble: {
    maxWidth: "100%",
    borderRadius: radius.xl,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  photoBubble: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 5 },
  photoCaptionPad: { paddingHorizontal: 8 },
  photoCaption: { marginTop: 5 },
  photo: { borderRadius: radius.lg, overflow: "hidden" },
  photoState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoUpload: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  photoUploadText: { fontWeight: "700" },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  deletedText: { fontStyle: "italic" },
  sending: { opacity: 0.7 },
  pressed: { opacity: 0.82 },
  reactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 3,
  },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  reactionEmoji: { fontSize: 14, lineHeight: 18 },
  sheetBody: { paddingHorizontal: space.xl, paddingBottom: 8, gap: 12 },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
  },
  emojiButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChoice: { fontSize: 25, lineHeight: 31 },
  quote: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 12,
    gap: 4,
  },
  quoteName: { fontWeight: "700" },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: radius.md,
  },
  reactor: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  composerWrap: {
    paddingHorizontal: space.md,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  pendingImage: { width: 52, height: 52, borderRadius: radius.md },
  attach: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.md,
  },
  viewerBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: 12,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  viewerCaption: { textAlign: "center" },
  viewerNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  viewerActions: { flexDirection: "row", gap: 10 },
  viewerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});
