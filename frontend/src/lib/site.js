// Only a full https:// address is used; anything else counts as "not set".
function httpsUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\/[^\s]+$/i.test(url) ? url : "";
}

// Single source of truth for branding. To rebrand, change this file and
// replace the logo files in /public — no component embeds the logo itself.
export const site = {
  name: "MKCGSPANDAN",
  shortName: "Spandan",
  tagline: "Together in Medicine. Connected Beyond Medicine.",
  description:
    "MKCGSPANDAN is a private community where doctors and medical Friends reconnect, celebrate professional journeys, preserve shared memories and plan reunions.",
  // NEXT_PUBLIC_SITE_URL, else (on Vercel) the project's production domain,
  // which Vercel exposes to the build; localhost only for local development.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:5000")
  ).replace(/\/+$/, ""),
  logo: {
    // The official MKCGSPANDAN logo (square artwork on white), in public/brand.
    // It is shown on a white tile so it stays legible in the dark theme, and is
    // never stretched or cropped. Next.js serves a resized copy of this file.
    image: "/brand/MKCGSPANDAN LOGO.png",
    // Pixel size of the logo file, used to keep its proportions.
    width: 1254,
    height: 1254,
    alt: "MKCGSPANDAN logo",
  },
  // Android app download — the "Download App" button on the homepage hero.
  // Set NEXT_PUBLIC_ANDROID_APK_URL in frontend/.env.local (or your host's
  // environment) to the full https:// address of the APK file or its download
  // page, then rebuild. Until it is set, the button shows "coming soon" and is
  // not a link.
  androidApkUrl: httpsUrl(""),
  // "Designed & Developed by" credit at the bottom of the footer (the Android
  // app shows the same credit — keep mobile/utils/constants.js in sync).
  // Only full https:// addresses become links; an empty value hides that link.
  developer: {
    name: "Bibhu Prasad Mahapatra",
    // Personal portfolio website — not set yet: add its full https:// address here.
    portfolioUrl: httpsUrl(""),
    linkedinUrl: httpsUrl(
      "https://www.linkedin.com/in/bibhuprasad-mahapatra-a9a896282/",
    ),
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
