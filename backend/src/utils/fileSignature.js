// Detects the real type of an uploaded file from its leading bytes ("magic
// numbers"). Filenames, extensions and the client-declared MIME type are never trusted.

const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'mmp4', 'M4V ', 'MSNV', 'dash', '3gp4', '3gp5',
]);

function ascii(buf, start, end) {
  return buf.subarray(start, end).toString('latin1');
}

function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'image', format: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: 'image', format: 'png', mime: 'image/png' };
  }

  // WebP: "RIFF" <size> "WEBP"
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return { kind: 'image', format: 'webp', mime: 'image/webp' };
  }

  // ISO base media (MP4 / QuickTime): <size> "ftyp" <brand>
  if (ascii(buffer, 4, 8) === 'ftyp') {
    const brand = ascii(buffer, 8, 12);
    if (brand === 'qt  ') return { kind: 'video', format: 'mov', mime: 'video/quicktime' };
    if (MP4_BRANDS.has(brand)) return { kind: 'video', format: 'mp4', mime: 'video/mp4' };
    return null; // e.g. HEIC/AVIF or unknown brands are not accepted
  }

  // WebM (EBML header + "webm" doctype within the first bytes)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    if (buffer.subarray(0, 64).includes(Buffer.from('webm'))) {
      return { kind: 'video', format: 'webm', mime: 'video/webm' };
    }
    return null;
  }

  return null;
}

const ALLOWED_FORMATS = Object.freeze({
  image: ['jpg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
});

module.exports = { detectFileType, ALLOWED_FORMATS };
