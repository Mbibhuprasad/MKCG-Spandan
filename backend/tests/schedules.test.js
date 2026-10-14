const Rsvp = require('../src/models/Rsvp');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { calendarDay, isoDay, birthdayMatches } = require('../src/utils/calendar');
const { setupTestApp, registerDoctor, createAdmin, inFuture } = require('./helpers/harness');

const ctx = setupTestApp();

let admin;
let organiser;
let asha;
let ravi;
let eventId;
let otherEventId;

const DAY = 24 * 60 * 60 * 1000;
const at = (days, hours = 0) => new Date(Date.now() + days * DAY + hours * 60 * 60 * 1000).toISOString();

const eventPayload = (overrides = {}) => ({
  title: 'Silver jubilee reunion dinner',
  description: 'An evening for the whole batch with families.',
  eventType: 'REUNION',
  venue: 'Hotel Sea View',
  address: 'Beach Road, Gopalpur-on-Sea, Odisha 761002',
  city: 'Gopalpur',
  startsAt: inFuture(30),
  endsAt: inFuture(31),
  ...overrides,
});

const plan = (overrides = {}) => ({
  travelFrom: 'Bhubaneswar',
  arrivalAt: at(29, 10),
  departureAt: at(32, 9),
  note: 'Driving down with family.',
  ...overrides,
});

beforeAll(async () => {
  admin = await createAdmin(ctx.app);
  organiser = await registerDoctor(ctx.app, { name: 'Dr Organiser Das' });
  asha = await registerDoctor(ctx.app, { name: 'Dr Asha Rao' });
  ravi = await registerDoctor(ctx.app, { name: 'Dr Ravi Kumar' });

  const event = await organiser.post('/api/v1/events', eventPayload());
  expect(event.status).toBe(201);
  eventId = event.body.data.id;
  const other = await organiser.post('/api/v1/events', eventPayload({ title: 'Batch meetup in Cuttack', address: '' }));
  otherEventId = other.body.data.id;
});

