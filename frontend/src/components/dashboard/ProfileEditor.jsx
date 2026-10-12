'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { api, formErrors } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Checkbox, FormMessage, TextAreaField, TextField } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Feedback';
import MediaUploader from '@/components/content/MediaUploader';
import CompletionBar from './CompletionBar';
import TagInput from './TagInput';
import ChangePasswordForm from './ChangePasswordForm';

const YEAR_MIN = 1940;
const YEAR_MAX = 2100;

const str = (value) => (value === null || value === undefined ? '' : String(value));
const num = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value).trim());

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

const BLANK = {
  education: () => ({ key: newKey(), degree: '', institution: '', year: '' }),
  experience: () => ({ key: newKey(), role: '', organization: '', city: '', startYear: '', endYear: '', current: false, description: '' }),
  achievements: () => ({ key: newKey(), title: '', year: '', description: '' }),
  publications: () => ({ key: newKey(), title: '', journal: '', year: '', url: '' }),
  links: () => ({ key: newKey(), label: '', url: '' }),
};

const LIST_LIMITS = { education: 10, experience: 15, achievements: 20, publications: 30, links: 6 };

function toForm(account) {
  const user = account || {};
  const p = user.profile || {};
  const v = user.visibility || {};
  return {
    name: user.name || '',
    professionalTitle: p.professionalTitle || '',
    specialization: p.specialization || '',
    subspecialty: p.subspecialty || '',
    designation: p.designation || '',
    hospital: p.hospital || '',
    city: p.city || '',
    state: p.state || '',
    batchYear: str(p.batchYear),
    yearsOfExperience: str(p.yearsOfExperience),
    bio: p.bio || '',
    qualifications: [...(p.qualifications || [])],
    interests: [...(p.interests || [])],
    languages: [...(p.languages || [])],
    education: (p.education || []).map((e) => ({ key: e.id, degree: e.degree || '', institution: e.institution || '', year: str(e.year) })),
    experience: (p.experience || []).map((e) => ({
      key: e.id,
      role: e.role || '',
      organization: e.organization || '',
      city: e.city || '',
      startYear: str(e.startYear),
      endYear: str(e.endYear),
      current: Boolean(e.current),
      description: e.description || '',
    })),
    achievements: (p.achievements || []).map((a) => ({ key: a.id, title: a.title || '', year: str(a.year), description: a.description || '' })),
    publications: (p.publications || []).map((x) => ({ key: x.id, title: x.title || '', journal: x.journal || '', year: str(x.year), url: x.url || '' })),
    links: (p.links || []).map((l) => ({ key: l.id, label: l.label || '', url: l.url || '' })),
    visibility: {
      directory: v.directory !== false,
      publicListing: Boolean(v.publicListing),
      showEmail: Boolean(v.showEmail),
      showPhone: Boolean(v.showPhone),
    },
  };
}

function toPayload(form, includeVisibility) {
  const payload = {
    name: form.name,
    profile: {
      professionalTitle: form.professionalTitle,
      specialization: form.specialization,
      subspecialty: form.subspecialty,
      designation: form.designation,
      hospital: form.hospital,
      city: form.city,
      state: form.state,
      batchYear: num(form.batchYear),
      yearsOfExperience: num(form.yearsOfExperience),
      bio: form.bio,
      qualifications: form.qualifications,
      interests: form.interests,
      languages: form.languages,
      education: form.education.map((e) => ({ degree: e.degree, institution: e.institution, year: num(e.year) })),
      experience: form.experience.map((e) => ({
        role: e.role,
        organization: e.organization,
        city: e.city,
        startYear: num(e.startYear),
        endYear: e.current ? null : num(e.endYear),
        current: e.current,
        description: e.description,
      })),
      achievements: form.achievements.map((a) => ({ title: a.title, year: num(a.year), description: a.description })),
      publications: form.publications.map((x) => ({ title: x.title, journal: x.journal, year: num(x.year), url: x.url.trim() })),
      links: form.links.map((l) => ({ label: l.label, url: l.url.trim() })),
    },
  };
  if (includeVisibility) payload.visibility = form.visibility;
  return payload;
}

