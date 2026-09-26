import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalize } from "./canonical";

/**
 * Ingest signing.
 *
 * The chain hash detects tampering with *stored* records. The signature proves
 * a record was accepted by *this* service rather than injected by someone with
 * write access to the database. They defend against different adversaries, so
 * the product keeps both.
 */

let cached: string | null = null;

const DEV_SECRET_FILE = path.join(
  process.env.CARLTINE_DATA_DIR ?? path.join(process.cwd(), ".carltine"),
  "dev-ingest-secret",
);

/**
 * Resolve the signing secret.
 *
 * Production sets CARLTINE_INGEST_SECRET. Without it we fall back to a key
 * persisted next to the chain, so that seeding a chain and then starting the
 * app still verifies. An in-memory-only fallback would regenerate the key on
 * every restart and report every historical record as forged, which is both
 * alarming and useless as a default.
 *
 * This fallback is explicitly not production-grade: the key lives in plaintext
 * beside the data it protects, so it protects against casual tampering, not
 * against someone who can read the app's filesystem.
 */
function resolveSecret(): string {
  if (cached) return cached;

  const configured = process.env.CARLTINE_INGEST_SECRET;
  if (configured && configured.length >= 16) {
    cached = configured;
    return cached;
  }

  try {
    if (existsSync(DEV_SECRET_FILE)) {
      const existing = readFileSync(DEV_SECRET_FILE, "utf8").trim();
      if (existing.length >= 16) {
        cached = existing;
        return cached;
      }
    }
    const generated = createHmac("sha256", String(Date.now()))
      .update(`${process.pid}:${Math.random()}`)
      .digest("hex");
    mkdirSync(path.dirname(DEV_SECRET_FILE), { recursive: true });
    writeFileSync(DEV_SECRET_FILE, generated, { encoding: "utf8", mode: 0o600 });
    console.warn(
      "[carltine] CARLTINE_INGEST_SECRET is unset. Generated a development key at " +
        `${DEV_SECRET_FILE}. Set CARLTINE_INGEST_SECRET before deploying.`,
    );
    cached = generated;
    return cached;
  } catch {
    // Read-only filesystem. Fall back to a per-process key: signatures will not
    // survive a restart, which is better than refusing to start.
    const ephemeral = createHmac("sha256", String(Date.now()))
      .update(String(process.pid))
      .digest("hex");
    console.warn(
      "[carltine] could not persist a dev signing key, using an ephemeral one. " +
        "Signatures will not survive a restart.",
    );
    cached = ephemeral;
    return cached;
  }
}

export function isEphemeralSigning(): boolean {
  return !(
    process.env.CARLTINE_INGEST_SECRET &&
    process.env.CARLTINE_INGEST_SECRET.length >= 16
  );
}

export function signRecord(hash: string): string {
  return createHmac("sha256", resolveSecret()).update(hash).digest("hex");
}

export function verifySignature(hash: string, signature: string): boolean {
  const expected = signRecord(hash);
  if (expected.length !== signature.length) return false;
  // Constant-time compare to avoid leaking bytes via timing.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export function digestOf(payload: unknown): string {
  return createHmac("sha256", resolveSecret())
    .update(canonicalize(payload))
    .digest("hex");
}
