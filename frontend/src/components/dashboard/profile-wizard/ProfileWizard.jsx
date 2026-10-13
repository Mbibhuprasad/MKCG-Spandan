"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, Save, Send } from "lucide-react";
import { api, formErrors } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useSpecialties } from "@/lib/specialties";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { FormMessage, TextField } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import ChangePasswordForm from "@/components/dashboard/ChangePasswordForm";
import {
  BLANK,
  LAST_STEP,
  LIST_LIMITS,
  STEPS,
  adoptStored,
  countErrorsByStep,
  mergeSlices,
  stepIndex,
  stepOfErrorKey,
  stepSlice,
  toForm,
  toPayload,
  validateStep,
} from "./model";
import { StepSidebar, StepStrip } from "./StepNav";
import { STEP_COMPONENTS } from "./steps";
import ReviewStep from "./ReviewStep";
import SuccessScreen from "./SuccessScreen";

const EASE = [0.22, 1, 0.36, 1];
const STEP_IDS = STEPS.map((s) => s.id);
const SUMMARY_STEPS = STEPS.slice(0, -1); // the steps summarised on the last one

// For year ranges the message sits on the end field, so editing the start clears it too.
const RANGE_END = {
  education: "year",
  experience: "endYear",
  fellowships: "endYear",
  memberships: "endYear",
};

const snapshot = (payload, ids) =>
  Object.fromEntries(
    ids.map((id) => [id, JSON.stringify(stepSlice(payload, id))]),
  );

const clampStep = (value) =>
  Math.max(0, Math.min(LAST_STEP, Number.isInteger(value) ? value : 0));

const panelVariants = {
  enter: (direction) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
  exit: (direction) => ({
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.18, ease: "easeIn" },
  }),
};

