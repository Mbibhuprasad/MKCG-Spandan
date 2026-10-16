'use client';

import { useId } from 'react';
import { Check, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/format';
import Button from '@/components/ui/Button';
import { Checkbox, FormMessage, TextAreaField, TextField } from '@/components/ui/Form';
import {
  CELEBRATION_PRESETS,
  LIMITS,
  PHOTO_SLOTS,
  SECTIONS,
  TEMPLATES,
  placementsOf,
  templateById,
  valueAt,
  zodiacOf,
} from './model';
import PhotoSlot from './PhotoSlot';
import PosterPreview from './PosterPreview';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Props for a text control bound to `path`, with a character counter. */
function bind({ form, errors, update }, path, max, hint) {
  const value = valueAt(form, path) ?? '';
  const count = max ? `${String(value).length}/${max}` : '';
  return {
    value,
    onChange: (event) => update(path, event.target.value),
    error: errors[path],
    hint: [hint, count].filter(Boolean).join(' · ') || undefined,
  };
}

function RefillButton({ onClick, label = 'Refill from my profile' }) {
  return (
    <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onClick}>
      {label}
    </Button>
  );
}

function StepIntro({ children, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="text-sm leading-relaxed text-fg-soft">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* Radio cards used for the portrait choice, templates, colours and placement. */
function ChoiceGroup({ label, children, className }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className={className}>
      <p id={id} className="mb-2 text-sm font-semibold text-fg">
        {label}
      </p>
      {children}
    </div>
  );
}

function Choice({ checked, onSelect, disabled, className, children, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'relative rounded-xl border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-brand bg-brand-soft ring-2 ring-brand/30' : 'border-line-strong bg-surface hover:bg-surface-2',
        className
      )}
    >
      {checked && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-fg">
          <Check className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
      {children}
    </button>
  );
}

function PortraitChooser({ form, update, onPhoto, onBusyChange }) {
  const { portraitSource, profilePhotoUrl, portrait } = form.photos;
  const options = [
    { value: 'PROFILE', title: 'My profile photo', text: profilePhotoUrl ? 'The photo on your profile.' : 'You have no profile photo yet.', disabled: !profilePhotoUrl },
    { value: 'UPLOAD', title: 'A different photo', text: 'Upload one just for this poster.' },
    { value: 'NONE', title: 'No photo', text: 'Your initials are shown instead.' },
  ];
  return (
    <div className="space-y-3">
      <ChoiceGroup label="Profile photograph" className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <Choice
              key={o.value}
              checked={portraitSource === o.value}
              disabled={o.disabled}
              onSelect={() => update('photos.portraitSource', o.value)}
              className="flex items-center gap-3 p-3 pr-8"
            >
              {o.value === 'PROFILE' && profilePhotoUrl && (
                <img src={profilePhotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-fg">{o.title}</span>
                <span className="block text-xs text-muted">{o.text}</span>
              </span>
            </Choice>
          ))}
        </div>
      </ChoiceGroup>
      {portraitSource === 'UPLOAD' && (
        <PhotoSlot
          label="Poster photograph"
          hint="A clear, front-facing photo works best. It is cropped to a circle."
          media={portrait}
          onChange={(media) => onPhoto('portrait', media)}
          onBusyChange={onBusyChange}
          round
        />
      )}
    </div>
  );
}

