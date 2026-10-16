import { Quote } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import m from './ModernProfessional.module.css';
import { Heartbeat } from './ornaments';
import { Block, ContactList, FactList, ListBlock, Portrait, cx } from './shared';

// Editorial layout: a dark credentials column beside a white page. The column
// holds the portrait, batch identity, qualifications and contacts; the page
// holds the name and the doctor's own words.
const PALETTES = {
  navy: { ink: '#0c1f3f', ink2: '#16305e', tint: '#eef2f8', line: '#d7dfeb' },
  slate: { ink: '#1f2733', ink2: '#2e3a4b', tint: '#f0f2f5', line: '#dadfe6' },
  teal: { ink: '#0b3b3f', ink2: '#12555b', tint: '#ecf5f4', line: '#d3e4e2' },
};

// The column can sit on either side; "Centre" is not offered for this layout.
const SIDE = { LEFT: m.mpLeft, RIGHT: m.mpRight };

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.navy;
  return { '--ink': p.ink, '--ink2': p.ink2, '--tint': p.tint, '--line': p.line };
}

export default function ModernProfessional({ d, palette, placement }) {
  const celebration = d.celebration;
  const hasLists = d.achievements.length > 0 || d.milestones.length > 0;
  const toFriends = d.greeting || d.messageToFriends;

  return (
    <div className={cx(m.mp, SIDE[placement] || SIDE.LEFT)} style={paletteStyle(palette)}>
      <aside className={m.mpRail}>
        <Portrait url={d.portraitUrl} initials={d.initials} className={m.mpPortrait} />
        <div className={m.mpRailBody} data-fit="rail" data-fit-min="0.6">
          {(d.college || d.batchYear) && (
            <div className={m.mpBatchBox} data-fit="college" data-fit-min="0.55">
              {d.batchYear && <p className={m.mpBatch}>Batch of {d.batchYear}</p>}
              {d.college && <p className={m.mpCollege}>{d.college}</p>}
            </div>
          )}
          {celebration && (
            <p className={m.mpCelebration}>
              {[
                celebration.title,
                celebration.years ? `${celebration.years} ${celebration.years === 1 ? 'year' : 'years'}` : '',
                celebration.eventYear,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {d.professional.qualifications && (
            <section className={m.mpRailSection}>
              <h3 className={m.mpRailLabel}>Qualifications</h3>
              <p className={m.mpRailText}>{d.professional.qualifications}</p>
            </section>
          )}
          {d.facts.length > 0 && (
            <section className={m.mpRailSection}>
              <h3 className={m.mpRailLabel}>Personal</h3>
              <FactList facts={d.facts} className={m.mpFacts} itemClassName={m.mpFact} />
            </section>
          )}
          {d.contacts.length > 0 && (
            <section className={cx(m.mpRailSection, m.mpRailContact)}>
              <h3 className={m.mpRailLabel}>Contact</h3>
              <ContactList contacts={d.contacts} className={m.mpContacts} itemClassName={m.mpContact} data-fit="contact" data-fit-min="0.65" />
            </section>
          )}
        </div>
        <p className={m.mpBrand}>{site.name}</p>
      </aside>

      <main className={m.mpPage}>
        <header className={m.mpHeader}>
          <span className={m.mpAccentBar} />
          <div className={m.mpNameBox} data-fit="name" data-fit-min="0.45">
            <h2 className={cx(m.mpName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
          </div>
          {d.professionalTitle && <p className={m.mpTitle}>{d.professionalTitle}</p>}
          {d.professional.specialization && <p className={m.mpSpec}>{d.professional.specialization}</p>}
          {d.roleLine && <p className={m.mpRole}>{d.roleLine}</p>}
        </header>

        <div className={m.mpBody} data-fit="body" data-fit-min="0.6">
          <Block heading="Biography" text={d.introduction} className={m.mpBlock} headingClassName={m.mpLabel} textClassName={m.mpLead} />
          {hasLists && (
            <div className={cx(m.mpLists, !(d.achievements.length && d.milestones.length) && m.mpListsSingle)}>
              <ListBlock heading="Professional achievements" items={d.achievements} className={m.mpBlock} headingClassName={m.mpLabel} listClassName={m.mpList} />
              <ListBlock heading="Awards & publications" items={d.milestones} className={m.mpBlock} headingClassName={m.mpLabel} listClassName={m.mpList} />
            </div>
          )}
          {d.quotation && (
            <figure className={m.mpQuote}>
              <Quote className={m.mpQuoteMark} aria-hidden="true" strokeWidth={1.4} />
              <div>
                <blockquote className={m.mpQuoteText}>{d.quotation}</blockquote>
                {d.quotationAuthor && <figcaption className={m.mpQuoteBy}>— {d.quotationAuthor}</figcaption>}
              </div>
            </figure>
          )}
          {toFriends && (
            <section className={m.mpBlock}>
              <h3 className={m.mpLabel}>To my batchmFriends</h3>
              {d.greeting && <p className={m.mpGreeting}>{d.greeting}</p>}
              {d.messageToFriends && <p className={m.mpText}>{d.messageToFriends}</p>}
            </section>
          )}
          <Block heading="Our batch" text={d.batchMessage} className={m.mpBlock} headingClassName={m.mpLabel} textClassName={m.mpText} />
          <Block heading="A memory I treasure" text={d.memory} className={m.mpBlock} headingClassName={m.mpLabel} textClassName={m.mpText} />
          {(d.closing || d.signature) && (
            <div className={m.mpClosing}>
              {d.closing && <p className={m.mpText}>{d.closing}</p>}
              {d.signature && <p className={m.mpSignature}>{d.signature}</p>}
            </div>
          )}
        </div>

        {d.gallery.length > 0 && (
          <div className={m.mpGallery}>
            {d.gallery.map((photo) => (
              <figure key={photo.key} className={m.mpPhoto}>
                <img src={photo.url} alt="" className={styles.photo} draggable={false} />
                <figcaption>{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <footer className={m.mpFooter}>
          <Heartbeat className={m.mpPulse} />
        </footer>
      </main>
    </div>
  );
}
