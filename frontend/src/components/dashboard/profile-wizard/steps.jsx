'use client';

import { Info, Lock } from 'lucide-react';
import {
  BLOOD_GROUPS,
  CREDENTIAL_TYPES,
  DEFAULT_COUNTRY,
  DEGREE_LEVELS,
  EMPLOYMENT_TYPES,
  INDIAN_STATES,
  PROFILE_SECTIONS,
  labelOf,
} from '@/lib/constants';
import { cn, yearRange } from '@/lib/format';
import Button from '@/components/ui/Button';
import { Checkbox, Field, FormMessage, SelectField, TextAreaField, TextField, Textarea } from '@/components/ui/Form';
import { Switch } from '@/components/admin/shared';
import TagInput from '@/components/dashboard/TagInput';
import { joinSubspecialties, splitSubspecialties } from '@/lib/specialties';
import { ComboField, EntryList, ImageAttachment, MultiComboField, YearField } from './controls';
import PhotoPicker from './PhotoPicker';
import PortfolioContent from './PortfolioContent';
import { BIO_MAX, todayInputValue, unlistedSubspecialties } from './model';

/*
 * One component per wizard step. Each receives `w`, the wizard's form helpers:
 *   w.form                      current values
 *   w.text(key, errorKey?)      → { value, onChange, error } for a text control
 *   w.setValue(key, value)      set a top-level value
 *   w.setValues(values, ...errorKeys)  set several values, clearing those messages
 *   w.list(name)                → props for <EntryList> (items, add, remove, open state, errors)
 *   w.item(name, index, key)    → { value, onChange, error } for a field inside an entry
 *   w.setItem(name, i, key, v)  set a field inside an entry
 *   w.listErr(prefix)           message for a whole list (tags)
 *   w.catalogue                 specialization / subspecialization options (lib/specialties.js)
 *   w.setVisibility / w.setSection
 */

const joined = (...parts) => parts.filter(Boolean).join(' · ');
const place = (...parts) => parts.filter(Boolean).join(', ');
const levelName = (level) => (level ? labelOf(DEGREE_LEVELS, level).replace(/ \(.*\)$/, '') : '');

