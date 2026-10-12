const request = require('supertest');
const User = require('../src/models/User');
const { setupTestApp, registerDoctor, createAdmin, loginAs } = require('./helpers/harness');

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

// The fields added for the multi-step profile wizard.
const wizardProfile = {
  headline: 'Interventional cardiologist and teacher',
  address: 'Plot 21, Nayapalli, Bhubaneswar',
  country: 'India',
  workAddress: 'Unit 4, City Heart Institute, Nayapalli',
  workEmail: 'Appointments@CityHeart.example',
  workPhone: '0674 2301234',
  education: [
    {
      degree: 'MBBS',
      institution: 'MKCG Medical College',
      fieldOfStudy: 'Medicine and Surgery',
      startYear: 1998,
      year: 2003,
      details: 'Gold medal in Physiology',
    },
  ],
  credentials: [
    {
      title: 'DM (Cardiology)',
      type: 'DEGREE',
      institution: 'National Board of Examinations',
      year: 2011,
      registration: 'State Medical Council 12345',
      details: 'Thesis on primary PCI outcomes',
    },
  ],
  experience: [
    {
      role: 'Senior Consultant',
      organization: 'City Heart Institute',
      employmentType: 'FULL_TIME',
      city: 'Bhubaneswar',
      state: 'Odisha',
      startYear: 2015,
      current: true,
    },
  ],
  fellowships: [
    {
      title: 'Fellowship in Interventional Cardiology',
      institution: 'Heart Centre',
      specialty: 'Cardiology',
      startYear: 2012,
      endYear: 2013,
      certificate: 'FIC',
      description: 'Complex coronary intervention',
    },
  ],
  achievements: [{ title: 'Best Teacher Award', issuer: 'State Medical Association', year: 2019 }],
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
    // Filling the profile in is not the same as submitting it (see the wizard tests below).
    expect(saved.body.data.profileCompletion.isComplete).toBe(false);

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
      profileWizard: { completedAt: '2020-01-01T00:00:00.000Z', step: 9 },
      profileCompletion: { isComplete: true },
      suspension: { reason: 'x' },
      profile: { city: 'Cuttack', photo: { url: 'https://evil.example/x.png' } },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.profileCompletion.isComplete).toBe(false);
    const stored = await User.findById(doctor.user.id);
    expect(stored.profileWizard.completedAt).toBeNull();
    expect(stored.profileWizard.step).toBe(0);
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

