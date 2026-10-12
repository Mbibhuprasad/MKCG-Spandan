const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, registerDoctor, createAdmin } = require('./helpers/harness');

const ctx = setupTestApp();

const fullProfile = {
  professionalTitle: 'Consultant Cardiologist',
  specialization: 'Cardiology',
  subspecialty: 'Interventional Cardiology',
  designation: 'Senior Consultant',
  hospital: 'City Heart Institute',
  city: 'Bhubaneswar',
  state: 'Odisha',
  batchYear: 1998,
  yearsOfExperience: 22,
  bio: 'Cardiologist with an interest in preventive care and teaching.',
  qualifications: ['MBBS', 'MD', 'DM'],
  interests: ['Preventive cardiology'],
  languages: ['Odia', 'English', 'Hindi'],
  education: [{ degree: 'MBBS', institution: 'Medical College', year: 2003 }],
  experience: [{ role: 'Senior Consultant', organization: 'City Heart Institute', city: 'Bhubaneswar', startYear: 2015, current: true }],
  achievements: [{ title: 'Best Teacher Award', year: 2019 }],
  publications: [{ title: 'Outcomes in primary PCI', journal: 'Heart Journal', year: 2020, url: 'https://example.org/paper' }],
  links: [{ label: 'Website', url: 'https://example.org' }],
};

describe('doctor profile', () => {
  test('an incomplete profile does not block the dashboard, and the prompt can be skipped', async () => {
    const doctor = await registerDoctor(ctx.app);
    const summary = await doctor.get('/api/v1/dashboard/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.profileCompletion.isComplete).toBe(false);
    expect(summary.body.data.profileCompletion.missing.length).toBeGreaterThan(0);

    expect((await doctor.get('/api/v1/posts')).status).toBe(200);
    expect((await doctor.get('/api/v1/doctors')).status).toBe(200);

    const skipped = await doctor.patch('/api/v1/doctors/me', { dismissProfilePrompt: true });
    expect(skipped.status).toBe(200);
    expect(skipped.body.data.profilePromptDismissed).toBe(true);
  });

  test('a doctor can complete and edit their own profile', async () => {
    const doctor = await registerDoctor(ctx.app);
    const saved = await doctor.patch('/api/v1/doctors/me', { name: 'Dr Ananya Mishra', profile: fullProfile });
    expect(saved.status).toBe(200);
    expect(saved.body.data.name).toBe('Dr Ananya Mishra');
    expect(saved.body.data.profile).toMatchObject({ specialization: 'Cardiology', city: 'Bhubaneswar', yearsOfExperience: 22 });
    expect(saved.body.data.profile.education).toHaveLength(1);
    expect(saved.body.data.profileCompletion.percent).toBeGreaterThanOrEqual(70);
    expect(saved.body.data.profileCompletion.isComplete).toBe(true);

    // Partial edit leaves the other fields untouched.
    const edited = await doctor.patch('/api/v1/doctors/me', { profile: { hospital: 'Lakeview Hospital' } });
    expect(edited.body.data.profile.hospital).toBe('Lakeview Hospital');
    expect(edited.body.data.profile.specialization).toBe('Cardiology');
    expect(edited.body.data.profile.publications).toHaveLength(1);

    const stored = await User.findById(doctor.user.id);
    expect(stored.profile.hospital).toBe('Lakeview Hospital');
  });

  test('profile updates cannot change role, status, email, phone or the featured flag', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await doctor.patch('/api/v1/doctors/me', {
      role: 'ADMIN',
      status: 'SUSPENDED',
      featured: true,
      email: 'hijack@example.com',
      phone: '+911111111111',
      passwordHash: 'x',
      profile: { city: 'Cuttack', photo: { url: 'https://evil.example/x.png' } },
    });
    expect(res.status).toBe(200);
    const stored = await User.findById(doctor.user.id);
    expect(stored.role).toBe('DOCTOR');
    expect(stored.status).toBe('ACTIVE');
    expect(stored.featured).toBe(false);
    expect(stored.email).toBe(doctor.credentials.email);
    expect(stored.profile.city).toBe('Cuttack');
    expect(stored.profile.photo.url).toBe('');
  });

  test('rejects invalid profile data, including unsafe links', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await doctor.patch('/api/v1/doctors/me', {
      profile: {
        yearsOfExperience: 400,
        links: [{ label: 'Site', url: 'javascript:alert(1)' }],
        education: [{ degree: '' }],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details).join(' ')).toMatch(/links/);
  });
});

