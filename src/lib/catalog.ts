/**
 * Model catalog and pricing.
 *
 * Prices are USD per 1M tokens as of September 2026 and change often, so they
 * live in one editable table with a `verifiedAt` stamp rather than scattered
 * through the routing code. `STALE_AFTER_DAYS` makes staleness visible instead
 * of quietly producing wrong savings claims, which is the one failure mode that
 * would destroy trust in the product.
 */

export type CapabilityTier = 1 | 2 | 3 | 4 | 5;

export interface ModelSpec {
  id: string;
  provider: "openai" | "anthropic" | "google" | "deepseek" | "qwen" | "mistral";
  label: string;
  /** USD per 1M input tokens. */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
  /** Higher means the model handles harder requests. */
  tier: CapabilityTier;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  /** Rough latency class for routing decisions that care about speed. */
  latencyClass: "fast" | "medium" | "slow";
}

export const MODELS: ModelSpec[] = [
  // Tier 5 — frontier. Reserved for genuinely hard requests.
  {
    id: "gpt-6-astra",
    provider: "openai",
    label: "GPT-6 Astra",
    inputPerM: 10,
    outputPerM: 50,
    tier: 5,
    contextWindow: 400_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "slow",
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Claude Opus 5",
    inputPerM: 5,
    outputPerM: 25,
    tier: 5,
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "slow",
  },
  // Tier 4 — strong general purpose.
  {
    id: "gpt-6-sol",
    provider: "openai",
    label: "GPT-6 Sol",
    inputPerM: 2,
    outputPerM: 10,
    tier: 4,
    contextWindow: 400_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "medium",
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    inputPerM: 3,
    outputPerM: 15,
    tier: 4,
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "medium",
  },
  {
    id: "deepseek-v4-pro",
    provider: "deepseek",
    label: "DeepSeek V4 Pro",
    inputPerM: 0.3,
    outputPerM: 1.1,
    tier: 4,
    contextWindow: 164_000,
    supportsTools: true,
    supportsVision: false,
    latencyClass: "medium",
  },
  // Tier 3 — the workhorses. Most production traffic belongs here.
  {
    id: "gpt-6-luna",
    provider: "openai",
    label: "GPT-6 Luna",
    inputPerM: 0.1,
    outputPerM: 0.5,
    tier: 3,
    contextWindow: 400_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "fast",
  },
  {
    id: "gemini-3-flash",
    provider: "google",
    label: "Gemini 3 Flash",
    inputPerM: 0.08,
    outputPerM: 0.3,
    tier: 3,
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsVision: true,
    latencyClass: "fast",
  },
  {
    id: "qwen3.7-flash",
    provider: "qwen",
    label: "Qwen3.7 Flash",
    inputPerM: 0.03,
    outputPerM: 0.13,
    tier: 3,
    contextWindow: 256_000,
    supportsTools: true,
    supportsVision: false,
    latencyClass: "fast",
  },
  // Tier 2 — cheap and fast, for extraction and classification.
  {
    id: "qwen3.7-turbo",
    provider: "qwen",
    label: "Qwen3.7 Turbo",
    inputPerM: 0.01,
    outputPerM: 0.04,
    tier: 2,
    contextWindow: 128_000,
    supportsTools: false,
    supportsVision: false,
    latencyClass: "fast",
  },
  {
    id: "deepseek-v4-flash",
    provider: "deepseek",
    label: "DeepSeek V4 Flash",
    inputPerM: 0.0028,
    outputPerM: 0.14,
    tier: 2,
    contextWindow: 164_000,
    supportsTools: true,
    supportsVision: false,
    latencyClass: "fast",
  },
  {
    id: "mistral-mini",
    provider: "mistral",
    label: "Mistral Mini",
    inputPerM: 0.03,
    outputPerM: 0.06,
    tier: 2,
    contextWindow: 128_000,
    supportsTools: true,
    supportsVision: false,
    latencyClass: "fast",
  },
  // Tier 1 — the floor. Almost free, and honest about its limits.
  {
    id: "qwen3.7-mini",
    provider: "qwen",
    label: "Qwen3.7 Mini",
    inputPerM: 0.002,
    outputPerM: 0.008,
    tier: 1,
    contextWindow: 64_000,
    supportsTools: false,
    supportsVision: false,
    latencyClass: "fast",
  },
];

export const CATALOG_VERIFIED_AT = "2026-09-26";
export const STALE_AFTER_DAYS = 30;

export function catalogAgeDays(now = new Date()): number {
  const verified = new Date(CATALOG_VERIFIED_AT);
  return Math.floor((now.getTime() - verified.getTime()) / 86_400_000);
}

export function isCatalogStale(now = new Date()): boolean {
  return catalogAgeDays(now) > STALE_AFTER_DAYS;
}

const BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}

/** Blended cost for a request shape, used to compare models fairly. */
export function estimateCostUsd(
  model: ModelSpec,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (model.inputPerM * inputTokens) / 1_000_000 +
    (model.outputPerM * outputTokens) / 1_000_000
  );
}
