import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Banner, Button, Chip, DateField, FieldError, Input, SwitchRow, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { PaletteChooser, PhotoField, TemplateGallery } from './components';
import { PosterRenderer } from './PosterRenderer';
import { CELEBRATION_PRESETS, LIMITS, PHOTO_SLOTS, SECTIONS, placementsOf, templateById, valueAt, zodiacOf } from './model';

// The six steps of the poster form — the same fields, limits and wording as
// the website editor (frontend/src/components/posters/steps.jsx).

/** Props for a text field bound to a form path. */
function bind({ form, errors, update }, path, max, help) {
  const value = valueAt(form, path);
  return {
    value: value == null ? '' : String(value),
    onChangeText: (text) => update(path, text),
    error: errors[path],
    help,
    maxLength: max || undefined,
    counter: Boolean(max && max >= 120),
  };
}

function Intro({ children, onRefill, refillLabel = 'Refill from my profile' }) {
  return (
    <View style={styles.intro}>
      <Text variant="small" tone="muted" style={styles.flex}>
        {children}
      </Text>
      {onRefill ? <Button title={refillLabel} icon="refresh" size="sm" variant="ghost" onPress={onRefill} /> : null}
    </View>
  );
}

function Group({ title, children }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.group, { borderColor: colors.line }]}>
      {title ? <Text variant="smallStrong">{title}</Text> : null}
      {children}
    </View>
  );
}

const toDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : null);
const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

function PortraitChooser({ form, update, onPhoto, onBusyChange }) {
  const { colors } = useTheme();
  const { portraitSource, profilePhotoUrl, portrait } = form.photos;
  const options = [
    { value: 'PROFILE', title: 'My profile photo', text: profilePhotoUrl ? 'The photo on your profile.' : 'You have no profile photo yet.', disabled: !profilePhotoUrl },
    { value: 'UPLOAD', title: 'A different photo', text: 'Upload one just for this poster.' },
    { value: 'NONE', title: 'No photo', text: 'Your initials are shown instead.' },
  ];
  return (
    <Group title="Profile photograph">
      {options.map((o) => {
        const selected = portraitSource === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => update('photos.portraitSource', o.value)}
            disabled={o.disabled}
            style={[
              styles.choice,
              { borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandSoft : colors.surface },
              o.disabled && styles.disabled,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: o.disabled }}
            accessibilityLabel={`${o.title}. ${o.text}`}
          >
            {o.value === 'PROFILE' && profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.choiceAvatar} contentFit="cover" />
            ) : (
              <Ionicons name={o.value === 'NONE' ? 'person-circle-outline' : 'image-outline'} size={26} color={colors.muted} />
            )}
            <View style={styles.flex}>
              <Text variant="smallStrong">{o.title}</Text>
              <Text variant="caption" tone="muted">
                {o.text}
              </Text>
            </View>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.brand : colors.muted} />
          </Pressable>
        );
      })}
      {portraitSource === 'UPLOAD' ? (
        <PhotoField
          label="Poster photograph"
          hint="A clear, front-facing photo works best."
          media={portrait}
          onChange={(media) => onPhoto('portrait', media)}
          onBusyChange={onBusyChange}
          round
        />
      ) : null}
    </Group>
  );
}

export function BasicStep(props) {
  const { form, update, errors, onRefill } = props;
  const dob = form.basic.dateOfBirth;
  const sign = zodiacOf(dob);
  return (
    <View style={styles.step}>
      <Intro onRefill={() => onRefill(['basic'])}>
        Filled in from your profile. What you change here is used for this poster only — your profile stays as it is.
      </Intro>
      <Input label="Display name" required {...bind(props, 'basic.displayName', LIMITS.displayName, 'Exactly as it should be printed')} />
      <Input
        label="Professional title"
        {...bind(props, 'basic.professionalTitle', LIMITS.professionalTitle, 'For example Senior Consultant or Professor of Surgery')}
      />
      <Input label="Batch year" required keyboardType="number-pad" placeholder="e.g. 1998" {...bind(props, 'basic.batchYear', 4)} />
      <Input label="College name" required {...bind(props, 'basic.college', LIMITS.college)} />
      <Input label="Hometown or city" {...bind(props, 'basic.hometown', LIMITS.hometown)} />
      <PortraitChooser {...props} />
      <Group title="Birthday">
        <DateField
          label="Date of birth"
          value={toDate(dob)}
          onChange={(d) => {
            update('basic.dateOfBirth', toIso(d));
            if (!d) {
              update('settings.sections.birthday', false);
              update('basic.showZodiac', false);
            }
          }}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          error={errors['basic.dateOfBirth']}
        />
        <Text variant="caption" tone="muted">
          Kept private unless you choose to print it below.
        </Text>
        <SwitchRow
          label="Print my birthday on the poster"
          value={form.settings.sections.birthday}
          disabled={!dob}
          onValueChange={(v) => update('settings.sections.birthday', v)}
        />
        <SwitchRow
          label="Include the year of birth"
          value={form.basic.showBirthYear}
          disabled={!dob || !form.settings.sections.birthday}
          onValueChange={(v) => update('basic.showBirthYear', v)}
        />
        <SwitchRow
          label="Show my zodiac sign"
          description={sign ? `Worked out from your date of birth: ${sign}.` : 'Enter your date of birth to work out the sign.'}
          value={form.basic.showZodiac}
          disabled={!sign}
          onValueChange={(v) => update('basic.showZodiac', v)}
        />
      </Group>
    </View>
  );
}

