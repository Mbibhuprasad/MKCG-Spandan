const Like = require('../src/models/Like');
const Vote = require('../src/models/Vote');
const Rsvp = require('../src/models/Rsvp');
const Poll = require('../src/models/Poll');
const Report = require('../src/models/Report');
const { setupTestApp, registerDoctor, createAdmin, inFuture } = require('./helpers/harness');

const ctx = setupTestApp();

let admin;
let alice;
let bob;
let carol;

const approve = (queue, id) => admin.patch(`/api/v1/admin/moderation/${queue}/${id}`, { action: 'approve' });

async function approvedPost(client, body = 'A post for interaction tests') {
  const res = await client.post('/api/v1/posts', { body });
  await approve('posts', res.body.data.id);
  return res.body.data.id;
}

async function approvedPoll(client, overrides = {}) {
  const res = await client.post('/api/v1/polls', {
    question: 'Where should we hold the reunion dinner?',
    options: ['Seafood place', 'Rooftop grill', 'Hotel banquet'],
    endsAt: inFuture(7),
    ...overrides,
  });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  await approve('polls', res.body.data.id);
  return res.body.data;
}

beforeAll(async () => {
  admin = await createAdmin(ctx.app);
  alice = await registerDoctor(ctx.app, { name: 'Dr Alice A' });
  bob = await registerDoctor(ctx.app, { name: 'Dr Bob B' });
  carol = await registerDoctor(ctx.app, { name: 'Dr Carol C' });
});

describe('likes', () => {
  test('one like per doctor: repeated and simultaneous requests count once', async () => {
    const postId = await approvedPost(alice);

    const first = await bob.put(`/api/v1/likes/post/${postId}`);
    expect(first.body.data).toEqual({ liked: true, likeCount: 1 });
    const second = await bob.put(`/api/v1/likes/post/${postId}`);
    expect(second.status).toBe(200);
    expect(second.body.data.likeCount).toBe(1);

    await Promise.all(Array.from({ length: 6 }, () => bob.put(`/api/v1/likes/post/${postId}`)));
    expect(await Like.countDocuments({ targetType: 'post', target: postId })).toBe(1);

    const liked = await carol.put(`/api/v1/likes/post/${postId}`);
    expect(liked.body.data.likeCount).toBe(2);

    const feed = await bob.get('/api/v1/posts');
    const item = feed.body.data.find((p) => p.id === postId);
    expect(item.likeCount).toBe(2);
    expect(item.likedByMe).toBe(true);
    expect((await alice.get(`/api/v1/posts/${postId}`)).body.data.likedByMe).toBe(false);
  });

  test('unlike is idempotent and the count never goes negative', async () => {
    const postId = await approvedPost(alice);
    await bob.put(`/api/v1/likes/post/${postId}`);
    expect((await bob.delete(`/api/v1/likes/post/${postId}`)).body.data).toEqual({ liked: false, likeCount: 0 });
    expect((await bob.delete(`/api/v1/likes/post/${postId}`)).body.data).toEqual({ liked: false, likeCount: 0 });
    await Promise.all(Array.from({ length: 4 }, () => bob.delete(`/api/v1/likes/post/${postId}`)));
    expect((await bob.get(`/api/v1/posts/${postId}`)).body.data.likeCount).toBe(0);
  });

  test('unpublished content cannot be liked, and unsupported targets are rejected', async () => {
    const pending = await alice.post('/api/v1/posts', { body: 'Still pending' });
    const id = pending.body.data.id;
    expect((await bob.put(`/api/v1/likes/post/${id}`)).status).toBe(404);
    expect((await alice.put(`/api/v1/likes/post/${id}`)).status).toBe(409);
    expect((await bob.put(`/api/v1/likes/poll/${id}`)).status).toBe(400);
    expect((await bob.put('/api/v1/likes/post/not-an-id')).status).toBe(400);
  });

  test('the same like API works for blogs', async () => {
    const blog = await alice.post('/api/v1/blogs', {
      title: 'Notes from a rural posting',
      excerpt: 'What a year in a district hospital taught a freshly minted graduate.',
      body: 'x'.repeat(40) + ' A year in a district hospital teaches resourcefulness, patience and humility. '.repeat(4),
      category: 'Career & Growth',
    });
    await approve('blogs', blog.body.data.id);
    const liked = await bob.put(`/api/v1/likes/blog/${blog.body.data.id}`);
    expect(liked.body.data).toEqual({ liked: true, likeCount: 1 });
    const detail = await bob.get(`/api/v1/blogs/slug/${blog.body.data.slug}`);
    expect(detail.body.data.likedByMe).toBe(true);
  });
});