// Quick client-side checks using the same keys the API uses for its own
// validation errors (e.g. "profile.education.0.degree"). The API re-validates.
function validate(form) {
  const errors = {};
  const yearError = (value) => {
    if (value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= YEAR_MIN && n <= YEAR_MAX ? null : 'Enter a valid year.';
  };
  const put = (key, message) => {
    if (message) errors[key] = message;
  };

  if (form.name.trim().length < 2) errors.name = 'Enter your full name.';
  put('profile.batchYear', yearError(form.batchYear));
  if (form.yearsOfExperience !== '') {
    const n = Number(form.yearsOfExperience);
    if (!Number.isInteger(n) || n < 0 || n > 80) errors['profile.yearsOfExperience'] = 'Enter a number between 0 and 80.';
  }
  form.education.forEach((e, i) => {
    if (!e.degree.trim()) errors[`profile.education.${i}.degree`] = 'Degree is required.';
    put(`profile.education.${i}.year`, yearError(e.year));
  });
  form.experience.forEach((e, i) => {
    if (!e.role.trim()) errors[`profile.experience.${i}.role`] = 'Role is required.';
    put(`profile.experience.${i}.startYear`, yearError(e.startYear));
    if (!e.current) {
      put(`profile.experience.${i}.endYear`, yearError(e.endYear));
      if (e.startYear !== '' && e.endYear !== '' && Number(e.endYear) < Number(e.startYear)) {
        errors[`profile.experience.${i}.endYear`] = 'The end year cannot be before the start year.';
      }
    }
  });
  form.achievements.forEach((a, i) => {
    if (!a.title.trim()) errors[`profile.achievements.${i}.title`] = 'Title is required.';
    put(`profile.achievements.${i}.year`, yearError(a.year));
  });
  form.publications.forEach((x, i) => {
    if (!x.title.trim()) errors[`profile.publications.${i}.title`] = 'Title is required.';
    put(`profile.publications.${i}.year`, yearError(x.year));
    if (x.url.trim() && !isHttpUrl(x.url)) errors[`profile.publications.${i}.url`] = 'Enter a full link starting with http:// or https://';
  });
  form.links.forEach((l, i) => {
    if (!l.label.trim()) errors[`profile.links.${i}.label`] = 'Label is required.';
    if (!isHttpUrl(l.url)) errors[`profile.links.${i}.url`] = 'Enter a full link starting with http:// or https://';
  });
  return errors;
}

function Section({ id, title, description, children }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-bold text-fg">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** A list of repeatable entries (education, experience …) with add / remove. */
function Repeatable({ id, title, description, items, max, addLabel, emptyText, itemLabel, onAdd, onRemove, error, children }) {
  return (
    <Section id={id} title={title} description={description}>
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li key={item.key} className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {itemLabel} {index + 1}
                </p>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
              <div className="space-y-4">{children(item, index)}</div>
            </li>
          ))}
        </ol>
      )}
      {items.length < max ? (
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
          {addLabel}
        </Button>
      ) : (
        <p className="text-xs text-muted">You have reached the limit of {max} entries.</p>
      )}
    </Section>
  );
}