export function ProfessionalStep(props) {
  return (
    <View style={styles.step}>
      <Intro onRefill={() => props.onRefill(['professional'])}>Filled in from your profile. Changes here apply to this poster only.</Intro>
      <Input label="Specialization" {...bind(props, 'professional.specialization', LIMITS.specialization)} />
      <Input label="Current role" {...bind(props, 'professional.role', LIMITS.role)} />
      <Input label="Current workplace or organization" {...bind(props, 'professional.workplace', LIMITS.workplace)} />
      <Input label="Qualifications" {...bind(props, 'professional.qualifications', LIMITS.qualifications, 'For example MBBS, MD (General Medicine)')} />
      <Input label="Professional achievements" multiline rows={3} {...bind(props, 'professional.achievements', LIMITS.achievements, 'One per line')} />
      <Input label="Awards, publications or other milestones" multiline rows={3} {...bind(props, 'professional.milestones', LIMITS.milestones, 'One per line')} />
    </View>
  );
}

export function MessagesStep(props) {
  return (
    <View style={styles.step}>
      <Intro>Printed exactly as you write them. Leave any of them empty to leave them out.</Intro>
      <Input label="Greeting to friends" placeholder="e.g. Dear friends," {...bind(props, 'messages.greeting', LIMITS.greeting)} />
      <Input label="Personal introduction" multiline rows={4} {...bind(props, 'messages.introduction', LIMITS.introduction)} />
      <Input label="Message to friends" multiline rows={4} {...bind(props, 'messages.messageToFriends', LIMITS.messageToFriends)} />
      <Input label="Favourite quotation" multiline rows={3} {...bind(props, 'messages.quotation', LIMITS.quotation)} />
      <Input label="Said by" {...bind(props, 'messages.quotationAuthor', LIMITS.quotationAuthor, 'Only if you know who said it')} />
      <Input label="Memorable college experience" multiline rows={4} {...bind(props, 'messages.memory', LIMITS.memory)} />
      <Input label="About the batch, college or reunion" multiline rows={4} {...bind(props, 'messages.batchMessage', LIMITS.batchMessage)} />
      <Input label="Closing wishes" multiline rows={2} {...bind(props, 'messages.closing', LIMITS.closing)} />
      <Input label="Signature" placeholder="e.g. Asha" {...bind(props, 'messages.signature', LIMITS.signature)} />
    </View>
  );
}

export function PhotosStep(props) {
  const { form, onPhoto, onBusyChange, goToStep } = props;
  const source = form.photos.portraitSource;
  const portraitText =
    source === 'PROFILE' ? 'Your profile photo' : source === 'UPLOAD' ? (form.photos.portrait ? 'A photo uploaded for this poster' : 'Not uploaded yet') : 'None — initials are shown';
  return (
    <View style={styles.step}>
      <Intro>Photos are stored privately: only you can see them, and they are deleted with the poster. JPG, PNG or WebP.</Intro>
      <Group>
        <View style={styles.intro}>
          <View style={styles.flex}>
            <Text variant="smallStrong">Personal photograph</Text>
            <Text variant="small" tone="muted">
              {portraitText}
            </Text>
          </View>
          <Button title="Change in Basics" size="sm" variant="secondary" onPress={() => goToStep(0)} />
        </View>
      </Group>
      {PHOTO_SLOTS.map((slot) => (
        <PhotoField key={slot.key} label={slot.label} media={form.photos[slot.key]} onChange={(media) => onPhoto(slot.key, media)} onBusyChange={onBusyChange} />
      ))}
    </View>
  );
}

const CONTACT_FIELDS = [
  { key: 'email', label: 'Email', keyboardType: 'email-address', max: LIMITS.contactEmail },
  { key: 'phone', label: 'Phone number', keyboardType: 'phone-pad', max: LIMITS.contactPhone },
  { key: 'address', label: 'Address or city', max: LIMITS.contactAddress, hint: 'A city is usually enough — avoid a full home address' },
  { key: 'website', label: 'Website or professional profile', keyboardType: 'url', max: LIMITS.contactWebsite, hint: 'Full link starting with https://' },
];

