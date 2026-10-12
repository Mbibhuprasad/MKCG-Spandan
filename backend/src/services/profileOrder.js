// Display order of the repeated profile sections, and the figures derived from
// them. Everything here works on copies: the profile is stored — and edited in
// the profile form — in the order the doctor entered it.

// Higher = shown first. Entries of the same rank are ordered by completion year.
const LEVEL_RANK = {
  SUPER_SPECIALITY: 6,
  DOCTORATE: 6,
  POSTGRADUATE: 5,
  DIPLOMA: 4,
  OTHER: 3,
  UNDERGRADUATE: 2,
  HIGHER_SECONDARY: 1,
  SECONDARY: 0,
};

// When no level was chosen, a well-known degree title still tells the level.
// Checked from the highest level down; "HSC" is the 12th in some states and
// the 10th in others, so it ranks as school education and the year decides.
const DEGREE_HINTS = [
  [/\b(dm|mch|drnb)\b/, 'SUPER_SPECIALITY'],
  [/\bphd\b|doctor of philosophy/, 'DOCTORATE'],
  [/\b(md|ms|dnb|mds|mph|msc|mha|mba)\b|\bmaster/, 'POSTGRADUATE'],
  [/diploma|\b(pgd\w*|dch|dgo|dlo|dmrd|ddvl|dtcd)\b/, 'DIPLOMA'],
  [/\b(mbbs|bds|bams|bhms|bsc|bpt|bpharm)\b|\bbachelor/, 'UNDERGRADUATE'],
  [/\+\s*2|\b(12th|xii|hsc|chse|puc)\b|class\s*12\b|higher secondary|senior secondary|intermediate|pre-?university/, 'HIGHER_SECONDARY'],
  [/\b(10th|x|ssc|sslc)\b|class\s*10\b|matric|secondary|high school/, 'SECONDARY'],
];

function educationRank(entry) {
  if (entry.level && entry.level in LEVEL_RANK) return LEVEL_RANK[entry.level];
  const degree = String(entry.degree || '')
    .toLowerCase()
    .replace(/\./g, '');
  const hint = DEGREE_HINTS.find(([pattern]) => pattern.test(degree));
  return hint ? LEVEL_RANK[hint[1]] : LEVEL_RANK.OTHER;
}

const yearOf = (value) => (Number.isFinite(value) ? value : -Infinity); // undated entries go last

// Sorts a copy by the given keys (each higher-first); ties keep the saved order.
function ordered(list, ...keys) {
  return (list || [])
    .map((item, index) => ({ item, index, values: keys.map((key) => key(item)) }))
    .sort((a, b) => {
      for (let i = 0; i < keys.length; i += 1) {
        if (a.values[i] !== b.values[i]) return a.values[i] > b.values[i] ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/** Highest level first, then the most recent completion year. */
const sortEducation = (list) => ordered(list, educationRank, (e) => yearOf(e.year));

/** Current positions first, then the most recently held. */
const sortExperience = (list) =>
  ordered(
    list,
    (e) => (e.current ? 1 : 0),
    (e) => yearOf(e.current ? e.startYear : (e.endYear ?? e.startYear)),
    (e) => yearOf(e.startYear)
  );

/** Most recent completion year first. */
const sortFellowships = (list) => ordered(list, (f) => yearOf(f.endYear ?? f.startYear), (f) => yearOf(f.startYear));

const sortByYear = (list) => ordered(list, (item) => yearOf(item.year));

/** Current memberships first, then the most recent. */
const sortMemberships = (list) =>
  ordered(
    list,
    (m) => (m.current ? 1 : 0),
    (m) => yearOf(m.current ? m.startYear : (m.endYear ?? m.startYear))
  );

/** A copy of a serialized profile with its repeated sections in display order. */
function orderProfile(profile) {
  return {
    ...profile,
    education: sortEducation(profile.education),
    credentials: sortByYear(profile.credentials),
    experience: sortExperience(profile.experience),
    fellowships: sortFellowships(profile.fellowships),
    achievements: sortByYear(profile.achievements),
    memberships: sortMemberships(profile.memberships),
    publications: sortByYear(profile.publications),
  };
}

/**
 * Years in practice, counted from the dated positions the doctor entered:
 * overlapping positions are counted once and gaps are left out. `null` when no
 * position has both a start and an end (or "current") — nothing is estimated.
 */
function experienceSummary(experience, thisYear = new Date().getFullYear()) {
  const spans = (experience || [])
    .map((e) => [e.startYear, e.current ? thisYear : e.endYear])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end >= start)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return { years: null, since: null };
  let years = 0;
  let [from, to] = spans[0];
  for (const [start, end] of spans.slice(1)) {
    if (start <= to) {
      to = Math.max(to, end);
    } else {
      years += to - from;
      [from, to] = [start, end];
    }
  }
  years += to - from;
  return { years, since: spans[0][0] };
}

module.exports = {
  educationRank,
  sortEducation,
  sortExperience,
  sortFellowships,
  sortMemberships,
  sortByYear,
  orderProfile,
  experienceSummary,
};
