import { Quote } from 'lucide-react';
import { site } from '@/lib/site';
import styles from '../poster.module.css';
import { CornerFlourish, Divider, GraduationCap, Heartbeat, OpenBook, Stethoscope } from './ornaments';
import { Block, ContactList, FactList, ListBlock, Portrait, cx } from './shared';

// Colours of each approved variation. Washes are "r g b" triplets so they can
// be used with any opacity.
const PALETTES = {
  royal: { ink: '#13306b', accent: '#1f5fbf', soft: '#e8f0fb', wash1: '86 140 214', wash2: '140 182 235', wash3: '30 80 170' },
  teal: { ink: '#0f4a4f', accent: '#12808a', soft: '#e4f3f1', wash1: '72 166 170', wash2: '150 205 200', wash3: '20 110 115' },
  rose: { ink: '#5a1f3a', accent: '#a8436a', soft: '#f9e9ef', wash1: '214 128 160', wash2: '236 182 200', wash3: '160 60 100' },
};

const PLACEMENT = { LEFT: styles.ctHeroLeft, RIGHT: styles.ctHeroRight, CENTER: styles.ctHeroCenter };

function paletteStyle(id) {
  const p = PALETTES[id] || PALETTES.royal;
  return {
    '--ink': p.ink,
    '--accent': p.accent,
    '--soft': p.soft,
    '--wash1': p.wash1,
    '--wash2': p.wash2,
    '--wash3': p.wash3,
  };
}

// Soft, irregular paint blooms for the watercolour background.
function Watercolor() {
  return (
    <svg className={styles.ctBlooms} viewBox="0 0 1240 1754" preserveAspectRatio="none" aria-hidden="true">
      <g style={{ fill: 'rgb(var(--wash1))' }}>
        <path opacity="0.20" d="M-40 -30C120 -40 300 10 330 120C360 240 230 260 150 330C70 400 -40 380 -60 260Z" />
        <path opacity="0.14" d="M-20 60C80 20 240 60 250 160C262 270 120 300 40 360C-20 400 -70 300 -60 200Z" />
        <path opacity="0.18" d="M1290 1500C1180 1440 1010 1470 960 1570C915 1660 980 1790 1100 1800C1220 1810 1300 1700 1290 1500Z" />
        <path opacity="0.12" d="M1280 1380C1150 1360 1060 1420 1040 1520C1020 1610 1110 1690 1200 1680C1290 1670 1320 1460 1280 1380Z" />
      </g>
      <g style={{ fill: 'rgb(var(--wash2))' }}>
        <path opacity="0.30" d="M1260 -20C1120 -40 990 30 980 140C970 240 1080 300 1170 290C1250 280 1300 160 1260 -20Z" />
        <path opacity="0.22" d="M-50 1420C60 1380 210 1430 230 1540C250 1650 140 1760 30 1770C-60 1780 -90 1500 -50 1420Z" />
        <path opacity="0.16" d="M520 1650C640 1600 820 1630 860 1700C890 1760 600 1800 500 1770C440 1750 460 1680 520 1650Z" />
      </g>
    </svg>
  );
}

function GoldFrame({ className }) {
  return (
    <div className={className}>
      <span className={cx(styles.goldBar, styles.goldTop)} />
      <span className={cx(styles.goldBar, styles.goldBottom)} />
      <span className={cx(styles.goldBar, styles.goldLeft)} />
      <span className={cx(styles.goldBar, styles.goldRight)} />
    </div>
  );
}

