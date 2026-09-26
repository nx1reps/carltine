import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * API key authentication for write endpoints.
 *
 * Keys are stored as SHA-256 hashes, never plaintext, so a leaked store does
 * not hand over working credentials. Comparison is constant-time.
 *
 * When no keys are configured the API is open, which is convenient for local
 * development and unacceptable anywhere else. `isAuthOpen()` exists so callers
 * and the UI can surface that state rather than leaving it implicit.
 */

const KEY_PREFIX = "crt_";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function configuredKeys(): string[] {
  const raw = process.env.CARLTINE_API_KEYS ?? "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function isAuthOpen(): boolean {
  return configuredKeys().length === 0;
}

export type AuthResult =
  | { ok: true; keyId: string }
  | { ok: false; reason: string };

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyKey(raw: string): AuthResult {
  const keys = configuredKeys();
  if (keys.length === 0) {
    return { ok: true, keyId: "anonymous" };
  }

  const presented = hashKey(raw);
  for (const key of keys) {
    if (constantTimeEqual(presented, hashKey(key))) {
      // The key itself is never returned, only a short fingerprint for the
      // audit trail, so a log dump cannot be used to recover the secret.
      return { ok: true, keyId: `${KEY_PREFIX}${key.slice(-4)}` };
    }
  }
  return { ok: false, reason: "Invalid or missing API key." };
}

/** Extract and verify a bearer key from a request. */
export function requireKey(request: NextRequest): AuthResult {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const key = bearer || request.headers.get("x-carltine-key")?.trim() || "";

  if (!key) {
    return isAuthOpen()
      ? { ok: true, keyId: "anonymous" }
      : { ok: false, reason: "Missing API key. Send `Authorization: Bearer <key>`." };
  }
  return verifyKey(key);
}
