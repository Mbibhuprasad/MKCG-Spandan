// Design tokens. The light palette mirrors the website (frontend/src/app/globals.css)
// so both products read as one brand; the dark palette adds the purple/blue
// accents used by the mobile app. Components never hard-code colours — they
// read them from the active palette through useTheme().

export const light = {
  mode: 'light',
  bg: '#ffffff',
  bgSoft: '#f5f8fd',
  surface: '#ffffff',
  surface2: '#eef3fb',
  line: '#e2e8f2',
  lineStrong: '#c9d3e4',
  fg: '#0e1c36',
  fgSoft: '#3d4c67',
  muted: '#64728a',

  brand: '#14398a',
  brandStrong: '#0c2866',
  brandSoft: '#e7eefb',
  brandFg: '#ffffff',
  brandInk: '#14398a',

  accent: '#1f57c8',
  accentSoft: '#e7eefb',

  leaf: '#14864f',
  leafStrong: '#0e6a3e',
  leafSoft: '#e3f5ea',
  leafFg: '#ffffff',

  danger: '#b8263f',
  dangerSoft: '#fdecef',
  dangerFg: '#ffffff',
  warn: '#9a6408',
  warnSoft: '#fdf2d8',

  glass: 'rgba(255,255,255,0.78)',
  glassLine: 'rgba(20,57,138,0.10)',
  overlay: 'rgba(9,18,40,0.45)',
  shadow: '#0f1e46',
  skeleton: '#e9eef7',

  gradientBrand: ['#14398a', '#1f57c8'],
  gradientHero: ['#0c2866', '#14398a', '#1c6a8f'],
  gradientLeaf: ['#14864f', '#1fa866'],
  bubbleMine: '#14398a',
  bubbleMineFg: '#ffffff',
  bubbleTheirs: '#eef3fb',
  bubbleTheirsFg: '#0e1c36',
};

export const dark = {
  mode: 'dark',
  bg: '#090b10',
  bgSoft: '#0d1017',
  surface: '#12151d',
  surface2: '#1a1e29',
  line: '#232838',
  lineStrong: '#353c52',
  fg: '#eef0f8',
  fgSoft: '#c3c8da',
  muted: '#8d94ab',

  brand: '#8b7cf6',
  brandStrong: '#a99cfb',
  brandSoft: '#1d1a3a',
  brandFg: '#0b0920',
  brandInk: '#b3a8fc',

  accent: '#5c8ff2',
  accentSoft: '#14223d',

  leaf: '#3ccb8a',
  leafStrong: '#6fdcaa',
  leafSoft: '#0e2a1e',
  leafFg: '#04160d',

  danger: '#f0738a',
  dangerSoft: '#2c1219',
  dangerFg: '#2a0a11',
  warn: '#e8b44c',
  warnSoft: '#2a2008',

  glass: 'rgba(18,21,29,0.82)',
  glassLine: 'rgba(139,124,246,0.18)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  skeleton: '#1c2130',

  gradientBrand: ['#7c5cf6', '#4f7df0'],
  gradientHero: ['#1a1440', '#2a2378', '#1d4f9c'],
  gradientLeaf: ['#1f9d68', '#3ccb8a'],
  bubbleMine: '#6a5cf0',
  bubbleMineFg: '#ffffff',
  bubbleTheirs: '#1a1e29',
  bubbleTheirsFg: '#eef0f8',
};

export const palettes = { light, dark };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 };

// One type scale for the whole app.
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  h1: { fontSize: 23, lineHeight: 29, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
};

// Android elevation plus the iOS equivalents, tinted by the palette.
export const shadow = (colors, level = 1) => {
  const presets = {
    0: { elevation: 0, opacity: 0, radius: 0, y: 0 },
    1: { elevation: 2, opacity: 0.08, radius: 10, y: 4 },
    2: { elevation: 6, opacity: 0.14, radius: 18, y: 8 },
    3: { elevation: 12, opacity: 0.22, radius: 26, y: 14 },
  };
  const p = presets[level] || presets[1];
  return {
    elevation: colors.mode === 'dark' ? 0 : p.elevation,
    shadowColor: colors.shadow,
    shadowOpacity: p.opacity,
    shadowRadius: p.radius,
    shadowOffset: { width: 0, height: p.y },
  };
};

export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
export const TAB_BAR_HEIGHT = 66;
