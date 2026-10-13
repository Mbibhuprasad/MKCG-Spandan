import { absoluteUrl, site } from "@/lib/site";

// Crawl hints only. These rules are NOT what protects private data: every
// member-only or admin-only API request is authorised by the backend, and the
// pages listed here contain no member data in their server-rendered HTML.
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/login",
          // Member-only areas
          "/community",
          "/memories",
          "/events",
          "/doctors",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
