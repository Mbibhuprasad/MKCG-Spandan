// Single source of truth for branding. To rebrand, change this file and
// replace the logo files in /public — no component embeds the logo itself.
export const site = {
  name: "MKCGSPANDAN",
  shortName: "Spandan",
  tagline: "Together in Medicine. Connected Beyond Medicine.",
  description:
    "MKCGSPANDAN is a private community where doctors and medical batchmates reconnect, celebrate professional journeys, preserve shared memories and plan reunions.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
  logo: {
    // The final logo. Save the artwork as frontend/public/mkcgspandan-logo.png
    // (any proportions — it is shown 36px tall, never stretched or cropped).
    // Until that file exists the built-in mark below is shown instead.
    image: "/mkcgspandan-logo.png",
    // Pixel size of the logo file, used to reserve its space while it loads.
    width: 512,
    height: 512,
    mark: "/brand/logo-mark.svg", // built-in fallback symbol
    alt: "MKCGSPANDAN logo",
  },
  // Credit shown at the bottom of the footer. Replace the placeholder with the
  // developer's name; add a full https:// address to `url` to make it a link.
  developer: {
    name: "[DEVELOPER_NAME]",
    url: "",
  },
  // Optional real photograph for the homepage hero (e.g. '/brand/hero.jpg').
  // When empty, the built-in illustration is shown instead.
  heroImage: "",
  policyVersion: "2026-10-01",
  contactEmail: "",
};

export const mainNav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/doctors", label: "My Friends" },
  { href: "/memories", label: "Memories" },
  { href: "/blogs", label: "Blogs" },
  { href: "/community", label: "Community" },
  { href: "/events", label: "Events" },
];

export const absoluteUrl = (path = "/") =>
  `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
