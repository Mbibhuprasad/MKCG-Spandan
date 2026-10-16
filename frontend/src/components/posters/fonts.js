import { Caveat, Cinzel, Cormorant_Garamond, Great_Vibes, Playfair_Display } from 'next/font/google';

// Poster-only typefaces, self-hosted by next/font (no request to Google at run
// time). They load only on the poster pages. Fraunces and Manrope come from the
// root layout (--font-heading / --font-body).
export const scriptFont = Great_Vibes({ weight: '400', subsets: ['latin', 'latin-ext'], variable: '--pf-script', display: 'swap' });
export const serifFont = Cormorant_Garamond({
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin', 'latin-ext'],
  variable: '--pf-serif',
  display: 'swap',
});
export const capsFont = Cinzel({ weight: ['500', '600', '700'], subsets: ['latin', 'latin-ext'], variable: '--pf-caps', display: 'swap' });

// Handwriting for the College Memories notes; an expressive display serif for Friends Forever.
export const handFont = Caveat({ weight: ['500', '700'], subsets: ['latin', 'latin-ext'], variable: '--pf-hand', display: 'swap' });
export const playfairFont = Playfair_Display({
  weight: ['500', '700', '800'],
  style: ['normal', 'italic'],
  subsets: ['latin', 'latin-ext'],
  variable: '--pf-playfair',
  display: 'swap',
});

export const posterFontClasses = `${scriptFont.variable} ${serifFont.variable} ${capsFont.variable} ${handFont.variable} ${playfairFont.variable}`;

const rootFamily = (name) =>
  typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Loads every face a poster can use, so the layout is measured (and exported)
 * with the real fonts rather than their fallbacks. Resolves even if a face
 * fails — the fallback stack is then used consistently.
 */
export async function ensurePosterFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const heading = rootFamily('--font-heading');
  const body = rootFamily('--font-body');
  const faces = [
    `400 48px ${scriptFont.style.fontFamily}`,
    `400 30px ${serifFont.style.fontFamily}`,
    `500 30px ${serifFont.style.fontFamily}`,
    `600 30px ${serifFont.style.fontFamily}`,
    `italic 400 30px ${serifFont.style.fontFamily}`,
    `italic 500 30px ${serifFont.style.fontFamily}`,
    `500 30px ${capsFont.style.fontFamily}`,
    `600 30px ${capsFont.style.fontFamily}`,
    `700 30px ${capsFont.style.fontFamily}`,
    `500 30px ${handFont.style.fontFamily}`,
    `700 30px ${handFont.style.fontFamily}`,
    `500 30px ${playfairFont.style.fontFamily}`,
    `700 30px ${playfairFont.style.fontFamily}`,
    `800 30px ${playfairFont.style.fontFamily}`,
    `italic 500 30px ${playfairFont.style.fontFamily}`,
    `italic 700 30px ${playfairFont.style.fontFamily}`,
  ];
  if (heading) faces.push(`600 60px ${heading}`);
  if (body) faces.push(`400 24px ${body}`, `600 24px ${body}`, `700 24px ${body}`, `800 24px ${body}`);
  await Promise.allSettled(faces.map((face) => document.fonts.load(face)));
  await document.fonts.ready;
}
