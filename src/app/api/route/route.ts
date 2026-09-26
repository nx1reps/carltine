import { NextRequest, NextResponse } from "next/server";
import { route, savingsVsFrontier } from "@/lib/router";
import { isCatalogStale, catalogAgeDays, estimateCostUsd } from "@/lib/catalog";
import { callWithFallback } from "@/lib/fallback";
import { hasKey, streamProvider, UpstreamError } from "@/lib/providers";
import * as store from "@/lib/store";
import { digestOf } from "@/lib/sign";
import { requireKey } from "@/lib/auth";
import { checkQuota, clientAddress, quotaHeaders } from "@/lib/quota";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChatRequest {
  model?: string;
  messages?: {
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  }[];
  /** OpenAI-shaped tool schemas. Presence implies requiresTools. */
  tools?: { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } }[];
  priority?: "economy" | "balanced" | "quality";
  requiresTools?: boolean;
  requiresVision?: boolean;
  maxCostUsd?: number;
  difficultyHint?: number;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  const auth = requireKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { message: auth.reason, type: "authentication_error" } },
      { status: 401 },
    );
  }

  const quota = checkQuota(auth.keyId, Date.now(), clientAddress(request.headers));
  if (!quota.ok) {
    return NextResponse.json(
      { error: { message: quota.reason, type: "quota_exceeded" } },
      { status: 429, headers: quotaHeaders(quota) },
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json(
      { error: { message: "Body must be valid JSON.", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json(
      { error: { message: "messages is required.", type: "invalid_request_error" } },
      { status: 400 },
    );
  }

  // A caller that supplies tool schemas has, by definition, a tool-calling
  // request, whether or not they also set the flag.
  const requiresTools = body.requiresTools === true || (body.tools?.length ?? 0) > 0;
  const hasToolResults = messages.some((m) => m.role === "tool");

  const decision = route({
    messages,
    model: body.model,
    priority: body.priority,
    requiresTools: requiresTools || hasToolResults,
    requiresVision: body.requiresVision,
    maxCostUsd: body.maxCostUsd,
    difficultyHint: body.difficultyHint,
  });

  const tools = body.tools;

  const vsFrontier = savingsVsFrontier(decision);
  const canCallUpstream = hasKey(decision.chosen);

  // ---- Streaming path -------------------------------------------------
  // Streamed responses are passed through as raw bytes. The decision is still
  // recorded first, so a streamed call is as auditable as a buffered one.
  if (body.stream && canCallUpstream) {
    const recordId = await recordDecision({
      authKeyId: auth.keyId,
      decision,
      vsFrontier,
      simulated: false,
      messages,
      outcome: "succeeded",
    }).catch(() => null);

    let upstream: Response;
    try {
      upstream = await streamProvider({
        model: decision.chosen,
        messages,
        tools,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        signal: request.signal,
      });
    } catch (err) {
      const message = err instanceof UpstreamError ? err.message : (err as Error).message;
      if (recordId) await markRecordFailed(recordId, message);
      return NextResponse.json(
        { error: { message, type: "upstream_error" } },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-carltine-model": decision.chosen.id,
        "x-carltine-record": recordId ?? "",
        ...quotaHeaders(quota),
      },
    });
  }

  // ---- Buffered path --------------------------------------------------
  if (canCallUpstream) {
    const { result, attempts, servedBy } = await callWithFallback(
      { messages, maxCostUsd: body.maxCostUsd, requiresTools },
      decision,
      {
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        tools,
        signal: request.signal,
      },
    );

    if (!result || !servedBy) {
      const lastError = attempts[attempts.length - 1]?.error ?? "no provider available";
      const recordId = await recordDecision({
        authKeyId: auth.keyId,
        decision,
        vsFrontier,
        simulated: false,
        messages,
        outcome: "failed",
        detail: { attempts: attempts.map((a) => ({ model: a.model.id, error: a.error })) },
      }).catch(() => null);
      if (recordId) await markRecordFailed(recordId!, lastError);
      return NextResponse.json(
        { error: { message: `All providers failed. Last error: ${lastError}`, type: "upstream_error" } },
        { status: 502 },
      );
    }

    // Recompute the real cost from actual token usage rather than the estimate.
    const realCost = estimateCostUsd(servedBy, result.inputTokens, result.outputTokens);
    const recordId = await recordDecision({
      authKeyId: auth.keyId,
      decision,
      vsFrontier,
      simulated: false,
      messages,
      outcome: "succeeded",
      servedBy: servedBy.id,
      attempts,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    }).catch(() => null);

    return NextResponse.json(
      {
        id: `chatcmpl-${recordId ?? "unrecorded"}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: servedBy.id,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: result.content,
              ...(result.toolCalls && result.toolCalls.length > 0
                ? { tool_calls: result.toolCalls }
                : {}),
            },
            finish_reason: result.finishReason ?? (result.toolCalls ? "tool_calls" : "stop"),
          },
        ],
        usage: {
          prompt_tokens: result.inputTokens,
          completion_tokens: result.outputTokens,
          total_tokens: result.inputTokens + result.outputTokens,
        },
        carltine: {
          recordId,
          chosen: decision.chosen.id,
          routedTo: decision.chosen.id,
          servedBy: servedBy.id,
          savingsPct: vsFrontier.savingsPct,
          savingsUsd: vsFrontier.frontierCostUsd - decision.chosenCostUsd,
          fellBack: servedBy.id !== decision.chosen.id,
          attempts: attempts.map((a) => ({ model: a.model.id, ok: a.ok, error: a.error })),
          tier: decision.chosen.tier,
          difficulty: decision.signals.difficulty,
          reasons: decision.reasons,
          realCostUsd: realCost,
          estimatedCostUsd: decision.chosenCostUsd,
          latencyMs: result.latencyMs,
          catalogStale: isCatalogStale(),
          storage: store.storageMode(),
        },
      },
      { headers: quotaHeaders(quota) },
    );
  }

  // ---- No key for the chosen provider: simulated response -------------
  const recordId = await recordDecision({
    authKeyId: auth.keyId,
    decision,
    vsFrontier,
    simulated: true,
    messages,
    outcome: "succeeded",
  }).catch(() => null);

  const content =
    `[simulated ${decision.chosen.label} response]\n\n` +
    `Routed: difficulty ${decision.signals.difficulty.toFixed(2)} → ${decision.chosen.label} (tier ${decision.chosen.tier}).\n` +
    `Reason: ${decision.reasons[0]}\n\n` +
    `No ${decision.chosen.provider} API key is configured, so no upstream call was made. ` +
    `Add one to your environment to get real completions.`;

  return NextResponse.json(
    {
      id: `chatcmpl-${recordId ?? "unrecorded"}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: decision.chosen.id,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: decision.signals.inputTokens,
        completion_tokens: Math.ceil(decision.signals.inputTokens * 0.5),
        total_tokens: Math.ceil(decision.signals.inputTokens * 1.5),
      },
      carltine: {
        recordId,
        // `chosen` is the stable key across all three response shapes. The
        // others are additive detail.
        chosen: decision.chosen.id,
        routedTo: decision.chosen.id,
        servedBy: null,
        fellBack: false,
        tier: decision.chosen.tier,
        difficulty: decision.signals.difficulty,
        reasons: decision.reasons,
        estimatedCostUsd: decision.chosenCostUsd,
        frontierCostUsd: vsFrontier.frontierCostUsd,
        savingsUsd: vsFrontier.frontierCostUsd - decision.chosenCostUsd,
        savingsPct: vsFrontier.savingsPct,
        simulated: true,
        catalogStale: isCatalogStale(),
        storage: store.storageMode(),
      },
    },
    { headers: quotaHeaders(quota) },
  );
}

async function recordDecision(args: {
  authKeyId: string;
  decision: ReturnType<typeof route>;
  vsFrontier: ReturnType<typeof savingsVsFrontier>;
  simulated: boolean;
  messages: { role: string; content: string }[];
  outcome: "succeeded" | "failed";
  servedBy?: string;
  attempts?: { model: { id: string }; ok: boolean; error: string | null }[];
  usage?: { inputTokens: number; outputTokens: number };
  detail?: Record<string, unknown>;
}) {
  const record = await store.append({
    actorType: "system",
    actorId: "carltine-router",
    humanPrincipalId: args.authKeyId,
    agentVersion: "router/1",
    action: "llm.route",
    targetSystem: args.decision.chosen.provider,
    targetResource: args.decision.chosen.id,
    detail: {
      chosen: args.decision.chosen.id,
      baseline: args.decision.baseline.id,
      servedBy: args.servedBy ?? null,
      tier: args.decision.chosen.tier,
      difficulty: args.decision.signals.difficulty,
      contributors: args.decision.signals.contributors,
      reasons: args.decision.reasons,
      considered: args.decision.considered,
      inputTokens: args.usage?.inputTokens ?? args.decision.signals.inputTokens,
      outputTokens: args.usage?.outputTokens ?? null,
      estimatedCostUsd: args.decision.chosenCostUsd,
      frontierCostUsd: args.vsFrontier.frontierCostUsd,
      savingsPct: args.vsFrontier.savingsPct,
      attempts: args.attempts?.map((a) => ({ model: a.model.id, ok: a.ok, error: a.error })) ?? [],
      simulated: args.simulated,
      catalogAgeDays: catalogAgeDays(),
      requestDigest: digestOf(args.messages),
      ...args.detail,
    },
    authorizationBasis: "ROUTE-policy-default-v1",
    grantedScope: [`model:${args.decision.chosen.id}`],
    scopeExceeded: false,
    oversightMode: "pre-approved",
    oversightActorId: null,
    oversightReason: null,
    riskClass: args.decision.chosen.tier >= 4 ? "high" : "limited",
    outcome: args.outcome,
    inputDigest: digestOf(args.messages),
    outputDigest: null,
    occurredAt: new Date().toISOString(),
  });
  return record.id;
}

/** Mark a record's outcome after the fact, appending a correction record. */
async function markRecordFailed(recordId: string, reason: string) {
  // Records are immutable, so a failure is recorded as a new linked event
  // rather than an update. This is the whole point of the ledger.
  await store.append({
    actorType: "system",
    actorId: "carltine-router",
    humanPrincipalId: null,
    agentVersion: "router/1",
    action: "llm.route.failed",
    targetSystem: "carltine",
    targetResource: recordId,
    detail: { reason },
    authorizationBasis: "ROUTE-outcome-correction-v1",
    grantedScope: ["record:*"],
    scopeExceeded: false,
    oversightMode: "pre-approved",
    oversightActorId: null,
    oversightReason: null,
    riskClass: "limited",
    outcome: "failed",
    inputDigest: null,
    outputDigest: null,
    occurredAt: new Date().toISOString(),
  });
}
