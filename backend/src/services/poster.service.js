const Poster = require('../models/Poster');
const ApiError = require('../utils/ApiError');
const { POSTER_TEMPLATES, POSTER_STATUS, POSTER_SECTIONS } = require('../config/constants');
const { serializeMedia, syncMedia, unclaim, destroyMedia } = require('./media.service');

const PHOTO_SLOTS = Object.freeze(['portrait', 'family', 'college', 'memory']);
const POPULATE = PHOTO_SLOTS.map((slot) => ({ path: `photos.${slot}` }));
const DEFAULT_TEMPLATE = 'classic-tribute';

// Fields every finished (READY) poster needs. Drafts may leave them empty.
const REQUIRED = Object.freeze([
  ['basic.displayName', (p) => Boolean(p.basic && p.basic.displayName), 'Enter the name to print on the poster.'],
  ['basic.batchYear', (p) => Boolean(p.basic && p.basic.batchYear), 'Enter your batch year.'],
  ['basic.college', (p) => Boolean(p.basic && p.basic.college), 'Enter your college name.'],
]);

function missingRequired(poster) {
  const details = {};
  for (const [key, present, message] of REQUIRED) if (!present(poster)) details[key] = message;
  return details;
}

const defaultPalette = (template) => POSTER_TEMPLATES[template].palettes[0];

const idOf = (ref) => (ref ? String(ref._id || ref) : null);

// A media reference is only serialised once populated (it then carries a publicId).
const photoOf = (ref) => (ref && ref.publicId ? serializeMedia(ref) : null);

function contactOf(item) {
  return { value: (item && item.value) || '', include: Boolean(item && item.include) };
}

// The full poster, for its owner only. `owner` is the signed-in user (the
// owner), whose current profile photo is offered as the portrait.
function serializePoster(poster, owner) {
  const b = poster.basic || {};
  const pr = poster.professional || {};
  const m = poster.messages || {};
  const c = poster.celebration || {};
  const ct = poster.contact || {};
  const ph = poster.photos || {};
  const s = poster.settings || {};
  const sections = s.sections || {};
  const profilePhoto = (owner && owner.profile && owner.profile.photo) || {};
  return {
    id: String(poster._id),
    title: poster.title || '',
    template: poster.template,
    templateVersion: poster.templateVersion,
    status: poster.status,
    basic: {
      displayName: b.displayName || '',
      professionalTitle: b.professionalTitle || '',
      batchYear: b.batchYear ?? null,
      college: b.college || '',
      hometown: b.hometown || '',
      dateOfBirth: b.dateOfBirth || '',
      showBirthYear: Boolean(b.showBirthYear),
      showZodiac: Boolean(b.showZodiac),
    },
    professional: {
      specialization: pr.specialization || '',
      workplace: pr.workplace || '',
      role: pr.role || '',
      qualifications: pr.qualifications || '',
      achievements: pr.achievements || '',
      milestones: pr.milestones || '',
    },
    messages: {
      greeting: m.greeting || '',
      introduction: m.introduction || '',
      messageToFriends: m.messageToFriends || '',
      quotation: m.quotation || '',
      quotationAuthor: m.quotationAuthor || '',
      memory: m.memory || '',
      batchMessage: m.batchMessage || '',
      closing: m.closing || '',
      signature: m.signature || '',
    },
    celebration: {
      title: c.title || '',
      years: c.years ?? null,
      eventYear: c.eventYear ?? null,
      tagline: c.tagline || '',
    },
    contact: {
      email: contactOf(ct.email),
      phone: contactOf(ct.phone),
      address: contactOf(ct.address),
      website: contactOf(ct.website),
    },
    photos: {
      portraitSource: ph.portraitSource || 'NONE',
      portrait: photoOf(ph.portrait),
      family: photoOf(ph.family),
      college: photoOf(ph.college),
      memory: photoOf(ph.memory),
      profilePhotoUrl: profilePhoto.url || '',
    },
    settings: {
      palette: s.palette || defaultPalette(poster.template),
      portraitPlacement: s.portraitPlacement || 'LEFT',
      sections: Object.fromEntries(POSTER_SECTIONS.map((key) => [key, sections[key] !== false])),
    },
    missing: Object.keys(missingRequired(poster)),
    lastExportedAt: poster.lastExportedAt || null,
    exportCount: poster.exportCount || 0,
    createdAt: poster.createdAt,
    updatedAt: poster.updatedAt,
  };
}

// One row of "My posters".
function serializePosterSummary(poster, owner) {
  const ph = poster.photos || {};
  const profilePhoto = (owner && owner.profile && owner.profile.photo) || {};
  let thumbUrl = '';
  if (ph.portraitSource === 'UPLOAD' && ph.portrait && ph.portrait.publicId) thumbUrl = serializeMedia(ph.portrait).thumbUrl;
  if (ph.portraitSource === 'PROFILE') thumbUrl = profilePhoto.thumbUrl || profilePhoto.url || '';
  return {
    id: String(poster._id),
    title: poster.title || '',
    template: poster.template,
    status: poster.status,
    palette: (poster.settings && poster.settings.palette) || defaultPalette(poster.template),
    displayName: (poster.basic && poster.basic.displayName) || '',
    batchYear: (poster.basic && poster.basic.batchYear) ?? null,
    thumbUrl,
    missing: Object.keys(missingRequired(poster)),
    lastExportedAt: poster.lastExportedAt || null,
    createdAt: poster.createdAt,
    updatedAt: poster.updatedAt,
  };
}

