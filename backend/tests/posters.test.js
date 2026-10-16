// Low export limit, set before the app reads its configuration (see rateLimit.test.js).
process.env.RATE_LIMIT_POSTER_EXPORT_MAX = '6';

const request = require('supertest');
const cloudinaryMock = require('cloudinary');
const Media = require('../src/models/Media');
const Poster = require('../src/models/Poster');
const User = require('../src/models/User');
const { setupTestApp, registerDoctor, createAdmin, PNG, MP4 } = require('./helpers/harness');

const ctx = setupTestApp();

const COMPLETE = {
  template: 'classic-tribute',
  basic: { displayName: 'Dr Asha Rao', batchYear: 1998, college: 'MKCG Medical College' },
};

const createPoster = (client, body = COMPLETE) => client.post('/api/v1/posters', body);
const update = (client, id, body) => client.patch(`/api/v1/posters/${id}`, body);
const exportAs = (client, id, format = 'png') => client.post(`/api/v1/posters/${id}/export`, { format });

let alice;
let bob;

beforeAll(async () => {
  alice = await registerDoctor(ctx.app, { name: 'Dr Alice Batchmate' });
  bob = await registerDoctor(ctx.app);
});

beforeEach(() => cloudinaryMock.__reset());

describe('access', () => {
  test('signed-out visitors and administrators cannot use the poster maker', async () => {
    expect((await request(ctx.app).get('/api/v1/posters')).status).toBe(401);
    expect((await request(ctx.app).post('/api/v1/posters').send(COMPLETE)).status).toBe(401);

    const admin = await createAdmin(ctx.app);
    expect((await admin.get('/api/v1/posters')).status).toBe(403);
    expect((await createPoster(admin)).status).toBe(403);
  });

  test("one doctor can never read, change, export or delete another doctor's poster", async () => {
    const created = await createPoster(alice, { ...COMPLETE, status: 'READY' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect((await bob.get(`/api/v1/posters/${id}`)).status).toBe(404);
    expect((await update(bob, id, { basic: { displayName: 'Hijacked' } })).status).toBe(404);
    expect((await exportAs(bob, id)).status).toBe(404);
    expect((await bob.delete(`/api/v1/posters/${id}`)).status).toBe(404);

    const bobsList = await bob.get('/api/v1/posters');
    expect(bobsList.body.data.map((p) => p.id)).not.toContain(id);

    const stored = await Poster.findById(id).lean();
    expect(stored.basic.displayName).toBe('Dr Asha Rao');
  });

  test('malformed ids are rejected', async () => {
    expect((await alice.get('/api/v1/posters/not-an-id')).status).toBe(400);
  });
});

describe('drafts', () => {
  test('a draft can be saved incomplete, reopened unchanged, and becomes READY only when complete', async () => {
    const draft = await createPoster(alice, {
      template: 'silver-jubilee',
      basic: { displayName: 'Dr Asha Rao' },
      messages: { greeting: 'Dear friends,', messageToFriends: 'Line one\nLine two — ॐ नमः, ଶୁଭେଚ୍ଛା, café ✨' },
    });
    expect(draft.status).toBe(201);
    expect(draft.body.data).toMatchObject({
      status: 'DRAFT',
      template: 'silver-jubilee',
      templateVersion: 1,
      settings: { palette: 'navy', portraitPlacement: 'LEFT' },
    });
    expect(draft.body.data.missing).toEqual(['basic.batchYear', 'basic.college']);

    const id = draft.body.data.id;
    const reopened = await alice.get(`/api/v1/posters/${id}`);
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.messages.messageToFriends).toBe('Line one\nLine two — ॐ नमः, ଶୁଭେଚ୍ଛା, café ✨');
    expect(reopened.body.data.messages.greeting).toBe('Dear friends,');

    const refused = await update(alice, id, { status: 'READY' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.details).toMatchObject({ 'basic.batchYear': expect.any(String), 'basic.college': expect.any(String) });

    const ready = await update(alice, id, { status: 'READY', basic: { batchYear: 1998, college: 'MKCG Medical College' } });
    expect(ready.status).toBe(200);
    expect(ready.body.data.status).toBe('READY');
    // Untouched fields are kept by a partial update.
    expect(ready.body.data.basic.displayName).toBe('Dr Asha Rao');
    expect(ready.body.data.messages.greeting).toBe('Dear friends,');

    // Clearing a required field turns a finished poster back into a draft.
    const cleared = await update(alice, id, { basic: { college: '' } });
    expect(cleared.body.data.status).toBe('DRAFT');
  });

  test("editing a poster never changes the doctor's profile", async () => {
    const before = await alice.get('/api/v1/doctors/me');
    const created = await createPoster(alice, {
      ...COMPLETE,
      basic: { ...COMPLETE.basic, displayName: 'Dr A. B.', hometown: 'Berhampur' },
      professional: { specialization: 'Poster-only speciality' },
    });
    expect(created.status).toBe(201);
    const after = await alice.get('/api/v1/doctors/me');
    expect(after.body.data.name).toBe(before.body.data.name);
    expect(after.body.data.profile.specialization).toBe(before.body.data.profile.specialization);
  });

  test('text is stored as plain text and lengths, dates, templates and colours are validated', async () => {
    const script = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const created = await createPoster(alice, { ...COMPLETE, messages: { introduction: script } });
    expect(created.status).toBe(201);
    // Stored verbatim as text — the web app renders it as text, never as HTML.
    expect(created.body.data.messages.introduction).toBe(script);

    const tooLong = await createPoster(alice, { ...COMPLETE, messages: { introduction: 'x'.repeat(601) } });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details['messages.introduction']).toMatch(/at most 600/);

    const badTemplate = await createPoster(alice, { ...COMPLETE, template: 'fancy' });
    expect(badTemplate.status).toBe(400);

    const badPalette = await createPoster(alice, { ...COMPLETE, settings: { palette: 'navy' } });
    expect(badPalette.status).toBe(400);
    expect(badPalette.body.error.details['settings.palette']).toBeDefined();

    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const dateOfBirth of ['1999-02-30', future, '12/05/1975']) {
      const res = await createPoster(alice, { ...COMPLETE, basic: { ...COMPLETE.basic, dateOfBirth } });
      expect(res.status).toBe(400);
    }

    const badContact = await createPoster(alice, {
      ...COMPLETE,
      contact: { email: { value: 'not-an-email', include: true }, website: { value: 'javascript:alert(1)', include: true } },
    });
    expect(badContact.status).toBe(400);
    expect(Object.keys(badContact.body.error.details)).toEqual(
      expect.arrayContaining(['contact.email.value', 'contact.website.value'])
    );

    const operator = await createPoster(alice, { ...COMPLETE, basic: { $where: '1' } });
    expect(operator.status).toBe(400);
  });

  test('all six templates can be saved with each of their own colour variations', async () => {
    const doctor = await registerDoctor(ctx.app);
    const templates = {
      'classic-tribute': ['royal', 'teal', 'rose'],
      'silver-jubilee': ['navy', 'maroon', 'emerald'],
      'modern-professional': ['navy', 'slate', 'teal'],
      'college-memories': ['vintage', 'sepia', 'sage'],
      'friends-forever': ['sky', 'sunset', 'twilight'],
      'medical-blue': ['blue', 'teal', 'indigo'],
    };
    for (const [template, palettes] of Object.entries(templates)) {
      const created = await createPoster(doctor, { ...COMPLETE, template, status: 'READY' });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ template, templateVersion: 1, status: 'READY', settings: { palette: palettes[0] } });
      for (const palette of palettes.slice(1)) {
        const recoloured = await update(doctor, created.body.data.id, { settings: { palette } });
        expect(recoloured.status).toBe(200);
        expect(recoloured.body.data.settings.palette).toBe(palette);
      }
      expect((await exportAs(doctor, created.body.data.id, 'png')).status).toBe(200);
    }

    // A colour from another template is refused.
    const wrong = await createPoster(doctor, { ...COMPLETE, template: 'modern-professional', settings: { palette: 'royal' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details['settings.palette']).toBeDefined();
  });

  test('cycling through every template keeps all entered content', async () => {
    const doctor = await registerDoctor(ctx.app);
    const content = {
      basic: { displayName: 'Dr Asha Rao', batchYear: 1998, college: 'MKCG Medical College', hometown: 'Berhampur' },
      professional: { specialization: 'Paediatrics', achievements: 'One\nTwo' },
      messages: { greeting: 'Dear friends,', quotation: 'Be kind.', memory: 'Anatomy hall at dawn.' },
      celebration: { title: 'Silver Jubilee', years: 25, eventYear: 2023 },
      contact: { phone: { value: '+91 98765 43210', include: true } },
      settings: { portraitPlacement: 'CENTER', sections: { quotation: false } },
    };
    const created = await createPoster(doctor, { ...COMPLETE, ...content, template: 'friends-forever', settings: { ...content.settings, palette: 'sunset' } });
    const id = created.body.data.id;
    let last;
    for (const template of ['modern-professional', 'college-memories', 'silver-jubilee', 'classic-tribute', 'medical-blue', 'friends-forever']) {
      last = await update(doctor, id, { template });
      expect(last.status).toBe(200);
      expect(last.body.data).toMatchObject({ template, ...content });
    }
    // Back on the first template, its colour falls back to the default (sunset was dropped on the way).
    expect(last.body.data.settings.palette).toBe('sky');
  });

  test('switching template keeps the content and moves to a valid colour', async () => {
    const created = await createPoster(alice, { ...COMPLETE, settings: { palette: 'teal' }, messages: { memory: 'Anatomy hall at dawn.' } });
    const id = created.body.data.id;
    const switched = await update(alice, id, { template: 'silver-jubilee' });
    expect(switched.body.data.settings.palette).toBe('navy');
    expect(switched.body.data.messages.memory).toBe('Anatomy hall at dawn.');
  });
});

