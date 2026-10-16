import { Cake, Globe, House, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { PHOTO_SLOTS, birthdayLabel, initialsOf, linesOf, zodiacOf } from '../model';
import styles from '../poster.module.css';

const t = (value) => String(value ?? '').trim();

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const CONTACT_ICONS = { email: Mail, phone: Phone, address: MapPin, website: Globe };

/**
 * Everything a template prints, worked out once from the form. Empty values
 * and switched-off sections are simply absent — a template never fills a gap
 * with invented text.
 */
export function derive(data) {
  const s = data.settings.sections;
  const b = data.basic;
  const pr = data.professional;
  const m = data.messages;
  const c = data.celebration;
  const ph = data.photos;

  let portraitUrl = '';
  if (ph.portraitSource === 'PROFILE') portraitUrl = ph.profilePhotoUrl || '';
  if (ph.portraitSource === 'UPLOAD' && ph.portrait) portraitUrl = ph.portrait.url || '';

  const birthday = s.birthday ? birthdayLabel(b.dateOfBirth, b.showBirthYear) : '';
  const zodiac = b.showZodiac ? zodiacOf(b.dateOfBirth) : '';
  const facts = [
    t(b.hometown) && { key: 'hometown', icon: House, text: t(b.hometown) },
    birthday && { key: 'birthday', icon: Cake, text: birthday },
    zodiac && { key: 'zodiac', icon: Sparkles, text: zodiac },
  ].filter(Boolean);

  const years = t(c.years);
  const celebration =
    s.celebration && (t(c.title) || years)
      ? { title: t(c.title), years: years ? Number(years) : null, eventYear: t(c.eventYear), tagline: t(c.tagline) }
      : null;

  const contacts = ['email', 'phone', 'address', 'website']
    .filter((key) => data.contact[key].include && t(data.contact[key].value))
    .map((key) => ({ key, icon: CONTACT_ICONS[key], text: t(data.contact[key].value) }));

  const gallery = s.gallery
    ? PHOTO_SLOTS.filter((slot) => ph[slot.key] && ph[slot.key].url).map((slot) => ({
        key: slot.key,
        url: ph[slot.key].url,
        caption: slot.caption,
      }))
    : [];

  const professional = s.professional
    ? {
        specialization: t(pr.specialization),
        role: t(pr.role),
        workplace: t(pr.workplace),
        qualifications: t(pr.qualifications),
      }
    : { specialization: '', role: '', workplace: '', qualifications: '' };

  const on = (key, value) => (s[key] ? t(value) : '');

  return {
    displayName: t(b.displayName),
    professionalTitle: t(b.professionalTitle),
    batchYear: t(b.batchYear),
    college: t(b.college),
    portraitUrl,
    initials: initialsOf(b.displayName),
    facts,
    professional,
    roleLine: [professional.role, professional.workplace].filter(Boolean).join(' · '),
    achievements: s.achievements ? linesOf(pr.achievements) : [],
    milestones: s.achievements ? linesOf(pr.milestones) : [],
    greeting: t(m.greeting),
    introduction: on('introduction', m.introduction),
    messageToFriends: on('messageToFriends', m.messageToFriends),
    quotation: on('quotation', m.quotation),
    quotationAuthor: s.quotation ? t(m.quotationAuthor) : '',
    memory: on('memory', m.memory),
    batchMessage: on('batchMessage', m.batchMessage),
    closing: on('closing', m.closing),
    signature: s.closing ? t(m.signature) : '',
    celebration,
    contacts,
    gallery,
  };
}

export function Portrait({ url, initials, className }) {
  return (
    <div className={className}>
      {url ? (
        <img src={url} alt="" className={styles.photo} draggable={false} />
      ) : (
        <span className={styles.monogram} aria-hidden="true">
          {initials || ' '}
        </span>
      )}
    </div>
  );
}

export function FactList({ facts, className, itemClassName }) {
  if (!facts.length) return null;
  return (
    <ul className={className}>
      {facts.map(({ key, icon: Icon, text }) => (
        <li key={key} className={itemClassName}>
          <Icon className={styles.factIcon} aria-hidden="true" strokeWidth={1.8} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export function ContactList({ contacts, className, itemClassName, ...rest }) {
  if (!contacts.length) return null;
  return (
    <ul className={className} {...rest}>
      {contacts.map(({ key, icon: Icon, text }) => (
        <li key={key} className={itemClassName}>
          <Icon className={styles.contactIcon} aria-hidden="true" strokeWidth={1.8} />
          <span className={styles.contactText}>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** A titled block of the doctor's own words, printed as written (line breaks kept). */
export function Block({ heading, text, className, headingClassName, textClassName }) {
  if (!text) return null;
  return (
    <section className={className}>
      {heading && <h3 className={headingClassName}>{heading}</h3>}
      <p className={textClassName}>{text}</p>
    </section>
  );
}

export function ListBlock({ heading, items, className, headingClassName, listClassName }) {
  if (!items.length) return null;
  return (
    <section className={className}>
      <h3 className={headingClassName}>{heading}</h3>
      <ul className={listClassName}>
        {items.map((item, i) => (
          <li key={`${i}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
