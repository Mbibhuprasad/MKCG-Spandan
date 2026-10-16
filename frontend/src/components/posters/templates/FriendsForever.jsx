import { Heart } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import f from './FriendsForever.module.css';
import { Sparkle } from './ornaments';
import { Block, ContactList, FactList, ListBlock, Portrait, cx } from './shared';

// Expressive alumni tribute: an arched portrait on a sweeping colour band, a
// large greeting, a full-width quotation band and a contact strip.
const PALETTES = {
  sky: { deep: '#123a6b', main: '#1d4e89', light: '#7aa6dc', cream: '#fbf4e4', warm: '#d9a441', ink: '#16294a' },
  sunset: { deep: '#6e2430', main: '#9a3b3b', light: '#e09a82', cream: '#fdf1e6', warm: '#e0a64b', ink: '#4a1d22' },
  twilight: { deep: '#1f1b4d', main: '#2e2a6b', light: '#9a92d6', cream: '#f8f2e6', warm: '#d6a84e', ink: '#221f4a' },
};

const PLACEMENT = { LEFT: f.ffHeroLeft, RIGHT: f.ffHeroRight, CENTER: f.ffHeroCenter };

// Fixed sparkle positions in the band's margins (percent of the poster), so
// every render is identical and none can cover text.
const SPARKLES = [
  [2.6, 2.4, 14, 0.85],
  [8.5, 5.2, 8, 0.55],
  [91, 2.2, 9, 0.6],
  [96, 5.6, 15, 0.85],
  [2.4, 9, 7, 0.45],
];

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.sky;
  return {
    '--deep': p.deep,
    '--main': p.main,
    '--light': p.light,
    '--cream': p.cream,
    '--warm': p.warm,
    '--ink': p.ink,
  };
}

