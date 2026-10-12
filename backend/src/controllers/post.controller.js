const mongoose = require('mongoose');
const Post = require('../models/Post');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { MODERATION } = require('../config/constants');
const content = require('../services/content.service');
const { claimMedia, unclaim, syncMedia, destroyMedia } = require('../services/media.service');
const { likedSet } = require('../services/interaction.service');
const { serializePost, AUTHOR_FIELDS } = require('../services/serializers');

const populate = (query) => query.populate('author', AUTHOR_FIELDS).populate('media');

async function present(posts, viewer) {
  const liked = await likedSet(viewer, 'post', posts.map((p) => p._id));
  return posts.map((p) => serializePost(p, { viewer, likedIds: liked }));
}

// Community feed: approved posts only, for every viewer.
async function feed(req, res) {
  const { type, page, limit } = req.valid.query;
  const filter = { moderationStatus: MODERATION.APPROVED };
  if (type) filter.type = type;
  const { skip } = paging({ page, limit });
  const [posts, total] = await Promise.all([
    populate(Post.find(filter).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit)),
    Post.countDocuments(filter),
  ]);
  return ok(res, await present(posts, req.user), pageMeta({ page, limit, total }));
}

// The author's own submissions in every moderation state.
async function mine(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { author: req.user._id };
  const { skip } = paging({ page, limit });
  const [posts, total] = await Promise.all([
    populate(Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Post.countDocuments(filter),
  ]);
  return ok(res, await present(posts, req.user), pageMeta({ page, limit, total }));
}

async function getOne(req, res) {
  const doc = await content.loadVisible('post', req.valid.params.id, req.user);
  await doc.populate([{ path: 'author', select: AUTHOR_FIELDS }, { path: 'media' }]);
  const [item] = await present([doc], req.user);
  return ok(res, item);
}

async function create(req, res) {
  const { type, body, mediaIds } = req.valid.body;
  const id = new mongoose.Types.ObjectId();
  const media = await claimMedia({ ids: mediaIds, ownerId: req.user._id, purpose: 'post', kind: 'Post', itemId: id });

  let post;
  try {
    post = await Post.create({
      _id: id,
      author: req.user._id, // ownership comes from the session, never the body
      type,
      body,
      media,
      ...content.initialModeration(req.user),
    });
  } catch (err) {
    await unclaim(media);
    throw err;
  }

  await post.populate([{ path: 'author', select: AUTHOR_FIELDS }, { path: 'media' }]);
  return created(res, serializePost(post, { viewer: req.user }));
}

async function update(req, res) {
  const post = await content.loadManageable('post', req.valid.params.id, req.user);
  const { type, body, mediaIds } = req.valid.body;

  let removed = [];
  let claimed = [];
  if (mediaIds !== undefined) {
    const result = await syncMedia({
      currentIds: post.media,
      nextIds: mediaIds,
      ownerId: req.user._id,
      purpose: 'post',
      kind: 'Post',
      itemId: post._id,
    });
    post.media = result.ids;
    ({ removed, claimed } = result);
  }
  if (type !== undefined) post.type = type;
  if (body !== undefined) post.body = body;
  content.resetModerationAfterEdit(post, req.user);

  try {
    await post.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);

  await post.populate([{ path: 'author', select: AUTHOR_FIELDS }, { path: 'media' }]);
  return ok(res, serializePost(post, { viewer: req.user }));
}

async function remove(req, res) {
  const post = await content.loadManageable('post', req.valid.params.id, req.user);
  await content.deleteContent('post', post);
  return ok(res, { deleted: true });
}

module.exports = { feed, mine, getOne, create, update, remove };
