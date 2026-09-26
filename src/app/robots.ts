import type { MetadataRoute } from "next";

/**
 * robots.txt
 *
 * The API surface is disallowed because indexing a chat endpoint is pointless
 * and crawling it wastes crawl budget. /app is allowed because the ledger and
 * playground are the pages a prospective user actually wants to find.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/app", "/docs"],
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://carltine.com/sitemap.xml",
    host: "https://carltine.com",
  };
}
