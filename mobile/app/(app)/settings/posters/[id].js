import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Banner,
  Button,
  ErrorState,
  KeyboardView,
  LoadingState,
  Screen,
  StackHeader,
  Text,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { postersApi } from "@/features/posters/api";
import { StepHeader } from "@/features/posters/components";
import {
  REQUIRED_LABELS,
  STEPS,
  TEMPLATES,
  applyPrefill,
  blankForm,
  errorsByStep,
  fromPoster,
  payloadKey,
  photoIds,
  prefillFromProfile,
  setIn,
  stepOfErrorKey,
  toPayload,
  validateForm,
  withTemplate,
} from "@/features/posters/model";
import {
  BasicStep,
  ContactStep,
  DesignStep,
  MessagesStep,
  PhotosStep,
  ProfessionalStep,
} from "@/features/posters/steps";
import { profileApi } from "@/features/profile/api";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { timeAgo } from "@/utils/format";

const STEP_COMPONENTS = [BasicStep, ProfessionalStep, MessagesStep, PhotosStep, ContactStep, DesignStep];
const AUTOSAVE_DELAY = 2500;

/**
 * Create or edit a batch poster — the same flow as the website editor:
 *  • a new poster starts from the doctor's profile (GET /doctors/me); nothing
 *    is ever written back to the profile;
 *  • changes are saved automatically a moment after typing stops (POST once,
 *    then PATCH), queued so they reach the server in order;
 *  • "Save finished poster" asks the API to mark it READY (the API checks the
 *    required fields); downloads are drawn from the saved poster.
 */
