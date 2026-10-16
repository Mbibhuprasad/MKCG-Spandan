'use client';

import { useId, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { uploadMedia } from '@/lib/api';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/format';
import Button from '@/components/ui/Button';

const IMAGE_TYPES = UPLOAD_LIMITS.imageAccept.split(',');

/**
 * One poster photograph. Files go to the API as private "poster" uploads (the
 * server re-checks type and size and stores them in Cloudinary); the poster
 * keeps only the returned upload id. The checks here are for quick feedback.
 */
export default function PhotoSlot({ label, hint, media, onChange, onBusyChange, disabled, round = false }) {
  const inputRef = useRef(null);
  const labelId = useId();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const busy = progress !== null;

  function setBusy(value) {
    setProgress(value);
    if (onBusyChange) onBusyChange(value !== null);
  }

  async function handleFile(file) {
    if (!file || busy) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > UPLOAD_LIMITS.imageMb * 1024 * 1024) {
      setError(`That image is larger than ${UPLOAD_LIMITS.imageMb} MB.`);
      return;
    }
    setError('');
    setBusy(0);
    try {
      const uploaded = await uploadMedia('poster', file, { onProgress: (p) => setProgress(p) });
      onChange(uploaded);
    } catch (err) {
      setError(err.message || 'The photo could not be uploaded. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const choose = () => inputRef.current && inputRef.current.click();
  const preview = media ? media.thumbUrl || media.url : '';

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-soft p-4 sm:flex-row sm:items-center">
      <div
        className={cn(
          'relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden border border-line-strong bg-surface text-muted',
          round ? 'rounded-full' : 'rounded-xl'
        )}
      >
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" aria-hidden="true" />}
        {busy && (
          <span role="status" className="absolute inset-0 flex items-center justify-center bg-surface/85 text-sm font-bold text-fg">
            {progress}%
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-sm font-semibold text-fg">
          {label} <span className="ml-1 text-xs font-normal text-muted">Optional</span>
        </p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={media ? RefreshCw : ImagePlus} onClick={choose} disabled={busy || disabled}>
            {media ? 'Replace' : 'Upload photo'}
          </Button>
          {media && (
            <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onChange(null)} disabled={busy || disabled}>
              Remove
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_LIMITS.imageAccept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          handleFile(event.target.files && event.target.files[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