describe('poll voting', () => {
  test('one ballot per doctor, even under simultaneous requests', async () => {
    const poll = await approvedPoll(alice);
    const [a, b] = poll.options;

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [i % 2 ? a.id : b.id] }))
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await Vote.countDocuments({ poll: poll.id, user: bob.user.id })).toBe(1);

    const again = await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [a.id] });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_VOTED');
  });

  test('validates options and the single-choice rule on the server', async () => {
    const poll = await approvedPoll(alice);
    const other = await approvedPoll(alice, { question: 'A second, unrelated question?' });

    expect((await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [] })).status).toBe(400);
    expect((await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [other.options[0].id] })).status).toBe(400);
    expect((await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [poll.options[0].id, poll.options[1].id] })).status).toBe(400);
    expect(await Vote.countDocuments({ poll: poll.id })).toBe(0);
  });

  test('multi-choice polls accept several options on a single ballot', async () => {
    const poll = await approvedPoll(alice, { allowMultiple: true, resultsVisibility: 'ALWAYS' });
    const res = await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [poll.options[0].id, poll.options[2].id] });
    expect(res.status).toBe(201);
    await carol.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [poll.options[0].id] });

    const view = await alice.get(`/api/v1/polls/${poll.id}`);
    expect(view.body.data.totalVoters).toBe(2);
    expect(view.body.data.options.map((o) => o.votes)).toEqual([2, 0, 1]);
    expect(view.body.data.options.map((o) => o.percent)).toEqual([67, 0, 33]);
  });

  test('results follow the visibility rule and are computed from real ballots', async () => {
    const afterVote = await approvedPoll(alice, { resultsVisibility: 'AFTER_VOTE' });
    const before = await bob.get(`/api/v1/polls/${afterVote.id}`);
    expect(before.body.data.resultsVisible).toBe(false);
    expect(before.body.data.totalVoters).toBeNull();
    expect(before.body.data.options[0].votes).toBeUndefined();

    const voted = await bob.post(`/api/v1/polls/${afterVote.id}/vote`, { optionIds: [afterVote.options[1].id] });
    expect(voted.body.data.resultsVisible).toBe(true);
    expect(voted.body.data.myVote).toEqual([afterVote.options[1].id]);
    expect(voted.body.data.options.map((o) => o.votes)).toEqual([0, 1, 0]);
    // Someone who has not voted still cannot see them.
    expect((await carol.get(`/api/v1/polls/${afterVote.id}`)).body.data.resultsVisible).toBe(false);

    const afterClose = await approvedPoll(alice, { resultsVisibility: 'AFTER_CLOSE' });
    const stillHidden = await bob.post(`/api/v1/polls/${afterClose.id}/vote`, { optionIds: [afterClose.options[0].id] });
    expect(stillHidden.body.data.resultsVisible).toBe(false);
    await Poll.updateOne({ _id: afterClose.id }, { $set: { endsAt: new Date(Date.now() - 1000) } });
    const closed = await carol.get(`/api/v1/polls/${afterClose.id}`);
    expect(closed.body.data.state).toBe('CLOSED');
    expect(closed.body.data.resultsVisible).toBe(true);
    expect(closed.body.data.options[0].votes).toBe(1);
  });

  test('closed and not-yet-open polls refuse votes', async () => {
    const poll = await approvedPoll(alice);
    await Poll.updateOne({ _id: poll.id }, { $set: { endsAt: new Date(Date.now() - 1000) } });
    const late = await bob.post(`/api/v1/polls/${poll.id}/vote`, { optionIds: [poll.options[0].id] });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('POLL_CLOSED');
    expect((await bob.get('/api/v1/polls?state=closed')).body.data.map((p) => p.id)).toContain(poll.id);
    expect((await bob.get('/api/v1/polls?state=open')).body.data.map((p) => p.id)).not.toContain(poll.id);

    const upcoming = await approvedPoll(alice, { startsAt: inFuture(2), endsAt: inFuture(5) });
    const early = await bob.post(`/api/v1/polls/${upcoming.id}/vote`, { optionIds: [upcoming.options[0].id] });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('POLL_NOT_OPEN');
  });

  test('rejects malformed polls', async () => {
    const dup = await alice.post('/api/v1/polls', { question: 'Duplicate options allowed?', options: ['Yes', 'yes'], endsAt: inFuture(3) });
    expect(dup.status).toBe(400);
    const one = await alice.post('/api/v1/polls', { question: 'Only one option here?', options: ['Yes'], endsAt: inFuture(3) });
    expect(one.status).toBe(400);
    const past = await alice.post('/api/v1/polls', { question: 'Already closed poll?', options: ['Yes', 'No'], endsAt: inFuture(-1) });
    expect(past.status).toBe(400);
  });
});