describe('event schedule: travel plans on the existing RSVP', () => {
  test('the event keeps its venue name and full address', async () => {
    const res = await asha.get(`/api/v1/events/${eventId}`);
    expect(res.body.data.venue).toBe('Hotel Sea View');
    expect(res.body.data.address).toBe('Beach Road, Gopalpur-on-Sea, Odisha 761002');

    const edited = await organiser.patch(`/api/v1/events/${eventId}`, { address: 'Beach Road, Gopalpur, Odisha 761002' });
    expect(edited.status).toBe(200);
    expect(edited.body.data.address).toBe('Beach Road, Gopalpur, Odisha 761002');
  });

  test('an empty schedule lists nobody', async () => {
    const res = await asha.get(`/api/v1/events/${eventId}/schedule`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('origin, arrival and departure are validated', async () => {
    const noOrigin = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: ' ' }));
    expect(noOrigin.status).toBe(400);
    expect(noOrigin.body.error.details.travelFrom).toBeTruthy();

    const missing = await asha.put(`/api/v1/events/${eventId}/schedule`, { travelFrom: 'Puri' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.arrivalAt).toBeTruthy();
    expect(missing.body.error.details.departureAt).toBeTruthy();

    const backwards = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ arrivalAt: at(31), departureAt: at(30) }));
    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details.departureAt).toBeTruthy();

    const afterEnd = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ arrivalAt: at(33), departureAt: at(34) }));
    expect(afterEnd.status).toBe(400);
    expect(afterEnd.body.error.details.arrivalAt).toMatch(/before the event ends/);

    const leavesEarly = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ arrivalAt: at(20), departureAt: at(25) }));
    expect(leavesEarly.status).toBe(400);
    expect(leavesEarly.body.error.details.departureAt).toMatch(/before the event starts/);

    const farAway = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ arrivalAt: at(-200), departureAt: at(31) }));
    expect(farAway.status).toBe(400);

    expect(await Rsvp.countDocuments({ event: eventId })).toBe(0);
  });

  test('saving a plan marks the doctor as going and returns it as theirs', async () => {
    const res = await asha.put(`/api/v1/events/${eventId}/schedule`, plan());
    expect(res.status).toBe(200);
    expect(res.body.data.rsvp.going).toBe(1);
    expect(res.body.data.rsvp.mine.status).toBe('GOING');
    expect(res.body.data.rsvp.mine.travel).toMatchObject({ from: 'Bhubaneswar', note: 'Driving down with family.' });
  });

  test('updating the plan keeps one record per doctor and event', async () => {
    const res = await asha.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: 'Cuttack', note: '' }));
    expect(res.status).toBe(200);
    expect(res.body.data.rsvp.mine.travel.from).toBe('Cuttack');
    expect(await Rsvp.countDocuments({ event: eventId, user: asha.user.id })).toBe(1);

    // Two identical requests at once still leave one record.
    await Promise.all([
      ravi.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: 'Berhampur', arrivalAt: at(30, -2) })),
      ravi.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: 'Berhampur', arrivalAt: at(30, -2) })),
    ]);
    expect(await Rsvp.countDocuments({ event: eventId, user: ravi.user.id })).toBe(1);
  });

  test('a MAYBE answer is kept when the plan is saved', async () => {
    await organiser.put(`/api/v1/events/${eventId}/rsvp`, { status: 'MAYBE' });
    const res = await organiser.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: 'Kolkata', arrivalAt: at(29, 2) }));
    expect(res.body.data.rsvp.mine.status).toBe('MAYBE');
  });

  test('the schedule lists attending doctors by arrival, without contact details', async () => {
    const res = await ravi.get(`/api/v1/events/${eventId}/schedule`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((row) => row.doctor.name)).toEqual(['Dr Organiser Das', 'Dr Asha Rao', 'Dr Ravi Kumar']);
    const mine = res.body.data.filter((row) => row.isMine);
    expect(mine).toHaveLength(1);
    expect(mine[0].doctor.id).toBe(ravi.user.id);
    expect(res.body.data[1].travel).toMatchObject({ from: 'Cuttack' });
    expect(new Date(res.body.data[1].travel.departureAt).getTime()).toBeGreaterThan(new Date(res.body.data[1].travel.arrivalAt).getTime());
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(asha.credentials.email);
    expect(text).not.toContain(asha.credentials.phone);
  });

  test('each schedule belongs to its own event', async () => {
    const other = await asha.get(`/api/v1/events/${otherEventId}/schedule`);
    expect(other.body.data).toEqual([]);
    const own = await asha.get(`/api/v1/events/${otherEventId}`);
    expect(own.body.data.rsvp.mine).toBeNull();
  });

  test('a doctor can only write their own plan; only admins can remove another one', async () => {
    // Ravi saving a plan never touches Asha's.
    await ravi.put(`/api/v1/events/${eventId}/schedule`, plan({ travelFrom: 'Rourkela' }));
    const ashaRow = await Rsvp.findOne({ event: eventId, user: asha.user.id }).lean();
    expect(ashaRow.travel.from).toBe('Cuttack');

    const forbidden = await ravi.delete(`/api/v1/events/${eventId}/schedule/${asha.user.id}`);
    expect(forbidden.status).toBe(403);
    expect((await Rsvp.findOne({ event: eventId, user: asha.user.id }).lean()).travel.from).toBe('Cuttack');

    const removed = await admin.delete(`/api/v1/events/${eventId}/schedule/${ravi.user.id}`);
    expect(removed.status).toBe(200);
    const after = await Rsvp.findOne({ event: eventId, user: ravi.user.id }).lean();
    expect(after.travel.arrivalAt).toBeNull();
    expect(after.status).toBe('GOING'); // the RSVP itself stays
    expect(await AuditLog.countDocuments({ action: 'TRAVEL_PLAN_DELETED', targetId: eventId })).toBe(1);

    const again = await admin.delete(`/api/v1/events/${eventId}/schedule/${ravi.user.id}`);
    expect(again.status).toBe(404);
  });

  test('removing a plan or answering "can\'t go" takes the doctor off the schedule', async () => {
    const cleared = await organiser.delete(`/api/v1/events/${eventId}/schedule`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.rsvp.mine.status).toBe('MAYBE');
    expect(cleared.body.data.rsvp.mine.travel).toBeNull();

    await asha.put(`/api/v1/events/${eventId}/rsvp`, { status: 'NOT_GOING' });
    const res = await ravi.get(`/api/v1/events/${eventId}/schedule`);
    expect(res.body.data).toEqual([]);
  });

  test('RSVP rules apply, but the organiser may always add their own plan', async () => {
    const closed = await organiser.post('/api/v1/events', eventPayload({ title: 'Organisers only planning trip', rsvpEnabled: false }));
    const closedId = closed.body.data.id;
    const refused = await asha.put(`/api/v1/events/${closedId}/schedule`, plan());
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('RSVP_CLOSED');
    const own = await organiser.put(`/api/v1/events/${closedId}/schedule`, plan());
    expect(own.status).toBe(200);

    const small = await organiser.post('/api/v1/events', eventPayload({ title: 'Small dinner for two', capacity: 1 }));
    const smallId = small.body.data.id;
    expect((await asha.put(`/api/v1/events/${smallId}/schedule`, plan())).status).toBe(200);
    const full = await ravi.put(`/api/v1/events/${smallId}/schedule`, plan());
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('EVENT_FULL');
  });

  test('deleting the event removes its schedule', async () => {
    const temp = await organiser.post('/api/v1/events', eventPayload({ title: 'Short lived get-together' }));
    await asha.put(`/api/v1/events/${temp.body.data.id}/schedule`, plan());
    await organiser.delete(`/api/v1/events/${temp.body.data.id}`);
    expect(await Rsvp.countDocuments({ event: temp.body.data.id })).toBe(0);
  });
});

