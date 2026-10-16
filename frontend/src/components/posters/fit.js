// Text fitting for the poster templates.
//
// Every region that holds variable-length text is marked `data-fit="<name>"`
// and has a fixed or maximum size with `overflow: hidden`. Its font sizes are
// written as calc(Npx * var(--fit)). For each region we find the largest --fit
// between `data-fit-min` and 1 at which nothing overflows. If even the minimum
// overflows, the region is reported so the editor can ask the doctor to
// shorten the text — the poster is never exported with clipped words.

// Regions above the body change how much room the body gets, so they go first.
// Regions nested inside another region (contacts in the Modern rail) go first too.
const ORDER = { college: 1, name: 2, contact: 3, identity: 4, quote: 4, rail: 6, story: 8, body: 9 };

// Compares the layout boxes of the region's children with the region itself.
// (scrollHeight is not usable: script and display faces draw beyond their
// line boxes, which counts as overflow even when the text plainly fits.)
// Rects are divided by the preview's scale, so the result is the same at any zoom.
// The scale is measured along the element's longer side: offsetWidth/Height are
// whole pixels, and on a one-line region (≈19px tall) the rounding alone made a
// full-width line look 2% too wide.
function overflows(el) {
  const box = el.getBoundingClientRect();
  const wide = el.offsetWidth >= el.offsetHeight;
  const size = wide ? el.offsetWidth : el.offsetHeight;
  const scale = size ? (wide ? box.width : box.height) / size : 1;
  if (!scale) return false;
  let bottom = 0;
  let right = 0;
  for (const child of el.children) {
    const r = child.getBoundingClientRect();
    bottom = Math.max(bottom, (r.bottom - box.top) / scale);
    right = Math.max(right, (r.right - box.left) / scale);
  }
  return bottom > el.clientHeight + 1 || right > el.clientWidth + 1;
}

function fitRegion(el) {
  const min = Number(el.dataset.fitMin) || 0.6;
  const apply = (value) => el.style.setProperty('--fit', String(value));

  apply(1);
  if (!overflows(el)) return { fit: 1, overflow: false };

  apply(min);
  if (overflows(el)) return { fit: min, overflow: true };

  let lo = min; // fits
  let hi = 1; // overflows
  for (let i = 0; i < 8; i += 1) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (overflows(el)) hi = mid;
    else lo = mid;
  }
  const fit = Math.floor(lo * 1000) / 1000;
  apply(fit);
  return { fit, overflow: false };
}

/**
 * Fits every region of a rendered poster. Returns
 * { overflow: boolean, regions: { body: { fit, overflow }, … } }, or null
 * when the poster is not laid out (display: none) and cannot be measured.
 */
export function fitPoster(root) {
  if (!root || !root.isConnected || root.clientHeight === 0) return null;
  const result = { overflow: false, regions: {} };
  const regions = Array.from(root.querySelectorAll('[data-fit]')).sort(
    (a, b) => (ORDER[a.dataset.fit] || 5) - (ORDER[b.dataset.fit] || 5)
  );
  for (const el of regions) {
    const region = fitRegion(el);
    result.regions[el.dataset.fit] = region;
    if (region.overflow) result.overflow = true;
  }
  return result;
}

const REGION_LABELS = {
  college: 'the college name',
  name: 'the name',
  contact: 'the contact details',
  body: 'the messages',
  rail: 'the qualifications and personal details',
  identity: 'the name and professional details',
  story: 'the memories and timeline',
  quote: 'the quotation',
};

/** Human description of what does not fit, for the editor. */
export function overflowMessage(fit) {
  if (!fit || !fit.overflow) return '';
  const parts = Object.entries(fit.regions)
    .filter(([, r]) => r.overflow)
    .map(([key]) => REGION_LABELS[key] || key);
  return `Some text is too long for this template (${parts.join(', ')}). Shorten it, switch off a section or remove a photo so nothing is cut off.`;
}
