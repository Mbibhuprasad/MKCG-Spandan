'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  Save,
  Share2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, plural, timeAgo } from '@/lib/format';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Badge, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { FormMessage } from '@/components/ui/Form';
import {
  STEPS,
  TEMPLATES,
  applyPrefill,
  blankForm,
  errorsByStep,
  fromPoster,
  prefillFromProfile,
  stepOfErrorKey,
  templateById,
  toPayload,
  validateForm,
} from './model';
import { overflowMessage } from './fit';
import { STEP_COMPONENTS } from './steps';
import PosterPreview from './PosterPreview';
import { exportErrorMessage, usePosterExport } from './usePosterExport';
import { usePosterShare } from './usePosterShare';

const AUTOSAVE_DELAY = 2500;
const REQUIRED_LABELS = { 'basic.displayName': 'display name', 'basic.batchYear': 'batch year', 'basic.college': 'college name' };

function setIn(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setIn(obj[head] || {}, rest.join('.'), value) };
}

const payloadKey = (form) => JSON.stringify(toPayload(form));

const photoIds = (form) =>
  ['portrait', 'family', 'college', 'memory'].map((k) => form.photos[k] && form.photos[k].id).filter(Boolean);

function SaveIndicator({ state, savedAt }) {
  const map = {
    saving: { icon: LoaderCircle, text: 'Saving…', className: 'text-muted', spin: true },
    saved: { icon: CircleCheck, text: savedAt ? `Saved ${timeAgo(savedAt)}` : 'All changes saved', className: 'text-leaf-strong' },
    dirty: { icon: Save, text: 'Unsaved changes', className: 'text-muted' },
    invalid: { icon: TriangleAlert, text: 'Fix the highlighted fields to save', className: 'text-warn' },
    error: { icon: CloudOff, text: 'Not saved — check your connection', className: 'text-danger' },
    new: { icon: FileText, text: 'Not saved yet', className: 'text-muted' },
  };
  const item = map[state] || map.new;
  return (
    <p role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', item.className)}>
      <item.icon className={cn('h-3.5 w-3.5', item.spin && 'animate-spin')} aria-hidden="true" />
      {item.text}
    </p>
  );
}