export function BasicStep(props) {
  const { form, update, onRefill } = props;
  const dob = form.basic.dateOfBirth;
  const sign = zodiacOf(dob);
  return (
    <div className="space-y-5">
      <StepIntro action={<RefillButton onClick={() => onRefill(['basic'])} />}>
        Filled in from your profile. What you change here is used for this poster only — your profile stays as it is.
      </StepIntro>
      <TextField label="Display name" required {...bind(props, 'basic.displayName', LIMITS.displayName, 'Exactly as it should be printed')} />
      <TextField
        label="Professional title"
        optional
        {...bind(props, 'basic.professionalTitle', LIMITS.professionalTitle, 'For example Senior Consultant or Professor of Surgery')}
      />
      <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <TextField label="Batch year" required inputMode="numeric" placeholder="e.g. 1998" {...bind(props, 'basic.batchYear')} />
        <TextField label="College name" required {...bind(props, 'basic.college', LIMITS.college)} />
      </div>
      <TextField label="Hometown or city" optional {...bind(props, 'basic.hometown', LIMITS.hometown)} />

      <PortraitChooser {...props} />

      <fieldset className="space-y-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Birthday</legend>
        <TextField
          label="Date of birth"
          optional
          type="date"
          max={todayIso()}
          className="max-w-xs"
          {...bind(props, 'basic.dateOfBirth', 0, 'Kept private unless you choose to print it below')}
        />
        <Checkbox
          label="Print my birthday on the poster"
          checked={form.settings.sections.birthday}
          disabled={!dob}
          onChange={(e) => update('settings.sections.birthday', e.target.checked)}
        />
        <Checkbox
          label="Include the year of birth"
          checked={form.basic.showBirthYear}
          disabled={!dob || !form.settings.sections.birthday}
          onChange={(e) => update('basic.showBirthYear', e.target.checked)}
        />
        <Checkbox
          label="Show my zodiac sign"
          description={sign ? `Worked out from your date of birth: ${sign}.` : 'Enter your date of birth to work out the sign.'}
          checked={form.basic.showZodiac}
          disabled={!sign}
          onChange={(e) => update('basic.showZodiac', e.target.checked)}
        />
      </fieldset>
    </div>
  );
}

export function ProfessionalStep(props) {
  return (
    <div className="space-y-5">
      <StepIntro action={<RefillButton onClick={() => props.onRefill(['professional'])} />}>
        Taken from your profile where available. Edit freely — only this poster changes.
      </StepIntro>
      <TextField label="Specialization" optional {...bind(props, 'professional.specialization', LIMITS.specialization)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Current role" optional {...bind(props, 'professional.role', LIMITS.role)} />
        <TextField label="Current workplace or organization" optional {...bind(props, 'professional.workplace', LIMITS.workplace)} />
      </div>
      <TextField
        label="Qualifications"
        optional
        {...bind(props, 'professional.qualifications', LIMITS.qualifications, 'For example MBBS, MD (General Medicine)')}
      />
      <TextAreaField label="Professional achievements" optional rows={3} {...bind(props, 'professional.achievements', LIMITS.achievements, 'One per line')} />
      <TextAreaField
        label="Awards, publications or other milestones"
        optional
        rows={3}
        {...bind(props, 'professional.milestones', LIMITS.milestones, 'One per line')}
      />
    </div>
  );
}

export function MessagesStep(props) {
  return (
    <div className="space-y-5">
      <StepIntro>
        Your words are printed exactly as you type them — nothing is rewritten. Leave any field empty to leave it out.
      </StepIntro>
      <TextField label="Greeting to Friends" optional placeholder="e.g. Dear friends," {...bind(props, 'messages.greeting', LIMITS.greeting)} />
      <TextAreaField label="Personal introduction" optional rows={4} {...bind(props, 'messages.introduction', LIMITS.introduction)} />
      <TextAreaField label="Message to friends" optional rows={4} {...bind(props, 'messages.messageToFriends', LIMITS.messageToFriends)} />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextAreaField label="Favourite quotation" optional rows={3} {...bind(props, 'messages.quotation', LIMITS.quotation)} />
        <TextField
          label="Said by"
          optional
          {...bind(props, 'messages.quotationAuthor', LIMITS.quotationAuthor, 'Only if you know who said it')}
        />
      </div>
      <TextAreaField label="Memorable college experience" optional rows={4} {...bind(props, 'messages.memory', LIMITS.memory)} />
      <TextAreaField
        label="About the batch, college or reunion"
        optional
        rows={4}
        {...bind(props, 'messages.batchMessage', LIMITS.batchMessage)}
      />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextAreaField label="Closing wishes" optional rows={2} {...bind(props, 'messages.closing', LIMITS.closing)} />
        <TextField label="Signature" optional placeholder="e.g. Asha" {...bind(props, 'messages.signature', LIMITS.signature)} />
      </div>
    </div>
  );
}

export function PhotosStep(props) {
  const { form, onPhoto, onBusyChange, goToStep } = props;
  const source = form.photos.portraitSource;
  const portraitText =
    source === 'PROFILE' ? 'Your profile photo' : source === 'UPLOAD' ? (form.photos.portrait ? 'A photo uploaded for this poster' : 'Not uploaded yet') : 'None — initials are shown';
  return (
    <div className="space-y-4">
      <StepIntro>
        Photos are stored privately: only you can see them, and they are deleted with the poster. JPG, PNG or WebP.
      </StepIntro>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg-soft p-4">
        <div>
          <p className="text-sm font-semibold text-fg">Personal photograph</p>
          <p className="text-sm text-muted">{portraitText}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => goToStep(0)}>
          Change in Basics
        </Button>
      </div>
      {PHOTO_SLOTS.map((slot) => (
        <PhotoSlot
          key={slot.key}
          label={slot.label}
          media={form.photos[slot.key]}
          onChange={(media) => onPhoto(slot.key, media)}
          onBusyChange={onBusyChange}
        />
      ))}
    </div>
  );
}

