import { Award, Quote, Stethoscope as StethoscopeIcon } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import mb from './MedicalBlue.module.css';
import { Heartbeat } from './ornaments';
import { Block, ContactList, FactList, ListBlock, Portrait, cx } from './shared';

// Clean clinical layout: a light blue header with a framed portrait and the
// doctor's professional identity, a batch strip, then a structured profile
// column beside the doctor's own words.
const PALETTES = {
  blue: { main: '#1769c2', deep: '#0b3f7a', tint: '#eaf3fd', line: '#cfe0f5', ink: '#0f2440' },
  teal: { main: '#0f8582', deep: '#0a4f52', tint: '#e7f6f5', line: '#c9e7e4', ink: '#0e2a2c' },
  indigo: { main: '#3d52c4', deep: '#232f7d', tint: '#eef0fc', line: '#d6dbf5', ink: '#161c45' },
};

const PLACEMENT = { LEFT: mb.mbHeroLeft, RIGHT: mb.mbHeroRight, CENTER: mb.mbHeroCenter };

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.blue;
  return { '--main': p.main, '--deep': p.deep, '--tint': p.tint, '--line': p.line, '--ink': p.ink };
}

export default function MedicalBlue({ d, palette, placement }) {
  const celebration = d.celebration;
  const hasLists = d.achievements.length > 0 || d.milestones.length > 0;
  const toFriends = d.greeting || d.messageToFriends;
  const hasAside = Boolean(celebration || d.professional.qualifications || d.facts.length || d.contacts.length);

  return (
    <div className={mb.mb} style={paletteStyle(palette)}>
      <header className={mb.mbHeader}>
        <span className={mb.mbTopBar} />
        <Heartbeat className={mb.mbPulseBg} />
        <p className={mb.mbKicker}>{site.name} · Batch profile</p>
        <div className={cx(mb.mbHero, PLACEMENT[placement] || PLACEMENT.LEFT)}>
          <Portrait url={d.portraitUrl} initials={d.initials} className={mb.mbPortrait} />
          <div className={mb.mbIdentity}>
            <div className={mb.mbNameBox} data-fit="name" data-fit-min="0.45">
              <h2 className={cx(mb.mbName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
            </div>
            {d.professionalTitle && <p className={mb.mbTitle}>{d.professionalTitle}</p>}
            {d.professional.specialization && (
              <p className={mb.mbSpec}>
                <StethoscopeIcon className={mb.mbSpecIcon} aria-hidden="true" strokeWidth={2} />
                <span>{d.professional.specialization}</span>
              </p>
            )}
            {d.roleLine && <p className={mb.mbRole}>{d.roleLine}</p>}
          </div>
        </div>
      </header>

      {(d.batchYear || d.college) && (
        <div className={mb.mbStrip} data-fit="college" data-fit-min="0.5">
          <div className={mb.mbStripInner}>
            {d.batchYear && <p className={mb.mbBatch}>Batch of {d.batchYear}</p>}
            {d.college && <p className={mb.mbCollege}>{d.college}</p>}
          </div>
        </div>
      )}

      <div className={cx(mb.mbContent, !hasAside && mb.mbContentSingle)}>
        {hasAside && (
          <aside className={mb.mbAside} data-fit="rail" data-fit-min="0.6">
            {celebration && (
              <section className={mb.mbBadge}>
                <Award className={mb.mbBadgeIcon} aria-hidden="true" strokeWidth={1.6} />
                {celebration.years && (
                  <p className={mb.mbBadgeYears}>
                    {celebration.years}
                    <span>{celebration.years === 1 ? 'year' : 'years'}</span>
                  </p>
                )}
                {celebration.title && <p className={mb.mbBadgeTitle}>{celebration.title}</p>}
                {celebration.eventYear && <p className={mb.mbBadgeMeta}>{celebration.eventYear}</p>}
                {celebration.tagline && <p className={mb.mbBadgeTagline}>{celebration.tagline}</p>}
              </section>
            )}
            {d.professional.qualifications && (
              <section className={mb.mbCard}>
                <h3 className={mb.mbCardLabel}>Qualifications</h3>
                <p className={mb.mbCardText}>{d.professional.qualifications}</p>
              </section>
            )}
            {d.facts.length > 0 && (
              <section className={mb.mbCard}>
                <h3 className={mb.mbCardLabel}>Personal</h3>
                <FactList facts={d.facts} className={mb.mbFacts} itemClassName={mb.mbFact} />
              </section>
            )}
            {d.contacts.length > 0 && (
              <section className={cx(mb.mbCard, mb.mbContactCard)}>
                <h3 className={mb.mbCardLabel}>Contact</h3>
                <ContactList contacts={d.contacts} className={mb.mbContacts} itemClassName={mb.mbContact} data-fit="contact" data-fit-min="0.65" />
              </section>
            )}
          </aside>
        )}

        <main className={mb.mbMain} data-fit="body" data-fit-min="0.6">
          <Block heading="About me" text={d.introduction} className={mb.mbBlock} headingClassName={mb.mbLabel} textClassName={mb.mbLead} />
          {hasLists && (
            <div className={cx(mb.mbLists, !(d.achievements.length && d.milestones.length) && mb.mbListsSingle)}>
              <ListBlock heading="Professional achievements" items={d.achievements} className={mb.mbBlock} headingClassName={mb.mbLabel} listClassName={mb.mbList} />
              <ListBlock heading="Awards & publications" items={d.milestones} className={mb.mbBlock} headingClassName={mb.mbLabel} listClassName={mb.mbList} />
            </div>
          )}
          {d.quotation && (
            <figure className={mb.mbQuote}>
              <Quote className={mb.mbQuoteMark} aria-hidden="true" strokeWidth={1.5} />
              <div>
                <blockquote className={mb.mbQuoteText}>{d.quotation}</blockquote>
                {d.quotationAuthor && <figcaption className={mb.mbQuoteBy}>— {d.quotationAuthor}</figcaption>}
              </div>
            </figure>
          )}
          {toFriends && (
            <section className={mb.mbBlock}>
              <h3 className={mb.mbLabel}>To my friends</h3>
              {d.greeting && <p className={mb.mbGreeting}>{d.greeting}</p>}
              {d.messageToFriends && <p className={mb.mbText}>{d.messageToFriends}</p>}
            </section>
          )}
          <Block heading="A memory I treasure" text={d.memory} className={mb.mbBlock} headingClassName={mb.mbLabel} textClassName={mb.mbText} />
          <Block heading="Our batch" text={d.batchMessage} className={mb.mbBlock} headingClassName={mb.mbLabel} textClassName={mb.mbText} />
          {(d.closing || d.signature) && (
            <div className={mb.mbClosing}>
              {d.closing && <p className={mb.mbText}>{d.closing}</p>}
              {d.signature && <p className={mb.mbSignature}>{d.signature}</p>}
            </div>
          )}
        </main>
      </div>

      {d.gallery.length > 0 && (
        <div className={mb.mbGallery}>
          {d.gallery.map((photo) => (
            <figure key={photo.key} className={mb.mbPhoto}>
              <div className={mb.mbPhotoFrame}>
                <img src={photo.url} alt="" className={styles.photo} draggable={false} />
              </div>
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <footer className={mb.mbFooter}>
        <p className={mb.mbBrand}>{site.name}</p>
        <Heartbeat className={mb.mbPulse} />
      </footer>
    </div>
  );
}