function Stepper({ step, onSelect, counts }) {
  const percent = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <nav aria-label="Poster steps" className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="eyebrow">
          Step {step + 1} of {STEPS.length}
        </p>
        <p className="text-xs font-semibold text-fg-soft">{STEPS[step].title}</p>
      </div>
      <div
        role="progressbar"
        aria-label="Poster steps"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mb-3 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-leaf transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <ol className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const active = i === step;
          const errorCount = counts[i];
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.short}${errorCount ? ` — ${plural(errorCount, 'field')} to check` : ''}`}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-2 pr-3.5 text-sm font-semibold transition-colors',
                  active ? 'border-brand/30 bg-brand-soft text-brand-ink' : 'border-transparent text-fg-soft hover:bg-surface-2'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    errorCount ? 'bg-danger-soft text-danger' : active ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted'
                  )}
                  aria-hidden="true"
                >
                  {errorCount ? '!' : i + 1}
                </span>
                {s.short}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Create or edit a batch poster (/dashboard/posters/new, /dashboard/posters/[id]).
 *
 *  • New posters start from the doctor's profile (GET /doctors/me); nothing is
 *    written to the profile.
 *  • Changes are saved automatically a moment after typing stops (POST once,
 *    then PATCH). Saves are queued so they reach the server in order.
 *  • "Save finished poster" asks the API to mark it READY (it checks the
 *    required fields); downloads are drawn from the saved poster.
 */
export default function PosterEditor({ posterId = null, initialTemplate = null }) {
  const { user } = useAuth();
  const toast = useToast();
  const reduceMotion = useReducedMotion();

  const [load, setLoad] = useState({ state: 'loading', error: null });
  const [form, setForm] = useState(null);
  const [prefill, setPrefill] = useState({});
  const [id, setId] = useState(posterId);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  // Outcome of the last save attempt; what is shown also depends on `dirty`.
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | invalid | error
  const [savedAt, setSavedAt] = useState(null);
  const [message, setMessage] = useState(null); // { tone, text }
  const [fit, setFit] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [savedKey, setSavedKey] = useState('');
  const savedPhotoIds = useRef(new Set());
  const queue = useRef(Promise.resolve());
  const idRef = useRef(posterId);
  const formRef = useRef(null);
  useEffect(() => {
    formRef.current = form;
  });

  const { exportPoster, preparePosterFile, exporting, phaseLabel, stage } = usePosterExport();
  const { canShare, share, sharing, dialog: shareDialog } = usePosterShare(preparePosterFile);

  /* ── Loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, poster] = await Promise.all([
          api.get('/doctors/me').then((r) => r.data),
          posterId ? api.get(`/posters/${posterId}`).then((r) => r.data) : null,
        ]);
        if (cancelled) return;
        const fromProfile = prefillFromProfile(me);
        let initial;
        if (poster) {
          initial = fromPoster(poster);
          savedPhotoIds.current = new Set(photoIds(initial));
          setSavedAt(poster.updatedAt);
        } else {
          // A template picked in the gallery (/dashboard/posters/new?template=…).
          const start = TEMPLATES.some((t) => t.id === initialTemplate) ? initialTemplate : undefined;
          initial = applyPrefill(blankForm(start), fromProfile, ['basic', 'professional', 'contact', 'photos']);
        }
        setSavedKey(payloadKey(initial));
        setPrefill(fromProfile);
        setForm(initial);
        setLoad({ state: 'ready', error: null });
      } catch (error) {
        if (!cancelled) setLoad({ state: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [posterId, initialTemplate]);

  // The preview may lag a keystroke behind so typing stays smooth. On the
  // first render after loading the deferred value is still null.
  const deferredForm = useDeferredValue(form) || form;
  const key = useMemo(() => (form ? payloadKey(form) : ''), [form]);
  const dirty = Boolean(form) && key !== savedKey;
  const liveErrors = useMemo(() => (form ? validateForm(form) : {}), [form]);
  const blocking = Object.keys(liveErrors).length > 0;
  const missing = useMemo(
    () => (form ? Object.keys(validateForm(form, { complete: true })).filter((k) => REQUIRED_LABELS[k]).map((k) => REQUIRED_LABELS[k]) : []),
    [form]
  );
  const fitMessage = overflowMessage(fit);

  /* ── Saving ── */
  const persist = useCallback(
    ({ status, quiet = false } = {}) => {
      const run = async () => {
        const current = formRef.current;
        const problems = validateForm(current, { complete: status === 'READY' });
        if (Object.keys(problems).length) {
          setErrors(problems);
          setSaveState('invalid');
          if (!quiet) {
            const first = Object.keys(problems)[0];
            setStep(stepOfErrorKey(first));
            setMessage({ tone: 'error', text: 'Please check the highlighted fields.' });
          }
          return null;
        }
        const body = toPayload(current, { status });
        const sentKey = payloadKey(current);
        setSaveState('saving');
        try {
          const { data } = idRef.current
            ? await api.patch(`/posters/${idRef.current}`, body)
            : await api.post('/posters', body);
          if (!idRef.current) {
            idRef.current = data.id;
            setId(data.id);
            // Keep the editor mounted: only the address changes.
            window.history.replaceState(null, '', `/dashboard/posters/${data.id}`);
          }
          setSavedKey(sentKey);
          savedPhotoIds.current = new Set(
            ['portrait', 'family', 'college', 'memory'].map((k) => data.photos[k] && data.photos[k].id).filter(Boolean)
          );
          setForm((f) => ({ ...f, status: data.status }));
          setSavedAt(data.updatedAt);
          setErrors({});
          setSaveState('saved');
          return data;
        } catch (error) {
          if (error && error.code === 'VALIDATION_ERROR' && error.details) {
            setErrors(error.details);
            setSaveState('invalid');
            if (!quiet) {
              setStep(stepOfErrorKey(Object.keys(error.details)[0]));
              setMessage({ tone: 'error', text: error.message });
            }
          } else {
            setSaveState('error');
            if (!quiet) setMessage({ tone: 'error', text: error.message || 'The poster could not be saved. Please try again.' });
          }
          return null;
        }
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => null);
      return next;
    },
    []
  );

  // Autosave shortly after the doctor stops typing.
  useEffect(() => {
    if (load.state !== 'ready' || !dirty || uploading) return undefined;
    if (blocking) {
      // Nothing invalid is sent; once typing pauses, show what needs fixing.
      const timer = setTimeout(() => {
        setErrors((e) => ({ ...liveErrors, ...e }));
        setSaveState('invalid');
      }, AUTOSAVE_DELAY);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => persist({ quiet: true }), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [key, dirty, blocking, liveErrors, uploading, load.state, persist]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty && saveState !== 'saving') return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saveState]);

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

  const setTemplate = useCallback((templateId) => {
    setForm((f) => {
      const t = templateById(templateId);
      const palette = t.palettes.some((p) => p.id === f.settings.palette) ? f.settings.palette : t.palettes[0].id;
      return { ...f, template: templateId, settings: { ...f.settings, palette } };
    });
  }, []);

  // A replaced photo that was never saved with the poster is discarded at once
  // (saved ones are removed by the API when the poster is saved).
  const onPhoto = useCallback(
    (slot, media) => {
      const previous = formRef.current.photos[slot];
      if (previous && previous.id && !savedPhotoIds.current.has(previous.id) && (!media || media.id !== previous.id)) {
        api.delete(`/media/${previous.id}`, undefined, { silentAuth: true }).catch(() => {});
      }
      update(`photos.${slot}`, media);
    },
    [update]
  );

  const onBusyChange = useCallback((busy) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1))), []);

  const onRefill = useCallback(
    (groups) => {
      setForm((f) => applyPrefill(f, prefill, groups));
      toast.info('Filled in from your profile.');
    },
    [prefill, toast]
  );

  /* ── Navigation ── */
  const goToStep = useCallback((index) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, index)));
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  function next() {
    const stepErrors = Object.fromEntries(Object.entries(liveErrors).filter(([k]) => stepOfErrorKey(k) === step));
    if (Object.keys(stepErrors).length) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setMessage({ tone: 'error', text: 'Please check the highlighted fields before continuing.' });
      return;
    }
    if (dirty && !uploading) persist({ quiet: true });
    goToStep(step + 1);
  }

  async function saveDraft() {
    const data = await persist({});
    if (data) toast.success('Draft saved.');
  }

  async function finish() {
    setFinishing(true);
    try {
      const data = await persist({ status: 'READY' });
      if (data) {
        setMessage({
          tone: 'success',
          text: fitMessage ? 'Poster saved. Shorten the text that does not fit before downloading it.' : 'Poster saved. You can download it now.',
        });
        toast.success('Poster saved.');
        setShowPreview(true);
      }
    } finally {
      setFinishing(false);
    }
  }

  async function download(format) {
    setMessage(null);
    try {
      if (dirty) {
        const saved = await persist({});
        if (!saved) return;
      }
      await queue.current;
      const saved = await exportPoster(idRef.current, format);
      if (saved) toast.success(format === 'pdf' ? 'PDF downloaded.' : 'PNG downloaded.');
    } catch (error) {
      setMessage({ tone: 'error', text: exportErrorMessage(error) });
    }
  }

  // Shares the saved poster (unsaved edits are saved first, as for a download).
  async function shareSaved() {
    setMessage(null);
    if (dirty) {
      const saved = await persist({});
      if (!saved) return;
    }
    await queue.current;
    await share(idRef.current);
  }

  /* ── Render ── */
  if (user && user.role !== 'DOCTOR') {
    return <ErrorState title="Batch posters are for doctor accounts" message="Sign in with a doctor account to create a poster." />;
  }
  if (load.state === 'loading') return <PageLoader label="Opening the poster maker…" />;
  if (load.state === 'error') {
    const notFound = load.error && (load.error.status === 404 || load.error.status === 400);
    return (
      <ErrorState
        title={notFound ? 'Poster not found' : 'The poster could not be opened'}
        message={notFound ? 'It may have been deleted. Your other posters are in My posters.' : load.error.message}
        onRetry={notFound ? undefined : () => window.location.reload()}
      />
    );
  }

  // Length problems show while typing; other checks once the doctor pauses,
  // continues or saves (see the autosave effect and `next`).
  const shownErrors = { ...errors };
  for (const [k, v] of Object.entries(liveErrors)) if (!shownErrors[k] && v.startsWith('Please keep this')) shownErrors[k] = v;
  const counts = errorsByStep(shownErrors);
  const StepComponent = STEP_COMPONENTS[step];
  const isLast = step === STEPS.length - 1;
  const ready = form.status === 'READY';
  const canDownload = Boolean(id) && ready && missing.length === 0 && !fitMessage && !blocking && !uploading;
  const downloadHint = !id || !ready ? 'Save the finished poster to download it.' : fitMessage ? 'Shorten the text that does not fit first.' : '';
  const template = templateById(form.template);
  let indicator = id ? 'saved' : 'new';
  if (saveState === 'saving' || uploading) indicator = 'saving';
  else if (dirty) indicator = saveState === 'invalid' || saveState === 'error' ? saveState : 'dirty';

  const preview = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg">Live preview</p>
          <p className="truncate text-xs text-muted">{template.name}</p>
        </div>
        <Badge tone={ready ? 'leaf' : 'neutral'}>{ready ? 'Finished' : 'Draft'}</Badge>
      </div>
      <PosterPreview data={deferredForm} onFit={setFit} label="Live poster preview" />
      {fitMessage ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warn" role="status">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {fitMessage}
        </p>
      ) : (
        <p className="text-xs text-muted">This preview is exactly what you download. PNG is 2480 × 3508 px; PDF is one A4 page.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="sm" icon={Download} onClick={() => download('png')} disabled={!canDownload || exporting}>
          PNG
        </Button>
        <Button variant="secondary" size="sm" icon={Download} onClick={() => download('pdf')} disabled={!canDownload || exporting}>
          PDF
        </Button>
        {canShare && (
          <Button variant="secondary" size="sm" icon={Share2} onClick={shareSaved} disabled={!canDownload || exporting} loading={sharing} className="col-span-2">
            Share
          </Button>
        )}
      </div>
      {exporting ? (
        <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {phaseLabel}
        </p>
      ) : (
        downloadHint && <p className="text-xs text-muted">{downloadHint}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {stage}
      {shareDialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard/posters" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My posters
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-fg">{id ? 'Edit my batch poster' : 'Create my batch poster'}</h1>
        </div>
        <SaveIndicator state={indicator} savedAt={indicator === 'saved' ? savedAt : null} />
      </div>

      <div className="lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          icon={showPreview ? EyeOff : Eye}
          onClick={() => setShowPreview((v) => !v)}
          aria-expanded={showPreview}
          aria-controls="poster-preview"
        >
          {showPreview ? 'Hide preview' : 'Show preview and download'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        {/* One preview for every screen size. Collapsed on small screens it is
            made invisible rather than removed, so it keeps being measured and
            the "does everything fit" check stays accurate. */}
        <aside
          id="poster-preview"
          aria-label="Poster preview"
          className={cn('min-w-0 lg:order-2', !showPreview && 'max-lg:invisible max-lg:h-0 max-lg:overflow-hidden')}
        >
          <div className="card p-4 lg:sticky lg:top-24">{preview}</div>
        </aside>

        <div className="min-w-0 space-y-5 lg:order-1">
          <Stepper step={step} onSelect={goToStep} counts={counts} />


          <section className="card p-5 sm:p-6" aria-labelledby="poster-step-title">
            <header className="mb-5">
              <h2 id="poster-step-title" className="text-xl font-bold text-fg">
                {STEPS[step].title}
              </h2>
              <p className="mt-1 text-sm text-muted">{STEPS[step].description}</p>
            </header>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={STEPS[step].id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
                exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
              >
                <StepComponent
                  form={form}
                  errors={shownErrors}
                  update={update}
                  setTemplate={setTemplate}
                  onPhoto={onPhoto}
                  onBusyChange={onBusyChange}
                  onRefill={onRefill}
                  goToStep={goToStep}
                  fitMessage={fitMessage}
                  missing={missing}
                />
              </motion.div>
            </AnimatePresence>

            {message && (
              <div className="mt-5">
                <FormMessage tone={message.tone}>{message.text}</FormMessage>
              </div>
            )}

            <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(step - 1)} disabled={step === 0}>
                  Back
                </Button>
                <Button variant="secondary" icon={Save} onClick={saveDraft} loading={saveState === 'saving' && !finishing} disabled={Boolean(uploading)}>
                  Save draft
                </Button>
              </div>
              {isLast ? (
                <Button variant="leaf" icon={CircleCheck} onClick={finish} loading={finishing} disabled={Boolean(uploading)}>
                  Save finished poster
                </Button>
              ) : (
                <Button iconRight={ArrowRight} onClick={next}>
                  Continue
                </Button>
              )}
            </footer>
          </section>
        </div>

      </div>
    </div>
  );
}