/** One step's content. Framer Motion owns this element's fade and slide. */
function StepPanel({ direction, onShown, children }) {
  const shown = useRef(onShown);
  useEffect(() => {
    shown.current = onShown;
  });
  useEffect(() => {
    shown.current();
  }, []);
  return (
    <motion.div
      custom={direction}
      variants={panelVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="space-y-5"
    >
      {children}
    </motion.div>
  );
}

function ProfilePeek({ form, photoUrl }) {
  const place = [form.city, form.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return (
    <div className="card flex items-center gap-3 p-4">
      <Avatar name={form.name} src={photoUrl} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-fg">
          {form.name.trim() || "Your name"}
        </p>
        <p className="truncate text-xs text-fg-soft">
          {form.professionalTitle.trim() ||
            form.designation.trim() ||
            "Professional title"}
        </p>
        <p className="truncate text-xs text-muted">
          {[form.specialization.trim(), place].filter(Boolean).join(" · ") ||
            "Specialization · City"}
        </p>
      </div>
    </div>
  );
}

/**
 * The doctor profile wizard (/dashboard/profile): one step per category.
 *
 *  • Data lives in the existing account: every save is PATCH /doctors/me with
 *    only the fields of the steps that changed.
 *  • "Next" checks the current step and saves what changed; "Save progress"
 *    saves without requiring the mandatory fields, so a doctor can leave and
 *    resume from the same step after signing in again.
 *  • The profile is marked complete by the API on final submission — the
 *    success screen is shown only after that request has succeeded.
 */
export default function ProfileWizard() {
  const { user, setUser, isAdmin } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const completion = (user && user.profileCompletion) || {
    isComplete: false,
    resumeStep: 0,
  };
  const profileComplete = Boolean(completion.isComplete);
  // Administrators are not listed in the directory: nothing is mandatory for them.
  const strict = !isAdmin;
  // The last step owns the visibility settings, which do not apply to administrators.
  const ownedSteps = useMemo(
    () => STEP_IDS.filter((id) => !(isAdmin && id === "review")),
    [isAdmin],
  );

  const [initial] = useState(() => {
    const form = toForm(user);
    const resume = clampStep(completion.resumeStep);
    return {
      form,
      saved: snapshot(toPayload(form), STEP_IDS),
      step: profileComplete ? 0 : resume,
      reached: profileComplete ? LAST_STEP : resume,
      resumed: !profileComplete && resume > 0,
    };
  });
  const [form, setForm] = useState(initial.form);
  const [saved, setSaved] = useState(initial.saved); // per step: the last body the API accepted
  const [step, setStep] = useState(initial.step);
  const [maxReached, setMaxReached] = useState(initial.reached);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [messageNeedsErrors, setMessageNeedsErrors] = useState(false); // hide the banner once its fields are fixed
  const [busy, setBusy] = useState(null); // 'next' | 'save' | 'submit'
  const [done, setDone] = useState(null); // { updated } once the API confirmed the submission
  const [openEntries, setOpenEntries] = useState({}); // list name → key of the entry being edited
  const [resumeNote, setResumeNote] = useState(initial.resumed);
  const [pendingHref, setPendingHref] = useState(null);

  const root = useRef(null);
  const top = useRef(null);
  const panel = useRef(null);
  const lock = useRef(false);
  const pendingFocus = useRef(null);

  // Specialization and subspecialization options come from the API's catalogue;
  // the cities are the ones listed doctors already use.
  const catalogue = useSpecialties();
  const filters = useApi("/doctors/filters");
  const suggestions = useMemo(
    () => ({ cities: (filters.data && filters.data.cities) || [] }),
    [filters.data],
  );
  const checks = { strict, isListedSubspecialty: catalogue.isListed };

  const payload = useMemo(() => toPayload(form), [form]);
  const dirtyIds = useMemo(
    () =>
      ownedSteps.filter(
        (id) => JSON.stringify(stepSlice(payload, id)) !== saved[id],
      ),
    [ownedSteps, payload, saved],
  );
  const dirty = dirtyIds.length > 0 && !done;

  /* ── GSAP: entrance of the wizard shell and the slow backdrop drift.
        It animates the shell wrappers and the decorative orbs only; the step
        panel inside is Framer Motion's. Everything is reverted on cleanup. ── */
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          "[data-wizard-enter]",
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.09,
            clearProps: "transform",
          },
        );
      }, root);
      return () => ctx.revert();
    });
    // Decorative movement is for large screens only.
    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          gsap.utils.toArray("[data-wizard-orb]").forEach((orb, i) => {
            gsap.to(orb, {
              x: i % 2 ? -30 : 34,
              y: i % 2 ? 16 : -20,
              duration: 9 + i * 3,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
            });
          });
        }, root);
        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);

  /* ── Unsaved changes: warn before the tab closes or a link leaves the page ── */
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  if (!user) return null;

  if (done) {
    return (
      <SuccessScreen
        portfolioHref={`/doctors/${user.id}`}
        listed={!isAdmin && form.visibility.directory}
        updated={done.updated}
      />
    );
  }

  /* ── Form helpers handed to the step components ── */
  const clearError = (key) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const hasErrorUnder = (prefix) =>
    Object.keys(errors).some((key) => errors[key] && key.startsWith(prefix));

  const setValue = (key, value, errorKey = `profile.${key}`) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(errorKey);
  };
  const setValues = (values, ...errorKeys) => {
    setForm((f) => ({ ...f, ...values }));
    errorKeys.forEach(clearError);
  };
  const setItem = (name, index, key, value) => {
    setForm((f) => ({
      ...f,
      [name]: f[name].map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
    clearError(`profile.${name}.${index}.${key}`);
    if (RANGE_END[name] && (key === "startYear" || key === "current"))
      clearError(`profile.${name}.${index}.${RANGE_END[name]}`);
  };
  const setVisibility = (key, value) =>
    setForm((f) => ({ ...f, visibility: { ...f.visibility, [key]: value } }));
  const setSection = (key, value) =>
    setForm((f) => ({
      ...f,
      visibility: {
        ...f.visibility,
        sections: { ...f.visibility.sections, [key]: value },
      },
    }));

  const w = {
    form,
    user,
    isAdmin,
    suggestions,
    catalogue,
    err: (key) => errors[key],
    // Errors reported for a whole list (e.g. "profile.expertise" or "profile.expertise.3").
    listErr: (prefix) => {
      const key = Object.keys(errors).find(
        (k) =>
          errors[k] &&
          (k === prefix ||
            (k.startsWith(`${prefix}.`) && k.split(".").length === 3)),
      );
      return key ? errors[key] : undefined;
    },
    text: (key, errorKey = `profile.${key}`) => ({
      value: form[key],
      onChange: (event) => setValue(key, event.target.value, errorKey),
      error: errors[errorKey],
    }),
    setValue,
    setValues,
    item: (name, index, key) => ({
      value: form[name][index][key],
      onChange: (event) => setItem(name, index, key, event.target.value),
      error: errors[`profile.${name}.${index}.${key}`],
    }),
    setItem,
    list: (name) => ({
      items: form[name],
      max: LIST_LIMITS[name],
      openKey: openEntries[name] ?? null,
      onOpenChange: (key) =>
        setOpenEntries((open) => ({ ...open, [name]: key })),
      onAdd: () => {
        const entry = BLANK[name]();
        setForm((f) => ({ ...f, [name]: [...f[name], entry] }));
        setOpenEntries((open) => ({ ...open, [name]: entry.key }));
      },
      onRemove: (index) => {
        setForm((f) => ({
          ...f,
          [name]: f[name].filter((_, i) => i !== index),
        }));
        // Indexes shift after a removal, so stale per-entry errors are dropped.
        setErrors((e) =>
          Object.fromEntries(
            Object.entries(e).filter(
              ([key]) => !key.startsWith(`profile.${name}.`),
            ),
          ),
        );
      },
      hasError: (index) => hasErrorUnder(`profile.${name}.${index}.`),
      error: errors[`profile.${name}`],
    }),
    setVisibility,
    setSection,
  };

  /* ── Navigation and focus ── */
  function focusFirstError() {
    window.setTimeout(() => {
      const scope = panel.current;
      if (!scope) return;
      const invalid = scope.querySelector('[aria-invalid="true"]');
      const target = invalid || scope.querySelector("[data-wizard-message]");
      if (!target) return;
      target.scrollIntoView({ block: "center" });
      if (invalid) invalid.focus({ preventScroll: true });
    }, 80);
  }

  // Runs when a step's panel has mounted (after the previous one has left).
  function handlePanelShown() {
    const mode = pendingFocus.current;
    pendingFocus.current = null;
    if (mode === "error") focusFirstError();
    else if (mode === "heading" && panel.current) {
      const heading = panel.current.querySelector("[data-step-heading]");
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  function show(target, focus = "heading") {
    pendingFocus.current = focus;
    if (focus !== "error") setMessage("");
    setDirection(target >= step ? 1 : -1);
    setStep(target);
    setMaxReached((reached) => Math.max(reached, target));
    setResumeNote(false);
    // Bring the top of the wizard back into view if it has scrolled away.
    if (top.current && top.current.getBoundingClientRect().top < 72)
      top.current.scrollIntoView({ block: "start" });
  }

  function fail(text, index, aboutFields = true) {
    setMessage(text);
    setMessageNeedsErrors(aboutFields);
    if (index !== step) show(index, "error");
    else focusFirstError();
  }

  function validateSteps(indexes) {
    const found = {};
    let firstInvalid = -1;
    for (const index of indexes) {
      const stepErrors = validateStep(form, STEPS[index].id, checks);
      if (Object.keys(stepErrors).length && firstInvalid < 0)
        firstInvalid = index;
      Object.assign(found, stepErrors);
    }
    // Replace the previous messages of the steps that were just checked.
    setErrors((prev) => ({
      ...Object.fromEntries(
        Object.entries(prev).filter(
          ([key]) => !indexes.includes(stepOfErrorKey(key)),
        ),
      ),
      ...found,
    }));
    return firstInvalid;
  }

  /* ── Saving ── */
  async function run(kind, task) {
    if (lock.current) return; // blocks double clicks and repeated submissions
    lock.current = true;
    setBusy(kind);
    try {
      await task();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function persist(ids, extra) {
    const sent = form;
    const { data } = await api.patch("/doctors/me", {
      ...mergeSlices(payload, ids),
      ...extra,
    });
    setUser(data);
    if (ids.includes("expertise")) {
      // The API tidies typed specialties ("spine surgery" → "Spine Surgery"): show them as stored.
      setForm((f) => adoptStored(f, sent, data));
      setSaved((prev) => ({
        ...prev,
        ...snapshot(toPayload(adoptStored(sent, sent, data)), ids),
      }));
    } else {
      setSaved((prev) => ({ ...prev, ...snapshot(payload, ids) }));
    }
    return data;
  }

  // A failed request never clears the form: the entries stay exactly as typed.
  function handleFailure(error) {
    const parsed = formErrors(error);
    const fieldErrors = parsed.fieldErrors || {};
    setErrors((prev) => ({ ...prev, ...fieldErrors }));
    const indexes = Object.keys(fieldErrors)
      .map(stepOfErrorKey)
      .filter((index) => index >= 0);
    fail(
      parsed.message,
      indexes.length ? Math.min(...indexes) : step,
      indexes.length > 0,
    );
  }

  const looseErrors = (id) =>
    validateStep(form, id, { ...checks, strict: false });

  function advance(target) {
    return run("next", async () => {
      const between = [];
      for (let index = step; index < target; index += 1) between.push(index);
      const firstInvalid = validateSteps(between);
      if (firstInvalid >= 0) {
        fail(
          "Please check the highlighted fields before continuing.",
          firstInvalid,
        );
        return;
      }
      setMessage("");
      // Save what changed. A step visited earlier that still has a problem is left for later.
      const ids = dirtyIds.filter(
        (id) => Object.keys(looseErrors(id)).length === 0,
      );
      if (ids.length) {
        try {
          await persist(ids, { wizardStep: Math.max(target, maxReached) });
        } catch (error) {
          handleFailure(error);
          return;
        }
      }
      show(target);
    });
  }

  function saveProgress() {
    return run("save", async () => {
      const blocked = dirtyIds.filter(
        (id) => Object.keys(looseErrors(id)).length > 0,
      );
      if (blocked.length) {
        setErrors((prev) =>
          Object.assign({ ...prev }, ...blocked.map(looseErrors)),
        );
        fail(
          "Some entries need attention before your progress can be saved.",
          Math.min(...blocked.map(stepIndex)),
        );
        return;
      }
      const position = Math.max(step, maxReached);
      if (!dirtyIds.length && position === completion.resumeStep) {
        toast.info("Everything is already saved.");
        return;
      }
      try {
        await persist(dirtyIds, { wizardStep: position });
        setMessage("");
        toast.success("Progress saved. You can leave and continue later.");
      } catch (error) {
        handleFailure(error);
      }
    });
  }

  function submit() {
    return run("submit", async () => {
      const firstInvalid = validateSteps(STEPS.map((_, index) => index));
      if (firstInvalid >= 0) {
        fail(
          "Please complete the highlighted fields before submitting.",
          firstInvalid,
        );
        return;
      }
      setMessage("");
      try {
        // Everything is sent again so the API validates the whole profile once more.
        await persist(ownedSteps, { wizardStep: LAST_STEP, submit: true });
        setDone({ updated: profileComplete });
      } catch (error) {
        handleFailure(error);
      }
    });
  }

  const select = (index) => {
    if (index === step || busy) return;
    if (index < step) show(index);
    else advance(index);
  };

  /* ── Derived view state ── */
  const errorCounts = countErrorsByStep(errors);
  const reached = profileComplete ? STEPS.length : maxReached;
  const statuses = STEPS.map((_, index) =>
    errorCounts[index] > 0
      ? "error"
      : index === step
        ? "current"
        : index < reached
          ? "complete"
          : "upcoming",
  );
  const completedSteps = STEPS.filter(
    (_, index) => index < reached && errorCounts[index] === 0,
  ).length;
  const percent = Math.round((completedSteps / STEPS.length) * 100);

  // A "check the highlighted fields" banner disappears as soon as nothing on the step is highlighted.
  const banner =
    message && (!messageNeedsErrors || errorCounts[step] > 0) ? message : "";

  const current = STEPS[step];
  const StepBody = STEP_COMPONENTS[current.id];
  const isLast = step === LAST_STEP;
  const photoUrl = (user.profile && user.profile.photoUrl) || "";
  const navProps = {
    steps: STEPS,
    current: step,
    statuses,
    errorCounts,
    percent,
    onSelect: select,
    disabled: Boolean(busy),
  };

  return (
    <div ref={root} className="space-y-6">
      <header
        data-wizard-enter
        className="card relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7"
      >
        <div
          className="pointer-events-none absolute inset-0 hidden sm:block"
          aria-hidden="true"
        >
          <span
            data-wizard-orb
            className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-brand/15 blur-3xl"
          />
          <span
            data-wizard-orb
            className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-leaf/15 blur-3xl"
          />
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Professional profile</p>
            <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-fg">
              {profileComplete
                ? "Edit your professional profile"
                : "Complete your professional profile"}
            </h1>
            <p className="mt-2 text-fg-soft">
              Short steps, one topic at a time. Only the fields marked{" "}
              <span className="font-semibold text-danger" aria-hidden="true">
                *
              </span>
              <span className="sr-only">with an asterisk</span> are required —
              save your progress and come back whenever you like.
            </p>
          </div>
          <Button
            href={`/doctors/${user.id}`}
            variant="secondary"
            icon={Eye}
            className="w-fit shrink-0"
          >
            View my portfolio
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside
          data-wizard-enter
          className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
        >
          <ProfilePeek form={form} photoUrl={photoUrl} />
          <StepSidebar {...navProps} completed={completedSteps} />
        </aside>

        <div
          data-wizard-enter
          ref={top}
          className="min-w-0 scroll-mt-24 space-y-4"
        >
          <div className="lg:hidden">
            <StepStrip {...navProps} />
          </div>

          {resumeNote && (
            <FormMessage tone="info">
              Welcome back — you are continuing from step {step + 1}. Everything
              you saved earlier is still here.
            </FormMessage>
          )}

          {/* Not a <form>: the gallery step opens the memory and blog forms inside it, and forms cannot nest. */}
          <div data-wizard-form>
            <section
              className="card p-5 sm:p-7"
              aria-labelledby="wizard-step-title"
            >
              <div ref={panel}>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <StepPanel
                    key={current.id}
                    direction={direction}
                    onShown={handlePanelShown}
                  >
                    <div className="border-b border-line pb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="eyebrow">
                          Step {step + 1} of {STEPS.length}
                        </p>
                        {current.optional && <Badge>Optional step</Badge>}
                      </div>
                      <h2
                        id="wizard-step-title"
                        data-step-heading
                        tabIndex={-1}
                        className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-fg outline-none"
                      >
                        {current.title}
                      </h2>
                      <p className="mt-1.5 text-sm text-muted">
                        {current.description}
                      </p>
                    </div>

                    <AnimatePresence initial={false}>
                      {banner && (
                        <motion.div
                          key={banner}
                          data-wizard-message
                          initial={{ opacity: 0, y: -6 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            x: [0, -5, 5, -3, 3, 0],
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35 }}
                        >
                          <FormMessage>{banner}</FormMessage>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <StepBody w={w} />
                    {isLast && (
                      <ReviewStep
                        form={form}
                        problems={SUMMARY_STEPS.map((s) =>
                          Object.values(validateStep(form, s.id, checks)),
                        )}
                        onEdit={(index) => show(index)}
                      />
                    )}
                  </StepPanel>
                </AnimatePresence>
              </div>
            </section>

            <div className="glass sticky bottom-3 z-20 mt-4 flex items-center gap-2 rounded-2xl p-2.5 shadow-lift sm:gap-3 sm:p-3">
              <Button
                variant="secondary"
                icon={ArrowLeft}
                onClick={() => show(step - 1)}
                disabled={step === 0 || Boolean(busy)}
              >
                Back
              </Button>
              <p
                className="hidden flex-1 text-center text-xs text-muted sm:block"
                role="status"
              >
                {dirty ? "You have unsaved changes" : "All changes saved"}
              </p>
              <Button
                variant="ghost"
                icon={Save}
                onClick={saveProgress}
                loading={busy === "save"}
                disabled={Boolean(busy)}
                className="ml-auto sm:ml-0"
              >
                {/* One flex item, so the button gap does not split the label. */}
                <span>
                  Save<span className="hidden sm:inline"> progress</span>
                </span>
              </Button>
              {isLast ? (
                <Button
                  variant="leaf"
                  icon={Send}
                  onClick={submit}
                  loading={busy === "submit"}
                  disabled={Boolean(busy)}
                >
                  <span>
                    {profileComplete ? "Save" : "Submit"}
                    <span className="hidden sm:inline">
                      {profileComplete ? " changes" : " profile"}
                    </span>
                  </span>
                </Button>
              ) : (
                <Button
                  iconRight={ArrowRight}
                  onClick={() => advance(step + 1)}
                  loading={busy === "next"}
                  disabled={Boolean(busy)}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-lg font-bold text-fg">
          Account details
        </h2>
        <p className="mt-1 text-sm text-muted">
          These are used to sign in and cannot be changed here. Contact the
          community administrator if they need updating.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email address"
            type="email"
            value={user.email}
            readOnly
            disabled
          />
          <TextField
            label="Phone number"
            type="tel"
            value={user.phone}
            readOnly
            disabled
          />
        </div>
      </section>

      <ChangePasswordForm />

      <ConfirmDialog
        open={Boolean(pendingHref)}
        onClose={() => setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          router.push(href);
        }}
        title="Leave without saving?"
        message="You have changes on this step that have not been saved yet. If you leave now, they will be lost."
        confirmLabel="Leave page"
      />
    </div>
  );
}
