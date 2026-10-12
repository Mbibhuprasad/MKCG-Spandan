'use client';

import { Info, Lock } from 'lucide-react';
import {
  CREDENTIAL_TYPES,
  DEFAULT_COUNTRY,
  DEGREE_LEVELS,
  EMPLOYMENT_TYPES,
  INDIAN_STATES,
  PROFILE_SECTIONS,
  labelOf,
} from '@/lib/constants';
import { cn, yearRange } from '@/lib/format';
import { Checkbox, Field, FormMessage, SelectField, TextAreaField, TextField, Textarea } from '@/components/ui/Form';
import { Switch } from '@/components/admin/shared';
import TagInput from '@/components/dashboard/TagInput';
import { ComboField, EntryList, ImageAttachment, YearField } from './controls';
import PhotoPicker from './PhotoPicker';
import PortfolioContent from './PortfolioContent';
import { BIO_MAX } from './model';

/*
 * One component per wizard step. Each receives `w`, the wizard's form helpers:
 *   w.form                      current values
 *   w.text(key, errorKey?)      → { value, onChange, error } for a text control
 *   w.setValue(key, value)      set a top-level value
 *   w.list(name)                → props for <EntryList> (items, add, remove, open state, errors)
 *   w.item(name, index, key)    → { value, onChange, error } for a field inside an entry
 *   w.setItem(name, i, key, v)  set a field inside an entry
 *   w.listErr(prefix)           message for a whole list (tags)
 *   w.setVisibility / w.setSection
 */

const joined = (...parts) => parts.filter(Boolean).join(' · ');
const place = (...parts) => parts.filter(Boolean).join(', ');

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

/* ── 1. Basic profile of doctor ── */
function BasicStep({ w }) {
  const length = w.form.bio.length;
  const bio = w.text('bio');
  return (
    <>
      <PhotoPicker />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" name="name" autoComplete="name" maxLength={80} required {...w.text('name', 'name')} />
        <TextField
          label="Professional title"
          placeholder="e.g. Consultant Cardiologist"
          hint="Shown under your name on cards and posts."
          maxLength={120}
          optional
          {...w.text('professionalTitle')}
        />
      </div>
      <TextField
        label="Current designation"
        placeholder="e.g. Associate Professor"
        maxLength={120}
        optional
        {...w.text('designation')}
      />
      <TextField
        label="Address"
        placeholder="e.g. house or building, street, area, city"
        hint="Shown to signed-in members on your portfolio."
        autoComplete="street-address"
        maxLength={240}
        optional
        {...w.text('address')}
      />
      <Field label="Biography / About the doctor" error={bio.error} optional>
        {(props) => (
          <>
            <Textarea {...props} rows={6} maxLength={BIO_MAX} {...bio} />
            <p className="flex items-start justify-between gap-4 text-xs text-muted">
              <span>Please do not include patient information.</span>
              <span className={cn('shrink-0 tabular-nums', length >= BIO_MAX - 100 && 'font-semibold text-warn')}>
                <span className="sr-only">Characters used: </span>
                {length}/{BIO_MAX}
              </span>
            </p>
          </>
        )}
      </Field>
      <Tags w={w} name="languages" label="Languages" placeholder="e.g. Odia, Hindi, English" max={12} maxLength={40} />
    </>
  );
}

/* ── 2. Field of work / expertise / procedures ── */
function ExpertiseStep({ w }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ComboField
          label="Primary specialization"
          placeholder="Search or type your specialty"
          options={w.suggestions.specializations}
          maxLength={80}
          required={!w.isAdmin}
          optional={w.isAdmin}
          value={w.form.specialization}
          onChange={(value) => w.setValue('specialization', value)}
          error={w.err('profile.specialization')}
        />
        <TextField
          label="Subspecialization"
          placeholder="e.g. Paediatric Nephrology"
          maxLength={80}
          optional
          {...w.text('subspecialty')}
        />
      </div>
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
      <Tags
        w={w}
        name="interests"
        label="Clinical and professional interests"
        placeholder="e.g. Medical education, Rural health"
        max={15}
        maxLength={60}
      />

      <Group title="Work experience" description="Optional. The positions you have held.">
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
      <Note>Your specialization and city are what batchmates use to find you in the doctor directory.</Note>
    </>
  );
}

