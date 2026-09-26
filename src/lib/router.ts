import {
  MODELS,
  type CapabilityTier,
  type ModelSpec,
  estimateCostUsd,
} from "./catalog";

/**
 * The router.
 *
 * Given a request, pick the cheapest model that can plausibly handle it. The
 * design goal is that every decision is explainable from the recorded inputs,
 * because an unexplainable router is indistinguishable from a random one with
 * better marketing.
 *
 * Approach: score difficulty from cheap, deterministic signals only. No model
 * call is made to decide which model to call, since that would cost more than
 * the routing saves and add a failure mode to the hot path. This is the same
 * intuition as RouteLLM, minus the preference-data training: structure and
 * signals predict difficulty well enough to clear the bar where the model
 * currently pinned is a frontier one.
 */

export type Priority = "economy" | "balanced" | "quality";

export interface RoutingRequest {
  messages: {
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  }[];
  /** Caller can force a model, bypassing routing entirely. */
  model?: string;
  priority?: Priority;
  requiresTools?: boolean;
  requiresVision?: boolean;
  /** Hard ceiling on spend for this request, in USD. */
  maxCostUsd?: number;
  /** Optional caller-supplied difficulty hint from 0 to 1. */
  difficultyHint?: number;
}

export interface RoutingSignals {
  /** Total characters across all messages. */
  promptChars: number;
  /** Longest single message length. */
  longestMessageChars: number;
  /** Distinct message roles present. */
  distinctRoles: number;
  /** Estimated input tokens, ~4 chars per token. */
  inputTokens: number;
  /** Count of code fences, a decent proxy for programming tasks. */
  codeBlockCount: number;
  /** Count of imperative verbs, a proxy for multi-step reasoning. */
  reasoningMarkerCount: number;
  /** Count of open-ended design/strategy markers. */
  designMarkerCount: number;
  /** Count of high-stakes domain markers (legal, clinical, financial). */
  domainMarkerCount: number;
  /** Whether a tool/function call structure is present. */
  hasToolStructure: boolean;
  /** Number of URLs, often a retrieval task. */
  urlCount: number;
  /** 0 to 1 difficulty score. */
  difficulty: number;
  /** Which signals pushed the score up, for the audit trail. */
  contributors: string[];
}

export interface RoutingDecision {
  chosen: ModelSpec;
  /** Cheapest model in the catalog, as the savings baseline. */
  baseline: ModelSpec;
  /** Most expensive eligible model, as the worst case. */
  premium: ModelSpec;
  signals: RoutingSignals;
  reasons: string[];
  /** Cost if the caller had used the baseline model. */
  baselineCostUsd: number;
  chosenCostUsd: number;
  savingsUsd: number;
  savingsPct: number;
  /** Eligible models considered, cheapest first. */
  considered: string[];
  /** Cheapest model overall, for context on how much headroom was given up. */
  cheapestAvailable?: string;
}

const REASONING_MARKERS = [
  "prove", "explain why", "derive", "compare and contrast", "trade-off",
  "tradeoff", "optimiz", "architect", "debug", "root cause", "step by step",
  "analyze", "evaluate", "design", "implications", "what if", "justify",
];

/**
 * Open-ended generation markers.
 *
 * These indicate a request with no verifiable answer, where a wrong model
 * produces a confidently incorrect result rather than an obviously failed one.
 * That is the failure mode worth paying to avoid, so these carry more weight
 * than a generic reasoning marker.
 */
const DESIGN_MARKERS = [
  "design", "architecture", "architect", "strategy", "roadmap", "plan",
  "compare and contrast", "evaluate", "trade-off", "tradeoff", "justify",
  "recommend", "critique", "review the approach", "pros and cons",
];

/** Signals that imply a high-stakes professional domain. */
const DOMAIN_MARKERS = [
  "legal", "contract", "compliance", "audit", "clinical", "diagnos", "patient",
  "medical", "financial advice", "investment", "tax", "regulation", "statute",
  "liability", "malpractice", "prescription", "patient safety",
];

const TOOL_TOKENS = ["<function", "tool_call", "tool_calls", "\"tools\"", "<|tool"];

function countMatches(text: string, needles: string[]): number {
  let n = 0;
  for (const needle of needles) {
    if (text.includes(needle)) n++;
  }
  return n;
}