const CONTACT_FIELDS = [
  { key: 'email', label: 'Email', type: 'email', max: LIMITS.contactEmail },
  { key: 'phone', label: 'Phone number', type: 'tel', max: LIMITS.contactPhone },
  { key: 'address', label: 'Address or city', max: LIMITS.contactAddress, hint: 'A city is usually enough — avoid a full home address' },
  { key: 'website', label: 'Website or professional profile', type: 'url', max: LIMITS.contactWebsite, hint: 'Full link starting with https://' },
];

export function ContactStep(props) {
  const { form, update, onRefill } = props;
  return (
    <div className="space-y-5">
      <FormMessage tone="info">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Nothing here is printed unless you switch it on. A downloaded poster can be shared beyond the community, so include
          only what you are happy for anyone to see.
        </span>
      </FormMessage>
      <div className="flex justify-end">
        <RefillButton label="Fill values from my account" onClick={() => onRefill(['contact'])} />
      </div>
      {CONTACT_FIELDS.map((f) => (
        <div key={f.key} className="space-y-3 rounded-2xl border border-line p-4">
          <Checkbox
            label={`Print my ${f.label.toLowerCase()} on the poster`}
            checked={form.contact[f.key].include}
            onChange={(e) => update(`contact.${f.key}.include`, e.target.checked)}
          />
          <TextField label={f.label} type={f.type} autoComplete="off" {...bind(props, `contact.${f.key}.value`, f.max, f.hint)} />
        </div>
      ))}
    </div>
  );
}

function TemplateCard({ template, form, checked, onSelect }) {
  const palette = template.palettes.some((p) => p.id === form.settings.palette) ? form.settings.palette : template.palettes[0].id;
  const data = { ...form, template: template.id, settings: { ...form.settings, palette } };
  return (
    <Choice checked={checked} onSelect={onSelect} label={template.name} className="flex flex-col gap-3 p-3">
      <PosterPreview data={data} label={`${template.name} thumbnail`} className="pointer-events-none" />
      <span>
        <span className="block text-sm font-bold text-fg">{template.name}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{template.description}</span>
      </span>
    </Choice>
  );
}