/* ── 3. Clinical practice area / address / contact ── */
function PracticeStep({ w }) {
  const inIndia = w.form.country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();
  return (
    <>
      <TextField
        label="Clinical practice area"
        placeholder="e.g. Outpatient cardiology and cath lab, Community paediatrics"
        hint="The setting or kind of practice you work in."
        maxLength={160}
        optional
        {...w.text('practiceArea')}
      />
      <TextField label="Hospital or clinic name" maxLength={160} optional {...w.text('hospital')} />
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
          value={w.form.city}
          onChange={(value) => w.setValue('city', value)}
          error={w.err('profile.city')}
        />
        <ComboField
          label="State"
          options={inIndia ? INDIAN_STATES : []}
          maxLength={80}
          optional
          value={w.form.state}
          onChange={(value) => w.setValue('state', value)}
          error={w.err('profile.state')}
        />
        <TextField label="Country" autoComplete="country-name" maxLength={80} optional {...w.text('country')} />
      </div>

      <Group
        title="Professional contact details"
        description="Optional workplace contact details, shown to signed-in members on your portfolio. Your account email and phone number stay private unless you choose to show them in the privacy step."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Workplace email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="e.g. appointments@clinic.in"
            maxLength={254}
            optional
            {...w.text('workEmail')}
          />
          <TextField
            label="Workplace phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="e.g. clinic reception"
            maxLength={24}
            optional
            {...w.text('workPhone')}
          />
        </div>
      </Group>

      <EntryList
        {...w.list('practiceLocations')}
        title="Other practice locations"
        description="Add any other hospital or clinic where you see patients."
        itemLabel="Location"
        addLabel="Add practice location"
        emptyText="No other locations added."
        summarize={(l) => ({ title: l.hospital, subtitle: joined(l.area, place(l.city, l.state, l.country)), meta: l.address })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Hospital or clinic name" maxLength={160} required {...w.item('practiceLocations', i, 'hospital')} />
              <TextField
                label="Clinical practice area"
                placeholder="e.g. Evening outpatient clinic"
                maxLength={160}
                optional
                {...w.item('practiceLocations', i, 'area')}
              />
            </div>
            <TextField label="Workplace address" maxLength={240} optional {...w.item('practiceLocations', i, 'address')} />
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
              hint="Shown to members only while workplace contact details are switched on."
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

/* ── 4. Education / degree / certification ── */
function EducationStep({ w }) {
  return (
    <>
      <EntryList
        {...w.list('education')}
        title="Academic degrees"
        description="Your medical college and university education."
        itemLabel="Degree"
        addLabel="Add degree"
        emptyText="No degrees added yet. Add your MBBS and any further degrees."
        summarize={(e) => ({
          title: joined(e.degree, e.fieldOfStudy),
          subtitle: e.institution,
          meta: joined(yearRange(e.startYear, e.year), e.level && labelOf(DEGREE_LEVELS, e.level).replace(/ \(.*\)$/, '')),
        })}
      >
        {(item, i) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Academic degree" optional {...w.item('education', i, 'level')}>
                <option value="">Not specified</option>
                {DEGREE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </SelectField>
              <TextField label="Degree title" placeholder="e.g. MBBS, MD, MS" maxLength={120} required {...w.item('education', i, 'degree')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Field of study"
                placeholder="e.g. General Medicine"
                maxLength={120}
                optional
                {...w.item('education', i, 'fieldOfStudy')}
              />
              <TextField label="Institution or university" maxLength={160} optional {...w.item('education', i, 'institution')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <YearField label="Start year" optional {...w.item('education', i, 'startYear')} />
              <YearField label="Completion year" optional {...w.item('education', i, 'year')} />
            </div>
            <TextField
              label="Academic certification"
              placeholder="e.g. University gold medal, Distinction in Surgery"
              maxLength={160}
              optional
              {...w.item('education', i, 'certification')}
            />
            <TextAreaField
              label="Additional relevant details"
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
                placeholder="e.g. DM (Cardiology), MRCP (UK), ATLS Provider"
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
              hint="Private by default: only you and the administrators can see this unless you choose to show it in the privacy step."
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

/* ── 5. Fellowship / postdoctoral certification ── */
function FellowshipsStep({ w }) {
  return (
    <>
      <Note>This step is optional. If you have no fellowship or postdoctoral qualification to add, simply continue.</Note>
      <EntryList
        {...w.list('fellowships')}
        title="Fellowships and postdoctoral certifications"
        itemLabel="Fellowship"
        addLabel="Add fellowship or certification"
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
              label="Fellowship title"
              placeholder="e.g. Fellowship in Minimal Access Surgery"
              maxLength={160}
              required
              {...w.item('fellowships', i, 'title')}
            />
            <TextField
              label="Postdoctoral qualification or certification"
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
            <TextAreaField label="Additional details" rows={2} maxLength={600} optional {...w.item('fellowships', i, 'description')} />
          </>
        )}
      </EntryList>
    </>
  );
}

/* ── 6. Awards ── */
function AwardsStep({ w }) {
  return (
    <EntryList
      {...w.list('achievements')}
      title="Awards"
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
  );
}

/* ── 7. Membership ── */
function MembershipsStep({ w }) {
  return (
    <>
      <EntryList
        {...w.list('memberships')}
        title="Professional memberships"
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
              label="Organisation or association name"
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
                hint="Private by default — see the privacy step."
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
        Membership numbers are never shown to other members unless you switch on registration and membership numbers in the
        privacy step.
      </Note>
    </>
  );
}

/* ── 8. Publications ── */
function PublicationsStep({ w }) {
  return (
    <EntryList
      {...w.list('publications')}
      title="Publications"
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
          <TextAreaField label="Short description" rows={2} maxLength={600} optional {...w.item('publications', i, 'description')} />
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

/* ── 9. Gallery and blogs ── */
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

/* ── 10. Privacy & profile visibility ── */
function VisibilityStep({ w }) {
  if (w.isAdmin) {
    return (
      <FormMessage tone="info">
        Administrator accounts are not listed in the doctor directory, so these settings do not apply. Continue to the review.
      </FormMessage>
    );
  }
  const v = w.form.visibility;
  return (
    <>
      <Group title="Who can find you">
        <Switch
          label="List me in the doctor directory"
          description="Signed-in members can find you by name, specialization and city, and open your portfolio. If you turn this off, other members only see a brief name card."
          checked={v.directory}
          onChange={(value) => w.setVisibility('directory', value)}
        />
        <Switch
          label="Allow a brief mention on the public homepage"
          description="If an administrator features you, visitors who are not signed in can see only your name, photo, title, specialization and city — never your contact details."
          checked={v.publicListing}
          onChange={(value) => w.setVisibility('publicListing', value)}
        />
      </Group>

      <Group title="Contact details" description="Contact details are only ever shown to signed-in members, on your portfolio.">
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
        <Switch
          label="Show my workplace contact details"
          description="The workplace email and phone numbers from the practice step, if you entered any."
          checked={v.showWorkContact}
          onChange={(value) => w.setVisibility('showWorkContact', value)}
        />
        <Switch
          label="Show my registration and membership numbers"
          description="Registration or licence details of your qualifications, and your membership numbers. Off by default."
          checked={v.showRegistration}
          onChange={(value) => w.setVisibility('showRegistration', value)}
        />
      </Group>

      <Group
        title="Portfolio sections"
        description="Choose which sections other members see on your portfolio. Your name, photo, expertise, biography and practice location are always part of it. Blogs are public, and memories you share with the community stay in the Memories section."
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
  practice: PracticeStep,
  education: EducationStep,
  fellowships: FellowshipsStep,
  awards: AwardsStep,
  memberships: MembershipsStep,
  publications: PublicationsStep,
  gallery: GalleryStep,
  visibility: VisibilityStep,
};
