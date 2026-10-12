const request = require('supertest');
const cloudinaryMock = require('cloudinary');
const Media = require('../src/models/Media');
const Post = require('../src/models/Post');
const { detectFileType } = require('../src/utils/fileSignature');
const { cleanupOrphans } = require('../src/services/media.service');
const { setupTestApp, registerDoctor, createAdmin, PNG, JPEG, MP4, EXE } = require('./helpers/harness');

const ctx = setupTestApp();
const cloud = cloudinaryMock.__state;

let alice;
let bob;

beforeAll(async () => {
  alice = await registerDoctor(ctx.app);
  bob = await registerDoctor(ctx.app);
});

beforeEach(() => cloudinaryMock.__reset());

describe('file type detection', () => {
  test('recognises real formats by content and ignores everything else', () => {
    expect(detectFileType(PNG)).toMatchObject({ kind: 'image', format: 'png' });
    expect(detectFileType(JPEG)).toMatchObject({ kind: 'image', format: 'jpg' });
    expect(detectFileType(MP4)).toMatchObject({ kind: 'video', format: 'mp4' });
    expect(detectFileType(EXE)).toBeNull();
    expect(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectFileType(Buffer.from('<html><body>not an image</body></html>'))).toBeNull();
    expect(detectFileType(Buffer.alloc(4))).toBeNull();
  });
});

describe('uploading', () => {
  test('requires authentication', async () => {
    const res = await request(ctx.app).post('/api/v1/media').field('purpose', 'post').attach('file', PNG, 'photo.png');
    expect(res.status).toBe(401);
    expect(cloud.uploads).toHaveLength(0);
  });

  test('images go to Cloudinary; only metadata is stored in MongoDB', async () => {
    const res = await alice.upload('profile', PNG);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ resourceType: 'image', format: 'png' });
    expect(res.body.data.url).toContain('https://res.cloudinary.com/');

    expect(cloud.uploads).toHaveLength(1);
    const sent = cloud.uploads[0].options;
    expect(sent.folder).toBe(`mkcg-test/profiles/${alice.user.id}`);
    expect(sent.resource_type).toBe('image');
    expect(sent.use_filename).toBe(false);

    const doc = await Media.findById(res.body.data.id).lean();
    expect(doc).toMatchObject({ purpose: 'profile', resourceType: 'image', deliveryType: 'upload' });
    expect(String(doc.owner)).toBe(alice.user.id);
    expect(doc.attachedTo.item).toBeNull();
    // No binary data anywhere in the record.
    expect(Object.values(doc).some((v) => Buffer.isBuffer(v))).toBe(false);
  });

  test('member-only media is stored as an authenticated (private) asset with signed URLs', async () => {
    const res = await alice.upload('memory', MP4, 'clip.mp4', 'video/mp4');
    expect(res.status).toBe(201);
    expect(res.body.data.resourceType).toBe('video');
    expect(cloud.uploads[0].options.type).toBe('authenticated');
    expect(cloud.uploads[0].options.eager_async).toBe(true);
    expect(res.body.data.url).toContain('/authenticated/s--');
    expect(res.body.data.thumbUrl).toContain('.jpg');
  });

  test('never exposes Cloudinary credentials', async () => {
    const res = await alice.upload('post', PNG);
    const text = JSON.stringify(res.body) + JSON.stringify(res.headers);
    expect(text).not.toContain(process.env.CLOUDINARY_API_SECRET);
    expect(text).not.toContain(process.env.CLOUDINARY_API_KEY);
  });

  test('rejects files whose content is not an allowed type, whatever the name says', async () => {
    const disguised = await alice.upload('post', EXE, 'holiday-photo.png', 'image/png');
    expect(disguised.status).toBe(400);
    expect(disguised.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const svg = await alice.upload('post', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'logo.png', 'image/png');
    expect(svg.status).toBe(400);

    // A genuine video is still refused where only images are permitted.
    const videoAsPost = await alice.upload('post', MP4, 'clip.mp4', 'video/mp4');
    expect(videoAsPost.status).toBe(400);

    expect((await alice.upload('not-a-purpose', PNG)).status).toBe(400);
    expect(cloud.uploads).toHaveLength(0);
    expect(await Media.countDocuments({ owner: alice.user.id, purpose: 'post' })).toBe(1); // only the earlier valid one
  });

  test('rejects oversized files', async () => {
    // Test limits: images 1 MB, videos 2 MB.
    const bigImage = Buffer.concat([PNG, Buffer.alloc(1.2 * 1024 * 1024)]);
    const image = await alice.upload('post', bigImage);
    expect(image.status).toBe(413);
    expect(image.body.error.code).toBe('FILE_TOO_LARGE');

    const hugeVideo = Buffer.concat([MP4, Buffer.alloc(2.5 * 1024 * 1024)]);
    const video = await alice.upload('memory', hugeVideo, 'clip.mp4', 'video/mp4');
    expect(video.status).toBe(413);
    expect(cloud.uploads).toHaveLength(0);
  });

  test('a failed Cloudinary upload leaves no database record', async () => {
    const before = await Media.countDocuments();
    cloud.failNextUpload = true;
    const res = await alice.upload('post', PNG);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPLOAD_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('Simulated');
    expect(await Media.countDocuments()).toBe(before);
  });

  test('if saving the metadata fails, the Cloudinary asset is removed again', async () => {
    const before = await Media.countDocuments();
    const spy = jest.spyOn(Media, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    const res = await alice.upload('post', PNG);
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error.message).not.toContain('database unavailable');
    expect(cloud.uploads).toHaveLength(1);
    expect(cloud.destroyed.map((d) => d.publicId)).toEqual([cloud.uploads[0].result.public_id]);
    expect(await Media.countDocuments()).toBe(before);
  });
});

