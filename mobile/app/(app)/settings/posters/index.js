import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActionSheet,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  StackHeader,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { postersApi } from "@/features/posters/api";
import { StatusPill, TemplateGallery, TemplateThumb } from "@/features/posters/components";
import { LIMITS, TEMPLATES, templateById } from "@/features/posters/model";
import { messageOf } from "@/services/api";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { timeAgo } from "@/utils/format";

// Profile → Settings → Batch Profile Poster Maker. The doctor's posters come
// from the same API as the website (GET /posters), so a poster started on the
// website continues here and the other way round.
function PosterRow({ poster, onOpen, onEdit, onMore }) {
  const { colors } = useTheme();
  const template = templateById(poster.template);
  const ready = poster.status === "READY" && !poster.missing.length;
  const name = poster.title || poster.displayName || "Untitled poster";
  return (
    <Card style={styles.row} padded={false}>
      <Pressable
        onPress={onOpen}
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${template.name}, ${ready ? "finished" : "draft"}. Open preview`}
      >
        <TemplateThumb templateId={poster.template} width={64} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {template.name}
            {poster.batchYear ? ` · Batch of ${poster.batchYear}` : ""}
          </Text>
          <View style={styles.rowMeta}>
            <StatusPill status={poster.status} missing={poster.missing} />
            <Text variant="caption" tone="muted">
              Updated {timeAgo(poster.updatedAt)}
            </Text>
          </View>
          {poster.lastExportedAt ? (
            <Text variant="caption" tone="muted">
              Last downloaded {timeAgo(poster.lastExportedAt)}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={[styles.rowActions, { borderTopColor: colors.line }]}>
        <Button title="Continue editing" icon="create-outline" size="sm" variant="ghost" onPress={onEdit} />
        <Button
          title={ready ? "Preview & export" : "Preview"}
          icon={ready ? "download-outline" : "eye-outline"}
          size="sm"
          variant="ghost"
          onPress={onOpen}
        />
        <Pressable
          onPress={onMore}
          hitSlop={8}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${name}`}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.fgSoft} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function PosterDashboard() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [posters, setPosters] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [actionsFor, setActionsFor] = useState(null);
  const loaded = useRef(false);

  const load = useCallback(async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);
    else if (!loaded.current) setStatus("loading");
    try {
      const { data } = await postersApi.list();
      setPosters(data);
      setError(null);
      setStatus("ready");
      loaded.current = true;
    } catch (err) {
      setError(err);
      if (!loaded.current) setStatus("error");
      else toast.error(messageOf(err));
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

  // Fresh every time the screen is shown (after editing, or a change on the website).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (poster) => {
    const name = poster.title || poster.displayName || "this poster";
    Alert.alert(
      "Delete poster?",
      `"${name}" and the photos uploaded for it will be deleted — on the website too. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await postersApi.remove(poster.id);
              setPosters((list) => list.filter((p) => p.id !== poster.id));
              toast.success("Poster deleted.");
            } catch (err) {
              toast.error(messageOf(err));
            }
          },
        },
      ],
    );
  };

  if (user.role !== "DOCTOR") {
    return (
      <Screen header={<StackHeader title="Batch poster" />}>
        <EmptyState
          icon="image-outline"
          title="Batch posters are for doctor accounts"
          message="Sign in with a doctor account to create a poster."
        />
      </Screen>
    );
  }

  const atLimit = posters.length >= LIMITS.perDoctor;
  const drafts = posters.filter((p) => !(p.status === "READY" && !p.missing.length));
  const finished = posters.filter((p) => p.status === "READY" && !p.missing.length);
  const open = (poster) => router.push(`/settings/posters/view/${poster.id}`);
  const edit = (poster, step) =>
    router.push({ pathname: "/settings/posters/[id]", params: { id: poster.id, ...(step != null ? { step: String(step) } : {}) } });

  const sheetPoster = actionsFor;
  const sheetReady = sheetPoster && sheetPoster.status === "READY" && !sheetPoster.missing.length;

  return (
    <Screen
      header={<StackHeader title="Batch Profile Poster Maker" />}
      scroll
      refreshing={refreshing}
      onRefresh={() => load({ pull: true })}
    >
      <View style={[styles.hero, { backgroundColor: colors.brandSoft }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.brand }]}>
          <Ionicons name="sparkles-outline" size={22} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text variant="h3">Create, personalize and share</Text>
          <Text variant="small" tone="soft">
            A poster for your batchmates from your profile and a personal message — download it as PNG or PDF, or share it.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="eyebrow" tone="muted" style={styles.sectionTitle}>
          Create a new batch poster
        </Text>
        <TemplateGallery value={template} onChange={setTemplate} />
        <Text variant="small" tone="muted">
          {templateById(template).description}
        </Text>
        {atLimit ? (
          <Banner
            tone="warn"
            message={`You can keep up to ${LIMITS.perDoctor} posters. Delete one you no longer need to create another.`}
          />
        ) : null}
        <Button
          title={`Start with ${templateById(template).name}`}
          icon="add"
          onPress={() => router.push({ pathname: "/settings/posters/[id]", params: { id: "new", template } })}
          disabled={atLimit}
          full
        />
        <Text variant="caption" tone="muted" center>
          You can switch template at any time without losing what you have written.
        </Text>
      </View>

      {status === "loading" ? (
        <View style={styles.section}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : status === "error" ? (
        <ErrorState error={error} onRetry={() => load()} />
      ) : posters.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title="No posters yet"
          message="Choose a template above to create your first batch poster. Posters you make on the website appear here too."
          compact
        />
      ) : (
        <>
          {drafts.length ? (
            <View style={styles.section}>
              <Text variant="eyebrow" tone="muted" style={styles.sectionTitle}>
                Drafts
              </Text>
              {drafts.map((p) => (
                <PosterRow key={p.id} poster={p} onOpen={() => open(p)} onEdit={() => edit(p)} onMore={() => setActionsFor(p)} />
              ))}
            </View>
          ) : null}
          {finished.length ? (
            <View style={styles.section}>
              <Text variant="eyebrow" tone="muted" style={styles.sectionTitle}>
                My saved posters
              </Text>
              {finished.map((p) => (
                <PosterRow key={p.id} poster={p} onOpen={() => open(p)} onEdit={() => edit(p)} onMore={() => setActionsFor(p)} />
              ))}
            </View>
          ) : null}
        </>
      )}

      <ActionSheet
        visible={Boolean(sheetPoster)}
        onClose={() => setActionsFor(null)}
        title={sheetPoster ? sheetPoster.title || sheetPoster.displayName || "Poster" : ""}
        actions={
          sheetPoster
            ? [
                { key: "preview", label: "Preview", icon: "eye-outline", onPress: () => open(sheetPoster) },
                { key: "edit", label: "Continue editing", icon: "create-outline", onPress: () => edit(sheetPoster) },
                { key: "template", label: "Select a different template", icon: "color-palette-outline", onPress: () => edit(sheetPoster, 5) },
                ...(sheetReady
                  ? [
                      { key: "png", label: "Download PNG", icon: "image-outline", onPress: () => router.push(`/settings/posters/view/${sheetPoster.id}?action=png`) },
                      { key: "pdf", label: "Download PDF", icon: "document-outline", onPress: () => router.push(`/settings/posters/view/${sheetPoster.id}?action=pdf`) },
                      { key: "share", label: "Share", icon: "share-social-outline", onPress: () => router.push(`/settings/posters/view/${sheetPoster.id}?action=share`) },
                    ]
                  : []),
                { key: "delete", label: "Delete", icon: "trash-outline", danger: true, onPress: () => confirmDelete(sheetPoster) },
              ]
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: "row", gap: 14, alignItems: "center", padding: space.lg, borderRadius: radius.xl, marginBottom: space.xl },
  heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { gap: 12, marginBottom: space.xl },
  sectionTitle: { marginLeft: 4 },
  row: { overflow: "hidden" },
  rowMain: { flexDirection: "row", gap: 14, padding: 14, alignItems: "center" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  more: { marginLeft: "auto", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
