'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Eye, FilePlus2, LayoutTemplate, LoaderCircle, Pencil, Share2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatDate, initials, timeAgo } from '@/lib/format';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Badge, CardSkeletons, EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { LIMITS, TEMPLATES, fromPoster, sampleForm, templateById } from './model';
import PosterPreview from './PosterPreview';
import { exportErrorMessage, usePosterExport } from './usePosterExport';
import { usePosterShare } from './usePosterShare';

function Cover({ poster }) {
  const template = templateById(poster.template);
  const palette = template.palettes.find((p) => p.id === poster.palette) || template.palettes[0];
  const [dark, mid, accent] = palette.swatch;
  const light = Boolean(template.light);
  return (
    <div
      className="relative flex aspect-[1240/1754] w-24 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg p-2 shadow-soft sm:w-28"
      style={{
        background: light ? `radial-gradient(circle at 15% 10%, ${mid}, #fbfaf5 60%)` : `linear-gradient(160deg, ${mid}, ${dark})`,
        boxShadow: `inset 0 0 0 3px ${accent}`,
      }}
      aria-hidden="true"
    >
      <span
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
        style={{ boxShadow: `0 0 0 2px ${accent}`, background: light ? '#fff' : dark, color: light ? dark : accent }}
      >
        {poster.thumbUrl ? <img src={poster.thumbUrl} alt="" className="h-full w-full object-cover" /> : initials(poster.displayName) || '·'}
      </span>
      <span className="line-clamp-2 text-center text-[0.6rem] font-bold leading-tight" style={{ color: light ? dark : '#fff' }}>
        {poster.displayName || 'Untitled'}
      </span>
      {poster.batchYear && (
        <span className="text-[0.55rem] font-semibold uppercase tracking-widest" style={{ color: light ? dark : accent }}>
          {poster.batchYear}
        </span>
      )}
    </div>
  );
}

const titleOf = (poster) => poster.title || poster.displayName || 'Untitled poster';

