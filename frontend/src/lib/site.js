// Single source of truth for branding. To rebrand, change this file and
// replace the files in /public/brand — no component embeds the logo itself.
export const site = {
  name: 'MKCGSPANDAN',
  shortName: 'Spandan',
  tagline: 'Together in Medicine. Connected Beyond Medicine.',
  description:
    'MKCGSPANDAN is a private community where doctors and medical batchmates reconnect, celebrate professional journeys, preserve shared memories and plan reunions.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  logo: {
    mark: '/brand/logo-mark.svg', // square symbol — replace with your own artwork
    alt: 'MKCGSPANDAN logo',
  },
  // Optional real photograph for the homepage hero (e.g. '/brand/hero.jpg').
  // When empty, the built-in illustration is shown instead.
  heroImage: '',
  policyVersion: '2026-10-01',
  contactEmail: '',
};

export const mainNav = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/memories', label: 'Memories' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/community', label: 'Community' },
  { href: '/events', label: 'Events' },
];

export const absoluteUrl = (path = '/') => `${site.url}${path.startsWith('/') ? path : `/${path}`}`;