describe('date of birth and today’s birthdays', () => {
  const today = calendarDay(new Date(), 'Asia/Kolkata');
  const bornToday = (year) => isoDay({ ...today, year: today.month === 2 && today.day === 29 ? 1984 : year });

  test('a doctor without a date of birth keeps working and nobody has a birthday yet', async () => {
    const me = await asha.get('/api/v1/doctors/me');
    expect(me.status).toBe(200);
    expect(me.body.data.profile.dateOfBirth).toBeNull();
    expect(me.body.data.visibility.showBirthday).toBe(true);

    const res = await ravi.get('/api/v1/doctors/birthdays');
    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe(isoDay(today));
    expect(res.body.data.timeZone).toBe('Asia/Kolkata');
    expect(res.body.data.doctors).toEqual([]);
  });

  test('the date of birth is validated and saved', async () => {
    const future = await asha.patch('/api/v1/doctors/me', { profile: { dateOfBirth: `${today.year + 1}-01-01` } });
    expect(future.status).toBe(400);
    expect(future.body.error.details['profile.dateOfBirth']).toMatch(/future/);

    const impossible = await asha.patch('/api/v1/doctors/me', { profile: { dateOfBirth: '1985-02-30' } });
    expect(impossible.status).toBe(400);

    const saved = await asha.patch('/api/v1/doctors/me', { profile: { dateOfBirth: bornToday(1980) } });
    expect(saved.status).toBe(200);
    expect(saved.body.data.profile.dateOfBirth).toBe(bornToday(1980));

    const cleared = await ravi.patch('/api/v1/doctors/me', { profile: { dateOfBirth: '' } });
    expect(cleared.body.data.profile.dateOfBirth).toBeNull();
  });

  test('other members never receive the date itself', async () => {
    const res = await ravi.get(`/api/v1/doctors/${asha.user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.dateOfBirth).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain(bornToday(1980));
    const own = await admin.get(`/api/v1/doctors/${asha.user.id}`);
    expect(own.body.data.profile.dateOfBirth).toBe(bornToday(1980));
  });

  test('every listed doctor born on this day and month appears, by name', async () => {
    await ravi.patch('/api/v1/doctors/me', { profile: { dateOfBirth: bornToday(1979) } });
    // Not today: one day off.
    const notToday = new Date(Date.UTC(1981, today.month - 1, today.day) + DAY).toISOString().slice(0, 10);
    await organiser.patch('/api/v1/doctors/me', { profile: { dateOfBirth: notToday } });
    // Born today, but opted out of the strip / not listed in Friends.
    const shy = await registerDoctor(ctx.app, { name: 'Dr Shy Opted Out' });
    await shy.patch('/api/v1/doctors/me', { profile: { dateOfBirth: bornToday(1982) }, visibility: { showBirthday: false } });
    const hidden = await registerDoctor(ctx.app, { name: 'Dr Hidden Member' });
    await hidden.patch('/api/v1/doctors/me', { profile: { dateOfBirth: bornToday(1983) }, visibility: { directory: false } });

    const res = await organiser.get('/api/v1/doctors/birthdays');
    expect(res.body.data.doctors.map((d) => d.name)).toEqual(['Dr Asha Rao', 'Dr Ravi Kumar']);
    expect(Object.keys(res.body.data.doctors[0]).sort()).toEqual(['city', 'id', 'name', 'photoUrl', 'professionalTitle', 'specialization']);
    expect(JSON.stringify(res.body)).not.toContain('1980');
  });

  test('the birthday list is for signed-in members only', async () => {
    const request = require('supertest');
    expect((await request(ctx.app).get('/api/v1/doctors/birthdays')).status).toBe(401);
  });

  test('29 February birthdays are celebrated on 28 February in other years', () => {
    expect(birthdayMatches({ year: 2027, month: 2, day: 28 })).toEqual([
      { month: 2, day: 28 },
      { month: 2, day: 29 },
    ]);
    expect(birthdayMatches({ year: 2028, month: 2, day: 28 })).toEqual([{ month: 2, day: 28 }]);
    expect(birthdayMatches({ year: 2028, month: 2, day: 29 })).toEqual([{ month: 2, day: 29 }]);
    expect(birthdayMatches({ year: 2027, month: 3, day: 1 })).toEqual([{ month: 3, day: 1 }]);
  });

  test('a stored leap-day birthday is found on 28 February of a common year', async () => {
    const leap = await registerDoctor(ctx.app, { name: 'Dr Leap Day' });
    await leap.patch('/api/v1/doctors/me', { profile: { dateOfBirth: '1984-02-29' } });
    const matches = birthdayMatches({ year: 2027, month: 2, day: 28 });
    const found = await User.find({
      _id: leap.user.id,
      $expr: {
        $or: matches.map(({ month, day }) => ({
          $and: [{ $eq: [{ $month: '$profile.dateOfBirth' }, month] }, { $eq: [{ $dayOfMonth: '$profile.dateOfBirth' }, day] }],
        })),
      },
    });
    expect(found).toHaveLength(1);
  });
});

describe('Friends cards: contact number only when the doctor allows it', () => {
  const cardOf = async (client, id) => (await client.get('/api/v1/doctors?limit=48')).body.data.find((d) => d.id === id);

  test('the phone number follows visibility.showPhone and the workplace phone showWorkContact', async () => {
    const card = await cardOf(ravi, asha.user.id);
    expect(card.contact).toEqual({});

    await asha.patch('/api/v1/doctors/me', { profile: { workPhone: '+916742500000' }, visibility: { showPhone: true } });
    const shown = await cardOf(ravi, asha.user.id);
    expect(shown.contact.phone).toBe(asha.user.phone);
    expect(shown.contact.workPhone).toBe('+916742500000');

    await asha.patch('/api/v1/doctors/me', { visibility: { showPhone: false, showWorkContact: false } });
    expect((await cardOf(ravi, asha.user.id)).contact).toEqual({});
    // The doctor always sees their own.
    expect((await cardOf(asha, asha.user.id)).contact.phone).toBe(asha.user.phone);
  });
});
