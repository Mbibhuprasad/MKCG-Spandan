'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { POSTER_HEIGHT, POSTER_WIDTH, fromPoster, posterFileName } from './model';
import { ensurePosterFonts } from './fonts';
import { overflowMessage } from './fit';
import { ExportError, canvasToPdf, canvasToPng, inlinePhotos, renderPosterCanvas, saveBlob } from './export';
import PosterCanvas from './PosterCanvas';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Renders the poster off screen at full size, fits it and paints it. Also used
// by the app renderer (PosterRenderer.jsx).
export function ExportStage({ data, onDone }) {
  const handle = useRef(null);
  const done = useRef(onDone);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensurePosterFonts();
        await nextFrame();
        if (cancelled) return;
        const fit = handle.current.fit();
        if (!fit) throw new ExportError('The poster could not be laid out for export.');
        if (fit.overflow) throw new ExportError(overflowMessage(fit));
        const canvas = await renderPosterCanvas(handle.current.node);
        if (!cancelled) done.current({ canvas });
      } catch (error) {
        if (!cancelled) done.current({ error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: -POSTER_WIDTH * 4,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <PosterCanvas ref={handle} data={data} label="Poster being exported" />
    </div>,
    document.body
  );
}

const PHASES = {
  authorising: 'Checking the saved poster…',
  drawing: 'Drawing the poster…',
  saving: 'Preparing the file…',
};

/**
 * Downloads a saved poster as PNG or PDF.
 *
 *   const { exportPoster, exporting, phase, stage } = usePosterExport();
 *   …render {stage} somewhere in the component…
 *   await exportPoster(id, 'png');
 *
 * The API first confirms the poster belongs to the doctor and is finished,
 * and returns the saved version, which is what gets drawn — never unsaved edits.
 */
export function usePosterExport() {
  const [job, setJob] = useState(null);
  const [phase, setPhase] = useState('');
  const running = useRef(false);

  // Draws the saved poster and returns { blob, filename, title, poster }.
  const render = useCallback(async (posterId, format) => {
    if (running.current) return null;
    running.current = true;
    try {
      setPhase('authorising');
      const { data } = await api.post(`/posters/${posterId}/export`, { format });
      const form = fromPoster(data.poster);
      const inlined = await inlinePhotos(form);

      setPhase('drawing');
      const canvas = await new Promise((resolve, reject) => {
        setJob({
          id: Date.now(),
          data: inlined,
          onDone: ({ canvas: painted, error }) => (error ? reject(error) : resolve(painted)),
        });
      });
      setJob(null);

      setPhase('saving');
      const title = [form.basic.displayName, form.title].filter(Boolean).join(' — ') || 'Batch poster';
      const blob = format === 'pdf' ? await canvasToPdf(canvas, { title }) : await canvasToPng(canvas);
      // Release the large canvas buffer straight away (matters on phones).
      canvas.width = 0;
      canvas.height = 0;
      return { blob, filename: posterFileName(form, format), title, poster: data.poster };
    } finally {
      setJob(null);
      setPhase('');
      running.current = false;
    }
  }, []);

  /** Downloads the poster; resolves with the saved poster (or null if busy). */
  const exportPoster = useCallback(
    async (posterId, format) => {
      const result = await render(posterId, format);
      if (!result) return null;
      saveBlob(result.blob, result.filename);
      return result.poster;
    },
    [render]
  );

  /** Prepares the PNG as a File for the Web Share API: { file, title, poster } (or null if busy). */
  const preparePosterFile = useCallback(
    async (posterId) => {
      const result = await render(posterId, 'png');
      if (!result) return null;
      const file = new File([result.blob], result.filename, { type: 'image/png' });
      return { file, title: result.title, poster: result.poster };
    },
    [render]
  );

  const stage = job ? <ExportStage key={job.id} data={job.data} onDone={job.onDone} /> : null;

  return { exportPoster, preparePosterFile, exporting: Boolean(phase), phase, phaseLabel: PHASES[phase] || '', stage };
}

/** Friendly message for any export failure. */
export function exportErrorMessage(error) {
  if (error instanceof ExportError) return error.message;
  if (error && error.code === 'POSTER_NOT_READY') return 'Finish the poster and save it before downloading it.';
  if (error && error.message && error.status) return error.message;
  return 'The poster could not be exported in this browser. Please try again, or use a recent version of Chrome, Edge, Firefox or Safari.';
}
