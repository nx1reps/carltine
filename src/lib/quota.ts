import { isAuthOpen } from "./auth";

/**
 * Free-tier guard.
 *
 * The business model is a free tier that the user never has to sign up for:
 * bring your own provider key, and Carltine routes it. That means our cost is
 * compute, not tokens, so the only thing worth metering is request volume.
 *
 * A small in-process allowance keeps a runaway loop from turning into a bill.
 * It is per-instance and therefore not a real quota — the honest version needs
 * the D1 counter — but it is enough to make the free tier safe to ship while
 * that is being built, and it fails open rather than rejecting real users.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 86_400_000; // 24h
const FREE_DAILY_LIMIT = 5_000;

/**
 * Allowance for a request that carried no key.
 *
 * When no keys are configured the endpoint is open, which is what makes the
 * free tier signup-free. It was previously also unmetered and infinite, which
 * meant a public deploy could be written to by anyone, without limit, and
 * without the operator being able to tell. Open should mean "no account
 * required", not "no boundary".
 */
const ANONYMOUS_DAILY_LIMIT = 500;

const buckets = new Map<string, Bucket>();

function limit(): number {
  const raw = process.env.CARLTINE_FREE_DAILY_LIMIT;
  if (!raw) return FREE_DAILY_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FREE_DAILY_LIMIT;
}

export type QuotaResult =
  | { ok: true; used: number; limit: number; remaining: number }
  | { ok: false; reason: string; used: number; limit: number };

/**
 * Best-effort client address, for bucketing anonymous traffic.
 *
 * Trusts the first value of the standard forwarding headers, which is what a
 * request arriving through Netlify, Vercel, or Cloudflare will carry. Spoofable
 * by a direct caller, which is acceptable: the point is to stop an accidental
 * runaway loop, not to defend against a motivated attacker choosing their own
 * limit.
 */
export function clientAddress(
  headers: { get(name: string): string | null },
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function checkQuota(
  keyId: string,
  now = Date.now(),
  address?: string,
): QuotaResult {
  // With no keys configured every caller shares the "anonymous" identity, so
  // the bucket is keyed by client address instead. Without this the open tier
  // had no limit at all.
  const open = isAuthOpen();
  const max = open ? ANONYMOUS_DAILY_LIMIT : limit();
  const bucketKey = open ? `anon:${address ?? "unknown"}` : keyId;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 0, resetAt: now + WINDOW_MS });
    return { ok: true, used: 0, limit: max, remaining: max };
  }

  if (existing.count >= max) {
    return {
      ok: false,
      reason: `Free tier limit reached (${max} requests/day). Reset at ${new Date(existing.resetAt).toISOString()}.`,
      used: existing.count,
      limit: max,
    };
  }

  existing.count += 1;
  return {
    ok: true,
    used: existing.count,
    limit: max,
    remaining: max - existing.count,
  };
}

export function quotaHeaders(result: QuotaResult): Record<string, string> {
  if (result.limit === Number.POSITIVE_INFINITY) return {};
  const remaining = Math.max(0, result.limit - result.used);
  return {
    "x-carltine-quota-limit": String(result.limit),
    "x-carltine-quota-used": String(result.used),
    "x-carltine-quota-remaining": String(remaining),
  };
}

/** Test hook: clears in-process counters. */
export function resetQuotas(): void {
  buckets.clear();
}