describe('event RSVPs', () => {
  let eventId;

  beforeAll(async () => {
    const res = await alice.post('/api/v1/events', {
      title: 'Batch get-together',
      description: 'Informal evening catch-up for everyone in town.',
      eventType: 'GET_TOGETHER',
      city: 'Bhubaneswar',
      startsAt: inFuture(20),
      capacity: 4,
    });
    eventId = res.body.data.id;
    await approve('events', eventId);
  });

  test('a doctor has exactly one RSVP per event, however many requests are sent', async () => {
    await Promise.all(Array.from({ length: 5 }, () => bob.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING', guests: 1 })));
    expect(await Rsvp.countDocuments({ event: eventId, user: bob.user.id })).toBe(1);

    const changed = await bob.put(`/api/v1/events/${eventId}/rsvp`, { status: 'MAYBE' });
    expect(changed.body.data.rsvp).toMatchObject({ going: 0, maybe: 1, guests: 0, mine: { status: 'MAYBE', guests: 0 } });
    expect(await Rsvp.countDocuments({ event: eventId, user: bob.user.id })).toBe(1);
  });

  test('counts attendees correctly and enforces capacity', async () => {
    await bob.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING', guests: 1 }); // 2 places
    const carolRes = await carol.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING', guests: 1 }); // 4 places
    expect(carolRes.body.data.rsvp).toMatchObject({ going: 2, guests: 2, attending: 4 });

    const full = await alice.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING' });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('EVENT_FULL');
    expect((await alice.put(`/api/v1/events/${eventId}/rsvp`, { status: 'MAYBE' })).status).toBe(200);

    const attendees = await alice.get(`/api/v1/events/${eventId}/attendees`);
    expect(attendees.body.data.map((a) => a.doctor.name).sort()).toEqual(['Dr Alice A', 'Dr Bob B', 'Dr Carol C']);
    expect(JSON.stringify(attendees.body)).not.toContain('@example.com'); // names only, no contact details

    const cleared = await carol.delete(`/api/v1/events/${eventId}/rsvp`);
    expect(cleared.body.data.rsvp).toMatchObject({ going: 1, attending: 2, mine: null });
  });

  test('rejects invalid RSVP input', async () => {
    expect((await bob.put(`/api/v1/events/${eventId}/rsvp`, { status: 'DEFINITELY' })).status).toBe(400);
    expect((await bob.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING', guests: 50 })).status).toBe(400);
  });
});

describe('reports', () => {
  test('a member can report content once; reports reach the admin', async () => {
    const postId = await approvedPost(alice, 'A post someone finds inappropriate');

    const own = await alice.post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: 'SPAM' });
    expect(own.status).toBe(400);

    const first = await bob.post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: 'SPAM', details: 'Looks like an advert.' });
    expect(first.status).toBe(201);
    const second = await bob.post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: 'HARASSMENT' });
    expect(second.body.data.alreadyReported).toBe(true);
    expect(await Report.countDocuments({ target: postId })).toBe(1);

    expect((await bob.get('/api/v1/admin/reports')).status).toBe(403);
    const list = await admin.get('/api/v1/admin/reports');
    const report = list.body.data.find((r) => r.targetId === postId);
    expect(report).toMatchObject({ reason: 'SPAM', status: 'OPEN', target: { exists: true, queue: 'posts' } });
    expect((await admin.get('/api/v1/admin/stats')).body.data.openReports).toBeGreaterThanOrEqual(1);

    const resolved = await admin.patch(`/api/v1/admin/reports/${report.id}`, { status: 'RESOLVED' });
    expect(resolved.body.data.status).toBe('RESOLVED');
  });
});

describe('comment pagination', () => {
  test('large threads are paginated', async () => {
    const postId = await approvedPost(alice, 'A busy thread');
    for (let i = 0; i < 7; i += 1) {
      const c = await bob.post('/api/v1/comments', { targetType: 'post', targetId: postId, body: `Comment number ${i + 1}` });
      await approve('comments', c.body.data.id);
    }
    const page1 = await carol.get(`/api/v1/comments?targetType=post&targetId=${postId}&limit=5`);
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.meta).toMatchObject({ total: 7, totalPages: 2, page: 1 });
    const page2 = await carol.get(`/api/v1/comments?targetType=post&targetId=${postId}&limit=5&page=2`);
    expect(page2.body.data).toHaveLength(2);
    expect((await carol.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(7);
  });
});