describe('contact privacy', () => {
  test('contact details are excluded unless each one is explicitly included', async () => {
    const created = await createPoster(alice, {
      ...COMPLETE,
      contact: { email: { value: 'asha@example.com' }, phone: { value: '+91 98765 43210', include: true } },
    });
    expect(created.body.data.contact).toEqual({
      email: { value: 'asha@example.com', include: false },
      phone: { value: '+91 98765 43210', include: true },
      address: { value: '', include: false },
      website: { value: '', include: false },
    });

    // Nothing is copied from the account automatically.
    const bare = await createPoster(alice, COMPLETE);
    expect(bare.body.data.contact.email).toEqual({ value: '', include: false });
    expect(bare.body.data.contact.phone).toEqual({ value: '', include: false });
  });
});

describe('photos', () => {
  test('poster photos are private Cloudinary uploads, claimed only by their owner, and cleaned up', async () => {
    const upload = await alice.upload('poster', PNG);
    expect(upload.status).toBe(201);
    expect(cloudinaryMock.__state.uploads[0].options).toMatchObject({
      type: 'authenticated',
      folder: `mkcg-test/posters/${alice.user.id}`,
    });

    // Videos are not accepted for posters.
    expect((await alice.upload('poster', MP4, 'clip.mp4', 'video/mp4')).status).toBe(400);

    // Bob cannot attach Alice's upload to his poster.
    const stolen = await createPoster(bob, { ...COMPLETE, photos: { familyId: upload.body.data.id } });
    expect(stolen.status).toBe(400);
    expect(stolen.body.error.code).toBe('MEDIA_INVALID');

    const created = await createPoster(alice, {
      ...COMPLETE,
      photos: { portraitSource: 'UPLOAD', portraitId: upload.body.data.id },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.photos.portrait.url).toContain('/image/authenticated/s--');
    const media = await Media.findById(upload.body.data.id).lean();
    expect(media.attachedTo).toMatchObject({ kind: 'Poster' });
    expect(String(media.attachedTo.item)).toBe(id);

    // Replacing the photo destroys the old asset after the save.
    const second = await alice.upload('poster', PNG);
    const replaced = await update(alice, id, { photos: { portraitId: second.body.data.id } });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.photos.portrait.id).toBe(second.body.data.id);
    expect(await Media.findById(upload.body.data.id)).toBeNull();
    expect(cloudinaryMock.__state.destroyed).toHaveLength(1);

    // Deleting the poster removes its photos too.
    const removed = await alice.delete(`/api/v1/posters/${id}`);
    expect(removed.status).toBe(200);
    expect(await Poster.findById(id)).toBeNull();
    expect(await Media.findById(second.body.data.id)).toBeNull();
    expect((await alice.get(`/api/v1/posters/${id}`)).status).toBe(404);
  });

  test("the doctor's profile photo can be used as the portrait without uploading it again", async () => {
    const photo = await alice.upload('profile', PNG);
    await alice.put('/api/v1/doctors/me/photo', { mediaId: photo.body.data.id });
    const created = await createPoster(alice, { ...COMPLETE, photos: { portraitSource: 'PROFILE' } });
    expect(created.body.data.photos.portraitSource).toBe('PROFILE');
    expect(created.body.data.photos.profilePhotoUrl).toContain('https://res.cloudinary.com/');
    expect(created.body.data.photos.portrait).toBeNull();
  });
});

