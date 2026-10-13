// Conversions between the saved account (what GET /auth/me returns), the form
// state a section screen edits, and the body PATCH /doctors/me expects.
import { YEAR_MAX, YEAR_MIN } from "@/utils/constants";
import { normalizePhone } from "@/utils/phone";
import { LISTS } from "./sections";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isHttpUrl = (value) => /^https?:\/\/[^\s]+$/i.test(value);
let itemKey = 0;
const newKey = () => `k${(itemKey += 1)}`;

const toInput = (field, value) => {
  if (field.type === "bool") return Boolean(value);
  if (field.type === "tags") return Array.isArray(value) ? [...value] : [];
  if (value === null || value === undefined) return "";
  return String(value);
};

export const emptyItem = (list) => {
  const item = { key: newKey() };
  for (const field of list.fields) item[field.key] = toInput(field, undefined);
  for (const keep of list.keep || []) item[keep] = null;
  return item;
};

export function itemToForm(list, saved) {
  const item = { key: saved.id || newKey() };
  for (const field of list.fields)
    item[field.key] = toInput(field, saved[field.key]);
  for (const keep of list.keep || []) item[keep] = saved[keep] ?? null;
  return item;
}

// Form state for one section, read from the saved account.
export function sectionToForm(section, user) {
  const form = { fields: {}, lists: {} };
  for (const field of section.fields)
    form.fields[field.key] = toInput(
      field,
      field.top ? user[field.key] : user.profile[field.key],
    );
  for (const key of section.lists)
    form.lists[key] = (user.profile[key] || []).map((saved) =>
      itemToForm(LISTS[key], saved),
    );
  if (section.whatsapp) {
    const w = user.whatsapp || {};
    form.whatsapp = {
      sameAsPhone: Boolean(w.sameAsPhone),
      number: w.sameAsPhone ? "" : w.number || "",
    };
  }
  if (section.visibility || section.whatsapp) {
    form.visibility = {};
    for (const key of section.visibility || [])
      form.visibility[key] = Boolean(user.visibility[key]);
    if (section.whatsapp)
      form.visibility.showWhatsapp = Boolean(user.visibility.showWhatsapp);
  }
  return form;
}

function fieldIssue(field, value) {
  const label = field.label;
  if (field.type === "bool" || field.type === "tags") return "";
  const text = String(value || "").trim();
  if (!text) return field.required ? `${label} is required.` : "";
  if (field.max && text.length > field.max)
    return `${label} must be at most ${field.max} characters.`;
  if (field.type === "year") {
    const n = Number(text);
    if (!/^\d{4}$/.test(text) || n < YEAR_MIN || n > YEAR_MAX)
      return "Enter a valid year.";
  }
  if (field.type === "phone" && !normalizePhone(text))
    return "Enter a valid phone number, including the country code if outside India.";
  if (field.type === "email" && !EMAIL_RE.test(text))
    return "Enter a valid email address.";
  if (field.type === "url" && !isHttpUrl(text))
    return "Enter a full link starting with http:// or https://";
  return "";
}

// Errors for one list entry, keyed by field. Empty object = valid.
export function validateItem(list, item) {
  const errors = {};
  for (const field of list.fields) {
    const issue = fieldIssue(field, item[field.key]);
    if (issue) errors[field.key] = issue;
  }
  if (list.range) {
    const [from, to, message] = list.range;
    if (
      item[from] &&
      item[to] &&
      !errors[from] &&
      !errors[to] &&
      Number(item[to]) < Number(item[from])
    )
      errors[to] = message;
  }
  return errors;
}

export function validateSection(section, form) {
  const errors = {};
  for (const field of section.fields) {
    // Required profile fields are enforced when the profile is submitted, not
    // on every save — a doctor can fill the profile in gradually. The name is
    // the exception: the account always needs one.
    const issue = fieldIssue(
      { ...field, required: field.key === "name" },
      form.fields[field.key],
    );
    if (issue) errors[field.key] = issue;
  }
  if (
    section.whatsapp &&
    !form.whatsapp.sameAsPhone &&
    form.whatsapp.number.trim() &&
    !normalizePhone(form.whatsapp.number)
  ) {
    errors.whatsapp =
      "Enter a valid WhatsApp number, including the country code if outside India.";
  }
  return errors;
}

const toValue = (field, raw) => {
  if (field.type === "bool") return Boolean(raw);
  if (field.type === "tags") return raw;
  const text = String(raw || "").trim();
  if (field.type === "year") return text ? Number(text) : null;
  if (field.type === "phone") return text ? normalizePhone(text) || text : "";
  if (field.type === "email") return text.toLowerCase();
  return text;
};

export function itemToPayload(list, item) {
  const out = {};
  for (const field of list.fields)
    out[field.key] = toValue(field, item[field.key]);
  for (const keep of list.keep || []) out[keep] = item[keep] ?? null;
  return out;
}

// The request body for one section: only the keys that section owns.
export function sectionToPayload(section, form) {
  const body = { wizardStep: section.step };
  const profile = {};
  for (const field of section.fields) {
    const value = toValue(field, form.fields[field.key]);
    if (field.top) body[field.key] = value;
    else profile[field.key] = value;
  }
  for (const key of section.lists)
    profile[key] = form.lists[key].map((item) =>
      itemToPayload(LISTS[key], item),
    );
  if (Object.keys(profile).length) body.profile = profile;
  if (section.whatsapp) {
    const sameAsPhone = Boolean(form.whatsapp.sameAsPhone);
    body.whatsapp = {
      sameAsPhone,
      number: sameAsPhone ? "" : normalizePhone(form.whatsapp.number) || "",
    };
  }
  if (form.visibility) body.visibility = { ...form.visibility };
  return body;
}

// Turns the API's field paths ("profile.city", "profile.education.0.degree",
// "whatsapp.number") into messages this screen can place:
//   { fields: { city: '…' }, lists: { education: ['Entry 1 — Degree: …'] }, other: ['…'] }
export function placeServerErrors(section, details) {
  const out = { fields: {}, lists: {}, other: [] };
  for (const [path, message] of Object.entries(details || {})) {
    const parts = path.split(".");
    if (parts[0] === "whatsapp") out.fields.whatsapp = message;
    else if (
      parts.length === 1 &&
      section.fields.some((f) => f.key === parts[0])
    )
      out.fields[parts[0]] = message;
    else if (
      parts[0] === "profile" &&
      parts.length === 2 &&
      section.fields.some((f) => f.key === parts[1])
    )
      out.fields[parts[1]] = message;
    else if (
      parts[0] === "profile" &&
      LISTS[parts[1]] &&
      section.lists.includes(parts[1])
    ) {
      const list = LISTS[parts[1]];
      const field = list.fields.find((f) => f.key === parts[3]);
      const where =
        parts[2] !== undefined && /^\d+$/.test(parts[2])
          ? `Entry ${Number(parts[2]) + 1}`
          : list.label;
      (out.lists[parts[1]] = out.lists[parts[1]] || []).push(
        `${where}${field ? ` — ${field.label}` : ""}: ${message}`,
      );
    } else out.other.push(message);
  }
  return out;
}
