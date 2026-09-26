/**
 * Load .env.local for the standalone scripts.
 *
 * This exists because of a bug that made the quickstart produce a broken
 * ledger on every clean clone. `npm run seed` runs under tsx, which does not
 * read .env.local, so `resolveSecret()` in src/lib/sign.ts found no
 * CARLTINE_INGEST_SECRET and fell back to a generated key written to
 * .carltine/dev-ingest-secret. The Next.js dev server *does* read .env.local,
 * so it signed and verified with the real secret instead. Two different keys
 * meant every seeded record failed its signature check, and the first thing a
 * new user saw on the ledger was "record 0 was not signed by this ingest
 * service".
 *
 * The fix is to use Next's own loader rather than a hand-rolled parser, so the
 * scripts and the app cannot disagree about precedence or about which files
 * are read at all. @next/env is declared in devDependencies for exactly this
 * reason: it ships with Next, but relying on a transitive dependency for a
 * direct import is how this breaks on the next major.
 */
import { loadEnvConfig } from "@next/env";

/**
 * @next/env skips `.env.local` when NODE_ENV=test.
 *
 * From its source:
 *
 *   const isTest = process.env.NODE_ENV === "test"
 *   const mode   = isTest ? "test" : dev ? "development" : "production"
 *   const files  = [`.env.${mode}.local`, mode !== "test" && ".env.local", ...]
 *
 * That is correct for `next test`, which must not pick up developer secrets. It
 * is wrong for these scripts: they are operator tools that exist to act on the
 * developer's own configuration, and running one under NODE_ENV=test (an
 * ordinary thing to do in CI) would silently drop the signing secret and
 * produce a chain that fails verification with a misleading error.
 *
 * So NODE_ENV is neutralised for the duration of the call and restored
 * immediately after. Nothing else in the process observes the change.
 */
// NODE_ENV is typed readonly by Next's ambient types, but it is a normal
// writable process variable at runtime and this is the only way to make
// loadEnvConfig read .env.local.
const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
if (originalNodeEnv === "test") {
  delete env.NODE_ENV;
}
try {
  loadEnvConfig(process.cwd(), env.NODE_ENV !== "production");
} finally {
  if (originalNodeEnv !== undefined) {
    env.NODE_ENV = originalNodeEnv;
  }
}