/**
 * Difficulty scoring.
 *
 * Each contribution is additive and capped, so no single signal can dominate.
 * The weights encode the intuition that *structure* (code, tools, many turns)
 * predicts difficulty better than raw length does.
 */
export function scoreDifficulty(
  req: Pick<RoutingRequest, "messages" | "requiresTools" | "requiresVision"> & {
    difficultyHint?: number;
  },
): RoutingSignals {
  const text = req.messages.map((m) => m.content).join("\n");
  const promptChars = text.length;
  const longestMessageChars = req.messages.reduce(
    (max, m) => Math.max(max, m.content.length),
    0,
  );
  const distinctRoles = new Set(req.messages.map((m) => m.role)).size;
  const inputTokens = Math.ceil(promptChars / 4);
  const codeBlockCount = (text.match(/```/g) ?? []).length / 2;
  const reasoningMarkerCount = countMatches(text.toLowerCase(), REASONING_MARKERS);
  const designMarkerCount = countMatches(text.toLowerCase(), DESIGN_MARKERS);
  const domainMarkerCount = countMatches(text.toLowerCase(), DOMAIN_MARKERS);
  const hasToolStructure =
    Boolean(req.requiresTools) ||
    countMatches(text, TOOL_TOKENS) > 0 ||
    // A conversation carrying tool results is a tool-calling request whether or
    // not the caller set the flag. Real OpenAI clients resend the full history
    // on every turn, so this is the common case, not an edge case.
    req.messages.some(
      (m) => m.role === "tool" || (m.tool_calls?.length ?? 0) > 0 || Boolean(m.tool_call_id),
    );
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;

  let difficulty = 0;
  const contributors: string[] = [];

  if (promptChars > 2_000) {
    difficulty += 0.12;
    contributors.push("long prompt");
  }
  if (promptChars > 8_000) {
    difficulty += 0.12;
    contributors.push("very long prompt");
  }
  if (promptChars > 32_000) {
    difficulty += 0.15;
    contributors.push("extremely long prompt");
  }
  if (codeBlockCount > 0) {
    difficulty += Math.min(0.1 + codeBlockCount * 0.05, 0.28);
    contributors.push(`${codeBlockCount} code block${codeBlockCount > 1 ? "s" : ""}`);
  }
  if (reasoningMarkerCount > 0) {
    difficulty += Math.min(reasoningMarkerCount * 0.08, 0.26);
    contributors.push(`${reasoningMarkerCount} reasoning marker${reasoningMarkerCount > 1 ? "s" : ""}`);
  }
  // Open-ended design work is weighted separately and more heavily. A request
  // to "design and justify" a system has no checkable answer, so a wrong model
  // returns something plausible and wrong, which is the most expensive failure
  // mode there is. These prompts were previously routing one tier too low.
  if (designMarkerCount > 0) {
    difficulty += Math.min(0.18 + designMarkerCount * 0.12, 0.45);
    contributors.push(`${designMarkerCount} design signal${designMarkerCount > 1 ? "s" : ""}`);
  }
  if (domainMarkerCount > 0) {
    difficulty += Math.min(0.2 + domainMarkerCount * 0.1, 0.4);
    contributors.push(`regulated domain (${domainMarkerCount})`);
  }
  if (hasToolStructure) {
    difficulty += 0.2;
    contributors.push("tool calls");
  }
  if (req.requiresVision) {
    difficulty += 0.18;
    contributors.push("vision input");
  }
  if (distinctRoles > 3) {
    difficulty += 0.08;
    contributors.push(`${distinctRoles} conversation roles`);
  }
  if (urlCount > 3) {
    difficulty += 0.1;
    contributors.push("multiple sources");
  }
  if (longestMessageChars > 6_000) {
    difficulty += 0.07;
    contributors.push("single long message");
  }
  if (req.difficultyHint !== undefined) {
    // Caller-supplied hints are trusted only as a nudge, not an override.
    difficulty = difficulty * 0.6 + req.difficultyHint * 0.4;
    contributors.push("caller hint");
  }

  difficulty = Math.max(0, Math.min(difficulty, 1));

  return {
    promptChars,
    longestMessageChars,
    distinctRoles,
    inputTokens,
    codeBlockCount: Math.floor(codeBlockCount),
    reasoningMarkerCount,
    designMarkerCount,
    domainMarkerCount,
    hasToolStructure,
    urlCount,
    difficulty,
    contributors,
  };
}

/** Map a 0-1 difficulty onto a capability tier. */
function tierForDifficulty(difficulty: number): CapabilityTier {
  // Thresholds are set so that anything with a reasoning or code signal clears
  // tier 3. Sending an architecture question to a tier-1 model fails loudly and
  // expensively later, which is far worse than overpaying on some fraction of
  // traffic. Under-routing is the expensive mistake; over-routing is the
  // cheap one.
  if (difficulty > 0.6) return 5;
  if (difficulty > 0.38) return 4;
  if (difficulty > 0.12) return 3;
  return 2;
}

/** Minimum tier the caller's stated priority permits. */
function tierFloor(priority: Priority): CapabilityTier {
  return priority === "quality" ? 4 : priority === "economy" ? 1 : 2;
}

/**
 * Resolve the tier to use.
 *
 * The priority floor is combined with the difficulty tier using max(), not
 * applied only when difficulty is low. Treating it as anything other than a
 * floor means `priority: "quality"` gets silently ignored for exactly the
 * medium-difficulty requests a caller flagged as important.
 */
function resolveTier(difficulty: number, priority: Priority): CapabilityTier {
  const byDifficulty = tierForDifficulty(difficulty);
  const floor = tierFloor(priority);
  return byDifficulty > floor ? byDifficulty : floor;
}

/**
 * Candidate pool.
 *
 * The tier the router selected is a *floor*, not a ceiling: if a request scores
 * as tier-4 work we use a tier-4 model, not the cheapest model that happens to
 * be under tier 4. Filtering on `tier <= n` and then sorting by price is the
 * obvious implementation and it is wrong — it silently downgrades every
 * request to the floor of the catalog.
 */
function eligible(
  signals: RoutingSignals,
  req: RoutingRequest,
  tier: CapabilityTier,
): ModelSpec[] {
  const exact = MODELS.filter((m) => {
    if (m.tier !== tier) return false;
    if (req.requiresTools && !m.supportsTools) return false;
    if (req.requiresVision && !m.supportsVision) return false;
    return true;
  });

  const pool = exact.sort(
    (a, b) => a.inputPerM + a.outputPerM - (b.inputPerM + b.outputPerM),
  );

  // Never return an empty pool. If the exact tier has no model meeting the
  // capability filter, climb until something qualifies, so a request can never
  // fail to route.
  if (pool.length > 0) return pool;
  for (let t = tier + 1; t <= 5; t++) {
    const wider = MODELS.filter((m) => {
      if (m.tier !== t) return false;
      if (req.requiresTools && !m.supportsTools) return false;
      if (req.requiresVision && !m.supportsVision) return false;
      return true;
    });
    if (wider.length > 0) {
      return wider.sort(
        (a, b) => a.inputPerM + a.outputPerM - (b.inputPerM + b.outputPerM),
      );
    }
  }
  return [];
}

/** Rough output estimate. Real usage is measured after the call completes. */
function estimateOutputTokens(signals: RoutingSignals): number {
  return Math.max(
    64,
    Math.min(Math.ceil(signals.promptChars / 4) * 0.5, 8_000),
  );
}

export function route(req: RoutingRequest): RoutingDecision {
  const priority = req.priority ?? "balanced";
  const signals = scoreDifficulty(req);
  const outputTokens = estimateOutputTokens(signals);

  // An explicit model request is a hard override. Respecting it is what makes
  // this safe to adopt: you can always pin a model for the calls that matter.
  if (req.model) {
    const pinned = MODELS.find((m) => m.id === req.model);
    if (pinned) {
      const premium = decisionPremium();
      const chosenCostUsd = estimateCostUsd(pinned, signals.inputTokens, outputTokens);
      const baselineCostUsd = estimateCostUsd(
        premium,
        signals.inputTokens,
        outputTokens,
      );
      const savingsUsd = Math.max(0, baselineCostUsd - chosenCostUsd);
      return {
        chosen: pinned,
        baseline: premium,
        premium,
        signals,
        reasons: [
          `caller pinned ${pinned.label}; routing bypassed`,
          // A pinned model can be the expensive choice, and the ledger should
          // say so rather than hiding it behind a zero-savings row.
          ...(pinned.id === premium.id
            ? []
            : [
                `pin is ${((chosenCostUsd / baselineCostUsd - 1) * 100).toFixed(0)}% ${
                  chosenCostUsd > baselineCostUsd ? "more" : "less"
                } than the frontier default for this request shape`,
              ]),
        ],
        baselineCostUsd,
        chosenCostUsd,
        savingsUsd,
        savingsPct:
          baselineCostUsd > 0 ? (savingsUsd / baselineCostUsd) * 100 : 0,
        considered: [pinned.id],
      };
    }
  }

  const reasons: string[] = [];
  let tier = resolveTier(signals.difficulty, priority);
  // The capability filter must use the same inferred flag the scorer used.
  // Filtering on `req.requiresTools` alone would let a conversation carrying
  // tool results land on a model that cannot accept them.
  const effectiveReq: RoutingRequest = signals.hasToolStructure
    ? { ...req, requiresTools: true }
    : req;
  let pool = eligible(signals, effectiveReq, tier);

  if (pool.length === 0) {
    tier = 5;
    pool = eligible(signals, effectiveReq, tier);
    reasons.push("no model met the capability filter; widened to frontier");
  }

  if (req.maxCostUsd !== undefined) {
    const withinBudget = pool.filter(
      (m) => estimateCostUsd(m, signals.inputTokens, outputTokens) <= req.maxCostUsd!,
    );
    if (withinBudget.length > 0) {
      if (withinBudget.length < pool.length) {
        reasons.push(
          `budget cap $${req.maxCostUsd} removed ${pool.length - withinBudget.length} candidate(s)`,
        );
      }
      pool = withinBudget;
    } else {
      // Nothing fits the cap. Take the cheapest anyway and say so loudly rather
      // than failing the request.
      reasons.push(
        `no candidate fit the $${req.maxCostUsd} cap; chose cheapest available and exceeded it`,
      );
      pool = [pool[0]];
    }
  }

  const chosen = pool[0];
  reasons.unshift(
    `difficulty ${signals.difficulty.toFixed(2)} → tier ${chosen.tier}` +
      (signals.contributors.length
        ? ` (${signals.contributors.join(", ")})`
        : " (no difficulty signals)"),
  );
  if (priority !== "balanced" && tier === tierFloor(priority)) {
    reasons.push(`priority "${priority}" set the tier floor to ${tier}`);
  }

  // Baseline is the frontier model a team would otherwise pin by default. This
  // is the only honest denominator: comparing to the cheapest model in the
  // catalog would report ~100% savings for every request and mean nothing.
  const cheapest = [...MODELS].sort(
    (a, b) => a.inputPerM + a.outputPerM - (b.inputPerM + b.outputPerM),
  )[0];
  const baseline = decisionPremium();
  const premium = baseline;

  const baselineCostUsd = estimateCostUsd(baseline, signals.inputTokens, outputTokens);
  const chosenCostUsd = estimateCostUsd(chosen, signals.inputTokens, outputTokens);
  const savingsUsd = Math.max(0, baselineCostUsd - chosenCostUsd);

  return {
    chosen,
    baseline,
    premium,
    signals,
    reasons,
    baselineCostUsd,
    chosenCostUsd,
    savingsUsd,
    savingsPct: baselineCostUsd > 0 ? (savingsUsd / baselineCostUsd) * 100 : 0,
    considered: pool.map((m) => m.id),
    cheapestAvailable: cheapest.id,
  };
}

/** The most expensive model in the catalog, used as the default comparison. */
function decisionPremium(): ModelSpec {
  return [...MODELS].sort(
    (a, b) => b.inputPerM + b.outputPerM - (a.inputPerM + a.outputPerM),
  )[0];
}

/**
 * Cost if the request had gone to the frontier default.
 *
 * Savings are only meaningful against a realistic alternative, so this compares
 * against the frontier model a team would otherwise pin, never against the
 * cheapest model in the catalog, which would inflate every number we publish.
 */
export function savingsVsFrontier(decision: RoutingDecision): {
  frontierCostUsd: number;
  savingsPct: number;
} {
  const frontier = decision.premium;
  const frontierCostUsd = estimateCostUsd(
    frontier,
    decision.signals.inputTokens,
    estimateOutputTokens(decision.signals),
  );
  return {
    frontierCostUsd,
    savingsPct:
      frontierCostUsd > 0
        ? ((frontierCostUsd - decision.chosenCostUsd) / frontierCostUsd) * 100
        : 0,
  };
}