describe('export', () => {
  test('only a finished poster can be exported, and each export is recorded', async () => {
    const draft = await createPoster(alice, { basic: { displayName: 'Dr Asha Rao' } });
    const refused = await exportAs(alice, draft.body.data.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('POSTER_NOT_READY');

    const ready = await createPoster(alice, { ...COMPLETE, status: 'READY' });
    const id = ready.body.data.id;
    const exported = await exportAs(alice, id, 'pdf');
    expect(exported.status).toBe(200);
    expect(exported.body.data.format).toBe('pdf');
    expect(exported.body.data.poster).toMatchObject({ id, status: 'READY', exportCount: 1 });
    expect(exported.body.data.poster.lastExportedAt).toBeTruthy();

    expect((await exportAs(alice, id, 'gif')).status).toBe(400);
  });

  test('downloads are rate limited per doctor', async () => {
    const doctor = await registerDoctor(ctx.app);
    const ready = await createPoster(doctor, { ...COMPLETE, status: 'READY' });
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await exportAs(doctor, ready.body.data.id)).status);
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});

describe('limits and account deletion', () => {
  test("deleting a doctor removes their posters and the posters' photos", async () => {
    const leaving = await registerDoctor(ctx.app);
    const upload = await leaving.upload('poster', PNG);
    const created = await createPoster(leaving, { ...COMPLETE, photos: { familyId: upload.body.data.id } });
    expect(created.status).toBe(201);

    const admin = await createAdmin(ctx.app);
    const removed = await admin.delete(`/api/v1/admin/doctors/${leaving.user.id}`, { reason: 'Requested account removal' });
    expect(removed.status).toBe(200);
    expect(await User.findById(leaving.user.id)).toBeNull();
    expect(await Poster.countDocuments({ owner: leaving.user.id })).toBe(0);
    expect(await Media.findById(upload.body.data.id)).toBeNull();
  });

  test('a doctor can keep at most 20 posters', async () => {
    const doctor = await registerDoctor(ctx.app);
    await Poster.insertMany(Array.from({ length: 20 }, () => ({ owner: doctor.user.id, template: 'classic-tribute' })));
    const res = await createPoster(doctor);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('POSTER_LIMIT');
    const list = await doctor.get('/api/v1/posters');
    expect(list.body.data).toHaveLength(20);
  });
});
