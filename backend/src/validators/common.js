const { z } = require('zod');
const { cleanText, cleanLine, isHttpUrl } = require('../utils/text');
const { LIMITS, MODERATION } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'This identifier is not valid.');

const idParams = z.object({ id: objectId });

// Multi-line plain text (control characters removed, whitespace tidied).
const text = (min, max, label = 'This field') =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be at most ${max} characters.`)
    );

// Single-line plain text.
const line = (min, max, label = 'This field') =>
  z
    .string()
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be at most ${max} characters.`)
    );

const optionalLine = (max, label) => line(0, max, label).optional();
const optionalText = (max, label) => text(0, max, label).optional();

const httpUrl = z
  .string()
  .trim()
  .max(300, 'This link is too long.')
  .refine(isHttpUrl, 'Enter a full link starting with http:// or https://');

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v));

// Accepts a date, or null / '' meaning "not set".
const nullableDate = z
  .union([z.null(), z.literal(''), date])
  .transform((v) => (v instanceof Date ? v : null));

const nullableId = z.union([z.null(), z.literal(''), objectId]).transform((v) => v || null);

const year = z.union([z.null(), z.number().int().min(1940, 'Enter a valid year.').max(2100, 'Enter a valid year.')]);

const page = z.coerce.number().int().min(1).max(100000).default(1);
const limit = (fallback = 12, max = LIMITS.pageSizeMax) => z.coerce.number().int().min(1).max(max).default(fallback);

const pageQuery = (fallback = 12, max = LIMITS.pageSizeMax) => z.object({ page, limit: limit(fallback, max) });

const moderationStatusFilter = z.enum([...Object.values(MODERATION), 'ALL']);

module.exports = {
  z,
  objectId,
  idParams,
  text,
  line,
  optionalLine,
  optionalText,
  httpUrl,
  date,
  nullableDate,
  nullableId,
  year,
  page,
  limit,
  pageQuery,
  moderationStatusFilter,
};