export function DesignStep(props) {
  const { form, update, setTemplate, errors, fitMessage, missing } = props;
  const template = templateById(form.template);
  const placements = placementsOf(form.template);
  // A placement this layout does not offer is drawn as Left (the value itself
  // is kept, so switching back to another template restores it).
  const placement = template.placements.includes(form.settings.portraitPlacement) ? form.settings.portraitPlacement : 'LEFT';
  return (
    <div className="space-y-6">
      <TextField label="Poster title" optional placeholder="e.g. Silver Jubilee 2026" {...bind(props, 'title', LIMITS.title, 'Only for your list of posters')} />

      <ChoiceGroup label="Template">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} form={form} checked={form.template === t.id} onSelect={() => setTemplate(t.id)} />
          ))}
        </div>
      </ChoiceGroup>

      <ChoiceGroup label="Colour">
        <div className="flex flex-wrap gap-2">
          {template.palettes.map((p) => (
            <Choice
              key={p.id}
              checked={form.settings.palette === p.id}
              onSelect={() => update('settings.palette', p.id)}
              className="flex items-center gap-2.5 py-2 pl-2.5 pr-9"
            >
              <span className="flex" aria-hidden="true">
                {p.swatch.map((c) => (
                  <span key={c} className="-ml-1 h-6 w-6 rounded-full border-2 border-surface first:ml-0" style={{ background: c }} />
                ))}
              </span>
              <span className="text-sm font-semibold text-fg">{p.label}</span>
            </Choice>
          ))}
        </div>
      </ChoiceGroup>

      <ChoiceGroup label="Portrait placement">
        <div className="inline-flex flex-wrap gap-2">
          {placements.map((p) => (
            <Choice
              key={p.value}
              checked={placement === p.value}
              onSelect={() => update('settings.portraitPlacement', p.value)}
              className="px-4 py-2 pr-9 text-sm font-semibold text-fg"
            >
              {p.label}
            </Choice>
          ))}
        </div>
      </ChoiceGroup>

      <fieldset className="space-y-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Reunion or anniversary (optional)</legend>
        <p className="text-sm text-muted">
          Shown as a badge in the Silver Jubilee template, and as a ribbon, label or timeline entry in the others. Enter
          only what applies — nothing is calculated for you.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Common reunion names">
          {CELEBRATION_PRESETS.map((preset) => (
            <Button
              key={preset.title}
              variant="secondary"
              size="sm"
              onClick={() => {
                update('celebration.title', preset.title);
                update('celebration.years', String(preset.years));
              }}
            >
              {preset.title} · {preset.years}
            </Button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
          <TextField label="Title" optional placeholder="e.g. Silver Jubilee Reunion" {...bind(props, 'celebration.title', LIMITS.celebrationTitle)} />
          <TextField label="Years" optional inputMode="numeric" {...bind(props, 'celebration.years')} />
          <TextField label="Event year" optional inputMode="numeric" {...bind(props, 'celebration.eventYear')} />
        </div>
        <TextField label="Tagline" optional {...bind(props, 'celebration.tagline', LIMITS.celebrationTagline)} />
      </fieldset>

      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Sections to show</legend>
        <p className="mb-3 text-sm text-muted">Switching a section off keeps what you wrote; empty sections are left out automatically.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Checkbox
              key={s.key}
              label={s.label}
              description={s.hint}
              checked={form.settings.sections[s.key]}
              onChange={(e) => update(`settings.sections.${s.key}`, e.target.checked)}
            />
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="final-check" className="space-y-2">
        <h3 id="final-check" className="text-sm font-semibold text-fg">
          Final check
        </h3>
        {missing.length > 0 ? (
          <FormMessage tone="warn">Still needed before the poster can be saved as finished: {missing.join(', ')}.</FormMessage>
        ) : (
          <FormMessage tone="success">All required details are filled in.</FormMessage>
        )}
        {fitMessage ? (
          <FormMessage tone="warn">
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {fitMessage}
            </span>
          </FormMessage>
        ) : (
          <FormMessage tone="success">Every line fits on the poster.</FormMessage>
        )}
        {Object.keys(errors).length > 0 && <FormMessage tone="error">Some fields need attention — they are marked in their steps.</FormMessage>}
      </section>
    </div>
  );
}

export const STEP_COMPONENTS = [BasicStep, ProfessionalStep, MessagesStep, PhotosStep, ContactStep, DesignStep];