export function ContactStep(props) {
  const { form, update, onRefill } = props;
  return (
    <View style={styles.step}>
      <Banner
        tone="info"
        icon="shield-checkmark-outline"
        message="Nothing here is printed unless you switch it on. A downloaded poster can be shared beyond the community, so include only what you are happy for anyone to see."
      />
      <View style={styles.right}>
        <Button title="Fill values from my account" icon="refresh" size="sm" variant="ghost" onPress={() => onRefill(['contact'])} />
      </View>
      {CONTACT_FIELDS.map((f) => (
        <Group key={f.key}>
          <SwitchRow
            label={`Print my ${f.label.toLowerCase()} on the poster`}
            value={form.contact[f.key].include}
            onValueChange={(v) => update(`contact.${f.key}.include`, v)}
          />
          <Input
            label={f.label}
            keyboardType={f.keyboardType}
            autoCapitalize={f.keyboardType ? 'none' : 'sentences'}
            autoCorrect={false}
            {...bind(props, `contact.${f.key}.value`, f.max, f.hint)}
          />
        </Group>
      ))}
    </View>
  );
}

export function DesignStep(props) {
  const { form, update, setTemplate, errors, fit, onFit, missing } = props;
  const template = templateById(form.template);
  const placements = placementsOf(form.template);
  const celebrationOn = form.settings.sections.celebration;
  return (
    <View style={styles.step}>
      <Input label="Poster title" placeholder="e.g. Silver Jubilee 2026" {...bind(props, 'title', LIMITS.title, 'Only for your list of posters')} />

      <View style={styles.block}>
        <Text variant="smallStrong">Template</Text>
        <TemplateGallery value={form.template} onChange={setTemplate} width={118} />
        <Text variant="caption" tone="muted">
          {template.description} Switching keeps everything you have written.
        </Text>
      </View>

      <View style={styles.block}>
        <Text variant="smallStrong">Colour</Text>
        <PaletteChooser templateId={form.template} value={form.settings.palette} onChange={(id) => update('settings.palette', id)} />
        <FieldError message={errors['settings.palette']} />
      </View>

      <View style={styles.block}>
        <Text variant="smallStrong">Portrait placement</Text>
        <View style={styles.chips}>
          {placements.map((p) => (
            <Chip key={p.value} label={p.label} selected={form.settings.portraitPlacement === p.value} onPress={() => update('settings.portraitPlacement', p.value)} />
          ))}
        </View>
        {!placements.some((p) => p.value === form.settings.portraitPlacement) ? (
          <Text variant="caption" tone="muted">
            This template offers {placements.map((p) => p.label.toLowerCase()).join(' or ')}; your choice is drawn as left.
          </Text>
        ) : null}
      </View>

      <Group title="Reunion / anniversary badge">
        <SwitchRow label="Show the badge" value={celebrationOn} onValueChange={(v) => update('settings.sections.celebration', v)} />
        {celebrationOn ? (
          <>
            <Text variant="caption" tone="muted">
              Common reunion names — only applied when you tap one:
            </Text>
            <View style={styles.chips}>
              {CELEBRATION_PRESETS.map((p) => (
                <Chip
                  key={p.title}
                  small
                  label={`${p.title} (${p.years})`}
                  onPress={() => {
                    update('celebration.title', p.title);
                    update('celebration.years', String(p.years));
                  }}
                />
              ))}
            </View>
            <Input label="Title" placeholder="e.g. Silver Jubilee Reunion" {...bind(props, 'celebration.title', LIMITS.celebrationTitle)} />
            <View style={styles.pair}>
              <Input label="Years" keyboardType="number-pad" style={styles.flex} {...bind(props, 'celebration.years', 2)} />
              <Input label="Event year" keyboardType="number-pad" style={styles.flex} {...bind(props, 'celebration.eventYear', 4)} />
            </View>
            <Input label="Tagline" {...bind(props, 'celebration.tagline', LIMITS.celebrationTagline)} />
          </>
        ) : null}
      </Group>

      <Group title="Sections to show">
        <Text variant="caption" tone="muted">
          Switching a section off keeps what you wrote; it is just not printed.
        </Text>
        {SECTIONS.filter((s) => s.key !== 'celebration').map((s) => (
          <SwitchRow
            key={s.key}
            label={s.label}
            description={s.hint}
            value={form.settings.sections[s.key]}
            disabled={s.key === 'birthday' && !form.basic.dateOfBirth}
            onValueChange={(v) => update(`settings.sections.${s.key}`, v)}
          />
        ))}
      </Group>

      <View style={styles.block}>
        <Text variant="smallStrong">Preview</Text>
        <Text variant="caption" tone="muted">
          Drawn by the same templates as the website — exactly what is downloaded. Pinch to zoom.
        </Text>
        {missing.length ? <Banner tone="warn" message={`Still needed before you can download: ${missing.join(', ')}.`} /> : null}
        {fit && fit.overflow ? <Banner tone="danger" message={fit.message} /> : null}
        <PosterRenderer form={form} onFit={onFit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step: { gap: 16 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  group: { gap: 12, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5 },
  choiceAvatar: { width: 40, height: 40, borderRadius: 20 },
  disabled: { opacity: 0.5 },
  right: { alignItems: 'flex-end' },
  block: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pair: { flexDirection: 'row', gap: 12 },
});