// Ownership check for every operation on a single poster. Another doctor's
// poster is reported as "not found", so ids cannot be probed.
async function loadOwnPoster(id, user, { populate = true } = {}) {
  const query = Poster.findOne({ _id: id, owner: user._id });
  if (populate) query.populate(POPULATE);
  const poster = await query;
  if (!poster) throw ApiError.notFound('That poster could not be found.');
  return poster;
}

const GROUPS = Object.freeze(['basic', 'professional', 'messages', 'celebration']);
const CONTACT_KEYS = Object.freeze(['email', 'phone', 'address', 'website']);

// Copies validated request fields onto the poster document. Only keys present
// in the request change; everything else is kept.
function applyContent(poster, body) {
  if (body.title !== undefined) poster.title = body.title;

  for (const group of GROUPS) {
    const values = body[group];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) poster.set(`${group}.${key}`, value);
    }
  }

  if (body.contact) {
    for (const key of CONTACT_KEYS) {
      const item = body.contact[key];
      if (!item) continue;
      if (item.value !== undefined) poster.set(`contact.${key}.value`, item.value);
      if (item.include !== undefined) poster.set(`contact.${key}.include`, item.include);
    }
  }

  if (body.settings) {
    const { palette, portraitPlacement, sections } = body.settings;
    if (portraitPlacement !== undefined) poster.set('settings.portraitPlacement', portraitPlacement);
    if (sections) {
      for (const [key, value] of Object.entries(sections)) {
        if (value !== undefined) poster.set(`settings.sections.${key}`, value);
      }
    }
    if (palette !== undefined) poster.set('settings.palette', palette);
  }

  if (body.template !== undefined) poster.template = body.template;
  const template = POSTER_TEMPLATES[poster.template];
  poster.templateVersion = template.version;

  const palette = poster.settings && poster.settings.palette;
  if (!template.palettes.includes(palette)) {
    // An explicitly chosen colour must belong to the template; after a template
    // switch an old colour simply falls back to the new template's default.
    if (body.settings && body.settings.palette !== undefined && body.settings.palette !== '') {
      throw ApiError.badRequest('Please check the highlighted fields.', {
        'settings.palette': 'Choose one of the colour variations of this template.',
      }, 'VALIDATION_ERROR');
    }
    poster.set('settings.palette', defaultPalette(poster.template));
  }
}

// DRAFT ↔ READY. A poster becomes READY only on request and only when complete;
// a READY poster whose required fields are later cleared drops back to DRAFT.
function applyStatus(poster, requested) {
  const missing = missingRequired(poster);
  const complete = Object.keys(missing).length === 0;
  if (requested === POSTER_STATUS.READY) {
    if (!complete) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Fill in the required fields before saving the finished poster.',
        missing
      );
    }
    poster.status = POSTER_STATUS.READY;
  } else if (requested === POSTER_STATUS.DRAFT) {
    poster.status = POSTER_STATUS.DRAFT;
  } else if (!complete) {
    poster.status = POSTER_STATUS.DRAFT;
  }
}

const currentPhotoIds = (poster) => PHOTO_SLOTS.map((slot) => idOf(poster.photos && poster.photos[slot])).filter(Boolean);

// Updates the poster's photo slots. New ids must be the caller's own unattached
// "poster" uploads (claimMedia enforces this); replaced uploads are returned in
// `removed` so they can be destroyed once the poster is saved.
async function applyPhotos(poster, photos, ownerId) {
  if (!photos) return { claimed: [], removed: [] };
  if (photos.portraitSource !== undefined) poster.set('photos.portraitSource', photos.portraitSource);

  const next = {};
  for (const slot of PHOTO_SLOTS) {
    const value = photos[`${slot}Id`];
    next[slot] = value === undefined ? idOf(poster.photos && poster.photos[slot]) : value;
  }
  const sync = await syncMedia({
    currentIds: currentPhotoIds(poster),
    nextIds: Object.values(next).filter(Boolean),
    ownerId,
    purpose: 'poster',
    kind: 'Poster',
    itemId: poster._id,
  });
  for (const slot of PHOTO_SLOTS) poster.set(`photos.${slot}`, next[slot]);
  return { claimed: sync.claimed, removed: sync.removed };
}

// Saves the poster; if that fails, newly claimed uploads are released again.
// Uploads that were replaced are destroyed only after a successful save.
async function savePoster(poster, { claimed, removed }) {
  try {
    await poster.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);
  await poster.populate(POPULATE);
  return poster;
}

async function deletePoster(poster) {
  const ids = currentPhotoIds(poster);
  await Poster.deleteOne({ _id: poster._id });
  await destroyMedia(ids);
}

module.exports = {
  DEFAULT_TEMPLATE,
  POPULATE,
  missingRequired,
  serializePoster,
  serializePosterSummary,
  loadOwnPoster,
  applyContent,
  applyStatus,
  applyPhotos,
  savePoster,
  deletePoster,
};
