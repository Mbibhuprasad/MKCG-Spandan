'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Play, X, TriangleAlert } from 'lucide-react';
import { api, uploadMedia } from '@/lib/api';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/format';

const IMAGE_TYPES = UPLOAD_LIMITS.imageAccept.split(',');
const VIDEO_TYPES = UPLOAD_LIMITS.videoAccept.split(',');

/**
 * Uploads images (and optionally videos) to the API, which validates the real
 * file content and stores it in Cloudinary. Controlled component:
 *
 *   const [media, setMedia] = useState([]);   // [{ id, resourceType, url, thumbUrl }]
 *   <MediaUploader purpose="post" value={media} onChange={setMedia} max={4} />
 *   …then send media.map((m) => m.id) as `mediaIds` (or the single id as coverId).
 *
 * purpose: 'profile' | 'blog' | 'post' | 'event' | 'memory' (decided by where it is used)
 * The checks here are for convenience only — the server repeats all of them.
 */
export default function MediaUploader({
  purpose,
  value = [],
  onChange,
  max = 1,
  allowVideo = false,
  label = 'Add photos',
  hint,
  onBusyChange,
  className,
}) {
  const inputRef = useRef(null);
  const [uploads, setUploads] = useState([]); // in-flight: { key, name, progress }
  const [errors, setErrors] = useState([]);

  const accept = allowVideo ? `${UPLOAD_LIMITS.imageAccept},${UPLOAD_LIMITS.videoAccept}` : UPLOAD_LIMITS.imageAccept;
  const remaining = Math.max(0, max - value.length - uploads.length);

  function validate(file) {
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !(allowVideo && isVideo)) {
      return `${file.name}: use ${allowVideo ? 'JPG, PNG, WebP, MP4, MOV or WebM' : 'JPG, PNG or WebP'} files.`;
    }
    const limitMb = isVideo ? UPLOAD_LIMITS.videoMb : UPLOAD_LIMITS.imageMb;
    if (file.size > limitMb * 1024 * 1024) return `${file.name}: larger than ${limitMb} MB.`;
    return null;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, remaining);
    if (!files.length) return;
    const problems = [];
    const accepted = [];
    for (const file of files) {
      const problem = validate(file);
      if (problem) problems.push(problem);
      else accepted.push(file);
    }
    setErrors(problems);
    if (!accepted.length) return;

    const pending = accepted.map((file, i) => ({ key: `${Date.now()}-${i}`, name: file.name, progress: 0, file }));
    setUploads((list) => [...list, ...pending]);
    if (onBusyChange) onBusyChange(true);

    const done = [];
    for (const item of pending) {
      try {
        const media = await uploadMedia(purpose, item.file, {
          onProgress: (progress) =>
            setUploads((list) => list.map((u) => (u.key === item.key ? { ...u, progress } : u))),
        });
        done.push(media);
      } catch (error) {
        problems.push(`${item.name}: ${error.message}`);
      } finally {
        setUploads((list) => list.filter((u) => u.key !== item.key));
      }
    }
    setErrors([...problems]);
    if (done.length) onChange([...value, ...done]);
    if (onBusyChange) onBusyChange(false);
  }

  function remove(media) {
    onChange(value.filter((m) => m.id !== media.id));
    // Best effort: discard the upload if it was never attached to anything.
    // (For files already attached to saved content the API refuses, which is fine.)
    api.delete(`/media/${media.id}`, undefined, { silentAuth: true }).catch(() => {});
  }

  return (
    <div className={className}>
      <div className={cn('grid gap-3', max > 1 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>
        {value.map((media) => (
          <div
            key={media.id}
            className={cn('group relative overflow-hidden rounded-xl border border-line bg-surface-2', max > 1 ? 'aspect-square' : 'aspect-video')}
          >
            <img src={media.thumbUrl || media.url} alt="Uploaded file preview" className="h-full w-full object-cover" />
            {media.resourceType === 'video' && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                <Play className="h-7 w-7 fill-current" aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(media)}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85"
              aria-label="Remove this file"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}

        {uploads.map((upload) => (
          <div
            key={upload.key}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3 text-center',
              max > 1 ? 'aspect-square' : 'aspect-video'
            )}
            role="status"
          >
            <p className="w-full truncate text-xs text-muted">{upload.name}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${upload.progress}%` }} />
            </div>
            <p className="text-xs font-semibold text-fg-soft">Uploading {upload.progress}%</p>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current && inputRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong p-4 text-center text-fg-soft',
              'hover:border-brand hover:bg-brand-soft/50 hover:text-brand-ink',
              max > 1 ? 'aspect-square' : 'aspect-video'
            )}
          >
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-[0.7rem] leading-tight text-muted">
              {hint ||
                (allowVideo
                  ? `Photos up to ${UPLOAD_LIMITS.imageMb} MB, videos up to ${UPLOAD_LIMITS.videoMb} MB`
                  : `JPG, PNG or WebP up to ${UPLOAD_LIMITS.imageMb} MB`)}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={max > 1}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {errors.length > 0 && (
        <ul className="mt-2 space-y-1" role="alert">
          {errors.map((message, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs font-medium text-danger">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
