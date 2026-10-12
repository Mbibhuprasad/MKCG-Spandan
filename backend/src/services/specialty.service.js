// Specializations and subspecializations: the predefined catalogue
// (config/specialties.js), the values doctors typed themselves, and the rules
// that keep both stored in one consistent, readable form.
const { SPECIALTIES, MEDICAL_ACRONYMS } = require('../config/specialties');
const { cleanLine } = require('../utils/text');

const keyOf = (value) => cleanLine(value).toLowerCase();

const ENTRY_BY_KEY = new Map(); // name or alias → catalogue entry
const SPECIALIZATION_TEXT = new Map(); // name or alias → its listed spelling
const SUBSPECIALTY_TEXT = new Map(); // subspecialization → its listed spelling
for (const entry of SPECIALTIES) {
  for (const label of [entry.name, ...(entry.aliases || [])]) {
    ENTRY_BY_KEY.set(keyOf(label), entry);
    SPECIALIZATION_TEXT.set(keyOf(label), label);
  }
  for (const sub of entry.subspecializations) {
    if (!SUBSPECIALTY_TEXT.has(keyOf(sub))) SUBSPECIALTY_TEXT.set(keyOf(sub), sub);
  }
}

const ACRONYMS = new Set(MEDICAL_ACRONYMS);
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

// One word, or one side of a hyphen or slash.
function casePart(part, { first, shouting }) {
  if (!/[A-Za-z]/.test(part)) return part;
  const lower = part.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, '');
  if (ACRONYMS.has(letters)) return part.toUpperCase();
  if (!first && lower === letters && SMALL_WORDS.has(letters)) return lower;
  if (shouting) {
    // In an all-capitals entry a short word without a vowel is an abbreviation ("TMJ").
    if (letters.length <= 4 && !/[aeiou]/.test(letters)) return part;
  } else if (/[A-Z]/.test(part.replace(/^[^A-Za-z]*[A-Za-z]/, ''))) {
    return part; // capitals inside the word were typed on purpose: "MCh", "LASIK", "IgA"
  }
  return lower.replace(/[a-z]/, (c) => c.toUpperCase());
}

/**
 * Tidies a typed specialty into Title Case: "spine surgery" → "Spine Surgery",
 * "head AND neck surgery" → "Head and Neck Surgery".
 * Capitals that carry meaning are kept: known abbreviations ("ent" → "ENT"),
 * and any word typed with capitals after its first letter ("MCh", "LASIK").
 * Text typed entirely in capitals is treated as ordinary words.
 */
function displayCase(value) {
  const text = cleanLine(value);
  const letters = text.replace(/[^A-Za-z]/g, '');
  const shouting = letters.length > 5 && letters === letters.toUpperCase();
  let first = true;
  return text
    .split(' ')
    .map((word) =>
      word
        .split(/([-/])/)
        .map((part) => {
          if (part === '-' || part === '/' || part === '') return part;
          const cased = casePart(part, { first, shouting });
          first = false;
          return cased;
        })
        .join('')
    )
    .join(' ');
}

/** The catalogue entry for a specialization, found by its name or an alias. */
const findSpecialty = (value) => ENTRY_BY_KEY.get(keyOf(value)) || null;

/** A listed option keeps its listed spelling; anything else is tidied into Title Case. */
function normalizeSpecialization(value) {
  const key = keyOf(value);
  if (!key) return '';
  return SPECIALIZATION_TEXT.get(key) || displayCase(value);
}

function normalizeSubspecialty(value) {
  const key = keyOf(value);
  if (!key) return '';
  return SUBSPECIALTY_TEXT.get(key) || displayCase(value);
}

/** Whether `subspecialty` is one of the predefined options of `specialization`. */
function isListedSubspecialty(specialization, subspecialty) {
  const entry = findSpecialty(specialization);
  const key = keyOf(subspecialty);
  return Boolean(entry && key && entry.subspecializations.some((sub) => keyOf(sub) === key));
}

const byText = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });

/**
 * The options offered by the profile form: the predefined catalogue plus the
 * values members entered themselves (`pairs`: [{ specialization, subspecialty }]).
 * A typed subspecialization is attached to the specialization it was saved
 * with, so the two stay related. `q` filters by name, alias or subspecialization.
 */
function buildCatalogue(pairs = [], q = '') {
  const entries = new Map(); // key of the name → output entry
  const subKeys = new Map(); // output entry → keys of its subspecializations
  const add = (entry, sub) => {
    const key = keyOf(sub);
    if (!key || subKeys.get(entry).has(key)) return;
    subKeys.get(entry).add(key);
    entry.subspecializations.push(sub);
  };
  const open = (name, aliases, custom) => {
    const entry = { name, aliases: [...aliases], subspecializations: [], custom };
    entries.set(keyOf(name), entry);
    subKeys.set(entry, new Set());
    return entry;
  };

  for (const seed of SPECIALTIES) {
    const entry = open(seed.name, seed.aliases || [], false);
    for (const sub of seed.subspecializations) add(entry, sub);
  }
  for (const pair of pairs) {
    const name = cleanLine(pair.specialization);
    if (!name) continue;
    const seed = findSpecialty(name);
    const entry = entries.get(keyOf(seed ? seed.name : name)) || open(name, [], true);
    add(entry, cleanLine(pair.subspecialty));
  }

  const needle = keyOf(q);
  return [...entries.values()]
    .filter((entry) => !needle || [entry.name, ...entry.aliases, ...entry.subspecializations].some((text) => keyOf(text).includes(needle)))
    .map((entry) => ({ ...entry, subspecializations: [...entry.subspecializations].sort(byText) }))
    .sort((a, b) => byText(a.name, b.name));
}

module.exports = {
  displayCase,
  findSpecialty,
  normalizeSpecialization,
  normalizeSubspecialty,
  isListedSubspecialty,
  buildCatalogue,
};
