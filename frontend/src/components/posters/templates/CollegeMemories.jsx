import { Quote } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import c from './CollegeMemories.module.css';
import { CollegeFacade } from './ornaments';
import { ContactList, FactList, Portrait, cx } from './shared';

// Warm ivory scrapbook: a taped polaroid portrait, a batch "postmark", the
// doctor's story as a timeline and a collage of their own photographs.
const PALETTES = {
  vintage: { paper: '#f4ead5', paper2: '#e9d8b6', ink: '#2f4a6d', accent: '#9c6b3c', tape: '178 204 230' },
  sepia: { paper: '#f3e7d3', paper2: '#e6d2b1', ink: '#5a3e26', accent: '#a8743a', tape: '226 196 150' },
  sage: { paper: '#f1ead7', paper2: '#e2d9bd', ink: '#3f5a46', accent: '#a37b45', tape: '178 206 176' },
};

const SIDE = { LEFT: c.cmHeroLeft, RIGHT: c.cmHeroRight };

// Fixed tilts so every render (preview and export) is identical.
const TILTS = [c.tiltA, c.tiltB, c.tiltC];

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.vintage;
  return { '--paper': p.paper, '--paper2': p.paper2, '--ink': p.ink, '--accent': p.accent, '--tape': p.tape };
}

/**
 * Timeline entries, in story order. Only entries the doctor wrote appear, and
 * only real years are printed: the batch year on the first entry, the event
 * year on the reunion entry. Other entries get a plain dot.
 */
function timelineOf(d) {
  const items = [
    d.memory && { key: 'memory', label: 'College days', text: d.memory },
    d.batchMessage && { key: 'batch', label: 'Our batch', text: d.batchMessage },
    d.introduction && { key: 'journey', label: 'My journey since', text: d.introduction },
    (d.achievements.length > 0 || d.milestones.length > 0) && {
      key: 'milestones',
      label: 'Milestones',
      list: [...d.achievements, ...d.milestones],
    },
    d.celebration && {
      key: 'celebration',
      label: [d.celebration.title, d.celebration.years ? `${d.celebration.years} ${d.celebration.years === 1 ? 'year' : 'years'}` : '']
        .filter(Boolean)
        .join(' · '),
      text: d.celebration.tagline,
      mark: d.celebration.eventYear,
    },
  ].filter(Boolean);
  if (items.length && d.batchYear && items[0].key !== 'celebration') items[0] = { ...items[0], mark: d.batchYear };
  return items;
}

export default function CollegeMemories({ d, palette, placement }) {
  const timeline = timelineOf(d);
  const hasCollage = d.gallery.length > 0;
  const hasNote = Boolean(d.messageToFriends);

  return (
    <div className={c.cm} style={paletteStyle(palette)}>
      <div className={c.cmPaper} />
      <CollegeFacade className={c.cmFacade} />

      <div className={c.cmContent}>
        <header className={c.cmHeader}>
          <div className={c.cmHeadText}>
            {d.college && (
              <div className={c.cmCollegeBox} data-fit="college" data-fit-min="0.55">
                <p className={c.cmCollege}>{d.college}</p>
              </div>
            )}
            <span className={c.cmRule} />
          </div>
          {d.batchYear && (
            <div className={c.cmStamp}>
              <span className={c.cmStampSmall}>Batch of</span>
              <span className={c.cmStampYear}>{d.batchYear}</span>
            </div>
          )}
        </header>

        <section className={cx(c.cmHero, SIDE[placement] || SIDE.LEFT)}>
          <figure className={c.cmPolaroid}>
            <span className={cx(c.tape, c.tapeLeft)} />
            <span className={cx(c.tape, c.tapeRight)} />
            <Portrait url={d.portraitUrl} initials={d.initials} className={c.cmPortrait} />
          </figure>
          <div className={c.cmIdentity} data-fit="identity" data-fit-min="0.6">
            {d.greeting && <p className={c.cmGreeting}>{d.greeting}</p>}
            <div className={c.cmNameBox} data-fit="name" data-fit-min="0.45">
              <h2 className={cx(c.cmName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
            </div>
            {d.professionalTitle && <p className={c.cmTitle}>{d.professionalTitle}</p>}
            {d.professional.specialization && <p className={c.cmSpec}>{d.professional.specialization}</p>}
            {d.roleLine && <p className={c.cmRole}>{d.roleLine}</p>}
            {d.professional.qualifications && <p className={c.cmQual}>{d.professional.qualifications}</p>}
            <FactList facts={d.facts} className={c.cmFacts} itemClassName={c.cmFact} />
          </div>
        </section>

        <div className={cx(c.cmMiddle, hasCollage && c.cmMiddleCollage)}>
          <div className={c.cmStory} data-fit="story" data-fit-min="0.6">
            {timeline.length > 0 && (
              <ol className={c.cmTimeline}>
                {timeline.map((item) => (
                  <li key={item.key} className={c.cmMoment}>
                    <span className={cx(c.cmMark, item.mark && c.cmMarkYear)}>{item.mark || ''}</span>
                    <div className={c.cmMomentBody}>
                      {item.label && <h3 className={c.cmMomentLabel}>{item.label}</h3>}
                      {item.text && <p className={c.cmText}>{item.text}</p>}
                      {item.list && (
                        <ul className={c.cmList}>
                          {item.list.map((line, i) => (
                            <li key={`${i}-${line}`}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {hasNote && (
              <section className={c.cmNote}>
                <h3 className={c.cmNoteLabel}>To my friends</h3>
                <p className={c.cmNoteText}>{d.messageToFriends}</p>
              </section>
            )}
            {d.quotation && (
              <figure className={c.cmQuote}>
                <Quote className={c.cmQuoteMark} aria-hidden="true" strokeWidth={1.4} />
                <blockquote className={c.cmQuoteText}>{d.quotation}</blockquote>
                {d.quotationAuthor && <figcaption className={c.cmQuoteBy}>— {d.quotationAuthor}</figcaption>}
              </figure>
            )}
            {(d.closing || d.signature) && (
              <div className={c.cmClosing}>
                {d.closing && <p className={c.cmClosingText}>{d.closing}</p>}
                {d.signature && <p className={c.cmSignature}>{d.signature}</p>}
              </div>
            )}
          </div>

          {hasCollage && (
            <div className={c.cmCollage}>
              {d.gallery.map((photo, i) => (
                <figure key={photo.key} className={cx(c.cmSnap, TILTS[i])}>
                  <span className={cx(c.tape, c.tapeTop)} />
                  <img src={photo.url} alt="" className={styles.photo} draggable={false} />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <footer className={c.cmFooter}>
          <ContactList contacts={d.contacts} className={c.cmContacts} itemClassName={c.cmContact} data-fit="contact" data-fit-min="0.7" />
          <p className={c.cmBrand}>{site.name}</p>
        </footer>
      </div>
    </div>
  );
}
