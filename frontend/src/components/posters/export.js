// Turns a rendered poster into a PNG or a PDF in the browser.
//
// The poster is drawn by the browser from the saved poster data with the same
// HTML/CSS as the preview (html-to-image copies the DOM into an SVG
// <foreignObject> and paints it onto a canvas). Nothing is uploaded: the file
// goes straight from memory to the doctor's device.
import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import { POSTER_HEIGHT, POSTER_WIDTH, PHOTO_SLOTS } from './model';

export const EXPORT_PIXEL_RATIO = 2; // 2480 × 3508 px — A4 at 300 dpi

// A4 width in PDF points; the height follows the poster's proportions (≈ A4).
const PDF_WIDTH_PT = 595.28;
const PDF_HEIGHT_PT = Math.round(((PDF_WIDTH_PT * POSTER_HEIGHT) / POSTER_WIDTH) * 100) / 100;

export class ExportError extends Error {}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function toDataUrl(url) {
  let response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  } catch {
    throw new ExportError('A photo on the poster could not be loaded. Check your connection and try again.');
  }
  if (!response.ok) throw new ExportError('A photo on the poster could not be loaded. Please re-upload it and try again.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new ExportError('A photo on the poster could not be read. Please re-upload it.');
  return blobToDataUrl(blob);
}

/**
 * Replaces every photo URL in the form with an embedded data URL, so the
 * export never depends on a second network request while drawing and a
 * missing photo is reported instead of silently left blank.
 */
export async function inlinePhotos(form) {
  const photos = { ...form.photos };
  const jobs = [];
  if (photos.portraitSource === 'PROFILE' && photos.profilePhotoUrl) {
    jobs.push(toDataUrl(photos.profilePhotoUrl).then((url) => (photos.profilePhotoUrl = url)));
  }
  for (const key of ['portrait', ...PHOTO_SLOTS.map((s) => s.key)]) {
    const media = photos[key];
    if (media && media.url && !media.url.startsWith('data:')) {
      jobs.push(toDataUrl(media.url).then((url) => (photos[key] = { ...media, url })));
    }
  }
  await Promise.all(jobs);
  return { ...form, photos };
}

async function waitForImages(node) {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        await img.decode();
      } catch {
        throw new ExportError('A photo on the poster could not be drawn. Please re-upload it and try again.');
      }
    })
  );
}

const isSafari = () =>
  typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

/** Paints the poster node (PosterCanvas root) onto a canvas at export resolution. */
export async function renderPosterCanvas(node) {
  await waitForImages(node);
  const options = {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    pixelRatio: EXPORT_PIXEL_RATIO,
    cacheBust: false,
    backgroundColor: '#ffffff',
    fontEmbedCSS: await getFontEmbedCSS(node),
  };
  // Safari sometimes paints embedded images only from the second pass.
  if (isSafari()) await toCanvas(node, options);
  const canvas = await toCanvas(node, options);
  if (!canvas || canvas.width === 0) throw new ExportError('The poster could not be drawn by this browser.');
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ExportError('The image could not be created. Your device may be low on memory.'))),
      type,
      quality
    );
  });
}

export const canvasToPng = (canvas) => canvasToBlob(canvas, 'image/png');

/* ── Minimal single-page PDF holding the poster as a full-page JPEG ───── */

function utf16Hex(text) {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i += 1) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

/**
 * Builds a PDF/1.4 file with one page of the poster's proportions (A4 width)
 * and the JPEG drawn edge to edge. The text is part of the image.
 */
export async function canvasToPdf(canvas, { title = 'Batch poster' } = {}) {
  const jpeg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', 0.93)).arrayBuffer());
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (part) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, body) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const part of body) push(part);
    push('\nendobj\n');
  };

  const w = PDF_WIDTH_PT;
  const h = PDF_HEIGHT_PT;
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ`;

  push('%PDF-1.4\n%âãÏÓ\n');
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  object(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
  ]);
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  ]);
  object(5, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
  object(6, [`<< /Title ${utf16Hex(title)} /Producer (MKCGSPANDAN Batch Poster Maker) >>`]);

  const xrefAt = length;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  for (let id = 1; id <= 6; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

/** Hands a file to the browser's download manager. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
