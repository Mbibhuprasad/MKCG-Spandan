const crypto = require('crypto');
const MarkdownIt = require('markdown-it');
const { FilterXSS } = require('xss');
const slugify = require('slugify');

// Layer 1 — markdown-it with html:false escapes any raw HTML in the source,
// and its link validator refuses javascript:/vbscript:/data: URLs.
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

// Images are not allowed in the body: the only blog image is the Cloudinary cover.
md.disable('image');

const renderToken = (tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options);

// External links open safely in a new tab and pass no ranking or referrer.
const defaultLinkOpen = md.renderer.rules.link_open || renderToken;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// The page title is the only <h1>; body headings are limited to h2–h4.
const HEADING_MAP = { h1: 'h2', h5: 'h4', h6: 'h4' };
const remapHeading = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (HEADING_MAP[token.tag]) token.tag = HEADING_MAP[token.tag];
  return renderToken(tokens, idx, options, env, self);
};
md.renderer.rules.heading_open = remapHeading;
md.renderer.rules.heading_close = remapHeading;

// Layer 2 — an independent allow-list sanitiser over the generated HTML.
const plain = [];
const sanitizer = new FilterXSS({
  whiteList: {
    h2: plain, h3: plain, h4: plain, p: plain, br: plain, hr: plain, blockquote: plain,
    ul: plain, ol: plain, li: plain, strong: plain, em: plain, s: plain, code: plain, pre: plain,
    table: plain, thead: plain, tbody: plain, tr: plain, th: plain, td: plain,
    a: ['href', 'title', 'target', 'rel'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  css: false,
});

function renderMarkdown(source) {
  return sanitizer.process(md.render(source));
}

function readingMinutes(source) {
  const words = String(source).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function makeSlug(title) {
  const base = slugify(title, { lower: true, strict: true, trim: true }).slice(0, 80).replace(/-+$/, '') || 'blog';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { renderMarkdown, readingMinutes, makeSlug };
