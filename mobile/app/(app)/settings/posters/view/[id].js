import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Banner,
  Button,
  ErrorState,
  LoadingState,
  ProgressBar,
  Screen,
  StackHeader,
  Text,
} from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { postersApi } from "@/features/posters/api";
import { StatusPill } from "@/features/posters/components";
import { exportErrorMessage, savePosterFile, sharePosterFile } from "@/features/posters/files";
import { fromPoster, templateById } from "@/features/posters/model";
import { PosterRenderer } from "@/features/posters/PosterRenderer";
import { messageOf } from "@/services/api";
import { space } from "@/theme/tokens";
import { timeAgo } from "@/utils/format";

const PHASES = {
  authorising: "Checking the saved poster…",
  drawing: "Drawing the poster at full resolution…",
  saving: "Preparing the file…",
  receiving: "Receiving the file…",
};

/**
 * Preview, download (PNG / PDF) and share a saved poster. As on the website,
 * every file is drawn from the SAVED poster that POST /posters/:id/export
 * returns after checking ownership and that the poster is finished — never
 * from unsaved edits — at 2480 × 3508 px (A4, 300 dpi).
 */
export default function PosterView() {
  const params = useLocalSearchParams();
  const id = String(params.id);
  const autoAction = params.action ? String(params.action) : null;
  const router = useRouter();
  const toast = useToast();
  const renderer = useRef(null);

  const [poster, setPoster] = useState(null);
  const [load, setLoad] = useState({ state: "loading", error: null });
  const [renderState, setRenderState] = useState("loading");
  const [fit, setFit] = useState(null);
  const [job, setJob] = useState(null); // { kind, phase, progress }
  const [notice, setNotice] = useState(null); // { tone, text }
  const autoDone = useRef(false);

  const loadPoster = useCallback(async () => {
    try {
      const { data } = await postersApi.get(id);
      setPoster(data);
      setLoad({ state: "ready", error: null });
    } catch (error) {
      setLoad({ state: "error", error });
    }
  }, [id]);

  // Reload whenever the screen is shown again (e.g. after editing).
  useFocusEffect(
    useCallback(() => {
      loadPoster();
    }, [loadPoster]),
  );

  const ready = Boolean(poster && poster.status === "READY" && !poster.missing.length);
  const blockedByFit = Boolean(fit && fit.overflow);

  const run = useCallback(
    async (kind) => {
      if (job || !poster) return;
      setNotice(null);
      const format = kind === "pdf" ? "pdf" : "png";
      setJob({ kind, phase: "authorising", progress: 0 });
      try {
        const { data } = await postersApi.authorizeExport(poster.id, format);
        setPoster(data.poster);
        const form = fromPoster(data.poster);
        const title = [form.basic.displayName, form.title].filter(Boolean).join(" — ") || "Batch poster";
        const file = await renderer.current.exportFile({
          form,
          format,
          title,
          onPhase: (phase, progress = 0) => setJob((j) => (j ? { ...j, phase, progress } : j)),
        });
        setJob(null);
        if (kind === "share") {
          await sharePosterFile(file);
        } else {
          const saved = await savePosterFile(file);
          if (saved) {
            setNotice({ tone: "success", text: `${format.toUpperCase()} saved (${Math.round(file.bytes / 1024)} KB).` });
            toast.success(format === "pdf" ? "PDF saved." : "PNG saved.");
          } else {
            setNotice({ tone: "info", text: "Not saved — no folder was chosen. You can share the file instead." });
          }
        }
      } catch (error) {
        setNotice({ tone: "danger", text: exportErrorMessage(error) });
      } finally {
        setJob(null);
      }
    },
    [job, poster, toast],
  );

  // ?action=png|pdf|share from the dashboard: run once the poster is drawn.
  useEffect(() => {
    if (!autoAction || autoDone.current || !ready || renderState !== "previewed" || blockedByFit) return;
    autoDone.current = true;
    run(autoAction);
  }, [autoAction, ready, renderState, blockedByFit, run]);

  const confirmDelete = () => {
    Alert.alert(
      "Delete poster?",
      "The poster and the photos uploaded for it will be deleted — on the website too. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await postersApi.remove(id);
              toast.success("Poster deleted.");
              router.back();
            } catch (error) {
              toast.error(messageOf(error));
            }
          },
        },
      ],
    );
  };

  const header = <StackHeader title={poster ? poster.title || poster.basic.displayName || "Batch poster" : "Batch poster"} subtitle={poster ? templateById(poster.template).name : undefined} />;

  if (load.state === "loading" && !poster) {
    return (
      <Screen header={header}>
        <LoadingState label="Opening the poster…" />
      </Screen>
    );
  }
  if (load.state === "error" && !poster) {
    const notFound = load.error && (load.error.status === 404 || load.error.status === 400);
    return (
      <Screen header={header}>
        <ErrorState error={notFound ? { message: "This poster may have been deleted." } : load.error} onRetry={notFound ? undefined : loadPoster} />
      </Screen>
    );
  }

  const form = fromPoster(poster);
  const busy = Boolean(job);
  const canExport = ready && !blockedByFit && renderState === "previewed" && !busy;

  return (
    <Screen header={header} scroll>
      <View style={styles.meta}>
        <StatusPill status={poster.status} missing={poster.missing} />
        <Text variant="caption" tone="muted">
          Updated {timeAgo(poster.updatedAt)}
          {poster.lastExportedAt ? ` · last downloaded ${timeAgo(poster.lastExportedAt)}` : ""}
        </Text>
      </View>

      {!ready ? (
        <Banner
          tone="warn"
          message="This is a draft. Open the editor and choose “Save finished poster” to download or share it."
          actionLabel="Continue editing"
          onAction={() => router.push({ pathname: "/settings/posters/[id]", params: { id, step: "5" } })}
          style={styles.banner}
        />
      ) : null}
      {blockedByFit ? <Banner tone="danger" message={fit.message} style={styles.banner} /> : null}
      {notice ? <Banner tone={notice.tone} message={notice.text} style={styles.banner} /> : null}

      <PosterRenderer ref={renderer} form={form} onFit={setFit} onStateChange={setRenderState} />
      <Text variant="caption" tone="muted" center style={styles.hint}>
        Drawn by the same templates as the website. Pinch to zoom.
      </Text>

      {busy ? (
        <View style={styles.progress}>
          <Text variant="smallStrong">{PHASES[job.phase] || "Working…"}</Text>
          <ProgressBar value={job.phase === "receiving" ? job.progress : job.phase === "saving" ? 0.6 : job.phase === "drawing" ? 0.3 : 0.1} tone="brand" />
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.row}>
          <Button title="Download PNG" icon="image-outline" onPress={() => run("png")} disabled={!canExport} loading={busy && job.kind === "png"} style={styles.flex} full />
          <Button title="Download PDF" icon="document-outline" onPress={() => run("pdf")} disabled={!canExport} loading={busy && job.kind === "pdf"} style={styles.flex} full />
        </View>
        <Button title="Share" icon="share-social-outline" variant="leaf" onPress={() => run("share")} disabled={!canExport} loading={busy && job.kind === "share"} full />
        <View style={styles.row}>
          <Button
            title="Edit"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/settings/posters/[id]", params: { id } })}
            disabled={busy}
            style={styles.flex}
            full
          />
          <Button
            title="Change template"
            icon="color-palette-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/settings/posters/[id]", params: { id, step: "5" } })}
            disabled={busy}
            style={styles.flex}
            full
          />
        </View>
        <Button title="Delete poster" icon="trash-outline" variant="danger" onPress={confirmDelete} disabled={busy} full />
      </View>
      <Text variant="caption" tone="muted" center style={styles.hint}>
        Files are 2480 × 3508 px (A4 at 300 dpi). A downloaded poster can be shared beyond the community — check the contact details you chose to print.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  banner: { marginBottom: 12 },
  hint: { marginTop: 8 },
  progress: { gap: 8, marginTop: space.lg },
  actions: { gap: 10, marginTop: space.lg },
  row: { flexDirection: "row", gap: 10 },
});
