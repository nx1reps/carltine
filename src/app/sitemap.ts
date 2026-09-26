import type { MetadataRoute } from "next";

/**
 * Sitemap.
 *
 * `lastModified` is pinned to a constant rather than `new Date()` because a
 * sitemap that changes on every build tells crawlers the site changes on every
 * build, which erodes trust in the dates it reports.
 */
const LAST_MODIFIED = new Date("2026-09-26");

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://carltine.com";

  return [
    { url: base, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/app/playground`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/app`, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/app/chain`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/docs`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: LAST_MODIFIED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/changelog`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/status`, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 0.4 },
    { url: `${base}/security`, lastModified: LAST_MODIFIED, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
