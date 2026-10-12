const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const ApiError = require('../utils/ApiError');
const { ok, created, pageMeta } = require('../utils/respond');
const { paging } = require('../utils/pagination');
const { escapeRegex } = require('../utils/text');
const { MODERATION, BLOG_CATEGORIES } = require('../config/constants');
const content = require('../services/content.service');
const { claimMedia, unclaim, destroyMedia } = require('../services/media.service');
const { hasLiked } = require('../services/interaction.service');
const { renderMarkdown, readingMinutes, makeSlug } = require('../services/markdown.service');
const { serializeBlogSummary, serializeBlogDetail, AUTHOR_FIELDS } = require('../services/serializers');

const POPULATE = [{ path: 'author', select: AUTHOR_FIELDS }, { path: 'cover' }];

// Public directory: approved blogs only.
async function list(req, res) {
  const { q, category, tag, page, limit } = req.valid.query;
  const filter = { moderationStatus: MODERATION.APPROVED };
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const { skip } = paging({ page, limit });
  const [blogs, total] = await Promise.all([
    Blog.find(filter).select('-bodyMarkdown -bodyHtml').sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Blog.countDocuments(filter),
  ]);
  return ok(res, blogs.map((b) => serializeBlogSummary(b, { viewer: req.user })), pageMeta({ page, limit, total }));
}

async function taxonomy(_req, res) {
  const approved = { moderationStatus: MODERATION.APPROVED };
  const [byCategory, byTag] = await Promise.all([
    Blog.aggregate([{ $match: approved }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Blog.aggregate([
      { $match: approved },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 30 },
    ]),
  ]);
  const counts = Object.fromEntries(byCategory.map((c) => [c._id, c.count]));
  return ok(res, {
    categories: BLOG_CATEGORIES.map((name) => ({ name, count: counts[name] || 0 })),
    tags: byTag.map((t) => ({ name: t._id, count: t.count })),
  });
}

async function mine(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { author: req.user._id };
  const { skip } = paging({ page, limit });
  const [blogs, total] = await Promise.all([
    Blog.find(filter).select('-bodyMarkdown -bodyHtml').sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Blog.countDocuments(filter),
  ]);
  return ok(res, blogs.map((b) => serializeBlogSummary(b, { viewer: req.user })), pageMeta({ page, limit, total }));
}

// Public for approved blogs. The author and admins can also preview an
// unpublished blog; everyone else receives a plain 404.
async function getBySlug(req, res) {
  const blog = await Blog.findOne({ slug: req.valid.params.slug }).populate(POPULATE);
  if (!blog || !content.canView('blog', blog, req.user)) throw ApiError.notFound('That blog could not be found.');
  const likedByMe = await hasLiked(req.user, 'blog', blog._id);
  return ok(res, serializeBlogDetail(blog, { viewer: req.user, likedByMe }));
}

// Owner/admin: full record including the Markdown source, for editing.
async function getForEdit(req, res) {
  const blog = await content.loadManageable('blog', req.valid.params.id, req.user, { adminAllowed: true });
  await blog.populate(POPULATE);
  return ok(res, serializeBlogDetail(blog, { viewer: req.user, includeSource: true }));
}

async function create(req, res) {
  const { title, excerpt, body, category, tags, coverId } = req.valid.body;
  const id = new mongoose.Types.ObjectId();
  const claimed = coverId
    ? await claimMedia({ ids: [coverId], ownerId: req.user._id, purpose: 'blog', kind: 'Blog', itemId: id })
    : [];

  let blog;
  try {
    blog = await Blog.create({
      _id: id,
      author: req.user._id,
      title,
      slug: makeSlug(title),
      excerpt,
      bodyMarkdown: body,
      bodyHtml: renderMarkdown(body),
      readingMinutes: readingMinutes(body),
      category,
      tags,
      cover: claimed[0] || null,
      ...content.initialModeration(req.user),
    });
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }

  await blog.populate(POPULATE);
  return created(res, serializeBlogDetail(blog, { viewer: req.user, includeSource: true }));
}

async function update(req, res) {
  const blog = await content.loadManageable('blog', req.valid.params.id, req.user);
  const { title, excerpt, body, category, tags, coverId } = req.valid.body;

  let claimed = [];
  let removed = [];
  if (coverId !== undefined && String(coverId || '') !== String(blog.cover || '')) {
    if (coverId) {
      claimed = await claimMedia({ ids: [coverId], ownerId: req.user._id, purpose: 'blog', kind: 'Blog', itemId: blog._id });
    }
    if (blog.cover) removed = [blog.cover];
    blog.cover = coverId || null;
  }
  if (title !== undefined) blog.title = title; // the slug stays stable so links keep working
  if (excerpt !== undefined) blog.excerpt = excerpt;
  if (category !== undefined) blog.category = category;
  if (tags !== undefined) blog.tags = tags;
  if (body !== undefined) {
    blog.bodyMarkdown = body;
    blog.bodyHtml = renderMarkdown(body);
    blog.readingMinutes = readingMinutes(body);
  }
  content.resetModerationAfterEdit(blog, req.user);

  try {
    await blog.save();
  } catch (err) {
    await unclaim(claimed);
    throw err;
  }
  await destroyMedia(removed);

  await blog.populate(POPULATE);
  return ok(res, serializeBlogDetail(blog, { viewer: req.user, includeSource: true }));
}

async function remove(req, res) {
  const blog = await content.loadManageable('blog', req.valid.params.id, req.user);
  await content.deleteContent('blog', blog);
  return ok(res, { deleted: true });
}

module.exports = { list, taxonomy, mine, getBySlug, getForEdit, create, update, remove };
