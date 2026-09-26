import { createHash } from "node:crypto";

/**
 * Deterministic JSON serialization: object keys sorted recursively.
 *
 * Hashing requires that the same logical record always produces the same
 * bytes, regardless of insertion order. Plain JSON.stringify does not
 * guarantee that, so we canonicalize before hashing.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** The prevHash of the first record in a chain. */
export const GENESIS_HASH = "0".repeat(64);