export default function PosterEditor() {
  const params = useLocalSearchParams();
  const posterId = params.id && params.id !== "new" ? String(params.id) : null;
  const initialTemplate = params.template ? String(params.template) : null;
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [load, setLoad] = useState({ state: "loading", error: null });
  const [form, setForm] = useState(null);
  const [prefill, setPrefill] = useState({});
  const [step, setStep] = useState(() => {
    const n = Number(params.step);
    return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
  });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | invalid | error
  const [savedAt, setSavedAt] = useState(null);
  const [message, setMessage] = useState(null); // { tone, text }
  const [fit, setFit] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [savedKey, setSavedKey] = useState("");

  const idRef = useRef(posterId);
  const [savedId, setSavedId] = useState(posterId);
  const formRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const savedPhotoIds = useRef(new Set());
  const leaving = useRef(false);
  const scroll = useRef(null);
  useEffect(() => {
    formRef.current = form;
  });

  /* ── Loading ── */
  const loadPoster = useCallback(async () => {
    setLoad({ state: "loading", error: null });
    try {
      const [me, poster] = await Promise.all([
        profileApi.me().then((r) => r.data),
        idRef.current ? postersApi.get(idRef.current).then((r) => r.data) : null,
      ]);
      const fromProfile = prefillFromProfile(me);
      let initial;
      if (poster) {
        initial = fromPoster(poster);
        savedPhotoIds.current = new Set(photoIds(initial));
        setSavedAt(poster.updatedAt);
      } else {
        const start = TEMPLATES.some((t) => t.id === initialTemplate) ? initialTemplate : undefined;
        initial = applyPrefill(blankForm(start), fromProfile, ["basic", "professional", "contact", "photos"]);
      }
      // As on the website: a new poster is created by the first real edit or save.
      setSavedKey(payloadKey(initial));
      setPrefill(fromProfile);
      setForm(initial);
      setLoad({ state: "ready", error: null });
    } catch (error) {
      setLoad({ state: "error", error });
    }
  }, [initialTemplate]);

  useEffect(() => {
    // Starts the requests; state is set when they answer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPoster();
  }, [loadPoster]);

  const key = useMemo(() => (form ? payloadKey(form) : ""), [form]);
  const dirty = Boolean(form) && key !== savedKey;
  const liveErrors = useMemo(() => (form ? validateForm(form) : {}), [form]);
  const blocking = Object.keys(liveErrors).length > 0;
  const missing = useMemo(
    () =>
      form
        ? Object.keys(validateForm(form, { complete: true }))
            .filter((k) => REQUIRED_LABELS[k])
            .map((k) => REQUIRED_LABELS[k])
        : [],
    [form],
  );

  /* ── Saving ── */
  const persist = useCallback(({ status, quiet = false } = {}) => {
    const run = async () => {
      const current = formRef.current;
      const problems = validateForm(current, { complete: status === "READY" });
      if (Object.keys(problems).length) {
        setErrors(problems);
        setSaveState("invalid");
        if (!quiet) {
          setStep(stepOfErrorKey(Object.keys(problems)[0]));
          setMessage({ tone: "danger", text: "Please check the highlighted fields." });
        }
        return null;
      }
      const body = toPayload(current, { status });
      const sentKey = payloadKey(current);
      setSaveState("saving");
      try {
        const { data } = idRef.current ? await postersApi.update(idRef.current, body) : await postersApi.create(body);
        if (!idRef.current) {
          idRef.current = data.id;
          setSavedId(data.id);
          // Keep the editor mounted; only the route parameter changes.
          router.setParams({ id: data.id, template: undefined });
        }
        setSavedKey(sentKey);
        savedPhotoIds.current = new Set(
          ["portrait", "family", "college", "memory"].map((k) => data.photos[k] && data.photos[k].id).filter(Boolean),
        );
        setForm((f) => ({ ...f, status: data.status }));
        setSavedAt(data.updatedAt);
        setErrors({});
        setSaveState("saved");
        return data;
      } catch (error) {
        if (error.code === "VALIDATION_ERROR" && error.details) {
          setErrors(error.details);
          setSaveState("invalid");
          if (!quiet) {
            setStep(stepOfErrorKey(Object.keys(error.details)[0]));
            setMessage({ tone: "danger", text: error.message });
          }
        } else {
          setSaveState("error");
          if (!quiet)
            setMessage({
              tone: "danger",
              text: error.isNetwork ? "No connection — the poster was not saved. Your changes are kept here." : error.message || "The poster could not be saved. Please try again.",
            });
        }
        return null;
      }
    };
    const next = queue.current.then(run, run);
    queue.current = next.catch(() => null);
    return next;
  }, [router]);

  // Autosave a moment after typing stops (only valid content is sent).
  useEffect(() => {
    if (load.state !== "ready" || !dirty || uploading) return undefined;
    if (blocking) {
      const timer = setTimeout(() => {
        setErrors((e) => ({ ...liveErrors, ...e }));
        setSaveState("invalid");
      }, AUTOSAVE_DELAY);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => persist({ quiet: true }), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [key, dirty, blocking, liveErrors, uploading, load.state, persist]);

  // Leaving with unsaved changes asks first (back button, gesture or header).
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (leaving.current || (!dirty && saveState !== "saving" && !uploading)) return;
      event.preventDefault();
      Alert.alert(
        uploading ? "A photo is still uploading" : "Unsaved changes",
        uploading ? "Leave now and the photo will not be added to the poster." : "Save your latest changes before leaving?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              leaving.current = true;
              navigation.dispatch(event.data.action);
            },
          },
          ...(uploading
            ? []
            : [
                {
                  text: "Save and leave",
                  onPress: async () => {
                    const saved = await persist({});
                    if (saved) {
                      leaving.current = true;
                      navigation.dispatch(event.data.action);
                    }
                  },
                },
              ]),
        ],
      );
    });
    return unsubscribe;
  }, [navigation, dirty, saveState, uploading, persist]);

  /* ── Editing ── */
  const update = useCallback((path, value) => {
    setForm((f) => setIn(f, path, value));
    setErrors((e) => {
      if (!e[path]) return e;
      const next = { ...e };
      delete next[path];
      return next;
    });
    setMessage(null);
  }, []);

  const setTemplate = useCallback((templateId) => setForm((f) => withTemplate(f, templateId)), []);

  // A replaced photo that was never saved with the poster is discarded at once
  // (saved ones are removed by the API when the poster is saved).
  const onPhoto = useCallback(
    (slot, media) => {
      const previous = formRef.current.photos[slot];
      if (previous && previous.id && !savedPhotoIds.current.has(previous.id) && (!media || media.id !== previous.id)) {
        postersApi.discardUpload(previous.id).catch(() => {});
      }
      update(`photos.${slot}`, media);
    },
    [update],
  );

  const onBusyChange = useCallback((busy) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1))), []);

  const onRefill = useCallback(
    (groups) => {
      setForm((f) => applyPrefill(f, prefill, groups));
      toast.info("Filled in from your profile.");
    },
    [prefill, toast],
  );

  const goToStep = useCallback((index) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, index)));
    setMessage(null);
    if (scroll.current) scroll.current.scrollTo({ y: 0, animated: false });
  }, []);

  const next = () => {
    const stepErrors = Object.fromEntries(Object.entries(liveErrors).filter(([k]) => stepOfErrorKey(k) === step));
    if (Object.keys(stepErrors).length) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setMessage({ tone: "danger", text: "Please check the highlighted fields before continuing." });
      return;
    }
    if (dirty && !uploading) persist({ quiet: true });
    goToStep(step + 1);
  };

  const saveDraft = async () => {
    const data = await persist({});
    if (data) toast.success("Draft saved.");
  };

  const finish = async () => {
    if (finishing) return;
    if (uploading) {
      setMessage({ tone: "warn", text: "Wait for the photo upload to finish." });
      return;
    }
    setFinishing(true);
    try {
      const data = await persist({ status: "READY" });
      if (data) {
        toast.success("Poster saved.");
        leaving.current = true;
        router.replace(`/settings/posters/view/${data.id}`);
      }
    } finally {
      setFinishing(false);
    }
  };

  /* ── Render ── */
  if (user.role !== "DOCTOR") {
    return (
      <Screen header={<StackHeader title="Batch poster" />}>
        <ErrorState error={{ message: "Batch posters are for doctor accounts." }} />
      </Screen>
    );
  }
  if (load.state === "loading") {
    return (
      <Screen header={<StackHeader title="Batch poster" />}>
        <LoadingState label="Opening the poster maker…" />
      </Screen>
    );
  }
  if (load.state === "error") {
    const notFound = load.error && (load.error.status === 404 || load.error.status === 400);
    return (
      <Screen header={<StackHeader title="Batch poster" />}>
        <ErrorState
          error={notFound ? { message: "This poster may have been deleted. Your other posters are in the poster maker." } : load.error}
          onRetry={notFound ? undefined : loadPoster}
        />
      </Screen>
    );
  }

  const shownErrors = { ...errors };
  for (const [k, v] of Object.entries(liveErrors)) if (!shownErrors[k] && v.startsWith("Please keep this")) shownErrors[k] = v;
  const counts = errorsByStep(shownErrors);
  const StepComponent = STEP_COMPONENTS[step];
  const isLast = step === STEPS.length - 1;

  const status =
    saveState === "saving"
      ? { icon: "sync", text: "Saving…", tone: "muted" }
      : dirty
        ? saveState === "invalid"
          ? { icon: "alert-circle-outline", text: "Fix the highlighted fields to save", tone: "warn" }
          : saveState === "error"
            ? { icon: "cloud-offline-outline", text: "Not saved — check your connection", tone: "danger" }
            : { icon: "ellipse-outline", text: savedId ? "Unsaved changes" : "Not saved yet", tone: "muted" }
        : savedAt
          ? { icon: "checkmark-circle-outline", text: `Saved ${timeAgo(savedAt)}`, tone: "leaf" }
          : { icon: "document-outline", text: "Not saved yet", tone: "muted" };

  return (
    <Screen
      header={
        <StackHeader
          title={savedId ? "Edit batch poster" : "New batch poster"}
          right={<Button title="Save" size="sm" variant="secondary" icon="save-outline" onPress={saveDraft} loading={saveState === "saving" && !finishing} />}
        />
      }
      padded={false}
      bottomInset={false}
    >
      <KeyboardView>
        <StepHeader step={step} onSelect={goToStep} counts={counts} />
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <Ionicons name={status.icon} size={14} color={colors[status.tone === "leaf" ? "leafStrong" : status.tone] || colors.muted} />
            <Text variant="caption" tone={status.tone === "leaf" ? "leaf" : status.tone}>
              {status.text}
            </Text>
          </View>
          <Text variant="h2">{STEPS[step].title}</Text>
          <Text variant="small" tone="muted" style={styles.stepDescription}>
            {STEPS[step].description}
          </Text>
          {message ? <Banner tone={message.tone} message={message.text} style={styles.message} /> : null}
          <StepComponent
            form={form}
            update={update}
            errors={shownErrors}
            onRefill={onRefill}
            onPhoto={onPhoto}
            onBusyChange={onBusyChange}
            goToStep={goToStep}
            setTemplate={setTemplate}
            fit={fit}
            onFit={setFit}
            missing={missing}
          />
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step > 0 ? (
            <Button title="Back" icon="arrow-back" variant="secondary" onPress={() => goToStep(step - 1)} style={styles.flex} full />
          ) : (
            <View style={styles.flex} />
          )}
          {isLast ? (
            <Button
              title="Save finished poster"
              icon="checkmark-done"
              onPress={finish}
              loading={finishing}
              disabled={uploading > 0}
              style={styles.flex2}
              full
            />
          ) : (
            <Button title="Next" iconRight="arrow-forward" onPress={next} style={styles.flex2} full />
          )}
        </View>
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  body: { padding: space.lg, paddingBottom: space.xxxl },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  stepDescription: { marginTop: 4, marginBottom: 16 },
  message: { marginBottom: 16 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: space.lg, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
