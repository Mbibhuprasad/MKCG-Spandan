const mongoose = require('mongoose');
const moderationPlugin = require('./plugins/moderation');
const { BLOG_CATEGORIES } = require('../config/constants');

const { Schema } = mongoose;

const blogSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, maxlength: 200 },
    excerpt: { type: String, required: true, trim: true, maxlength: 320 },
    bodyMarkdown: { type: String, required: true, maxlength: 60000 },
    bodyHtml: { type: String, required: true }, // rendered from Markdown and sanitised on the server
    cover: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    category: { type: String, enum: BLOG_CATEGORIES, required: true },
    tags: { type: [{ type: String, lowercase: true, trim: true, maxlength: 30 }], default: [] },
    readingMinutes: { type: Number, default: 1, min: 1 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

blogSchema.plugin(moderationPlugin);
blogSchema.index({ moderationStatus: 1, publishedAt: -1 });
blogSchema.index({ moderationStatus: 1, category: 1, publishedAt: -1 });
blogSchema.index({ moderationStatus: 1, tags: 1, publishedAt: -1 });
blogSchema.index({ moderationStatus: 1, submittedAt: 1 });
blogSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
