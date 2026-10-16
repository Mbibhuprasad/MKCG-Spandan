import { Quote } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import { CollegeFacade, GraduationCap, Laurel, Sparkle } from './ornaments';
import { Block, ContactList, FactList, ListBlock, Portrait, cx } from './shared';

const PALETTES = {
  navy: { bg1: '#0b1736', bg2: '#16306b', bg3: '#070f24', metal: '#e4e9f2', metalDeep: '#9aa6b8', accent: '#b9d3ff', glow: '120 160 255' },
  maroon: { bg1: '#3b0a17', bg2: '#6a1629', bg3: '#24050d', metal: '#f2d48a', metalDeep: '#b8923d', accent: '#ffe3a3', glow: '255 190 120' },
  emerald: { bg1: '#062b23', bg2: '#0d5443', bg3: '#031a15', metal: '#e3ebe7', metalDeep: '#98aba3', accent: '#bff0d8', glow: '120 230 190' },
};

const PLACEMENT = { LEFT: styles.sjHeroLeft, RIGHT: styles.sjHeroRight, CENTER: styles.sjHeroCenter };

// Fixed confetti positions (percent of the poster), so every render is
// identical. All of them sit in the margin between the frame and the content,
// so they can never cover text.
const SPARKLES = [
  [5, 4, 16, 0.7],
  [12, 3.1, 9, 0.45],
  [30, 2.9, 7, 0.4],
  [70, 2.9, 8, 0.4],
  [88, 3.1, 10, 0.45],
  [95, 4, 15, 0.65],
  [4.7, 22, 9, 0.35],
  [95.3, 26, 11, 0.45],
  [4.8, 48, 7, 0.3],
  [95.2, 55, 8, 0.3],
  [4.7, 75, 8, 0.3],
  [95.3, 82, 7, 0.3],
];

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.navy;
  return {
    '--bg1': p.bg1,
    '--bg2': p.bg2,
    '--bg3': p.bg3,
    '--metal': p.metal,
    '--metal-deep': p.metalDeep,
    '--accent': p.accent,
    '--glow': p.glow,
  };
}

export default function SilverJubilee({ d, palette, placement }) {
  const celebration = d.celebration;
  const hasPhotos = d.gallery.length > 0;

  return (
    <div className={styles.sj} style={paletteStyle(palette)}>
      <div className={styles.sjGlow} />
      {SPARKLES.map(([x, y, size, opacity]) => (
        <Sparkle
          key={`${x}-${y}`}
          className={styles.sjSparkle}
          style={{ left: `${x}%`, top: `${y}%`, width: size * 2, height: size * 2, opacity }}
        />
      ))}
      <CollegeFacade className={styles.sjFacade} />
      <div className={styles.sjFrame} />
      <div className={styles.sjFrameInner} />

      <div className={styles.sjContent}>
        <header className={styles.sjTop}>
          {d.college && (
            <div className={styles.sjCollegeBox} data-fit="college" data-fit-min="0.55">
              <p className={styles.sjCollege}>{d.college}</p>
            </div>
          )}
          {d.batchYear && (
            <p className={styles.sjBatch}>
              <span className={styles.sjRule} />
              <span>Batch of {d.batchYear}</span>
              <span className={styles.sjRule} />
            </p>
          )}
        </header>

        {celebration && (
          <section className={styles.sjCelebration}>
            <div className={styles.sjBadge}>
              <Laurel className={styles.sjLaurel} />
              <div className={styles.sjBadgeInner}>
                {celebration.years ? (
                  <>
                    <span className={styles.sjYears}>{celebration.years}</span>
                    <span className={styles.sjYearsLabel}>{celebration.years === 1 ? 'Year' : 'Years'}</span>
                  </>
                ) : (
                  <GraduationCap className={styles.sjBadgeCap} />
                )}
              </div>
            </div>
            {(celebration.title || celebration.eventYear || celebration.tagline) && (
              <div className={styles.sjCelebrationText}>
                {celebration.title && <p className={styles.sjCelebrationTitle}>{celebration.title}</p>}
                {(celebration.eventYear || celebration.tagline) && (
                  <p className={styles.sjTagline}>{[celebration.eventYear, celebration.tagline].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            )}
          </section>
        )}

        <section className={cx(styles.sjHero, PLACEMENT[placement] || PLACEMENT.LEFT)}>
          <Portrait url={d.portraitUrl} initials={d.initials} className={styles.sjPortrait} />
          <div className={styles.sjIdentity}>
            <div className={styles.sjNameBox} data-fit="name" data-fit-min="0.4">
              <h2 className={cx(styles.sjName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
            </div>
            {d.professionalTitle && <p className={styles.sjTitle}>{d.professionalTitle}</p>}
            {d.professional.specialization && <p className={styles.sjSpec}>{d.professional.specialization}</p>}
            {d.roleLine && <p className={styles.sjRole}>{d.roleLine}</p>}
            {d.professional.qualifications && <p className={styles.sjQual}>{d.professional.qualifications}</p>}
            <FactList facts={d.facts} className={styles.sjFacts} itemClassName={styles.sjFact} />
          </div>
        </section>

        <div className={cx(styles.sjBody, hasPhotos && styles.sjBodyPhotos)}>
          <div className={styles.sjMain} data-fit="body" data-fit-min="0.6">
            {d.greeting && <p className={styles.sjGreeting}>{d.greeting}</p>}
            <Block text={d.messageToFriends} className={styles.sjBlock} textClassName={styles.sjText} />
            <Block heading="Our batch" text={d.batchMessage} className={styles.sjBlock} headingClassName={styles.sjLabel} textClassName={styles.sjText} />
            <Block heading="About me" text={d.introduction} className={styles.sjBlock} headingClassName={styles.sjLabel} textClassName={styles.sjText} />
            {d.quotation && (
              <figure className={styles.sjQuote}>
                <Quote className={styles.sjQuoteMark} aria-hidden="true" strokeWidth={1.4} />
                <blockquote className={styles.sjQuoteText}>{d.quotation}</blockquote>
                {d.quotationAuthor && <figcaption className={styles.sjQuoteBy}>— {d.quotationAuthor}</figcaption>}
              </figure>
            )}
            <Block heading="A memory I treasure" text={d.memory} className={styles.sjBlock} headingClassName={styles.sjLabel} textClassName={styles.sjText} />
            <ListBlock heading="Achievements" items={d.achievements} className={styles.sjBlock} headingClassName={styles.sjLabel} listClassName={styles.sjList} />
            <ListBlock heading="Awards & milestones" items={d.milestones} className={styles.sjBlock} headingClassName={styles.sjLabel} listClassName={styles.sjList} />
            {(d.closing || d.signature) && (
              <div className={styles.sjClosing}>
                {d.closing && <p className={styles.sjText}>{d.closing}</p>}
                {d.signature && <p className={styles.sjSignature}>{d.signature}</p>}
              </div>
            )}
          </div>
          {hasPhotos && (
            <div className={styles.sjPhotos}>
              {d.gallery.map((photo) => (
                <figure key={photo.key} className={styles.sjPhotoFrame}>
                  <img src={photo.url} alt="" className={styles.photo} draggable={false} />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <footer className={styles.sjFooter}>
          <ContactList contacts={d.contacts} className={styles.sjContacts} itemClassName={styles.sjContact} data-fit="contact" data-fit-min="0.7" />
          <p className={styles.sjBrand}>{site.name}</p>
        </footer>
      </div>
    </div>
  );
}
