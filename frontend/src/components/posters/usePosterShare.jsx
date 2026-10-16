'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { saveBlob } from './export';
import { exportErrorMessage } from './usePosterExport';

const noSubscribe = () => () => {};

/** True when this browser can hand an image file to the system share sheet. */
export function canShareFiles() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], 'poster.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Sharing a saved poster through the Web Share API (phones, and desktop
 * browsers that support sharing files). The PNG is drawn exactly as for a
 * download and handed to the share sheet; nothing is uploaded anywhere.
 *
 *   const { canShare, share, dialog } = usePosterShare(preparePosterFile);
 *
 * Browsers only open the share sheet straight after a tap. Drawing the poster
 * can take longer than that allows, so when the browser refuses, a small
 * dialog asks for one more tap ("Share now").
 */
export function usePosterShare(preparePosterFile) {
  const toast = useToast();
  // False on the server and during hydration, so both renders agree.
  const canShare = useSyncExternalStore(noSubscribe, canShareFiles, () => false);
  const [pending, setPending] = useState(null); // { file, title }
  const [sharing, setSharing] = useState(false);

  const handOver = useCallback(
    async (prepared) => {
      try {
        await navigator.share({ files: [prepared.file], title: prepared.title });
        setPending(null);
        toast.success('Poster shared.');
        return 'shared';
      } catch (error) {
        if (error && error.name === 'AbortError') {
          setPending(null);
          return 'cancelled'; // the doctor closed the share sheet
        }
        if (error && error.name === 'NotAllowedError') {
          setPending(prepared);
          return 'needs-tap';
        }
        setPending(null);
        toast.error('This browser could not share the poster. Download it instead.');
        return 'failed';
      }
    },
    [toast]
  );

  /** Resolves with the saved poster when it was drawn (shared or not), else null. */
  const share = useCallback(
    async (posterId) => {
      setSharing(true);
      try {
        const prepared = await preparePosterFile(posterId);
        if (!prepared) return null;
        await handOver(prepared);
        return prepared.poster;
      } catch (error) {
        toast.error(exportErrorMessage(error));
        return null;
      } finally {
        setSharing(false);
      }
    },
    [preparePosterFile, handOver, toast]
  );

  const dialog = (
    <Modal
      open={Boolean(pending)}
      onClose={() => setPending(null)}
      title="Your poster is ready"
      description="Tap Share to choose an app or a contact."
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => {
              saveBlob(pending.file, pending.file.name);
              setPending(null);
            }}
          >
            Download instead
          </Button>
          <Button icon={Share2} onClick={() => handOver(pending)}>
            Share now
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-soft">The image is the same high-resolution PNG you would download.</p>
    </Modal>
  );

  return { canShare, share, sharing, dialog };
}
