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

export function checkQuota(keyId: string, now = Date.now()): QuotaResult {
  // Open-auth local development is not metered; it is not a public endpoint.
  if (isAuthOpen()) {
    return { ok: true, used: 0, limit: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY };
  }

  const max = limit();
  const existing = buckets.get(keyId);

  if (!existing || existing.resetAt <= now) {
    buckets.set(keyId, { count: 0, resetAt: now + WINDOW_MS });
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
