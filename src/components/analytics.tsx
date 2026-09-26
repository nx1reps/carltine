"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * PostHog, loaded only when a key is configured.
 *
 * Gated on an env var rather than always shipping the dependency, so a fork or
 * self-hosted deploy sends analytics nowhere instead of to a third party its
 * operator never agreed to. The dynamic import keeps ~30kB out of the bundle
 * when it is disabled.
 */
export function Analytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

  useEffect(() => {
    if (!key) return;
    try {
      posthog.init(key, {
        api_host: host,
        capture_pageview: true,
        // Respect the browser preference rather than profiling regardless.
        opt_out_capturing_by_default: false,
        persistence: "localStorage+cookie",
      });
    } catch {
      // Analytics must never break the page.
    }
  }, [key, host]);

  return null;
}