export default function ClassicTribute({ d, palette, placement }) {
  const hasAside = Boolean(d.quotation || d.memory || d.achievements.length || d.milestones.length);
  const hasMain = Boolean(d.introduction || d.messageToFriends || d.batchMessage);
  const celebration = d.celebration;

  return (
    <div className={styles.ct} style={paletteStyle(palette)}>
      <div className={styles.ctWash} />
      <Watercolor />
      <GoldFrame className={styles.ctFrameOuter} />
      <GoldFrame className={styles.ctFrameInner} />
      <CornerFlourish className={cx(styles.ctCorner, styles.cornerTL)} />
      <CornerFlourish className={cx(styles.ctCorner, styles.cornerTR)} />
      <CornerFlourish className={cx(styles.ctCorner, styles.cornerBL)} />
      <CornerFlourish className={cx(styles.ctCorner, styles.cornerBR)} />
      <GraduationCap className={styles.ctArtCap} />
      <OpenBook className={styles.ctArtBook} />
      <Stethoscope className={styles.ctArtSteth} />

      <div className={styles.ctContent}>
        <header className={styles.ctHeader}>
          {d.college && (
            <div className={styles.ctCollegeBox} data-fit="college" data-fit-min="0.55">
              <p className={styles.ctCollege}>{d.college}</p>
            </div>
          )}
          {(d.batchYear || celebration) && (
            <div className={styles.ctBatchRow}>
              {d.batchYear && <span className={styles.ctBatch}>Batch of {d.batchYear}</span>}
              {celebration && (
                <span className={styles.ctRibbon}>
                  {[
                    celebration.title,
                    celebration.years ? `${celebration.years} ${celebration.years === 1 ? 'year' : 'years'}` : '',
                    celebration.eventYear,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
          )}
          <Divider className={styles.ctDivider} />
        </header>

        <section className={cx(styles.ctHero, PLACEMENT[placement] || PLACEMENT.LEFT)}>
          <Portrait url={d.portraitUrl} initials={d.initials} className={styles.ctPortrait} />
          <div className={styles.ctIdentity}>
            <div className={styles.ctNameBox} data-fit="name" data-fit-min="0.4">
              <h2 className={cx(styles.ctName, !d.displayName && styles.placeholder)}>{d.displayName || 'Your name'}</h2>
            </div>
            {d.professionalTitle && <p className={styles.ctTitle}>{d.professionalTitle}</p>}
            {d.professional.specialization && <p className={styles.ctSpec}>{d.professional.specialization}</p>}
            {d.roleLine && <p className={styles.ctRole}>{d.roleLine}</p>}
            {d.professional.qualifications && <p className={styles.ctQual}>{d.professional.qualifications}</p>}
            <FactList facts={d.facts} className={styles.ctFacts} itemClassName={styles.ctFact} />
          </div>
        </section>

        <div className={styles.ctBody} data-fit="body" data-fit-min="0.6">
          {d.greeting && <p className={styles.ctGreeting}>{d.greeting}</p>}
          {(hasMain || hasAside) && (
            <div className={cx(styles.ctColumns, !(hasMain && hasAside) && styles.ctSingle)}>
              {hasMain && (
                <div className={styles.ctMain}>
                  <Block heading="About me" text={d.introduction} className={styles.ctBlock} headingClassName={styles.ctLabel} textClassName={styles.ctText} />
                  <Block heading="To my friends" text={d.messageToFriends} className={styles.ctBlock} headingClassName={styles.ctLabel} textClassName={styles.ctText} />
                  <Block heading="Our batch" text={d.batchMessage} className={styles.ctBlock} headingClassName={styles.ctLabel} textClassName={styles.ctText} />
                </div>
              )}
              {hasAside && (
                <aside className={styles.ctAside}>
                  {d.quotation && (
                    <figure className={styles.ctQuote}>
                      <Quote className={styles.ctQuoteMark} aria-hidden="true" strokeWidth={1.4} />
                      <blockquote className={styles.ctQuoteText}>{d.quotation}</blockquote>
                      {d.quotationAuthor && <figcaption className={styles.ctQuoteBy}>— {d.quotationAuthor}</figcaption>}
                    </figure>
                  )}
                  <Block heading="A memory I treasure" text={d.memory} className={styles.ctCard} headingClassName={styles.ctLabel} textClassName={styles.ctText} />
                  <ListBlock heading="Achievements" items={d.achievements} className={styles.ctCard} headingClassName={styles.ctLabel} listClassName={styles.ctList} />
                  <ListBlock heading="Awards & milestones" items={d.milestones} className={styles.ctCard} headingClassName={styles.ctLabel} listClassName={styles.ctList} />
                </aside>
              )}
            </div>
          )}
          {(d.closing || d.signature) && (
            <div className={styles.ctClosing}>
              {d.closing && <p className={styles.ctText}>{d.closing}</p>}
              {d.signature && <p className={styles.ctSignature}>{d.signature}</p>}
            </div>
          )}
        </div>

        {d.gallery.length > 0 && (
          <div className={styles.ctGallery}>
            {d.gallery.map((photo, i) => (
              <figure key={photo.key} className={cx(styles.ctPolaroid, styles[`tilt${i}`])}>
                <img src={photo.url} alt="" className={styles.photo} draggable={false} />
                <figcaption>{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <footer className={styles.ctFooter}>
          <Heartbeat className={styles.ctPulse} />
          <ContactList contacts={d.contacts} className={styles.ctContacts} itemClassName={styles.ctContact} data-fit="contact" data-fit-min="0.7" />
          <p className={styles.ctBrand}>{site.name}</p>
        </footer>
      </div>
    </div>
  );
}
