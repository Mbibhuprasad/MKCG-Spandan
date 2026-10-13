import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Input,
  ListFooter,
  LoadingState,
  Screen,
  Sheet,
  StackHeader,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useChat } from "@/features/chat/ChatContext";
import { chatApi } from "@/features/chat/api";
import { DoctorRow } from "@/features/doctors/DoctorCard";
import { doctorsApi } from "@/features/doctors/api";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedList } from "@/hooks/usePagedList";
import { useResource } from "@/hooks/useResource";
import { messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { joinParts } from "@/utils/format";
import { formatPhone, openWhatsApp } from "@/utils/phone";

// What the doctor sees after picking someone: who they are and the contact
// details that person chose to share (the API leaves out everything else).
function DoctorPreview({ doctor, onClose, onStart, starting, failure }) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const profile = useResource(() => doctorsApi.get(doctor.id), [doctor.id]);
  const contact = (profile.data && profile.data.contact) || {};

  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <Avatar uri={doctor.photoUrl} name={doctor.name} size={72} square />
        <View style={styles.flex}>
          <Text variant="h2">{doctor.name}</Text>
          <Text variant="small" tone="soft">
            {joinParts([
              doctor.professionalTitle || doctor.designation,
              doctor.specialization,
            ]) || "Community member"}
          </Text>
          {joinParts([doctor.hospital, doctor.city], ", ") ? (
            <Text variant="caption" tone="muted">
              {joinParts([doctor.hospital, doctor.city], ", ")}
            </Text>
          ) : null}
        </View>
      </View>

      {profile.status === "loading" ? (
        <LoadingState compact label="Loading contact details…" />
      ) : null}
      {profile.status === "error" ? (
        <ErrorState compact error={profile.error} onRetry={profile.reload} />
      ) : null}
      {profile.status === "ready" ? (
        <View
          style={[
            styles.contact,
            { backgroundColor: colors.bgSoft, borderColor: colors.line },
          ]}
        >
          <View style={styles.contactRow}>
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={contact.whatsapp ? colors.leaf : colors.muted}
            />
            {contact.whatsapp ? (
              <>
                <Text style={styles.flex}>{formatPhone(contact.whatsapp)}</Text>
                <Button
                  title="WhatsApp"
                  size="sm"
                  variant="leaf"
                  onPress={async () => {
                    if (!(await openWhatsApp(contact.whatsapp)))
                      toast.error(
                        "WhatsApp could not be opened on this phone.",
                      );
                  }}
                />
              </>
            ) : (
              <Text tone="muted" style={styles.flex}>
                WhatsApp number not shared
              </Text>
            )}
          </View>
          {contact.phone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color={colors.muted} />
              <Text style={styles.flex}>{formatPhone(contact.phone)}</Text>
            </View>
          ) : null}
          {contact.email ? (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={colors.muted} />
              <Text style={styles.flex} numberOfLines={1}>
                {contact.email}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {failure ? (
        <Banner
          tone="warn"
          message={messageOf(failure)}
          actionLabel={
            failure.code === "WHATSAPP_REQUIRED"
              ? "Add my WhatsApp number"
              : undefined
          }
          onAction={() => {
            onClose();
            router.push("/profile/section/practice");
          }}
        />
      ) : null}

      <Button
        title="Start chat"
        icon="chatbubble-ellipses"
        onPress={onStart}
        loading={starting}
        full
        size="lg"
      />
      <Button
        title="View full profile"
        variant="ghost"
        full
        onPress={() => {
          onClose();
          router.push(`/doctors/${doctor.id}`);
        }}
      />
      <Text variant="caption" tone="muted" center>
        In-app chat is private to the two of you. WhatsApp is a separate,
        optional way to reach this friend — nothing is sent there for you.
      </Text>
    </View>
  );
}

// One-to-One Chat, step two: find a doctor, look at who they are, open the conversation.
export default function NewChat() {
  const router = useRouter();
  const { user } = useAuth();
  const { upsertConversation } = useChat();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 350);
  const list = usePagedList(
    (page) => doctorsApi.list({ page, limit: 20, q }),
    [q],
  );
  const [selected, setSelected] = useState(null);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState(null);

  const doctors = list.items.filter((d) => d.id !== user.id);

  const start = async () => {
    if (starting || !selected) return;
    setStarting(true);
    setFailure(null);
    try {
      // The server returns the single conversation between the two doctors,
      // creating it only if it does not exist yet — from either side.
      const { data } = await chatApi.openDirect(selected.id);
      upsertConversation(data);
      setSelected(null);
      router.replace(`/chat/${data.id}`);
    } catch (error) {
      setFailure(error);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen
      header={
        <StackHeader title="New chat" subtitle="Choose a friend to message" />
      }
      padded={false}
      keyboard
    >
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search friends by name"
        icon="search"
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        maxLength={60}
        style={styles.search}
      />
      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <DoctorRow
              doctor={item}
              onPress={() => {
                setFailure(null);
                setSelected(item);
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          list.status === "loading" ? (
            <LoadingState label="Searching friends…" />
          ) : list.status === "error" ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState
              icon="search-outline"
              title={q ? "No friend matches" : "No other friends yet"}
              message={
                q
                  ? "Check the spelling or try part of the name."
                  : "Friends appear here as they join the community."
              }
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.loadingMore}
            error={list.moreError}
            onRetry={list.loadMore}
          />
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <Sheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Start a conversation"
      >
        {selected ? (
          <DoctorPreview
            doctor={selected}
            onClose={() => setSelected(null)}
            onStart={start}
            starting={starting}
            failure={failure}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { marginHorizontal: space.lg, marginTop: space.lg, marginBottom: 6 },
  row: { paddingHorizontal: space.lg, marginBottom: 10 },
  list: { paddingTop: 8, paddingBottom: 40, flexGrow: 1 },
  preview: { paddingHorizontal: space.xl, gap: 12 },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  contact: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
});
