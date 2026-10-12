'use client';

import { useRef, useState } from 'react';
import { Camera, CircleAlert, Trash2, Upload } from 'lucide-react';
import { api, uploadMedia } from '@/lib/api';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

const IMAGE_TYPES = UPLOAD_LIMITS.imageAccept.split(',');

/**
 * Circular profile photo with upload / change / remove.
 *
 * The image goes to the API, which checks the real file content and stores it
 * in Cloudinary; MongoDB only keeps the resulting URLs. The photo is saved as
 * soon as it is uploaded — it is not part of the step's "Save progress".
 * The checks here are for convenience only: the server repeats all of them.
 */
export default function PhotoPicker() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null); // null = idle, 0–100 = uploading
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const photoUrl = (user && user.profile && user.profile.photoUrl) || '';
  const busy = progress !== null || removing;

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
    setProgress(0);
    let media = null;
    try {
      media = await uploadMedia('profile', file, { onProgress: setProgress });
      const { data } = await api.put('/doctors/me/photo', { mediaId: media.id });
      setUser(data);
      toast.success('Profile photo updated.');
    } catch (err) {
      setError(err.message || 'The photo could not be uploaded. Please try again.');
      // The upload was not attached to the profile: discard it.
      if (media) api.delete(`/media/${media.id}`, undefined, { silentAuth: true }).catch(() => {});
    } finally {
      setProgress(null);
    }
  }

  async function removePhoto() {
    if (busy) return;
    setError('');
    setRemoving(true);
    try {
      const { data } = await api.delete('/doctors/me/photo');
      setUser(data);
      toast.success('Profile photo removed.');
    } catch (err) {
      setError(err.message || 'The photo could not be removed. Please try again.');
    } finally {
      setRemoving(false);
    }
  }

  const choose = () => inputRef.current && inputRef.current.click();

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-bg-soft p-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        <Avatar name={user ? user.name : ''} src={photoUrl} size="2xl" className="ring-4 ring-surface shadow-soft" />
        {busy && (
          <span
            className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/80 text-sm font-bold text-fg"
            role="status"
          >
            {removing ? 'Removing…' : `${progress}%`}
          </span>
        )}
        <button
          type="button"
          onClick={choose}
          disabled={busy}
          aria-label={photoUrl ? 'Change profile photo' : 'Upload a profile photo'}
          className="absolute bottom-1 right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-brand text-brand-fg shadow-soft hover:bg-brand-strong disabled:opacity-60"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-w-0 text-center sm:text-left">
        <p className="text-sm font-semibold text-fg">
          Profile photo <span className="ml-1 text-xs font-normal text-muted">Optional</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          A clear, recent photo helps batchmates recognise you. JPG, PNG or WebP up to {UPLOAD_LIMITS.imageMb} MB. Photos are
          saved straight away.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button variant="secondary" size="sm" icon={Upload} onClick={choose} disabled={busy}>
            {photoUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {photoUrl && (
            <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={removePhoto} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
        {error && (
          <p className="mt-2 flex items-start justify-center gap-1.5 text-xs font-medium text-danger sm:justify-start" role="alert">
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
