// Original line-art used by the poster templates. Everything is drawn in
// `currentColor`, so each template colours it through CSS.

export function CornerFlourish({ className }) {
  return (
    <svg viewBox="0 0 160 160" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M8 152V44Q8 8 44 8H152" strokeWidth="2.6" />
      <path d="M20 152V54Q20 20 54 20H152" strokeWidth="1.1" />
      <path d="M44 8C44 40 72 48 86 32C96 20 82 6 71 14C62 21 70 32 79 27" strokeWidth="2" />
      <path d="M8 44C40 44 48 72 32 86C20 96 6 82 14 71C21 62 32 70 27 79" strokeWidth="2" />
      <path d="M96 8C104 16 116 16 124 8" strokeWidth="1.4" />
      <path d="M8 96C16 104 16 116 8 124" strokeWidth="1.4" />
      <circle cx="44" cy="44" r="5" fill="currentColor" stroke="none" />
      <ellipse cx="62" cy="62" rx="9" ry="3.6" transform="rotate(45 62 62)" fill="currentColor" stroke="none" opacity="0.8" />
      <circle cx="138" cy="20" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="138" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Divider({ className }) {
  return (
    <svg viewBox="0 0 320 24" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M8 12H132" strokeWidth="1.6" />
      <path d="M188 12H312" strokeWidth="1.6" />
      <path d="M160 2L170 12L160 22L150 12Z" fill="currentColor" stroke="none" />
      <circle cx="140" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="180" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Heartbeat({ className }) {
  return (
    <svg viewBox="0 0 240 40" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M2 22H78L88 6L100 36L110 12L118 22H238" />
    </svg>
  );
}

export function Stethoscope({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M30 12V38A22 22 0 0 0 74 38V12" />
      <path d="M24 12H36M68 12H80" />
      <path d="M52 60V78A20 20 0 0 0 92 78V70" />
      <circle cx="92" cy="58" r="11" />
      <circle cx="92" cy="58" r="4" fill="currentColor" />
    </svg>
  );
}

export function GraduationCap({ className }) {
  return (
    <svg viewBox="0 0 120 90" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M60 8L112 30L60 52L8 30Z" />
      <path d="M28 39V59C28 69 92 69 92 59V39" />
      <path d="M104 33V60" />
      <circle cx="104" cy="64" r="4" fill="currentColor" />
    </svg>
  );
}

export function OpenBook({ className }) {
  return (
    <svg viewBox="0 0 120 90" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M60 20C45 10 22 10 8 16V78C22 72 45 72 60 82Z" />
      <path d="M60 20C75 10 98 10 112 16V78C98 72 75 72 60 82" />
      <path d="M20 30C30 27 40 27 50 31M20 42C30 39 40 39 50 43M70 31C80 27 90 27 100 30M70 43C80 39 90 39 100 42" strokeWidth="2" />
    </svg>
  );
}

// Two branches of leaves meeting at the bottom, open at the top.
const LAUREL_LEAVES = (() => {
  const leaves = [];
  const cx = 150;
  const cy = 150;
  const r = 128;
  for (let deg = 102; deg <= 246; deg += 12) {
    const t = (deg * Math.PI) / 180;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    const tangent = deg + 90;
    leaves.push({ x, y, inner: tangent - 28, outer: tangent + 28, deg });
  }
  return leaves;
})();

export function Laurel({ className }) {
  const branch = (mirror) =>
    LAUREL_LEAVES.map((leaf) => {
      const x = mirror ? 300 - leaf.x : leaf.x;
      const sign = mirror ? -1 : 1;
      return (
        <g key={`${mirror ? 'r' : 'l'}${leaf.deg}`}>
          <ellipse cx={x} cy={leaf.y} rx="17" ry="6.5" transform={`rotate(${sign * leaf.inner} ${x} ${leaf.y}) translate(${sign * 10} 0)`} />
          <ellipse cx={x} cy={leaf.y} rx="17" ry="6.5" transform={`rotate(${sign * leaf.outer} ${x} ${leaf.y}) translate(${sign * 10} 0)`} />
        </g>
      );
    });
  return (
    <svg viewBox="0 0 300 300" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M136.6 277.3A128 128 0 0 1 97.9 33.1" />
        <path d="M163.4 277.3A128 128 0 0 0 202.1 33.1" />
      </g>
      <g fill="currentColor">
        {branch(false)}
        {branch(true)}
      </g>
    </svg>
  );
}

export function Sparkle({ className, style }) {
  return (
    <svg viewBox="-10 -10 20 20" className={className} style={style} aria-hidden="true">
      <path d="M0 -10L2.4 -2.4L10 0L2.4 2.4L0 10L-2.4 2.4L-10 0L-2.4 -2.4Z" fill="currentColor" />
    </svg>
  );
}

// A generic collegiate façade (dome, pediment and columns) — not any real building.
export function CollegeFacade({ className }) {
  const columns = Array.from({ length: 10 }, (_, i) => 120 + i * 40);
  return (
    <svg viewBox="0 0 600 220" className={className} fill="currentColor" aria-hidden="true">
      <path d="M300 18C262 18 236 44 232 78H368C364 44 338 18 300 18Z" />
      <rect x="296" y="2" width="8" height="18" />
      <rect x="226" y="78" width="148" height="10" />
      <path d="M96 118L300 70L504 118Z" />
      <rect x="96" y="118" width="408" height="12" />
      {columns.map((x) => (
        <rect key={x} x={x - 8} y="136" width="16" height="62" />
      ))}
      <rect x="20" y="146" width="80" height="52" />
      <rect x="500" y="146" width="80" height="52" />
      <rect x="84" y="198" width="432" height="8" />
      <rect x="60" y="206" width="480" height="8" />
      <rect x="0" y="214" width="600" height="6" />
    </svg>
  );
}
