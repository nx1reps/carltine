import { MODELS, type ModelSpec, estimateCostUsd } from "./catalog";
import { type RoutingRequest, type RoutingDecision } from "./router";
import {
  UpstreamError,
  callProvider,
  hasKey,
  type CallOptions,
  type UpstreamResult,
} from "./providers";

/**
 * Provider fallback.
 *
 * A router that routes to a single model is a single point of failure. When a
 * provider is rate-limited or down, retrying the same model just burns the
 * caller's timeout, so we walk *up* the catalog from the chosen tier to the
 * next-cheapest model with a usable key.
 *
 * "Up" matters: falling back to a weaker model risks a silently bad answer,
 * which is the one failure this product exists to prevent. Escalating to a
 * more capable model costs a little more and preserves quality.
 */

export interface Attempt {
  model: ModelSpec;
  ok: boolean;
  error: string | null;
  latencyMs: number;
}

export interface FallbackResult {
  result: UpstreamResult | null;
  attempts: Attempt[];
  /** The final model that answered, which may differ from the first choice. */
  servedBy: ModelSpec | null;
  decision: RoutingDecision;
}

function sameProvider(a: ModelSpec, b: ModelSpec): boolean {
  return a.provider === b.provider;
}/**
 * Ordered retry candidates.
 *
 * Only models the caller has a key for, and only ones at a *strictly higher*
 * tier than the original choice. The original is added by the caller; this
 * returns only the escalations. A budget cap is respected here too, so a
 * fallback cannot silently exceed a limit the caller set.
 */
export function fallbackChain(
  decision: RoutingDecision,
  maxCostUsd: number | undefined,
): ModelSpec[] {
  const chosenTier = decision.chosen.tier;

  return MODELS.filter((m) => {
    if (m.tier <= chosenTier) return false;
    if (!hasKey(m)) return false;
    if (maxCostUsd !== undefined) {
      const cost = estimateCostUsd(
        m,
        decision.signals.inputTokens,
        decision.signals.inputTokens,
      );
      if (cost > maxCostUsd) return false;
    }
    return true;
  })
    .sort(
      (a, b) =>
        a.tier - b.tier || a.inputPerM + a.outputPerM - (b.inputPerM + b.outputPerM),
    )
    .slice(0, 4);
}

export async function callWithFallback(
  req: RoutingRequest,
  decision: RoutingDecision,
  options: {
    temperature?: number;
    maxTokens?: number;
    tools?: CallOptions["tools"];
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<FallbackResult> {
  const attempts: Attempt[] = [];
  const messages = req.messages;

  const candidates: ModelSpec[] = [
    decision.chosen,
    ...fallbackChain(decision, req.maxCostUsd).filter(
      (m) => m.id !== decision.chosen.id && !sameProvider(m, decision.chosen),
    ),
  ];

  for (const model of candidates) {
    if (!hasKey(model)) {
      attempts.push({
        model,
        ok: false,
        error: "no API key configured for this provider",
        latencyMs: 0,
      });
      continue;
    }

    const callOpts: CallOptions = {
      model,
      messages,
      tools: options.tools,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    };

    try {
      const result = await callProvider(callOpts);
      attempts.push({ model, ok: true, error: null, latencyMs: result.latencyMs });
      return { result, attempts, servedBy: model, decision };
    } catch (err) {
      const isUpstream = err instanceof UpstreamError;
      attempts.push({
        model,
        ok: false,
        error: isUpstream ? (err as UpstreamError).message : (err as Error).message,
        latencyMs: 0,
      });
      // A non-retryable error (bad key, invalid model) will not improve with a
      // different model on the same provider, but escalating to another provider
      // with a different key is still worth one attempt.
      if (!isUpstream) break;
    }
  }

  return { result: null, attempts, servedBy: null, decision };
}