function Note({ icon: Icon = Info, children }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-fg-soft">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Group({ title, description, children }) {
  return (
    <fieldset className="rounded-2xl border border-line p-4 sm:p-5">
      <legend className="px-1.5 text-sm font-bold text-fg">{title}</legend>
      {description && <p className="mb-4 text-sm text-muted">{description}</p>}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Tags({ w, name, label, placeholder, max, maxLength, hint }) {
  return (
    <TagInput
      label={label}
      placeholder={placeholder}
      hint={hint}
      values={w.form[name]}
      onChange={(values) => w.setValue(name, values)}
      max={max}
      maxLength={maxLength}
      error={w.listErr(`profile.${name}`)}
    />
  );
}

/* ── 1. Basic profile ── */
function BasicStep({ w }) {
  const length = w.form.bio.length;
  const bio = w.text('bio');
  return (
    <>
      <PhotoPicker />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          maxLength={80}
          required
          {...w.text("name", "name")}
        />
        <TextField
          label="Current designation"
          placeholder="e.g. Associate Professor"
          maxLength={120}
          optional
          {...w.text("designation")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Blood group"
          hint="Private — only you and the administrators see it unless you choose to show it in the last step."
          optional
          {...w.text("bloodGroup")}
        >
          <option value="">Not stated</option>
          {BLOOD_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Date of birth"
          type="date"
          min="1900-01-01"
          max={todayInputValue()}
          hint="Private — never shown on your profile. Friends only see you in Today's Birthdays on the day, unless you turn that off in the last step."
          optional
          {...w.text("dateOfBirth")}
        />
      </div>
      
      {/* <TextField
        label="Professional headline"
        placeholder="e.g. Interventional cardiologist and medical teacher"
        hint="One line that sums up your work. Shown below your name on your portfolio."
        maxLength={160}
        optional
        {...w.text('headline')}
      /> */}
      <TextField
        label="Address (area or locality)"
        placeholder="e.g. Nayapalli, Bhubaneswar"
        hint="Shown to signed-in members on your portfolio. Please do not enter a home address — your workplace address belongs in the Practice & contacts step."
        maxLength={240}
        optional
        {...w.text("address")}
      />
      <Field label="Biography / About the doctor" error={bio.error} optional>
        {(props) => (
          <>
            <Textarea {...props} rows={6} maxLength={BIO_MAX} {...bio} />
            <p className="flex items-start justify-between gap-4 text-xs text-muted">
              <span>Please do not include patient information.</span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  length >= BIO_MAX - 100 && "font-semibold text-warn",
                )}
              >
                <span className="sr-only">Characters used: </span>
                {length}/{BIO_MAX}
              </span>
            </p>
          </>
        )}
      </Field>
      <Tags
        w={w}
        name="languages"
        label="Languages"
        placeholder="e.g. Odia, Hindi, English"
        max={12}
        maxLength={40}
      />
    </>
  );
}

/* ── 2. Expertise ── */
function ExpertiseStep({ w }) {
  const { form, catalogue } = w;
  const specialization = form.specialization.trim();
  const subspecialties = splitSubspecialties(form.subspecialty);
  const entry = catalogue.find(specialization);
  const subOptions = catalogue.subspecializationsOf(specialization);
  // Subspecializations chosen for a different specialization that are not options of this one.
  const unlisted = unlistedSubspecialties(form, catalogue.isListed);
  const unlistedText = unlisted.map((sub) => `“${sub}”`).join(', ');

  return (
    <>
      <ComboField
        label="Primary specialization"
        placeholder="Search the list, or type your own"
        hint="If yours is not in the list, type it — it is saved exactly as a listed one would be."
        options={catalogue.names}
        keywords={catalogue.keywordsOf}
        maxLength={80}
        required={!w.isAdmin}
        optional={w.isAdmin}
        value={form.specialization}
        // The subspecialization keeps the specialization it was chosen for, so a change here is noticed below.
        onChange={(value) => w.setValues({ specialization: value }, 'profile.specialization', 'profile.subspecialty')}
        error={w.err('profile.specialization')}
      />
      <MultiComboField
        label="Subspecializations"
        placeholder={
          subOptions.length
            ? `Search ${entry ? entry.name : specialization} subspecializations, or type your own`
            : specialization
              ? 'Type your subspecialization'
              : 'Choose your specialization first, or type your own'
        }
        hint={
          subOptions.length
            ? `Choose as many as apply (up to 8). The list follows your specialization (${entry ? entry.name : specialization}); if one is missing, type it and press Enter.`
            : 'Optional. Add as many as apply (up to 8). Typed entries are tidied into Title Case when saved; abbreviations such as ENT or MCh are kept.'
        }
        options={subOptions}
        max={8}
        maxLength={80}
        optional
        values={subspecialties}
        // Choosing or typing one is a decision for the current specialization.
        onChange={(values) =>
          w.setValues({ subspecialty: joinSubspecialties(values), subspecialtyFor: form.specialization }, 'profile.subspecialty')
        }
        error={w.err('profile.subspecialty')}
      />
      {unlisted.length > 0 && (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn" role="status">
          <p className="font-semibold">
            You changed your specialization{specialization ? ` to ${specialization}` : ''}. {unlistedText}{' '}
            {unlisted.length === 1 ? 'is not one of its listed subspecializations.' : 'are not among its listed subspecializations.'}
          </p>
          <p className="mt-1">Choose a new one above, or tell us what to do with the old one:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => w.setValues({ subspecialtyFor: form.specialization }, 'profile.subspecialty')}
            >
              {unlisted.length === 1 ? 'It still applies' : 'They still apply'} — keep {unlistedText}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                w.setValues(
                  {
                    subspecialty: joinSubspecialties(subspecialties.filter((sub) => !unlisted.includes(sub))),
                    subspecialtyFor: form.specialization,
                  },
                  'profile.subspecialty',
                )
              }
            >
              {unlisted.length === 1 ? 'Remove it' : 'Remove them'}
            </Button>
          </div>
        </div>
      )}
      <TextField
        label="Field of work"
        placeholder="e.g. Clinical practice and teaching, Public health, Research"
        hint="The kind of work you mainly do."
        maxLength={120}
        optional
        {...w.text('fieldOfWork')}
      />
      <Tags
        w={w}
        name="expertise"
        label="Areas of expertise"
        placeholder="e.g. Joint replacement, Diabetes care"
        hint="Press Enter after each one. Up to 20."
        max={20}
        maxLength={80}
      />
      <Tags
        w={w}
        name="procedures"
        label="Procedures performed"
        placeholder="e.g. Coronary angioplasty, Cataract surgery"
        hint="Press Enter after each one. Up to 30. Leave empty if you do not perform procedures."
        max={30}
        maxLength={100}
      />

      <Group
        title="Work experience"
        description="Optional. The positions you have held. Your portfolio shows them as a timeline with the current and most recent first, whatever order you add them in."
      >
        <EntryList
          {...w.list('experience')}
          title="Positions"
          itemLabel="Position"
          addLabel="Add position"
          emptyText="No positions added yet."
          summarize={(e) => ({
            title: e.role,
            subtitle: joined(e.organization, place(e.city, e.state)),
            meta: joined(yearRange(e.startYear, e.endYear, e.current), e.employmentType && labelOf(EMPLOYMENT_TYPES, e.employmentType)),
          })}
        >
          {(item, i) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Designation or job title"
                  placeholder="e.g. Senior Resident"
                  maxLength={120}
                  required
                  {...w.item('experience', i, 'role')}
                />
                <TextField label="Hospital, clinic or organisation" maxLength={160} optional {...w.item('experience', i, 'organization')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField label="Employment type" optional {...w.item('experience', i, 'employmentType')}>
                  <option value="">Not specified</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </SelectField>
                <TextField label="City" maxLength={80} optional {...w.item('experience', i, 'city')} />
                <TextField label="State" maxLength={80} optional {...w.item('experience', i, 'state')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <YearField label="Start year" optional {...w.item('experience', i, 'startYear')} />
                <YearField
                  label="End year"
                  {...w.item('experience', i, 'endYear')}
                  value={item.current ? '' : item.endYear}
                  disabled={item.current}
                  placeholder={item.current ? 'Present' : 'YYYY'}
                  hint={item.current ? 'Shown as “Present” on your portfolio.' : undefined}
                  optional={!item.current}
                />
              </div>
              <Checkbox
                label="I currently work here"
                checked={item.current}
                onChange={(event) => w.setItem('experience', i, 'current', event.target.checked)}
              />
              <TextAreaField
                label="Responsibilities or description"
                rows={3}
                maxLength={600}
                hint="Please do not include patient information."
                optional
                {...w.item('experience', i, 'description')}
              />
            </>
          )}
        </EntryList>
      </Group>
      <Note>Your specialization and city are what Friends use to find you in the Friends section.</Note>
    </>
  );
}

/* ── 3. Education ── */
function EducationStep({ w }) {
  return (
    <>
      <Note>
        Add your qualifications in any order. Your portfolio lists the highest and most recent first — for example DM or MCh, then MD
        or MS, then MBBS, then +2 and 10th if you add them. Nothing you enter is changed.
      </Note>
      <EntryList
        {...w.list('education')}
        title="Education"
        description="Your degrees and, if you wish, your earlier schooling."
        itemLabel="Qualification"
        addLabel="Add qualification"
        emptyText="No education added yet. Add your MBBS and any further degrees."
        summarize={(e) => ({
          title: joined(e.degree, e.fieldOfStudy),
          subtitle: e.institution,
          meta: joined(yearRange(e.startYear, e.year), levelName(e.level)),
        })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Qualification or degree"
                placeholder="e.g. MBBS, MD, MS, +2 Science"
                maxLength={120}
                required
                {...w.item('education', i, 'degree')}
              />
              <SelectField label="Level" hint="Decides where this appears on your portfolio." optional {...w.item('education', i, 'level')}>
                <option value="">Not specified</option>
                {DEGREE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Institution or university" maxLength={160} optional {...w.item('education', i, 'institution')} />
              <TextField
                label="Field of study"
                placeholder="e.g. General Medicine"
                maxLength={120}
                optional
                {...w.item('education', i, 'fieldOfStudy')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <YearField label="Start year" hint="If applicable." optional {...w.item('education', i, 'startYear')} />
              <YearField label="Completion year" optional {...w.item('education', i, 'year')} />
            </div>
            <TextField
              label="Academic distinction"
              placeholder="e.g. University gold medal, Distinction in Surgery"
              maxLength={160}
              optional
              {...w.item('education', i, 'certification')}
            />
            <TextAreaField
              label="Additional details"
              placeholder="e.g. thesis topic"
              rows={2}
              maxLength={400}
              optional
              {...w.item('education', i, 'details')}
            />
          </>
        )}
      </EntryList>

      <Tags
        w={w}
        name="qualifications"
        label="Qualification letters"
        placeholder="e.g. MBBS, MD (Medicine), DNB"
        hint="The short forms shown as badges on your portfolio. Press Enter to add. Up to 12."
        max={12}
        maxLength={80}
      />

      <EntryList
        {...w.list('credentials')}
        title="Professional qualifications and certifications"
        description="Kept separate from your academic degrees: board certifications, diplomas, licences and the like."
        itemLabel="Qualification"
        addLabel="Add qualification or certification"
        emptyText="No professional qualifications added yet."
        summarize={(c) => ({
          title: c.title,
          subtitle: joined(c.type && labelOf(CREDENTIAL_TYPES, c.type), c.institution),
          meta: c.year,
        })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Qualification or certification"
                placeholder="e.g. MRCP (UK), ATLS Provider"
                maxLength={160}
                required
                {...w.item('credentials', i, 'title')}
              />
              <SelectField label="Type" optional {...w.item('credentials', i, 'type')}>
                <option value="">Not specified</option>
                {CREDENTIAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <TextField label="Awarding institution" maxLength={160} optional {...w.item('credentials', i, 'institution')} />
              <YearField label="Completion year" optional {...w.item('credentials', i, 'year')} />
            </div>
            <TextField
              label="Registration or licence details"
              placeholder="e.g. council name and registration number"
              hint="Private by default: only you and the administrators can see this unless you choose to show it in the last step."
              maxLength={120}
              optional
              {...w.item('credentials', i, 'registration')}
            />
            <TextAreaField label="Additional details" rows={2} maxLength={400} optional {...w.item('credentials', i, 'details')} />
          </>
        )}
      </EntryList>
      <Note icon={Lock}>
        Qualifications are self-declared. MKCGSPANDAN does not verify medical registrations, so please enter them accurately.
      </Note>
    </>
  );
}

/* ── 4. Practice & contacts ── */
function PracticeStep({ w }) {
  const { form } = w;
  const inIndia = form.country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();
  const v = form.visibility;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Hospital or clinic name" maxLength={160} optional {...w.text('hospital')} />
        <TextField
          label="Designation"
          placeholder="e.g. Senior Consultant"
          hint="Your current designation — the same field as in the Basic profile step."
          maxLength={120}
          optional
          {...w.text('designation')}
        />
      </div>
      <TextField
        label="Clinical practice area"
        placeholder="e.g. Outpatient cardiology and cath lab, Community paediatrics"
        hint="The setting or kind of practice you work in."
        maxLength={160}
        optional
        {...w.text('practiceArea')}
      />
      <TextField
        label="Professional workplace address"
        placeholder="e.g. department, building, street"
        hint="Your workplace only. Please do not enter a home address."
        maxLength={240}
        optional
        {...w.text('workAddress')}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <ComboField
          label="City"
          placeholder="Where you practise"
          options={w.suggestions.cities}
          maxLength={80}
          required={!w.isAdmin}
          optional={w.isAdmin}
          value={form.city}
          onChange={(value) => w.setValue('city', value)}
          error={w.err('profile.city')}
        />
        <ComboField
          label="State"
          options={inIndia ? INDIAN_STATES : []}
          maxLength={80}
          optional
          value={form.state}
          onChange={(value) => w.setValue('state', value)}
          error={w.err('profile.state')}
        />
        <TextField label="Country" autoComplete="country-name" maxLength={80} optional {...w.text('country')} />
      </div>

      <Group
        title="Professional contact details"
        description="Optional, and shown only to signed-in members on your portfolio. Your account email and phone number stay private unless you choose to show them in the last step."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Professional phone number"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="e.g. clinic reception"
            maxLength={24}
            optional
            {...w.text('workPhone')}
          />
          <TextField
            label="Professional email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="e.g. appointments@clinic.in"
            maxLength={254}
            optional
            {...w.text('workEmail')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <TextField
            label="WhatsApp number"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={24}
            optional={!form.whatsappSame}
            {...w.text('whatsappNumber', 'whatsapp.number')}
            value={form.whatsappSame ? '' : form.whatsappNumber}
            disabled={form.whatsappSame}
            placeholder={form.whatsappSame ? w.user.phone : 'e.g. 98xxxxxxxx'}
            hint="Lets Friends message you on WhatsApp."
          />
          <Checkbox
            className="sm:pt-8"
            label="Same as my registered phone number"
            description={w.user.phone}
            checked={form.whatsappSame}
            onChange={(event) => w.setValues({ whatsappSame: event.target.checked }, 'whatsapp.number')}
          />
        </div>
        {!w.isAdmin && (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Who can see these</p>
            <Switch
              label="Show my professional phone and email to members"
              description="Includes the contact phone of your other practice locations."
              checked={v.showWorkContact}
              onChange={(value) => w.setVisibility('showWorkContact', value)}
            />
            <Switch
              label="Show my WhatsApp number to members"
              checked={v.showWhatsapp}
              onChange={(value) => w.setVisibility('showWhatsapp', value)}
            />
          </div>
        )}
      </Group>

      <EntryList
        {...w.list('practiceLocations')}
        title="Other hospitals and clinics"
        description="Add any other hospital or clinic where you practise. Each one is shown as its own card on your portfolio."
        itemLabel="Practice"
        addLabel="Add hospital or clinic"
        emptyText="No other hospitals or clinics added."
        summarize={(l) => ({
          title: l.hospital,
          subtitle: joined(l.designation, l.area, place(l.city, l.state, l.country)),
          meta: l.address,
        })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Hospital or clinic name" maxLength={160} required {...w.item('practiceLocations', i, 'hospital')} />
              <TextField
                label="Designation"
                placeholder="e.g. Visiting Consultant"
                maxLength={120}
                optional
                {...w.item('practiceLocations', i, 'designation')}
              />
            </div>
            <TextField
              label="Clinical practice area"
              placeholder="e.g. Evening outpatient clinic"
              maxLength={160}
              optional
              {...w.item('practiceLocations', i, 'area')}
            />
            <TextField
              label="Professional workplace address"
              hint="Your workplace only. Please do not enter a home address."
              maxLength={240}
              optional
              {...w.item('practiceLocations', i, 'address')}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="City" maxLength={80} optional {...w.item('practiceLocations', i, 'city')} />
              <TextField label="State" maxLength={80} optional {...w.item('practiceLocations', i, 'state')} />
              <TextField label="Country" maxLength={80} optional {...w.item('practiceLocations', i, 'country')} />
            </div>
            <TextField
              label="Contact phone at this location"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              hint="Shown to members only while your professional contact details are switched on."
              maxLength={24}
              className="sm:max-w-xs"
              optional
              {...w.item('practiceLocations', i, 'phone')}
            />
          </>
        )}
      </EntryList>

      <EntryList
        {...w.list('links')}
        title="Public professional links"
        description="For example your clinic website, an appointment page or a professional networking profile."
        itemLabel="Link"
        addLabel="Add link"
        emptyText="No links added yet."
        summarize={(l) => ({ title: l.label, subtitle: l.url })}
      >
        {(item, i) => (
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <TextField label="Label" placeholder="e.g. Clinic website" maxLength={40} required {...w.item('links', i, 'label')} />
            <TextField
              label="Link"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={300}
              required
              {...w.item('links', i, 'url')}
            />
          </div>
        )}
      </EntryList>
    </>
  );
}

/* ── 5. Fellowship ── */
function FellowshipsStep({ w }) {
  return (
    <>
      <Note>
        This step is optional. If you have no fellowship or postdoctoral qualification to add, simply continue. Your portfolio lists
        the most recently completed first.
      </Note>
      <EntryList
        {...w.list('fellowships')}
        title="Fellowships and postdoctoral qualifications"
        itemLabel="Fellowship"
        addLabel="Add fellowship or qualification"
        emptyText="Nothing added — that is perfectly fine."
        summarize={(f) => ({
          title: f.title,
          subtitle: joined(f.certificate, f.institution, f.specialty),
          meta: yearRange(f.startYear, f.endYear),
        })}
      >
        {(item, i) => (
          <>
            <TextField
              label="Fellowship or postdoctoral qualification"
              placeholder="e.g. Fellowship in Minimal Access Surgery"
              maxLength={160}
              required
              {...w.item('fellowships', i, 'title')}
            />
            <TextField
              label="Qualification letters or certificate"
              placeholder="e.g. FMAS, FNB, PDCC"
              maxLength={160}
              optional
              {...w.item('fellowships', i, 'certificate')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Institution" maxLength={160} optional {...w.item('fellowships', i, 'institution')} />
              <TextField label="Specialty or field" maxLength={120} optional {...w.item('fellowships', i, 'specialty')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <YearField label="Start year" optional {...w.item('fellowships', i, 'startYear')} />
              <YearField label="Completion year" optional {...w.item('fellowships', i, 'endYear')} />
            </div>
            <TextAreaField label="Description" rows={2} maxLength={600} optional {...w.item('fellowships', i, 'description')} />
          </>
        )}
      </EntryList>
    </>
  );
}

/* ── 6. Awards & memberships ── */
function AwardsMembershipsStep({ w }) {
  return (
    <>
      <EntryList
        {...w.list('achievements')}
        title="Awards"
        description="Awards and honours you have received, with a photo or certificate if you like."
        itemLabel="Award"
        addLabel="Add award"
        emptyText="No awards added yet."
        summarize={(a) => ({ title: a.title, subtitle: a.issuer, meta: joined(a.year, a.imageId && 'Image attached') })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <TextField label="Award title" maxLength={160} required {...w.item('achievements', i, 'title')} />
              <YearField label="Year" optional {...w.item('achievements', i, 'year')} />
            </div>
            <TextField
              label="Awarding organisation"
              placeholder="e.g. Indian Medical Association"
              maxLength={160}
              optional
              {...w.item('achievements', i, 'issuer')}
            />
            <TextAreaField label="Description" rows={2} maxLength={400} optional {...w.item('achievements', i, 'description')} />
            <ImageAttachment
              label="Award image or certificate"
              hint="Shown with the award on your portfolio. Do not upload anything that contains patient information."
              purpose="award"
              imageId={item.imageId}
              imageUrl={item.imageUrl}
              onChange={({ imageId, imageUrl }) => {
                w.setItem('achievements', i, 'imageId', imageId);
                w.setItem('achievements', i, 'imageUrl', imageUrl);
              }}
            />
          </>
        )}
      </EntryList>

      <div className="space-y-5 border-t border-line pt-6">
        <EntryList
          {...w.list('memberships')}
          title="Professional memberships"
          description="Professional bodies, associations and societies you belong to."
          itemLabel="Membership"
          addLabel="Add membership"
          emptyText="No memberships added yet."
          summarize={(m) => ({
            title: m.organization,
            subtitle: m.type,
            meta: joined(yearRange(m.startYear, m.endYear, m.current), m.current && 'Current member'),
          })}
        >
          {(item, i) => (
            <>
              <TextField
                label="Association or organisation"
                placeholder="e.g. Indian Medical Association"
                maxLength={160}
                required
                {...w.item('memberships', i, 'organization')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Membership type or designation"
                  placeholder="e.g. Life member, Fellow, Secretary"
                  maxLength={120}
                  optional
                  {...w.item('memberships', i, 'type')}
                />
                <TextField
                  label="Membership number"
                  hint="Private by default — see the last step."
                  maxLength={80}
                  optional
                  {...w.item('memberships', i, 'number')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <YearField label="Start year" optional {...w.item('memberships', i, 'startYear')} />
                <YearField
                  label="End year"
                  {...w.item('memberships', i, 'endYear')}
                  value={item.current ? '' : item.endYear}
                  disabled={item.current}
                  placeholder={item.current ? 'Present' : 'YYYY'}
                  optional={!item.current}
                />
              </div>
              <Checkbox
                label="I am currently a member"
                checked={item.current}
                onChange={(event) => w.setItem('memberships', i, 'current', event.target.checked)}
              />
            </>
          )}
        </EntryList>
        <Note icon={Lock}>
          Membership numbers are never shown to other members unless you switch on registration and membership numbers in the last
          step.
        </Note>
      </div>
    </>
  );
}

/* ── 7. Publications ── */
function PublicationsStep({ w }) {
  return (
    <EntryList
      {...w.list('publications')}
      title="Publications"
      description="Your portfolio lists the most recent first."
      itemLabel="Publication"
      addLabel="Add publication"
      emptyText="No publications added yet."
      summarize={(x) => ({ title: x.title, subtitle: joined(x.journal, x.year), meta: x.authors })}
    >
      {(item, i) => (
        <>
          <TextField label="Publication title" maxLength={240} required {...w.item('publications', i, 'title')} />
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <TextField label="Journal, book or conference" maxLength={160} optional {...w.item('publications', i, 'journal')} />
            <YearField label="Publication year" optional {...w.item('publications', i, 'year')} />
          </div>
          <TextField
            label="Authors"
            placeholder="e.g. Mishra A, Das R, Patnaik S"
            maxLength={300}
            optional
            {...w.item('publications', i, 'authors')}
          />
          <TextAreaField label="Description" rows={2} maxLength={600} optional {...w.item('publications', i, 'description')} />
          <TextField
            label="DOI link or publication URL"
            type="url"
            inputMode="url"
            placeholder="https://doi.org/…"
            hint="A full link starting with http:// or https://"
            maxLength={300}
            optional
            {...w.item('publications', i, 'url')}
          />
        </>
      )}
    </EntryList>
  );
}

/* ── 8. Gallery & blogs ── */
function GalleryStep() {
  return (
    <>
      <Note>
        Gallery photos and blogs are saved and published the moment you add them — they do not wait for &ldquo;Next&rdquo;, and no
        approval is needed. You can also add more later from your portfolio or dashboard without reopening these steps.
      </Note>
      <PortfolioContent />
    </>
  );
}

/* ── 9. Visibility & review: the visibility controls (the summary follows them) ── */
function VisibilityStep({ w }) {
  if (w.isAdmin) {
    return (
      <FormMessage tone="info">
        Administrator accounts are not listed in the Friends section, so the visibility settings do not apply. Check the summary
        below and save.
      </FormMessage>
    );
  }
  const v = w.form.visibility;
  return (
    <>
      <Group title="Friends listing and portfolio">
        <Switch
          label="List me in Friends"
          description="Signed-in members can find you by name, specialization and city. If you turn this off, other members only see a brief name card."
          checked={v.directory}
          onChange={(value) => w.setVisibility('directory', value)}
        />
        <Switch
          label="Open my professional portfolio to members"
          description="If you turn this off, members who open your profile see only your name, photo, title and specialization — none of the sections or contact details below."
          checked={v.portfolio}
          onChange={(value) => w.setVisibility('portfolio', value)}
        />
        <Switch
          label="Allow a brief mention on the public homepage"
          description="If an administrator features you, visitors who are not signed in can see only your name, photo, title, specialization and city — never your contact details."
          checked={v.publicListing}
          onChange={(value) => w.setVisibility('publicListing', value)}
        />
        <Switch
          label="Show me in Today's Birthdays"
          description={
            w.form.dateOfBirth
              ? 'On your birthday, signed-in members see your name in the Today\u2019s Birthdays strip. Your date of birth and age are never shown.'
              : 'You have not entered a date of birth, so you will not appear there.'
          }
          checked={v.showBirthday}
          onChange={(value) => w.setVisibility('showBirthday', value)}
        />
      </Group>

      <Group title="Contact details" description="Contact details are only ever shown to signed-in members, on your portfolio.">
        <Switch
          label="Show my professional phone and email"
          description="The workplace contact details from the Practice & contacts step, if you entered any."
          checked={v.showWorkContact}
          onChange={(value) => w.setVisibility('showWorkContact', value)}
        />
        <Switch
          label="Show my WhatsApp number"
          description="The WhatsApp number from the Practice & contacts step, if you entered one."
          checked={v.showWhatsapp}
          onChange={(value) => w.setVisibility('showWhatsapp', value)}
        />
        <Switch
          label="Show my account email address"
          description={`${w.user.email} — the address you sign in with.`}
          checked={v.showEmail}
          onChange={(value) => w.setVisibility('showEmail', value)}
        />
        <Switch
          label="Show my account phone number"
          description={`${w.user.phone} — the number you registered with.`}
          checked={v.showPhone}
          onChange={(value) => w.setVisibility('showPhone', value)}
        />
      </Group>

      <Group title="Private details" description="Off by default. Nothing here is ever shown in the Friends section or on the public site.">
        <Switch
          label="Show my blood group on my portfolio"
          description={
            w.form.bloodGroup
              ? `${w.form.bloodGroup} — for fellow members only. It is not a substitute for a blood-group test in any medical situation.`
              : 'You have not entered a blood group, so there is nothing to show.'
          }
          checked={v.showBloodGroup}
          onChange={(value) => w.setVisibility('showBloodGroup', value)}
        />
        <Switch
          label="Show my registration and membership numbers"
          description="Registration or licence details of your qualifications, and your membership numbers."
          checked={v.showRegistration}
          onChange={(value) => w.setVisibility('showRegistration', value)}
        />
      </Group>

      <Group
        title="Portfolio sections"
        description="Choose which sections other members see on your portfolio. Your name, photo, expertise, biography and practice details are always part of it. Blogs are public, and memories you share with the community stay in the Memories section."
      >
        {PROFILE_SECTIONS.map((section) => (
          <Switch
            key={section.key}
            label={section.label}
            checked={v.sections[section.key]}
            onChange={(value) => w.setSection(section.key, value)}
          />
        ))}
      </Group>

      <Note icon={Lock}>
        You and the community administrators always see your full profile. Anything you hide here is left out by the server
        itself, so it never reaches another member&apos;s device.
      </Note>
    </>
  );
}

export const STEP_COMPONENTS = {
  basic: BasicStep,
  expertise: ExpertiseStep,
  education: EducationStep,
  practice: PracticeStep,
  fellowships: FellowshipsStep,
  awards: AwardsMembershipsStep,
  publications: PublicationsStep,
  gallery: GalleryStep,
  review: VisibilityStep,
};