describe('attaching uploads to content', () => {
  test('a client-supplied media id is only accepted if the caller owns it', async () => {
    const upload = await alice.upload('post', PNG);
    const mediaId = upload.body.data.id;

    const stolen = await bob.post('/api/v1/posts', { body: 'Using someone else’s photo', mediaIds: [mediaId] });
    expect(stolen.status).toBe(400);
    expect(stolen.body.error.code).toBe('MEDIA_INVALID');
    expect(await Post.countDocuments({ author: bob.user.id })).toBe(0);
    expect((await Media.findById(mediaId)).attachedTo.item).toBeNull();

    const unknown = await alice.post('/api/v1/posts', { body: 'Unknown id', mediaIds: ['64b7f0f0f0f0f0f0f0f0f0f0'] });
    expect(unknown.status).toBe(400);

    const own = await alice.post('/api/v1/posts', { body: 'My own photo', mediaIds: [mediaId] });
    expect(own.status).toBe(201);
    expect(own.body.data.media).toHaveLength(1);
    expect(String((await Media.findById(mediaId)).attachedTo.item)).toBe(own.body.data.id);

    // The same upload cannot be attached twice.
    const reused = await alice.post('/api/v1/posts', { body: 'Reusing the photo', mediaIds: [mediaId] });
    expect(reused.status).toBe(400);
  });

  test('an upload can only be used for the purpose it was made for', async () => {
    const profilePhoto = await alice.upload('profile', PNG);
    const res = await alice.post('/api/v1/posts', { body: 'Wrong purpose', mediaIds: [profilePhoto.body.data.id] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEDIA_INVALID');
  });

  test('arbitrary URLs are never accepted in place of an upload', async () => {
    const res = await alice.post('/api/v1/posts', { body: 'External image', mediaIds: ['https://evil.example/tracker.png'] });
    expect(res.status).toBe(400);
    const res2 = await alice.post('/api/v1/posts', { body: 'External image', media: [{ url: 'https://evil.example/tracker.png' }] });
    expect(res2.status).toBe(201);
    expect(res2.body.data.media).toEqual([]);
  });

  test('profile photos: set, replace (old asset destroyed) and remove', async () => {
    const first = await bob.upload('profile', PNG);
    const set = await bob.put('/api/v1/doctors/me/photo', { mediaId: first.body.data.id });
    expect(set.status).toBe(200);
    expect(set.body.data.profile.photoUrl).toContain('https://res.cloudinary.com/');

    const firstDoc = await Media.findById(first.body.data.id);
    const second = await bob.upload('profile', JPEG, 'me.jpg', 'image/jpeg');
    await bob.put('/api/v1/doctors/me/photo', { mediaId: second.body.data.id });
    expect(cloud.destroyed.map((d) => d.publicId)).toContain(firstDoc.publicId);
    expect(await Media.findById(first.body.data.id)).toBeNull();

    const removed = await bob.delete('/api/v1/doctors/me/photo');
    expect(removed.body.data.profile.photoUrl).toBe('');
    expect(await Media.findById(second.body.data.id)).toBeNull();

    // Another doctor's upload cannot become my photo.
    const theirs = await alice.upload('profile', PNG);
    expect((await bob.put('/api/v1/doctors/me/photo', { mediaId: theirs.body.data.id })).status).toBe(400);
  });

  test('deleting content removes its Cloudinary assets', async () => {
    const upload = await alice.upload('post', PNG);
    const post = await alice.post('/api/v1/posts', { body: 'Soon to be deleted', mediaIds: [upload.body.data.id] });
    const doc = await Media.findById(upload.body.data.id);

    expect((await alice.delete(`/api/v1/posts/${post.body.data.id}`)).status).toBe(200);
    expect(cloud.destroyed.map((d) => d.publicId)).toContain(doc.publicId);
    expect(await Media.findById(upload.body.data.id)).toBeNull();
  });

  test('editing a post replaces media and cleans up what was removed', async () => {
    const a = await alice.upload('post', PNG);
    const b = await alice.upload('post', PNG);
    const post = await alice.post('/api/v1/posts', { body: 'Two versions', mediaIds: [a.body.data.id] });
    const aDoc = await Media.findById(a.body.data.id);

    const edited = await alice.patch(`/api/v1/posts/${post.body.data.id}`, { mediaIds: [b.body.data.id] });
    expect(edited.status).toBe(200);
    expect(edited.body.data.media.map((m) => m.id)).toEqual([b.body.data.id]);
    expect(cloud.destroyed.map((d) => d.publicId)).toContain(aDoc.publicId);
  });

  test('an uploader can discard an unused upload but not one that is in use', async () => {
    const unused = await alice.upload('post', PNG);
    expect((await bob.delete(`/api/v1/media/${unused.body.data.id}`)).status).toBe(404);
    expect((await alice.delete(`/api/v1/media/${unused.body.data.id}`)).status).toBe(200);

    const used = await alice.upload('post', PNG);
    await alice.post('/api/v1/posts', { body: 'Attached', mediaIds: [used.body.data.id] });
    expect((await alice.delete(`/api/v1/media/${used.body.data.id}`)).status).toBe(409);
  });

  test('an asset Cloudinary fails to delete is kept on record for a later retry', async () => {
    const upload = await alice.upload('post', PNG);
    const post = await alice.post('/api/v1/posts', { body: 'Outage during delete', mediaIds: [upload.body.data.id] });
    const spy = jest.spyOn(cloudinaryMock.v2.uploader, 'destroy').mockRejectedValueOnce(new Error('Cloudinary outage'));

    expect((await alice.delete(`/api/v1/posts/${post.body.data.id}`)).status).toBe(200);
    spy.mockRestore();

    const kept = await Media.findById(upload.body.data.id);
    expect(kept).not.toBeNull();
    expect(kept.attachedTo.item).toBeNull(); // now an orphan the cleanup job will retry
  });

  test('orphaned uploads are cleaned up, attached ones are kept', async () => {
    const orphan = await alice.upload('post', PNG);
    const kept = await alice.upload('post', PNG);
    await alice.post('/api/v1/posts', { body: 'Keeps its photo', mediaIds: [kept.body.data.id] });

    // Both are "old" now, but only the unattached one is an orphan.
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await Media.collection.updateMany({ _id: { $in: [orphan.body.data.id, kept.body.data.id].map((id) => new Media.base.Types.ObjectId(id)) } }, { $set: { createdAt: old } });
    const orphanDoc = await Media.findById(orphan.body.data.id);

    await cleanupOrphans();
    expect(await Media.findById(orphan.body.data.id)).toBeNull();
    expect(await Media.findById(kept.body.data.id)).not.toBeNull();
    expect(cloud.destroyed.map((d) => d.publicId)).toContain(orphanDoc.publicId);
  });
});

describe('private downloads', () => {
  test('only members who may see a memory can obtain its download link', async () => {
    const admin = await createAdmin(ctx.app);
    const upload = await alice.upload('memory', PNG);
    const memory = await alice.post('/api/v1/memories', { title: 'Hostel days', mediaIds: [upload.body.data.id] });
    const path = `/api/v1/memories/${memory.body.data.id}/media/${upload.body.data.id}/download`;

    expect((await request(ctx.app).get(path)).status).toBe(401);
    expect((await bob.get(path)).status).toBe(404); // still pending
    expect((await alice.get(path)).status).toBe(200); // the owner may

    await admin.patch(`/api/v1/admin/moderation/memories/${memory.body.data.id}`, { action: 'approve' });
    const res = await bob.get(path);
    expect(res.status).toBe(200);
    const expires = Number(new URL(res.body.data.url).searchParams.get('expires_at'));
    expect(expires - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