function PosterRow({ poster, onDelete, onDownload, onPreview, onShare, canShare, busy }) {
  const template = templateById(poster.template);
  const ready = poster.status === 'READY';
  const title = titleOf(poster);
  const busyHere = busy && busy.id === poster.id ? busy.action : null;
  return (
    <li className="card flex gap-4 p-4 sm:p-5">
      <Cover poster={poster} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-base font-bold text-fg">{title}</h3>
          <Badge tone={ready ? 'leaf' : 'neutral'}>{ready ? 'Finished' : 'Draft'}</Badge>
        </div>
        <p className="mt-1 text-sm text-fg-soft">{template.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          Last updated {formatDate(poster.updatedAt)} ({timeAgo(poster.updatedAt)})
          {poster.lastExportedAt ? ` · last downloaded ${formatDate(poster.lastExportedAt)}` : ''}
        </p>
        {!ready && poster.missing.length > 0 && (
          <p className="mt-1 text-xs text-warn">Still needed: {poster.missing.map((k) => k.split('.').pop().replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Button href={`/dashboard/posters/${poster.id}`} size="sm" icon={Pencil}>
            {ready ? 'Edit' : 'Continue editing'}
          </Button>
          <Button variant="secondary" size="sm" icon={Eye} onClick={() => onPreview(poster)} aria-label={`Preview ${title}`}>
            Preview
          </Button>
          {ready && (
            <>
              <Button variant="secondary" size="sm" icon={busyHere === 'png' ? LoaderCircle : Download} onClick={() => onDownload(poster, 'png')} disabled={Boolean(busy)}>
                PNG
              </Button>
              <Button variant="secondary" size="sm" icon={busyHere === 'pdf' ? LoaderCircle : Download} onClick={() => onDownload(poster, 'pdf')} disabled={Boolean(busy)}>
                PDF
              </Button>
              {canShare && (
                <Button variant="secondary" size="sm" icon={busyHere === 'share' ? LoaderCircle : Share2} onClick={() => onShare(poster)} disabled={Boolean(busy)}>
                  Share
                </Button>
              )}
            </>
          )}
          <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onDelete(poster)} aria-label={`Delete ${title}`}>
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}

// The saved poster, loaded when the dialog opens (keyed by poster id).
function PreviewBody({ summary }) {
  const [state, setState] = useState({ loading: true, error: null, form: null });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(`/posters/${summary.id}`, undefined, { signal: controller.signal })
      .then(({ data }) => setState({ loading: false, error: null, form: fromPoster(data) }))
      .catch((error) => {
        if (error && error.name === 'AbortError') return;
        setState({ loading: false, error, form: null });
      });
    return () => controller.abort();
  }, [summary.id]);

  if (state.loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Opening the poster" />
      </div>
    );
  }
  if (state.error) return <ErrorState message={state.error.status === 404 ? 'This poster no longer exists.' : state.error.message} />;
  return (
    <div className="mx-auto max-w-md">
      <PosterPreview data={state.form} label={`Preview of ${titleOf(summary)}`} />
      {summary.status !== 'READY' && (
        <p className="mt-3 text-center text-xs text-muted">This is a draft. Save it as finished in the editor to download or share it.</p>
      )}
    </div>
  );
}

/** Opens a saved poster read-only, drawn exactly as it would be downloaded. */
function PreviewDialog({ summary, onClose, onDownload, onShare, canShare, busy }) {
  const ready = summary && summary.status === 'READY';
  return (
    <Modal
      open={Boolean(summary)}
      onClose={onClose}
      title={summary ? titleOf(summary) : ''}
      description={summary ? `${templateById(summary.template).name} · ${ready ? 'Finished' : 'Draft'}` : ''}
      size="lg"
      footer={
        summary && (
          <>
            <Button href={`/dashboard/posters/${summary.id}`} variant="secondary" icon={Pencil}>
              {ready ? 'Edit' : 'Continue editing'}
            </Button>
            {ready && (
              <>
                <Button variant="secondary" icon={Download} onClick={() => onDownload(summary, 'pdf')} disabled={Boolean(busy)}>
                  PDF
                </Button>
                {canShare && (
                  <Button variant="secondary" icon={Share2} onClick={() => onShare(summary)} disabled={Boolean(busy)}>
                    Share
                  </Button>
                )}
                <Button icon={Download} onClick={() => onDownload(summary, 'png')} disabled={Boolean(busy)}>
                  PNG
                </Button>
              </>
            )}
          </>
        )
      }
    >
      {summary && <PreviewBody key={summary.id} summary={summary} />}
    </Modal>
  );
}

/** Design previews of every template, filled with labelled sample text. */
function TemplateGallery({ canCreate }) {
  const samples = useMemo(() => TEMPLATES.map((t) => ({ template: t, data: sampleForm(t.id) })), []);
  return (
    <section aria-labelledby="poster-templates">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="poster-templates" className="text-lg font-bold text-fg">
            Templates
          </h2>
          <p className="text-sm text-muted">Design previews with sample text — your own details replace every line.</p>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {samples.map(({ template, data }) => (
          <li key={template.id} className="card flex flex-col gap-3 p-3">
            <div className="relative">
              <PosterPreview data={data} label={`${template.name} design preview`} className="pointer-events-none" />
              <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                Sample
              </span>
            </div>
            <div className="flex flex-1 flex-col">
              <h3 className="text-sm font-bold text-fg">{template.name}</h3>
              <p className="mt-0.5 flex-1 text-xs leading-relaxed text-muted">{template.description}</p>
              {canCreate && (
                <Link
                  href={`/dashboard/posters/new?template=${template.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
                >
                  Use this template
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "My batch posters" (/dashboard/posters): history, preview, downloads, sharing and deletion. */
export default function PosterDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const isDoctor = Boolean(user && user.role === 'DOCTOR');
  const { data, loading, error, reload, setData } = useApi('/posters', null, { enabled: isDoctor });
  const [toDelete, setToDelete] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [busy, setBusy] = useState(null); // { id, action: 'png' | 'pdf' | 'share' }
  const { exportPoster, preparePosterFile, stage } = usePosterExport();
  const { canShare, share, dialog: shareDialog } = usePosterShare(preparePosterFile);

  if (!isDoctor) {
    return <ErrorState title="Batch posters are for doctor accounts" message="Sign in with a doctor account to create a poster." />;
  }

  const posters = data || [];
  const atLimit = posters.length >= LIMITS.perDoctor;

  const markExported = (poster, saved) =>
    setData((list) => (list || []).map((p) => (p.id === poster.id ? { ...p, lastExportedAt: saved.lastExportedAt } : p)));

  async function confirmDelete() {
    const poster = toDelete;
    try {
      await api.delete(`/posters/${poster.id}`);
      setData((list) => (list || []).filter((p) => p.id !== poster.id));
      toast.success('Poster deleted.');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message || 'The poster could not be deleted.');
    }
  }

  async function download(poster, format) {
    setBusy({ id: poster.id, action: format });
    try {
      const saved = await exportPoster(poster.id, format);
      if (saved) {
        markExported(poster, saved);
        toast.success(format === 'pdf' ? 'PDF downloaded.' : 'PNG downloaded.');
      }
    } catch (err) {
      toast.error(exportErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function shareOne(poster) {
    setBusy({ id: poster.id, action: 'share' });
    try {
      const saved = await share(poster.id);
      if (saved) markExported(poster, saved);
    } finally {
      setBusy(null);
    }
  }

  const createButton = (
    <Button href="/dashboard/posters/new" icon={FilePlus2}>
      Create My Batch Poster
    </Button>
  );

  return (
    <div className="space-y-10">
      {stage}
      {shareDialog}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Batch Profile Poster Maker</p>
          <h1 className="font-display text-3xl font-semibold text-fg">My batch posters</h1>
          <p className="mt-2 text-fg-soft">
            Turn your profile and a personal message into a poster for your Friends. Choose a template, preview it as you
            type, and download it as a print-ready PNG or PDF.
          </p>
        </div>
        {atLimit ? (
          <p className="text-sm text-warn">You have {LIMITS.perDoctor} posters — delete one to create another.</p>
        ) : (
          createButton
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-3" aria-label="How it works">
        {[
          { icon: LayoutTemplate, title: `${TEMPLATES.length} templates`, text: 'Five distinct layouts, each in three colour variations.' },
          { icon: Sparkles, title: 'Filled in for you', text: 'Your profile details are used as a starting point — the profile itself is never changed.' },
          { icon: ShieldCheck, title: 'Private by default', text: 'Only you can see your posters. Contact details appear only if you switch them on.' },
        ].map((item) => (
          <li key={item.title} className="flex gap-3 rounded-2xl border border-line bg-bg-soft p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-fg">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="poster-history">
        <h2 id="poster-history" className="mb-4 text-lg font-bold text-fg">
          My posters
        </h2>
        {loading && !data ? (
          <CardSkeletons count={2} className="grid gap-4 lg:grid-cols-2" height="h-44" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : posters.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="No posters yet"
            description="Create your first batch poster. Your profile details are filled in for you, and drafts are saved as you type."
            action={createButton}
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {posters.map((poster) => (
              <PosterRow
                key={poster.id}
                poster={poster}
                onDelete={setToDelete}
                onDownload={download}
                onPreview={setPreviewing}
                onShare={shareOne}
                canShare={canShare}
                busy={busy}
              />
            ))}
          </ul>
        )}
      </section>

      <TemplateGallery canCreate={!atLimit} />

      <PreviewDialog
        summary={previewing}
        onClose={() => setPreviewing(null)}
        onDownload={download}
        onShare={shareOne}
        canShare={canShare}
        busy={busy}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this poster?"
        confirmLabel="Delete poster"
        message={
          toDelete
            ? `“${titleOf(toDelete)}” and the photos uploaded for it will be permanently deleted. Files you already downloaded are not affected.`
            : ''
        }
      />
    </div>
  );
}
