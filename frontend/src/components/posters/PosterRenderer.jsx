'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TEMPLATES, posterFileName } from './model';
import { ensurePosterFonts } from './fonts';
import { overflowMessage } from './fit';
import { ExportError, canvasToPdf, canvasToPng, inlinePhotos } from './export';
import { ExportStage, exportErrorMessage } from './usePosterExport';
import PosterPreview from './PosterPreview';

// Bridge version: bump when the message format changes (the app checks it).
const BRIDGE_VERSION = 1;
// Exported files travel to the app as base64 in pieces of this many characters
// (a multiple of 4, so each piece decodes on its own when appended to a file).
const CHUNK = 256 * 1024;

const post = (message) => {
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
};

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function waitForImages(root) {
  const images = Array.from((root && root.querySelectorAll('img')) || []);
  const results = await Promise.allSettled(images.map((img) => img.decode()));
  return results.filter((r) => r.status === 'rejected').length;
}

/**
 * Draws posters for the MKCGSPANDAN Android app (/poster-renderer, opened in a
 * WebView). The app sends the poster it loaded from the API (with the owner's
 * bearer token); this page renders it with the very same templates, fitting and
 * export code as the website editor, and returns the preview state or the
 * finished PNG / PDF. It never calls the API itself and stores nothing: data
 * arrives in memory from the app and the file goes straight back to it.
 *
 * Messages from the app (window.mkcgPosterBridge.receive):
 *   { type: 'preview', form }                         form = editor form shape (model.js)
 *   { type: 'export', requestId, form, format, title } format = 'png' | 'pdf'
 * Messages to the app (window.ReactNativeWebView.postMessage, JSON):
 *   ready · fit · previewed · export-phase · file-start · file-chunk · file-end · error
 */
export default function PosterRenderer() {
  const [embedded, setEmbedded] = useState(null);
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null);
  const previewRoot = useRef(null);
  const busy = useRef(false);

  const runExport = useCallback(async ({ requestId, form, format, title }) => {
    if (busy.current) {
      post({ type: 'error', requestId, message: 'Another file is still being prepared. Please wait a moment.' });
      return;
    }
    busy.current = true;
    try {
      post({ type: 'export-phase', requestId, phase: 'drawing' });
      await ensurePosterFonts();
      const inlined = await inlinePhotos(form);
      const canvas = await new Promise((resolve, reject) => {
        setJob({ id: requestId, data: inlined, onDone: ({ canvas: painted, error }) => (error ? reject(error) : resolve(painted)) });
      });
      setJob(null);
      post({ type: 'export-phase', requestId, phase: 'saving' });
      const blob = format === 'pdf' ? await canvasToPdf(canvas, { title: title || 'Batch poster' }) : await canvasToPng(canvas);
      const size = { width: canvas.width, height: canvas.height };
      canvas.width = 0;
      canvas.height = 0;
      const base64 = await blobToBase64(blob);
      const chunks = Math.ceil(base64.length / CHUNK);
      post({
        type: 'file-start',
        requestId,
        mimeType: format === 'pdf' ? 'application/pdf' : 'image/png',
        filename: posterFileName(form, format),
        bytes: blob.size,
        chunks,
        ...size,
      });
      for (let index = 0; index < chunks; index += 1) {
        post({ type: 'file-chunk', requestId, index, data: base64.slice(index * CHUNK, (index + 1) * CHUNK) });
        await pause();
      }
      post({ type: 'file-end', requestId });
    } catch (error) {
      setJob(null);
      post({ type: 'error', requestId, message: error instanceof ExportError ? error.message : exportErrorMessage(error) });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const inApp = Boolean(window.ReactNativeWebView);
    // Known only in the browser: decides between the app view and the notice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmbedded(inApp);
    window.mkcgPosterBridge = {
      receive(message) {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'preview' && message.form) setPreview({ form: message.form, at: Date.now() });
        else if (message.type === 'export' && message.form) runExport(message);
      },
    };
    post({ type: 'ready', version: BRIDGE_VERSION, templates: TEMPLATES.map((t) => t.id) });
    return () => {
      delete window.mkcgPosterBridge;
    };
  }, [runExport]);

  // After the preview is drawn: report photos that failed and the final height.
  useEffect(() => {
    if (!preview) return undefined;
    let cancelled = false;
    (async () => {
      await ensurePosterFonts();
      const failed = await waitForImages(previewRoot.current);
      if (!cancelled) {
        post({ type: 'previewed', failedImages: failed, height: previewRoot.current ? previewRoot.current.scrollHeight : 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const onFit = useCallback((fit) => {
    post({ type: 'fit', overflow: Boolean(fit && fit.overflow), message: overflowMessage(fit) });
  }, []);

  return (
    // Covers the site's header and footer: inside the app only the poster shows.
    <div className="fixed inset-0 z-[200] overflow-auto bg-[#e9edf3]">
      {embedded === false && (
        <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-[#475569]">
          This page draws batch posters for the MKCGSPANDAN app. Open your posters from the website dashboard instead.
        </div>
      )}
      {preview && (
        <div ref={previewRoot} className="p-0">
          <PosterPreview data={preview.form} onFit={onFit} label="Poster preview" className="[&>div]:rounded-none [&>div]:shadow-none [&>div]:ring-0" />
        </div>
      )}
      {job && <ExportStage key={job.id} data={job.data} onDone={job.onDone} />}
    </div>
  );
}