describe('directory and portfolio', () => {
  let viewer;
  let cardio;
  let neuro;
  let hidden;

  beforeAll(async () => {
    viewer = await registerDoctor(ctx.app, { name: 'Dr Viewer Person' });
    cardio = await registerDoctor(ctx.app, { name: 'Dr Meera Cardio' });
    await cardio.patch('/api/v1/doctors/me', { profile: { ...fullProfile, city: 'Berhampur' } });
    neuro = await registerDoctor(ctx.app, { name: 'Dr Rohan Neuro' });
    await neuro.patch('/api/v1/doctors/me', { profile: { specialization: 'Neurology', city: 'Cuttack', hospital: 'Neuro Centre' } });
    hidden = await registerDoctor(ctx.app, { name: 'Dr Hidden Member' });
    await hidden.patch('/api/v1/doctors/me', { profile: { specialization: 'Neurology', city: 'Cuttack' }, visibility: { directory: false } });
  });

  test('the directory requires authentication', async () => {
    expect((await request(ctx.app).get('/api/v1/doctors')).status).toBe(401);
    expect((await request(ctx.app).get(`/api/v1/doctors/${cardio.user.id}`)).status).toBe(401);
  });

  test('search by name and filters by specialization and city work on real records', async () => {
    const byName = await viewer.get('/api/v1/doctors?q=meera');
    expect(byName.body.data.map((d) => d.name)).toEqual(['Dr Meera Cardio']);

    const bySpec = await viewer.get('/api/v1/doctors?specialization=Neurology');
    expect(bySpec.body.data.map((d) => d.name)).toEqual(['Dr Rohan Neuro']); // hidden doctor excluded

    const byCity = await viewer.get('/api/v1/doctors?city=berhampur'); // case-insensitive
    expect(byCity.body.data.map((d) => d.name)).toEqual(['Dr Meera Cardio']);

    const combined = await viewer.get('/api/v1/doctors?specialization=Cardiology&city=Cuttack');
    expect(combined.body.data).toHaveLength(0);

    const filters = await viewer.get('/api/v1/doctors/filters');
    expect(filters.body.data.specializations).toEqual(expect.arrayContaining(['Cardiology', 'Neurology']));
    expect(filters.body.data.cities).toEqual(expect.arrayContaining(['Berhampur', 'Cuttack']));

    // Regex metacharacters are treated as text, not as a pattern.
    const odd = await viewer.get(`/api/v1/doctors?q=${encodeURIComponent('(.*')}`);
    expect(odd.status).toBe(200);
    expect(odd.body.data).toHaveLength(0);
  });

  test('paginates with safe limits', async () => {
    const page1 = await viewer.get('/api/v1/doctors?limit=2&page=1');
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(page1.body.meta.total).toBeGreaterThanOrEqual(3);
    expect((await viewer.get('/api/v1/doctors?limit=5000')).status).toBe(400);
  });

  test('directory cards never include contact details', async () => {
    const res = await viewer.get('/api/v1/doctors');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(cardio.credentials.email);
    expect(text).not.toContain('passwordHash');
    for (const card of res.body.data) {
      expect(card.email).toBeUndefined();
      expect(card.phone).toBeUndefined();
    }
  });

  test('portfolio pages come from the database and respect contact visibility', async () => {
    const hiddenContact = await viewer.get(`/api/v1/doctors/${cardio.user.id}`);
    expect(hiddenContact.status).toBe(200);
    expect(hiddenContact.body.data.profile.hospital).toBe('City Heart Institute');
    expect(hiddenContact.body.data.profile.education[0].degree).toBe('MBBS');
    expect(hiddenContact.body.data.contact).toEqual({});
    expect(hiddenContact.body.data.visibility).toBeUndefined();

    await cardio.patch('/api/v1/doctors/me', { visibility: { showEmail: true } });
    const emailOnly = await viewer.get(`/api/v1/doctors/${cardio.user.id}`);
    expect(emailOnly.body.data.contact).toEqual({ email: cardio.credentials.email });

    // The owner always sees their own details.
    const own = await cardio.get(`/api/v1/doctors/${cardio.user.id}`);
    expect(own.body.data.isMine).toBe(true);
    expect(own.body.data.contact.phone).toBeDefined();
  });

  test('a doctor hidden from the directory only exposes a name card to other members', async () => {
    const res = await viewer.get(`/api/v1/doctors/${hidden.user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.limited).toBe(true);
    expect(res.body.data.contact).toEqual({});
    expect(res.body.data.profile.city).toBeUndefined();
    expect(res.body.data.profile.bio).toBeUndefined();
  });

  test('unknown and malformed ids return 404 / 400', async () => {
    expect((await viewer.get('/api/v1/doctors/64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
    expect((await viewer.get('/api/v1/doctors/not-an-id')).status).toBe(400);
  });

  test('public featured doctors need both the doctor’s consent and an admin decision', async () => {
    const admin = await createAdmin(ctx.app);
    const publicList = () => request(ctx.app).get('/api/v1/doctors/featured');

    expect((await publicList()).body.data).toHaveLength(0);

    // Admin features the doctor, but the doctor has not consented yet.
    await admin.patch(`/api/v1/admin/doctors/${cardio.user.id}/visibility`, { featured: true });
    expect((await publicList()).body.data).toHaveLength(0);

    await cardio.patch('/api/v1/doctors/me', { visibility: { publicListing: true } });
    const listed = await publicList();
    expect(listed.body.data).toHaveLength(1);
    expect(Object.keys(listed.body.data[0]).sort()).toEqual(['city', 'id', 'name', 'photoUrl', 'professionalTitle', 'specialization']);
    expect(JSON.stringify(listed.body)).not.toContain(cardio.credentials.email);

    // Consent alone (without the admin flag) is not enough either.
    await neuro.patch('/api/v1/doctors/me', { visibility: { publicListing: true } });
    expect((await publicList()).body.data).toHaveLength(1);
  });
});