export default function ProfileEditor() {
  const { user, setUser, isAdmin } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(user));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const err = (key) => errors[key];
  // Errors reported for a whole list (e.g. "profile.qualifications" or "profile.qualifications.3").
  const listErr = (prefix) => {
    const key = Object.keys(errors).find((k) => errors[k] && (k === prefix || (k.startsWith(`${prefix}.`) && k.split('.').length === 3)));
    return key ? errors[key] : undefined;
  };

  const clearError = (key) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setField = (key, errorKey = `profile.${key}`) => (event) => {
    const value = event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    clearError(errorKey);
  };
  const setList = (key) => (values) => setForm((f) => ({ ...f, [key]: values }));
  const setVisibility = (key) => (event) => {
    const checked = event.target.checked;
    setForm((f) => ({ ...f, visibility: { ...f.visibility, [key]: checked } }));
  };
  const addItem = (list) => () => setForm((f) => ({ ...f, [list]: [...f[list], BLANK[list]()] }));
  const removeItem = (list) => (index) => {
    setForm((f) => ({ ...f, [list]: f[list].filter((_, i) => i !== index) }));
    // Indexes shift after a removal, so stale per-entry errors are dropped.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`profile.${list}.`))));
  };
  const setItem = (list, index, key, fromEvent = (event) => event.target.value) => (event) => {
    const value = fromEvent(event);
    setForm((f) => ({ ...f, [list]: f[list].map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));
    clearError(`profile.${list}.${index}.${key}`);
  };

  function focusFirstError() {
    setTimeout(() => {
      const invalid = document.querySelector('#profile-form [aria-invalid="true"]');
      if (invalid) invalid.focus();
      else {
        const top = document.getElementById('profile-form-message');
        if (top) top.scrollIntoView({ block: 'center' });
      }
    }, 50);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) {
      setMessage('Please check the highlighted fields.');
      focusFirstError();
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.patch('/doctors/me', toPayload(form, !isAdmin));
      setUser(data);
      setForm(toForm(data));
      toast.success('Profile saved.');
    } catch (error) {
      const parsed = formErrors(error);
      setErrors(parsed.fieldErrors);
      setMessage(parsed.message);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUploaded(list) {
    const media = list[0];
    if (!media) return;
    setPhotoBusy(true);
    try {
      const { data } = await api.put('/doctors/me/photo', { mediaId: media.id });
      setUser(data);
      toast.success('Profile photo updated.');
    } catch (error) {
      toast.error(error.message);
      // The upload was not attached to the profile: discard it.
      api.delete(`/media/${media.id}`, undefined, { silentAuth: true }).catch(() => {});
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const { data } = await api.delete('/doctors/me/photo');
      setUser(data);
      toast.success('Profile photo removed.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  if (!user) return null;
  const completion = user.profileCompletion || { percent: 0, isComplete: false, missing: [] };
  const photoUrl = user.profile ? user.profile.photoUrl : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">My profile</h1>
          <p className="mt-2 max-w-2xl text-fg-soft">
            Your profile is your professional portfolio inside the community. Every field is optional — add as much as you
            like, whenever you like.
          </p>
        </div>
        <Button href={`/doctors/${user.id}`} variant="secondary" icon={Eye}>
          View my profile
        </Button>
      </header>

      <section className="card p-5 sm:p-6" aria-label="Profile completion">
        <CompletionBar percent={completion.percent} />
        <p className="mt-2.5 text-sm text-muted">
          {completion.isComplete && completion.missing.length === 0
            ? 'Your profile is complete.'
            : completion.missing.length
              ? `${completion.isComplete ? 'Looking good. You could still add' : 'Still to add'}: ${completion.missing.join(', ')}.`
              : 'A few details are still missing.'}
        </p>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="text-lg font-bold text-fg">
          Profile photo
        </h2>
        <p className="mt-1 text-sm text-muted">A clear, recent photo helps batchmates recognise you. Photos are saved immediately.</p>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar name={user.name} src={photoUrl} size="2xl" />
            {photoBusy && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/70">
                <Spinner label="Updating photo" />
              </span>
            )}
          </div>
          <div className="w-full max-w-xs">
            <MediaUploader
              purpose="profile"
              value={[]}
              onChange={handlePhotoUploaded}
              max={1}
              label={photoUrl ? 'Replace photo' : 'Upload photo'}
            />
            {photoUrl && (
              <Button variant="danger-ghost" size="sm" icon={Trash2} className="mt-2" onClick={removePhoto} disabled={photoBusy}>
                Remove photo
              </Button>
            )}
          </div>
        </div>
      </section>

      <form id="profile-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        <div id="profile-form-message">
          <FormMessage>{message}</FormMessage>
        </div>

        <Section id="basics-heading" title="Basic details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={setField('name', 'name')}
              error={err('name')}
              maxLength={80}
              required
            />
            <TextField
              label="Professional title"
              placeholder="e.g. Consultant Cardiologist"
              value={form.professionalTitle}
              onChange={setField('professionalTitle')}
              error={err('profile.professionalTitle')}
              maxLength={120}
              optional
            />
            <TextField
              label="Specialization"
              placeholder="e.g. Cardiology"
              value={form.specialization}
              onChange={setField('specialization')}
              error={err('profile.specialization')}
              maxLength={80}
              optional
            />
            <TextField
              label="Subspecialty"
              placeholder="e.g. Interventional Cardiology"
              value={form.subspecialty}
              onChange={setField('subspecialty')}
              error={err('profile.subspecialty')}
              maxLength={80}
              optional
            />
            <TextField
              label="Professional designation"
              placeholder="e.g. Associate Professor"
              value={form.designation}
              onChange={setField('designation')}
              error={err('profile.designation')}
              maxLength={120}
              optional
            />
            <TextField
              label="Hospital or clinic"
              value={form.hospital}
              onChange={setField('hospital')}
              error={err('profile.hospital')}
              maxLength={160}
              optional
            />
            <TextField
              label="City"
              autoComplete="address-level2"
              value={form.city}
              onChange={setField('city')}
              error={err('profile.city')}
              maxLength={80}
              optional
            />
            <TextField
              label="State"
              autoComplete="address-level1"
              value={form.state}
              onChange={setField('state')}
              error={err('profile.state')}
              maxLength={80}
              optional
            />
            <TextField
              label="Batch year"
              type="number"
              inputMode="numeric"
              min={YEAR_MIN}
              max={YEAR_MAX}
              hint="The year your batch joined medical college."
              value={form.batchYear}
              onChange={setField('batchYear')}
              error={err('profile.batchYear')}
              optional
            />
            <TextField
              label="Years of experience"
              type="number"
              inputMode="numeric"
              min={0}
              max={80}
              value={form.yearsOfExperience}
              onChange={setField('yearsOfExperience')}
              error={err('profile.yearsOfExperience')}
              optional
            />
          </div>
        </Section>

        <Section id="about-heading" title="About you">
          <TextAreaField
            label="Short biography"
            rows={5}
            maxLength={1200}
            hint={`${form.bio.length}/1200 characters. Please do not include patient information.`}
            value={form.bio}
            onChange={setField('bio')}
            error={err('profile.bio')}
            optional
          />
          <TagInput
            label="Qualifications"
            placeholder="e.g. MBBS, MD (Medicine)"
            values={form.qualifications}
            onChange={setList('qualifications')}
            max={12}
            maxLength={80}
            error={listErr('profile.qualifications')}
          />
          <TagInput
            label="Professional interests"
            placeholder="e.g. Preventive cardiology"
            values={form.interests}
            onChange={setList('interests')}
            max={15}
            maxLength={60}
            error={listErr('profile.interests')}
          />
          <TagInput
            label="Languages"
            placeholder="e.g. Odia, Hindi, English"
            values={form.languages}
            onChange={setList('languages')}
            max={12}
            maxLength={40}
            error={listErr('profile.languages')}
          />
        </Section>

        <Repeatable
          id="education-heading"
          title="Medical education"
          items={form.education}
          max={LIST_LIMITS.education}
          itemLabel="Entry"
          addLabel="Add education"
          emptyText="No education entries yet."
          onAdd={addItem('education')}
          onRemove={removeItem('education')}
          error={err('profile.education')}
        >
          {(item, i) => (
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
              <TextField
                label="Degree"
                placeholder="e.g. MBBS"
                value={item.degree}
                onChange={setItem('education', i, 'degree')}
                error={err(`profile.education.${i}.degree`)}
                maxLength={120}
                required
              />
              <TextField
                label="Institution"
                value={item.institution}
                onChange={setItem('education', i, 'institution')}
                error={err(`profile.education.${i}.institution`)}
                maxLength={160}
                optional
              />
              <TextField
                label="Year"
                type="number"
                inputMode="numeric"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={item.year}
                onChange={setItem('education', i, 'year')}
                error={err(`profile.education.${i}.year`)}
              />
            </div>
          )}
        </Repeatable>

        <Repeatable
          id="experience-heading"
          title="Professional experience"
          items={form.experience}
          max={LIST_LIMITS.experience}
          itemLabel="Position"
          addLabel="Add experience"
          emptyText="No positions added yet."
          onAdd={addItem('experience')}
          onRemove={removeItem('experience')}
          error={err('profile.experience')}
        >
          {(item, i) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Role"
                  placeholder="e.g. Senior Resident"
                  value={item.role}
                  onChange={setItem('experience', i, 'role')}
                  error={err(`profile.experience.${i}.role`)}
                  maxLength={120}
                  required
                />
                <TextField
                  label="Organisation"
                  value={item.organization}
                  onChange={setItem('experience', i, 'organization')}
                  error={err(`profile.experience.${i}.organization`)}
                  maxLength={160}
                  optional
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="City"
                  value={item.city}
                  onChange={setItem('experience', i, 'city')}
                  error={err(`profile.experience.${i}.city`)}
                  maxLength={80}
                />
                <TextField
                  label="Start year"
                  type="number"
                  inputMode="numeric"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={item.startYear}
                  onChange={setItem('experience', i, 'startYear')}
                  error={err(`profile.experience.${i}.startYear`)}
                />
                <TextField
                  label="End year"
                  type="number"
                  inputMode="numeric"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={item.current ? '' : item.endYear}
                  onChange={setItem('experience', i, 'endYear')}
                  error={err(`profile.experience.${i}.endYear`)}
                  disabled={item.current}
                  hint={item.current ? 'Current position' : undefined}
                />
              </div>
              <Checkbox
                label="I currently work here"
                checked={item.current}
                onChange={setItem('experience', i, 'current', (event) => event.target.checked)}
              />
              <TextAreaField
                label="Description"
                rows={2}
                maxLength={600}
                value={item.description}
                onChange={setItem('experience', i, 'description')}
                error={err(`profile.experience.${i}.description`)}
                optional
              />
            </>
          )}
        </Repeatable>

        <Repeatable
          id="achievements-heading"
          title="Achievements"
          items={form.achievements}
          max={LIST_LIMITS.achievements}
          itemLabel="Achievement"
          addLabel="Add achievement"
          emptyText="No achievements added yet."
          onAdd={addItem('achievements')}
          onRemove={removeItem('achievements')}
          error={err('profile.achievements')}
        >
          {(item, i) => (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <TextField
                  label="Title"
                  value={item.title}
                  onChange={setItem('achievements', i, 'title')}
                  error={err(`profile.achievements.${i}.title`)}
                  maxLength={160}
                  required
                />
                <TextField
                  label="Year"
                  type="number"
                  inputMode="numeric"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={item.year}
                  onChange={setItem('achievements', i, 'year')}
                  error={err(`profile.achievements.${i}.year`)}
                />
              </div>
              <TextAreaField
                label="Description"
                rows={2}
                maxLength={400}
                value={item.description}
                onChange={setItem('achievements', i, 'description')}
                error={err(`profile.achievements.${i}.description`)}
                optional
              />
            </>
          )}
        </Repeatable>

        <Repeatable
          id="publications-heading"
          title="Publications"
          items={form.publications}
          max={LIST_LIMITS.publications}
          itemLabel="Publication"
          addLabel="Add publication"
          emptyText="No publications added yet."
          onAdd={addItem('publications')}
          onRemove={removeItem('publications')}
          error={err('profile.publications')}
        >
          {(item, i) => (
            <>
              <TextField
                label="Title"
                value={item.title}
                onChange={setItem('publications', i, 'title')}
                error={err(`profile.publications.${i}.title`)}
                maxLength={240}
                required
              />
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <TextField
                  label="Journal or publisher"
                  value={item.journal}
                  onChange={setItem('publications', i, 'journal')}
                  error={err(`profile.publications.${i}.journal`)}
                  maxLength={160}
                  optional
                />
                <TextField
                  label="Year"
                  type="number"
                  inputMode="numeric"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={item.year}
                  onChange={setItem('publications', i, 'year')}
                  error={err(`profile.publications.${i}.year`)}
                />
              </div>
              <TextField
                label="Link"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={item.url}
                onChange={setItem('publications', i, 'url')}
                error={err(`profile.publications.${i}.url`)}
                maxLength={300}
                optional
              />
            </>
          )}
        </Repeatable>

        <Repeatable
          id="links-heading"
          title="Professional links"
          description="For example your clinic website or a professional networking profile."
          items={form.links}
          max={LIST_LIMITS.links}
          itemLabel="Link"
          addLabel="Add link"
          emptyText="No links added yet."
          onAdd={addItem('links')}
          onRemove={removeItem('links')}
          error={err('profile.links')}
        >
          {(item, i) => (
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <TextField
                label="Label"
                placeholder="e.g. Clinic website"
                value={item.label}
                onChange={setItem('links', i, 'label')}
                error={err(`profile.links.${i}.label`)}
                maxLength={40}
                required
              />
              <TextField
                label="Link"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={item.url}
                onChange={setItem('links', i, 'url')}
                error={err(`profile.links.${i}.url`)}
                maxLength={300}
                required
              />
            </div>
          )}
        </Repeatable>

        <Section
          id="privacy-heading"
          title="Privacy and visibility"
          description="You decide who can find you and which contact details members can see."
        >
          {isAdmin ? (
            <FormMessage tone="info">
              Administrator accounts are not listed in the doctor directory, so these settings do not apply.
            </FormMessage>
          ) : (
            <>
              <Checkbox
                label="List me in the member directory"
                description="Signed-in members can find your profile by name, specialization and city. If you turn this off, other members only see a brief name card."
                checked={form.visibility.directory}
                onChange={setVisibility('directory')}
              />
              <Checkbox
                label="Allow a brief mention on the public homepage"
                description="If an administrator features you, visitors who are not signed in can see only your name, photo, title, specialization and city — never your contact details."
                checked={form.visibility.publicListing}
                onChange={setVisibility('publicListing')}
              />
              <Checkbox
                label="Show my email address to members"
                description="Visible on your profile to signed-in members only."
                checked={form.visibility.showEmail}
                onChange={setVisibility('showEmail')}
              />
              <Checkbox
                label="Show my phone number to members"
                description="Visible on your profile to signed-in members only."
                checked={form.visibility.showPhone}
                onChange={setVisibility('showPhone')}
              />
            </>
          )}
        </Section>

        <Section
          id="account-heading"
          title="Account details"
          description="These are used to sign in and cannot be changed here. Contact the community administrator if they need updating."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Email address" type="email" value={user.email} readOnly disabled />
            <TextField label="Phone number" type="tel" value={user.phone} readOnly disabled />
          </div>
        </Section>

        <div className="glass sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl px-4 py-3 shadow-lift sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-fg-soft">
            Profile details are visible to signed-in members.{' '}
            <Link href="/community-guidelines" className="font-semibold text-brand-ink hover:underline">
              Community guidelines
            </Link>
          </p>
          <Button type="submit" icon={Save} loading={saving} className="shrink-0">
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <ChangePasswordForm />
    </div>
  );
}