describe('profile wizard', () => {
  test('progress is saved step by step and resumes after signing out and in again', async () => {
    const doctor = await registerDoctor(ctx.app);

    const stepOne = await doctor.patch('/api/v1/doctors/me', {
      name: 'Dr Resume Later',
      profile: { professionalTitle: 'Consultant Physician', headline: 'General medicine', bio: 'Physician.' },
      wizardStep: 1,
    });
    expect(stepOne.status).toBe(200);
    expect(stepOne.body.data.profileCompletion).toMatchObject({ resumeStep: 1, isComplete: false, completedAt: null });

    const stepFour = await doctor.patch('/api/v1/doctors/me', {
      profile: { education: wizardProfile.education, credentials: wizardProfile.credentials },
      wizardStep: 4,
    });
    expect(stepFour.status).toBe(200);
    expect(stepFour.body.data.profileCompletion.resumeStep).toBe(4);

    await doctor.post('/api/v1/auth/logout', {});
    expect((await doctor.get('/api/v1/doctors/me')).status).toBe(401);

    const back = await loginAs(ctx.app, doctor.credentials.email, doctor.credentials.password);
    const me = await back.get('/api/v1/doctors/me');
    expect(me.status).toBe(200);
    expect(me.body.data.profileCompletion).toMatchObject({ resumeStep: 4, isComplete: false });
    expect(me.body.data.name).toBe('Dr Resume Later');
    expect(me.body.data.profile).toMatchObject({ professionalTitle: 'Consultant Physician', headline: 'General medicine' });
    expect(me.body.data.profile.education[0]).toMatchObject({ degree: 'MBBS', fieldOfStudy: 'Medicine and Surgery', startYear: 1998, year: 2003 });
    expect(me.body.data.profile.credentials[0]).toMatchObject({ title: 'DM (Cardiology)', registration: 'State Medical Council 12345' });

    expect((await back.patch('/api/v1/doctors/me', { wizardStep: 11 })).status).toBe(400);
    expect((await back.patch('/api/v1/doctors/me', { wizardStep: -1 })).status).toBe(400);
  });

  test('every wizard field is stored in MongoDB and returned to its owner', async () => {
    const doctor = await registerDoctor(ctx.app);
    const saved = await doctor.patch('/api/v1/doctors/me', { profile: { ...fullProfile, ...wizardProfile } });
    expect(saved.status).toBe(200);
    const p = saved.body.data.profile;
    expect(p).toMatchObject({
      headline: 'Interventional cardiologist and teacher',
      address: 'Plot 21, Nayapalli, Bhubaneswar',
      country: 'India',
      workAddress: 'Unit 4, City Heart Institute, Nayapalli',
      workEmail: 'appointments@cityheart.example', // normalised
      workPhone: '+916742301234', // normalised
    });
    expect(p.education[0]).toMatchObject(wizardProfile.education[0]);
    expect(p.credentials[0]).toMatchObject(wizardProfile.credentials[0]);
    expect(p.experience[0]).toMatchObject({ employmentType: 'FULL_TIME', state: 'Odisha', current: true, endYear: null });
    expect(p.fellowships[0]).toMatchObject(wizardProfile.fellowships[0]);
    expect(p.achievements[0]).toMatchObject({ title: 'Best Teacher Award', issuer: 'State Medical Association' });

    const stored = await User.findById(doctor.user.id).lean();
    expect(stored.profile.fellowships[0].title).toBe('Fellowship in Interventional Cardiology');
    expect(stored.profile.credentials[0].registration).toBe('State Medical Council 12345');
    expect(stored.profile.education[0].startYear).toBe(1998);
    expect(stored.profile.workPhone).toBe('+916742301234');
    expect(stored.profile.photo.url).toBe(''); // no image data is ever stored in the profile
  });

  test('the sections added for expertise, practice, memberships and publications are stored', async () => {
    const doctor = await registerDoctor(ctx.app);
    const sections = {
      fieldOfWork: 'Clinical nephrology and dialysis',
      expertise: ['Haemodialysis', 'Kidney transplantation', 'Haemodialysis'],
      procedures: ['Renal biopsy', 'Dialysis catheter insertion'],
      practiceArea: 'Outpatient and inpatient nephrology',
      practiceLocations: [{ hospital: 'Sunrise Kidney Clinic', area: 'Evening outpatient clinic', address: '12 Station Road', city: 'Cuttack', state: 'Odisha', country: 'India', phone: '0671 2301234' }],
      education: [{ degree: 'MD', level: 'POSTGRADUATE', institution: 'SCB Medical College', fieldOfStudy: 'General Medicine', year: 2008, certification: 'University gold medal' }],
      memberships: [{ organization: 'Indian Society of Nephrology', type: 'Life member', number: 'LM-4471', startYear: 2012, current: true }],
      publications: [{ title: 'Vascular access outcomes', journal: 'Indian Journal of Nephrology', authors: 'Mishra A, Das R', year: 2020, description: 'A five-year single-centre review.', url: 'https://doi.org/10.1000/example' }],
    };
    const saved = await doctor.patch('/api/v1/doctors/me', { profile: sections });
    expect(saved.status).toBe(200);
    const p = saved.body.data.profile;
    expect(p).toMatchObject({ fieldOfWork: sections.fieldOfWork, practiceArea: sections.practiceArea, procedures: sections.procedures });
    expect(p.expertise).toEqual(['Haemodialysis', 'Kidney transplantation']); // duplicates removed
    expect(p.practiceLocations[0]).toMatchObject({ hospital: 'Sunrise Kidney Clinic', city: 'Cuttack', phone: '+916712301234' });
    expect(p.education[0]).toMatchObject({ degree: 'MD', level: 'POSTGRADUATE', certification: 'University gold medal' });
    expect(p.memberships[0]).toMatchObject(sections.memberships[0]);
    expect(p.publications[0]).toMatchObject(sections.publications[0]);

    const stored = await User.findById(doctor.user.id).lean();
    expect(stored.profile.memberships[0].number).toBe('LM-4471');
    expect(stored.profile.procedures).toHaveLength(2);

    // Other members: the membership number and the extra location's phone follow the privacy switches.
    const viewer = await registerDoctor(ctx.app);
    const portfolio = () => viewer.get(`/api/v1/doctors/${doctor.user.id}`);
    let seen = (await portfolio()).body;
    expect(seen.data.profile.memberships[0]).toMatchObject({ organization: 'Indian Society of Nephrology', number: '' });
    expect(JSON.stringify(seen)).not.toContain('LM-4471');
    expect(seen.data.profile.practiceLocations[0].phone).toBe('+916712301234'); // workplace contact is shown by default

    await doctor.patch('/api/v1/doctors/me', { visibility: { showRegistration: true, showWorkContact: false } });
    seen = (await portfolio()).body;
    expect(seen.data.profile.memberships[0].number).toBe('LM-4471');
    expect(seen.data.profile.practiceLocations[0].phone).toBe('');

    await doctor.patch('/api/v1/doctors/me', { visibility: { sections: { memberships: false } } });
    expect((await portfolio()).body.data.profile.memberships).toEqual([]);

    // Invalid entries are refused.
    const bad = await doctor.patch('/api/v1/doctors/me', {
      profile: {
        memberships: [{ organization: '', startYear: 2015, endYear: 2010 }],
        practiceLocations: [{ hospital: 'Clinic', phone: 'call me' }],
        education: [{ degree: 'MD', level: 'WIZARD' }],
        publications: [{ title: 'Paper', url: 'javascript:alert(1)' }],
      },
    });
    expect(bad.status).toBe(400);
    const details = Object.keys(bad.body.error.details).join(' ');
    expect(details).toMatch(/memberships\.0\.organization/);
    expect(details).toMatch(/practiceLocations\.0\.phone/);
    expect(details).toMatch(/education\.0\.level/);
    expect(details).toMatch(/publications\.0\.url/);
  });

  test('optional sections can be left empty', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await doctor.patch('/api/v1/doctors/me', {
      profile: { specialization: 'Dermatology', city: 'Puri', fellowships: [], credentials: [], education: [], workEmail: '', workPhone: '' },
      submit: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.profileCompletion.isComplete).toBe(true);
    expect(res.body.data.profile.fellowships).toEqual([]);
  });

  test('rejects invalid wizard data and stores nothing from the request', async () => {
    const doctor = await registerDoctor(ctx.app);
    const res = await doctor.patch('/api/v1/doctors/me', {
      profile: {
        headline: 'Should not be saved',
        education: [{ degree: 'MD', startYear: 2010, year: 2005 }],
        experience: [
          { role: 'Registrar', startYear: 2012, endYear: 2010 },
          { role: 'Consultant', employmentType: 'ASTRONAUT' },
        ],
        fellowships: [{ title: '', startYear: 2015, endYear: 2014 }],
        credentials: [{ title: 'DNB', type: 'HONORARY_KNIGHTHOOD', year: 1200 }],
        workEmail: 'not-an-email',
        workPhone: 'call me',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details;
    expect(details['profile.education.0.year']).toMatch(/completion year/i);
    expect(details['profile.experience.0.endYear']).toMatch(/end year/i);
    expect(details['profile.experience.1.employmentType']).toBeDefined();
    expect(details['profile.fellowships.0.title']).toBeDefined();
    expect(details['profile.credentials.0.type']).toBeDefined();
    expect(details['profile.credentials.0.year']).toBeDefined();
    expect(details['profile.workEmail']).toBeDefined();
    expect(details['profile.workPhone']).toBeDefined();

    const stored = await User.findById(doctor.user.id);
    expect(stored.profile.headline).toBe('');
    expect(stored.profile.education).toHaveLength(0);
  });

  test('the profile is marked complete only by a successful final submission', async () => {
    const doctor = await registerDoctor(ctx.app); // registered without specialization or city

    // Submitting without the required fields is refused, names the fields, and saves nothing.
    const refused = await doctor.patch('/api/v1/doctors/me', { profile: { bio: 'Lost on purpose.' }, wizardStep: 9, submit: true });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(refused.body.error.details).sort()).toEqual(['profile.city', 'profile.specialization']);
    let stored = await User.findById(doctor.user.id);
    expect(stored.profileWizard.completedAt).toBeNull();
    expect(stored.profileWizard.step).toBe(0);
    expect(stored.profile.bio).toBe('');

    // Saving the required fields as a draft still does not complete the profile.
    const draft = await doctor.patch('/api/v1/doctors/me', { profile: { specialization: 'Paediatrics', city: 'Sambalpur' }, wizardStep: 9 });
    expect(draft.body.data.profileCompletion).toMatchObject({ isComplete: false, requiredMissing: [], resumeStep: 9 });

    const done = await doctor.patch('/api/v1/doctors/me', { submit: true });
    expect(done.status).toBe(200);
    expect(done.body.data.profileCompletion.isComplete).toBe(true);
    expect(done.body.data.profileCompletion.completedAt).toBeTruthy();
    stored = await User.findById(doctor.user.id);
    expect(stored.profileWizard.completedAt).toBeInstanceOf(Date);
    const firstCompletedAt = stored.profileWizard.completedAt.getTime();

    // The dashboard summary reports the same status.
    expect((await doctor.get('/api/v1/dashboard/summary')).body.data.profileCompletion.isComplete).toBe(true);

    // Later edits keep the original completion time…
    const edited = await doctor.patch('/api/v1/doctors/me', { profile: { hospital: 'Children’s Hospital' }, submit: true });
    expect(edited.status).toBe(200);
    expect((await User.findById(doctor.user.id)).profileWizard.completedAt.getTime()).toBe(firstCompletedAt);

    // …and a profile that loses a required field stops counting as complete.
    const cleared = await doctor.patch('/api/v1/doctors/me', { profile: { city: '' } });
    expect(cleared.body.data.profileCompletion).toMatchObject({ isComplete: false, requiredMissing: ['City'] });
  });

  test('a doctor cannot edit another doctor’s profile', async () => {
    const owner = await registerDoctor(ctx.app, { name: 'Dr Owner Person' });
    const intruder = await registerDoctor(ctx.app, { name: 'Dr Intruder Person' });
    const payload = { id: owner.user.id, userId: owner.user.id, name: 'Dr Hijacked', profile: { bio: 'Hijacked' }, submit: true };

    // There is no route for writing to someone else's profile…
    for (const method of ['patch', 'put', 'delete']) {
      const res = await intruder[method](`/api/v1/doctors/${owner.user.id}`, payload);
      expect(res.status).toBe(404);
    }
    expect((await intruder.put(`/api/v1/doctors/${owner.user.id}/photo`, { mediaId: owner.user.id })).status).toBe(404);

    // …and naming another account in the body of one's own update changes only the caller.
    await intruder.patch('/api/v1/doctors/me', payload);
    const stored = await User.findById(owner.user.id);
    expect(stored.name).toBe('Dr Owner Person');
    expect(stored.profile.bio).toBe('');
    expect(stored.profileWizard.completedAt).toBeNull();

    // Signed-out requests are refused outright.
    expect((await request(ctx.app).patch('/api/v1/doctors/me').send({ name: 'Nobody' })).status).toBeGreaterThanOrEqual(401);
  });
});

describe('portfolio privacy settings', () => {
  let viewer;
  let doctor;
  let admin;
  const portfolio = (client) => client.get(`/api/v1/doctors/${doctor.user.id}`);

  beforeAll(async () => {
    viewer = await registerDoctor(ctx.app, { name: 'Dr Privacy Viewer' });
    doctor = await registerDoctor(ctx.app, { name: 'Dr Privacy Owner' });
    await doctor.patch('/api/v1/doctors/me', { profile: { ...fullProfile, ...wizardProfile }, submit: true });
    admin = await createAdmin(ctx.app);
  });

  test('defaults: registration details are private, workplace contact is shown, every section is visible', async () => {
    const mine = await doctor.get('/api/v1/doctors/me');
    expect(mine.body.data.visibility).toMatchObject({
      showWorkContact: true,
      showRegistration: false,
      sections: {
        education: true,
        qualifications: true,
        experience: true,
        fellowships: true,
        achievements: true,
        memberships: true,
        publications: true,
        gallery: true,
        links: true,
      },
    });

    const res = await portfolio(viewer);
    expect(res.status).toBe(200);
    const { profile, contact } = res.body.data;
    expect(profile.credentials[0].title).toBe('DM (Cardiology)');
    expect(profile.credentials[0].registration).toBe('');
    expect(JSON.stringify(res.body)).not.toContain('12345');
    expect(profile.fellowships).toHaveLength(1);
    expect(profile.workAddress).toBe('Unit 4, City Heart Institute, Nayapalli');
    // Workplace contact is exposed through `contact`; the account's own email and phone stay private.
    expect(contact).toEqual({ workEmail: 'appointments@cityheart.example', workPhone: '+916742301234' });
    expect(JSON.stringify(res.body)).not.toContain(doctor.credentials.email);
    expect(res.body.data.visibility).toBeUndefined();
  });

  test('the doctor and administrators always see everything', async () => {
    for (const client of [doctor, admin]) {
      const res = await portfolio(client);
      expect(res.body.data.profile.credentials[0].registration).toBe('State Medical Council 12345');
      expect(res.body.data.contact).toMatchObject({ email: doctor.credentials.email, workEmail: 'appointments@cityheart.example' });
      expect(res.body.data.visibility.sections.education).toBe(true);
    }
  });

  test('hidden sections, registration and workplace contact are removed by the API, not by the browser', async () => {
    const saved = await doctor.patch('/api/v1/doctors/me', {
      visibility: { showWorkContact: false, sections: { education: false, fellowships: false, publications: false } },
    });
    expect(saved.status).toBe(200);
    // A partial update leaves the other section switches alone.
    expect(saved.body.data.visibility.sections).toEqual({
      education: false,
      qualifications: true,
      experience: true,
      fellowships: false,
      achievements: true,
      memberships: true,
      publications: false,
      gallery: true,
      links: true,
    });

    const res = await portfolio(viewer);
    const body = JSON.stringify(res.body);
    expect(res.body.data.profile.education).toEqual([]);
    expect(res.body.data.profile.fellowships).toEqual([]);
    expect(res.body.data.profile.publications).toEqual([]);
    expect(res.body.data.profile.experience).toHaveLength(1);
    expect(res.body.data.contact).toEqual({});
    expect(body).not.toContain('MKCG Medical College');
    expect(body).not.toContain('Fellowship in Interventional');
    expect(body).not.toContain('appointments@cityheart.example');
    expect(body).not.toContain('+916742301234');

    // The owner still sees their own hidden sections.
    const own = await portfolio(doctor);
    expect(own.body.data.profile.education).toHaveLength(1);
    expect(own.body.data.visibility.sections.education).toBe(false);

    // Hiding qualifications removes both the short list and the detailed entries.
    await doctor.patch('/api/v1/doctors/me', { visibility: { sections: { qualifications: false } } });
    const hidden = await portfolio(viewer);
    expect(hidden.body.data.profile.qualifications).toEqual([]);
    expect(hidden.body.data.profile.credentials).toEqual([]);
  });

  test('registration details appear only after the doctor opts in', async () => {
    await doctor.patch('/api/v1/doctors/me', {
      visibility: { showRegistration: true, showWorkContact: true, sections: { qualifications: true } },
    });
    const res = await portfolio(viewer);
    expect(res.body.data.profile.credentials[0].registration).toBe('State Medical Council 12345');
    expect(res.body.data.contact).toEqual({ workEmail: 'appointments@cityheart.example', workPhone: '+916742301234' });
  });

  test('directory cards and the limited name card never carry wizard-only details', async () => {
    const cards = await viewer.get('/api/v1/doctors?q=privacy%20owner');
    expect(cards.body.data).toHaveLength(1);
    const card = JSON.stringify(cards.body.data[0]);
    expect(card).not.toContain('12345');
    expect(card).not.toContain('cityheart');
    expect(card).not.toContain('Nayapalli');

    await doctor.patch('/api/v1/doctors/me', { visibility: { directory: false } });
    const limited = await portfolio(viewer);
    expect(limited.body.data.limited).toBe(true);
    expect(limited.body.data.contact).toEqual({});
    expect(Object.keys(limited.body.data.profile).sort()).toEqual(['photoUrl', 'professionalTitle', 'specialization']);
    await doctor.patch('/api/v1/doctors/me', { visibility: { directory: true } });
  });

  test('invalid visibility values are rejected', async () => {
    const res = await doctor.patch('/api/v1/doctors/me', { visibility: { showRegistration: 'yes', sections: { education: 'no' } } });
    expect(res.status).toBe(400);
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
