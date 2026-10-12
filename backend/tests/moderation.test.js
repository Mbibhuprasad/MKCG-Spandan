const request = require('supertest');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const AuditLog = require('../src/models/AuditLog');
const { setupTestApp, registerDoctor, createAdmin, PNG, inFuture, LONG_BODY } = require('./helpers/harness');

const ctx = setupTestApp();

let admin;
let author;
let other;

const review = (queue, id, action, reason) => admin.patch(`/api/v1/admin/moderation/${queue}/${id}`, { action, reason });
const ids = (res) => res.body.data.map((item) => item.id);

beforeAll(async () => {
  admin = await createAdmin(ctx.app);
  author = await registerDoctor(ctx.app, { name: 'Dr Author One' });
  other = await registerDoctor(ctx.app, { name: 'Dr Other Two' });
});

describe('posts', () => {
  let postId;

  test('a doctor’s post starts PENDING regardless of what the request claims', async () => {
    const res = await author.post('/api/v1/posts', {
      body: 'Looking forward to the silver jubilee reunion!',
      type: 'REUNION_UPDATE',
      moderationStatus: 'APPROVED',
      publishedAt: new Date().toISOString(),
      author: other.user.id,
      likeCount: 999,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe('PENDING');
    expect(res.body.data.author.id).toBe(author.user.id);
    expect(res.body.data.likeCount).toBe(0);
    postId = res.body.data.id;

    const stored = await Post.findById(postId);
    expect(stored.moderationStatus).toBe('PENDING');
    expect(String(stored.author)).toBe(author.user.id);
    expect(stored.publishedAt).toBeNull();
  });

  test('pending posts are invisible to other doctors and absent from the feed', async () => {
    expect(ids(await other.get('/api/v1/posts'))).not.toContain(postId);
    expect(ids(await author.get('/api/v1/posts'))).not.toContain(postId); // not in the public feed for anyone
    expect((await other.get(`/api/v1/posts/${postId}`)).status).toBe(404);
    expect((await request(ctx.app).get(`/api/v1/posts/${postId}`)).status).toBe(401);
  });

  test('the author can see their own submission and its status', async () => {
    const mine = await author.get('/api/v1/posts/mine');
    expect(ids(mine)).toContain(postId);
    expect(mine.body.data.find((p) => p.id === postId).moderation.status).toBe('PENDING');
    expect((await author.get(`/api/v1/posts/${postId}`)).status).toBe(200);

    const summary = await author.get('/api/v1/dashboard/summary');
    expect(summary.body.data.submissions.post.PENDING).toBe(1);
  });

  test('a doctor cannot approve content through the admin API or by editing it', async () => {
    expect((await author.patch(`/api/v1/admin/moderation/posts/${postId}`, { action: 'approve' })).status).toBe(403);
    expect((await author.get('/api/v1/admin/moderation/posts')).status).toBe(403);

    const edit = await author.patch(`/api/v1/posts/${postId}`, { body: 'Edited text', moderationStatus: 'APPROVED' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.moderation.status).toBe('PENDING');
    expect((await Post.findById(postId)).moderationStatus).toBe('PENDING');
  });

  test('it appears in the admin queue and is published once approved', async () => {
    const queue = await admin.get('/api/v1/admin/moderation/posts');
    expect(ids(queue)).toContain(postId);

    const approved = await review('posts', postId, 'approve');
    expect(approved.status).toBe(200);
    expect(approved.body.data.moderation.status).toBe('APPROVED');
    expect(approved.body.data.moderation.reviewedAt).toBeTruthy();

    expect(ids(await other.get('/api/v1/posts'))).toContain(postId);
    expect((await other.get(`/api/v1/posts/${postId}`)).status).toBe(200);
    // Other members never receive moderation details.
    expect((await other.get(`/api/v1/posts/${postId}`)).body.data.moderation).toBeUndefined();

    const notes = await author.get('/api/v1/notifications');
    expect(notes.body.data.some((n) => n.type === 'CONTENT_APPROVED')).toBe(true);

    // Approving twice does not create a second notification.
    await review('posts', postId, 'approve');
    const again = await author.get('/api/v1/notifications');
    expect(again.body.data.filter((n) => n.type === 'CONTENT_APPROVED')).toHaveLength(1);
  });

  test('doctors cannot modify or delete another doctor’s content', async () => {
    expect((await other.patch(`/api/v1/posts/${postId}`, { body: 'Hijacked' })).status).toBe(403);
    expect((await other.delete(`/api/v1/posts/${postId}`)).status).toBe(403);
    expect((await Post.findById(postId)).body).toBe('Edited text');
  });

  test('editing an approved post sends it back for review', async () => {
    const edit = await author.patch(`/api/v1/posts/${postId}`, { body: 'Updated after approval' });
    expect(edit.body.data.moderation.status).toBe('PENDING');
    expect(ids(await other.get('/api/v1/posts'))).not.toContain(postId);
    await review('posts', postId, 'approve');
    expect(ids(await other.get('/api/v1/posts'))).toContain(postId);
  });

  test('rejected posts stay hidden and the author is told why', async () => {
    const created = await author.post('/api/v1/posts', { body: 'A post that will be rejected' });
    const id = created.body.data.id;
    const rejected = await review('posts', id, 'reject', 'Please remove the promotional link.');
    expect(rejected.body.data.moderation.status).toBe('REJECTED');

    expect(ids(await other.get('/api/v1/posts'))).not.toContain(id);
    expect((await other.get(`/api/v1/posts/${id}`)).status).toBe(404);
    // Hidden content is indistinguishable from missing content for other doctors.
    expect((await other.delete(`/api/v1/posts/${id}`)).status).toBe(404);

    const own = await author.get(`/api/v1/posts/${id}`);
    expect(own.body.data.moderation).toMatchObject({ status: 'REJECTED', rejectionReason: 'Please remove the promotional link.' });
    const notes = await author.get('/api/v1/notifications');
    expect(notes.body.data.some((n) => n.type === 'CONTENT_REJECTED')).toBe(true);
  });

  test('an admin can delete any post, including approved ones, and it is audited', async () => {
    const removed = await admin.delete(`/api/v1/admin/moderation/posts/${postId}`, { reason: 'Duplicate' });
    expect(removed.status).toBe(200);
    expect(await Post.findById(postId)).toBeNull();
    expect((await other.get(`/api/v1/posts/${postId}`)).status).toBe(404);

    const log = await AuditLog.findOne({ action: 'CONTENT_DELETED', targetId: postId });
    expect(log).not.toBeNull();
    expect(log.actorName).toBe('Test Admin');
    expect(await AuditLog.countDocuments({ action: 'CONTENT_APPROVED' })).toBeGreaterThan(0);
  });

  test('admin-authored posts are published immediately', async () => {
    const res = await admin.post('/api/v1/posts', { body: 'Welcome to the community, everyone.', type: 'ANNOUNCEMENT' });
    expect(res.body.data.moderation.status).toBe('APPROVED');
    expect(ids(await other.get('/api/v1/posts'))).toContain(res.body.data.id);
  });
});

describe('blogs', () => {
  let blog;
  const payload = {
    title: 'What twenty years of practice taught me',
    excerpt: 'Reflections on the habits from our student years that still shape daily practice.',
    body: LONG_BODY,
    category: 'Batch Stories',
    tags: ['Reunion', 'reflection'],
  };

  test('a submitted blog is pending and hidden from the public and from other doctors', async () => {
    const res = await author.post('/api/v1/blogs', { ...payload, moderationStatus: 'APPROVED', slug: 'my-own-slug' });
    expect(res.status).toBe(201);
    blog = res.body.data;
    expect(blog.moderation.status).toBe('PENDING');
    expect(blog.slug).not.toBe('my-own-slug');
    expect(blog.slug).toMatch(/^what-twenty-years-of-practice-taught-me-[a-f0-9]{6}$/);
    expect(blog.tags).toEqual(['reunion', 'reflection']);

    const publicList = await request(ctx.app).get('/api/v1/blogs');
    expect(ids(publicList)).not.toContain(blog.id);
    expect((await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`)).status).toBe(404);
    expect((await other.get(`/api/v1/blogs/slug/${blog.slug}`)).status).toBe(404);
    expect((await other.get(`/api/v1/blogs/${blog.id}`)).status).toBe(404);

    // The author can preview it and sees the status.
    const preview = await author.get(`/api/v1/blogs/slug/${blog.slug}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.moderation.status).toBe('PENDING');
    expect(ids(await author.get('/api/v1/blogs/mine'))).toContain(blog.id);
  });

  test('once approved it is public, without internal fields', async () => {
    await review('blogs', blog.id, 'approve');

    const publicList = await request(ctx.app).get('/api/v1/blogs');
    expect(ids(publicList)).toContain(blog.id);
    expect(publicList.body.data[0].bodyHtml).toBeUndefined();

    const detail = await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.bodyHtml).toContain('<p>');
    expect(detail.body.data.bodyMarkdown).toBeUndefined();
    expect(detail.body.data.moderation).toBeUndefined();
    expect(detail.body.data.publishedAt).toBeTruthy();

    const byCategory = await request(ctx.app).get('/api/v1/blogs?category=Batch%20Stories&tag=reunion');
    expect(ids(byCategory)).toContain(blog.id);
    const taxonomy = await request(ctx.app).get('/api/v1/blogs/taxonomy');
    expect(taxonomy.body.data.categories.find((c) => c.name === 'Batch Stories').count).toBe(1);
  });

  test('editing keeps the slug stable but requires approval again', async () => {
    const edit = await author.patch(`/api/v1/blogs/${blog.id}`, { title: 'A completely different headline' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.slug).toBe(blog.slug);
    expect(edit.body.data.moderation.status).toBe('PENDING');
    expect((await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`)).status).toBe(404);
    expect((await other.patch(`/api/v1/blogs/${blog.id}`, { title: 'Not my blog at all' })).status).toBe(404);
  });

  test('admins can delete any blog', async () => {
    await review('blogs', blog.id, 'approve');
    expect((await admin.delete(`/api/v1/admin/moderation/blogs/${blog.id}`)).status).toBe(200);
    expect((await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`)).status).toBe(404);
  });
});

describe('comments', () => {
  let postId;
  let commentId;

  beforeAll(async () => {
    const created = await author.post('/api/v1/posts', { body: 'A post to discuss' });
    postId = created.body.data.id;
  });

  test('comments are only possible on published content', async () => {
    expect((await other.post('/api/v1/comments', { targetType: 'post', targetId: postId, body: 'Nice' })).status).toBe(404);
    expect((await author.post('/api/v1/comments', { targetType: 'post', targetId: postId, body: 'Nice' })).status).toBe(409);
    await review('posts', postId, 'approve');
  });

  test('a doctor’s comment waits for approval and is hidden from everyone else', async () => {
    const res = await other.post('/api/v1/comments', { targetType: 'post', targetId: postId, body: 'Count me in for the reunion!', moderationStatus: 'APPROVED' });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe('PENDING');
    commentId = res.body.data.id;

    const forAuthor = await author.get(`/api/v1/comments?targetType=post&targetId=${postId}`);
    expect(ids(forAuthor)).not.toContain(commentId);
    const forCommenter = await other.get(`/api/v1/comments?targetType=post&targetId=${postId}`);
    expect(ids(forCommenter)).toContain(commentId);

    expect((await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(0);
    expect(ids(await admin.get('/api/v1/admin/moderation/comments'))).toContain(commentId);
  });

  test('approval publishes the comment and updates the count exactly once', async () => {
    await review('comments', commentId, 'approve');
    await review('comments', commentId, 'approve');
    const forAuthor = await author.get(`/api/v1/comments?targetType=post&targetId=${postId}`);
    expect(ids(forAuthor)).toContain(commentId);
    expect((await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(1);

    const notes = await author.get('/api/v1/notifications');
    expect(notes.body.data.filter((n) => n.type === 'NEW_COMMENT')).toHaveLength(1);
  });

  test('only the commenter or an admin can remove a comment', async () => {
    expect((await author.delete(`/api/v1/comments/${commentId}`)).status).toBe(403);
    expect((await author.patch(`/api/v1/comments/${commentId}`, { body: 'Tampered' })).status).toBe(403);

    // Editing un-publishes the comment until it is reviewed again.
    const edited = await other.patch(`/api/v1/comments/${commentId}`, { body: 'Count me in — with family!' });
    expect(edited.body.data.moderation.status).toBe('PENDING');
    expect((await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(0);

    await review('comments', commentId, 'approve');
    expect((await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(1);

    expect((await admin.delete(`/api/v1/admin/moderation/comments/${commentId}`)).status).toBe(200);
    expect(await Comment.findById(commentId)).toBeNull();
    expect((await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(0);
  });
});

describe('memories', () => {
  let memoryId;
  let mediaId;

  test('an uploaded memory is pending and its media cannot be reached by others', async () => {
    const upload = await author.upload('memory', PNG);
    expect(upload.status).toBe(201);
    mediaId = upload.body.data.id;

    const res = await author.post('/api/v1/memories', { title: 'Convocation day', caption: 'The whole batch on stage.', mediaIds: [mediaId] });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe('PENDING');
    memoryId = res.body.data.id;

    expect(ids(await other.get('/api/v1/memories'))).not.toContain(memoryId);
    expect((await other.get(`/api/v1/memories/${memoryId}`)).status).toBe(404);
    expect((await other.get(`/api/v1/memories/${memoryId}/media/${mediaId}/download`)).status).toBe(404);
    expect(ids(await author.get('/api/v1/memories/mine'))).toContain(memoryId);
    expect(ids(await admin.get('/api/v1/admin/moderation/memories'))).toContain(memoryId);
  });

  test('after approval members can view and download; visitors cannot', async () => {
    await review('memories', memoryId, 'approve');
    const list = await other.get('/api/v1/memories');
    expect(ids(list)).toContain(memoryId);
    const item = list.body.data.find((m) => m.id === memoryId);
    expect(item.media[0].url).toContain('/authenticated/s--'); // signed delivery of a private asset

    const download = await other.get(`/api/v1/memories/${memoryId}/media/${mediaId}/download`);
    expect(download.status).toBe(200);
    expect(download.body.data.url).toMatch(/expires_at=\d+/);
    expect(download.body.data.expiresInSeconds).toBeLessThanOrEqual(300);

    expect((await request(ctx.app).get('/api/v1/memories')).status).toBe(401);
    expect((await request(ctx.app).get(`/api/v1/memories/${memoryId}/media/${mediaId}/download`)).status).toBe(401);
    // A media id that does not belong to this memory is refused.
    expect((await other.get(`/api/v1/memories/${memoryId}/media/64b7f0f0f0f0f0f0f0f0f0f0/download`)).status).toBe(404);
  });

  test('admins can reject or delete a memory after it was approved', async () => {
    await review('memories', memoryId, 'reject', 'Please crop the photo.');
    expect(ids(await other.get('/api/v1/memories'))).not.toContain(memoryId);
    expect((await other.get(`/api/v1/memories/${memoryId}/media/${mediaId}/download`)).status).toBe(404);
    expect((await admin.delete(`/api/v1/admin/moderation/memories/${memoryId}`)).status).toBe(200);
    expect((await author.get(`/api/v1/memories/${memoryId}`)).status).toBe(404);
  });
});

describe('events and visit plans', () => {
  let eventId;
  let visitId;

  const eventPayload = () => ({
    title: 'Silver jubilee reunion dinner',
    description: 'An evening for the whole batch with families.',
    eventType: 'REUNION',
    venue: 'Hotel Sea View, Private Hall',
    city: 'Gopalpur',
    startsAt: inFuture(30),
    endsAt: inFuture(31),
    budgetNote: 'About 2,500 per person',
    showOnPublicSite: true,
  });

  test('events and visit plans are submitted for approval in separate queues', async () => {
    const event = await author.post('/api/v1/events', eventPayload());
    expect(event.status).toBe(201);
    expect(event.body.data.moderation.status).toBe('PENDING');
    eventId = event.body.data.id;

    const visit = await author.post('/api/v1/events', {
      title: 'Visiting Bengaluru in December',
      description: 'In town for a conference — happy to meet batchmates for coffee.',
      eventType: 'VISIT_PLAN',
      city: 'Bengaluru',
      startsAt: inFuture(40),
    });
    expect(visit.status).toBe(201);
    visitId = visit.body.data.id;

    expect(ids(await other.get('/api/v1/events'))).toEqual([]);
    expect((await other.get(`/api/v1/events/${eventId}`)).status).toBe(404);
    expect(ids(await author.get('/api/v1/events/mine'))).toEqual(expect.arrayContaining([eventId, visitId]));

    expect(ids(await admin.get('/api/v1/admin/moderation/events'))).toEqual([eventId]);
    expect(ids(await admin.get('/api/v1/admin/moderation/visit-plans'))).toEqual([visitId]);
    // An item cannot be actioned through the wrong queue.
    expect((await review('events', visitId, 'approve')).status).toBe(404);

    const stats = await admin.get('/api/v1/admin/stats');
    expect(stats.body.data.pending.events).toBe(1);
    expect(stats.body.data.pending['visit-plans']).toBe(1);

    // Nothing is public yet.
    expect((await request(ctx.app).get('/api/v1/events/public')).body.data).toEqual([]);
  });

  test('RSVPs are closed until the event is approved', async () => {
    expect((await author.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING' })).status).toBe(409);
    expect((await other.put(`/api/v1/events/${eventId}/rsvp`, { status: 'GOING' })).status).toBe(404);
  });

  test('approval publishes to members, notifies them, and exposes only a summary publicly', async () => {
    await review('events', eventId, 'approve');
    await review('visit-plans', visitId, 'approve');

    expect(ids(await other.get('/api/v1/events'))).toEqual([eventId, visitId]);
    expect(ids(await other.get('/api/v1/events?type=VISIT_PLAN'))).toEqual([visitId]);
    expect((await other.get(`/api/v1/events/${eventId}`)).body.data.venue).toBe('Hotel Sea View, Private Hall');

    const notes = await other.get('/api/v1/notifications');
    expect(notes.body.data.filter((n) => n.type === 'EVENT_PUBLISHED')).toHaveLength(2);

    const pub = await request(ctx.app).get('/api/v1/events/public');
    expect(pub.body.data).toHaveLength(1); // the visit plan did not opt in
    expect(Object.keys(pub.body.data[0]).sort()).toEqual(['city', 'endsAt', 'eventType', 'id', 'startsAt', 'title']);
    expect(JSON.stringify(pub.body)).not.toContain('Hotel Sea View');
    expect((await request(ctx.app).get('/api/v1/events')).status).toBe(401);
  });

  test('validates dates and blocks edits by other doctors', async () => {
    const past = await author.post('/api/v1/events', { ...eventPayload(), startsAt: inFuture(-2), endsAt: inFuture(-1) });
    expect(past.status).toBe(400);
    const reversed = await author.post('/api/v1/events', { ...eventPayload(), startsAt: inFuture(10), endsAt: inFuture(9) });
    expect(reversed.status).toBe(400);
    expect((await other.patch(`/api/v1/events/${eventId}`, { title: 'Changed by someone else' })).status).toBe(403);
    expect((await other.delete(`/api/v1/events/${eventId}`)).status).toBe(403);
  });

  test('admins can delete events and visit plans', async () => {
    expect((await admin.delete(`/api/v1/admin/moderation/visit-plans/${visitId}`)).status).toBe(200);
    expect((await admin.delete(`/api/v1/admin/moderation/events/${eventId}`)).status).toBe(200);
    expect(ids(await other.get('/api/v1/events'))).toEqual([]);
  });
});

describe('polls', () => {
  let pollId;

  test('a poll is pending, hidden and closed to voting until approved', async () => {
    const res = await author.post('/api/v1/polls', {
      question: 'Which month suits you for the reunion?',
      options: ['December', 'January', 'February'],
      endsAt: inFuture(14),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe('PENDING');
    pollId = res.body.data.id;
    const optionId = res.body.data.options[0].id;

    expect(ids(await other.get('/api/v1/polls'))).not.toContain(pollId);
    expect((await other.get(`/api/v1/polls/${pollId}`)).status).toBe(404);
    expect((await other.post(`/api/v1/polls/${pollId}/vote`, { optionIds: [optionId] })).status).toBe(404);
    expect((await author.post(`/api/v1/polls/${pollId}/vote`, { optionIds: [optionId] })).status).toBe(409);
    expect(ids(await admin.get('/api/v1/admin/moderation/polls'))).toContain(pollId);
  });

  test('the author may edit while pending; approval publishes and locks the options', async () => {
    const edit = await author.patch(`/api/v1/polls/${pollId}`, { options: ['December', 'January'] });
    expect(edit.status).toBe(200);
    expect(edit.body.data.options).toHaveLength(2);

    await review('polls', pollId, 'approve');
    expect(ids(await other.get('/api/v1/polls'))).toContain(pollId);
    const notes = await other.get('/api/v1/notifications');
    expect(notes.body.data.some((n) => n.type === 'POLL_PUBLISHED')).toBe(true);

    const locked = await author.patch(`/api/v1/polls/${pollId}`, { options: ['March', 'April'] });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('POLL_LOCKED');
    expect((await other.patch(`/api/v1/polls/${pollId}`, { question: 'Changed by another doctor?' })).status).toBe(403);
  });

  test('admins can delete any poll', async () => {
    expect((await admin.delete(`/api/v1/admin/moderation/polls/${pollId}`)).status).toBe(200);
    expect((await other.get(`/api/v1/polls/${pollId}`)).status).toBe(404);
  });
});