// The bands are drawn behind their content and stretch to its height. Solid
// layered fills rather than an SVG gradient: several posters share a page
// (thumbnails) and gradient ids would clash between them.
function TopBand({ mirrored }) {
  return (
    <svg className={cx(f.ffBand, mirrored && f.mirrored)} viewBox="0 0 1240 1000" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0H1240V900C1080 940 940 880 780 900C600 924 480 990 300 994C170 997 80 980 0 960Z" style={{ fill: 'var(--main)' }} />
      <path d="M0 0H1240V240C1040 330 860 300 640 380C430 456 230 520 0 500Z" style={{ fill: 'var(--deep)' }} opacity="0.7" />
      <path d="M0 0H780C600 90 420 150 0 220Z" style={{ fill: 'var(--deep)' }} opacity="0.55" />
      <path d="M0 960C80 980 170 997 300 994C480 990 600 924 780 900C940 880 1080 940 1240 900" fill="none" style={{ stroke: 'var(--warm)' }} strokeWidth="6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BottomBand() {
  return (
    <svg className={f.ffBand} viewBox="0 0 1240 300" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 60C220 14 420 4 640 36C860 68 1040 58 1240 14V300H0Z" style={{ fill: 'var(--main)' }} />
      <path d="M0 60C220 14 420 4 640 36C860 68 1040 58 1240 14" fill="none" style={{ stroke: 'var(--warm)' }} strokeWidth="5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function FriendsForever({ d, palette, placement }) {
  const celebration = d.celebration;
  const batchLine = [d.batchYear && `Batch of ${d.batchYear}`, d.college].filter(Boolean).join(' · ');
  const hasPhotos = d.gallery.length > 0;
  const lists = [...d.achievements, ...d.milestones];

  return (
    <div className={f.ff} style={paletteStyle(palette)}>
      <div className={f.ffCream} />

      <div className={f.ffContent}>
        <div className={f.ffTop}>
          <TopBand mirrored={placement === 'RIGHT'} />
          {SPARKLES.map(([x, y, size, opacity]) => (
            <Sparkle
              key={`${x}-${y}`}
              className={f.ffSparkle}
              style={{ left: `${x}%`, top: `${(y * 1754) / 100}px`, width: size * 2, height: size * 2, opacity }}
            />
          ))}
          <header className={f.ffHeader}>
            <p className={f.ffTheme}>
              <Heart className={f.ffHeart} aria-hidden="true" strokeWidth={0} fill="currentColor" />
              Friends forever
              <Heart className={f.ffHeart} aria-hidden="true" strokeWidth={0} fill="currentColor" />
            </p>
            {batchLine && (
              <div className={f.ffBatchBox} data-fit="college" data-fit-min="0.55">
                <p className={f.ffBatch}>{batchLine}</p>
              </div>
            )}
            {celebration && (
              <p className={f.ffCelebration}>
                {[
                  celebration.title,
                  celebration.years ? `${celebration.years} ${celebration.years === 1 ? 'year' : 'years'}` : '',
                  celebration.eventYear,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </header>

          <section className={cx(f.ffHero, PLACEMENT[placement] || PLACEMENT.LEFT)}>
            <div className={f.ffArchRing}>
              <Portrait url={d.portraitUrl} initials={d.initials} className={f.ffArch} />
            </div>
            <div className={f.ffIdentity} data-fit="identity" data-fit-min="0.6">
              <div className={f.ffNameBox} data-fit="name" data-fit-min="0.45">
                <h2 className={cx(f.ffName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
              </div>
              {d.professionalTitle && <p className={f.ffTitle}>{d.professionalTitle}</p>}
              {d.professional.specialization && <p className={f.ffSpec}>{d.professional.specialization}</p>}
              {d.roleLine && <p className={f.ffRole}>{d.roleLine}</p>}
              {d.professional.qualifications && <p className={f.ffQual}>{d.professional.qualifications}</p>}
              <FactList facts={d.facts} className={f.ffFacts} itemClassName={f.ffFact} />
            </div>
          </section>
        </div>

        <div className={f.ffBody} data-fit="body" data-fit-min="0.6">
          {d.greeting && <p className={f.ffGreeting}>{d.greeting}</p>}
          {d.messageToFriends && <p className={f.ffMessage}>{d.messageToFriends}</p>}
          <Block heading="A little about me" text={d.introduction} className={f.ffBlock} headingClassName={f.ffLabel} textClassName={f.ffText} />
          <Block heading="Our batch" text={d.batchMessage} className={f.ffBlock} headingClassName={f.ffLabel} textClassName={f.ffText} />
          <Block heading="A memory I treasure" text={d.memory} className={f.ffBlock} headingClassName={f.ffLabel} textClassName={f.ffText} />
          <ListBlock heading="Achievements & milestones" items={lists} className={f.ffBlock} headingClassName={f.ffLabel} listClassName={f.ffList} />
          {(d.closing || d.signature) && (
            <div className={f.ffClosing}>
              {d.closing && <p className={f.ffClosingText}>{d.closing}</p>}
              {d.signature && <p className={f.ffSignature}>{d.signature}</p>}
            </div>
          )}
        </div>

        {d.quotation && (
          <figure className={f.ffQuoteBand} data-fit="quote" data-fit-min="0.6">
            <span className={f.ffQuoteMark} aria-hidden="true">
              “
            </span>
            <blockquote className={f.ffQuoteText}>{d.quotation}</blockquote>
            {d.quotationAuthor && <figcaption className={f.ffQuoteBy}>— {d.quotationAuthor}</figcaption>}
          </figure>
        )}

        {hasPhotos && (
          <div className={f.ffPhotos}>
            {d.gallery.map((photo) => (
              <figure key={photo.key} className={f.ffPhoto}>
                <div className={f.ffPhotoFrame}>
                  <img src={photo.url} alt="" className={styles.photo} draggable={false} />
                </div>
                <figcaption>{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <footer className={f.ffFooter}>
          <BottomBand />
          <ContactList contacts={d.contacts} className={f.ffContacts} itemClassName={f.ffContact} data-fit="contact" data-fit-min="0.7" />
          <p className={f.ffBrand}>{site.name}</p>
        </footer>
      </div>
    </div>
  );
}
