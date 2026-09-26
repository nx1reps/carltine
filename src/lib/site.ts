/**
 * Canonical project URLs.
 *
 * These were previously hardcoded in ten places across the site, which meant
 * the clone command in the hero and the link in the footer could drift apart
 * and both be wrong. One source of truth, imported everywhere.
 */

/** Repository root, no trailing slash. */
export const GITHUB_REPO = "https://github.com/nx1reps/carltine";

/** `owner/name`, for building paths and for the docs. */
export const GITHUB_REPO_SLUG = "nx1reps/carltine";

/** The one-line self-host command shown in the hero. */
export const GITHUB_CLONE_URL = `${GITHUB_REPO}.git`;

/** Issues, for the "report a problem" links. */
export const GITHUB_ISSUES = `${GITHUB_REPO}/issues`;
