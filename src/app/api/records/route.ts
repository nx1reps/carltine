import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import { digestOf } from "@/lib/sign";
import type { NewAgentActionRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTORS = new Set(["agent", "human", "system"]);
const OVERSIGHT = new Set([
  "none",
  "pre-approved",
  "human-in-the-loop",
  "human-approved",
  "human-overrode",
  "human-stopped",
]);
const OUTCOMES = new Set(["succeeded", "failed", "denied", "partial"]);
const RISKS = new Set(["minimal", "limited", "high"]);

/**
 * Validate a submission into a NewAgentActionRecord.
 *
 * Returns either a record ready to append or a field-keyed error. Validation
 * is strict because these records are compliance artifacts: a record that is
 * missing its authorization basis is worse than no record, since it looks like
 * evidence.
 */
function validate(
  body: Record<string, unknown>,
): { ok: true; value: NewAgentActionRecord } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const str = (k: string, required = true): string | null => {
    const v = body[k];
    if (v === undefined || v === null || v === "") {
      if (required) errors[k] = "required";
      return null;
    }
    if (typeof v !== "string") {
      errors[k] = "must be a string";
      return null;
    }
    return v;
  };

  const actorType = str("actorType");
  if (actorType && !ACTORS.has(actorType)) {
    errors.actorType = `must be one of ${[...ACTORS].join(", ")}`;
  }

  // Every field is read and validated into a local BEFORE the error gate below.
  // Validating inside the returned object literal would run after the gate and
  // silently skip the check entirely.
  const actorId = str("actorId");
  const humanPrincipalId = str("humanPrincipalId", false);
  const agentVersion = str("agentVersion", false);
  const action = str("action");
  const targetSystem = str("targetSystem");
  const targetResource = str("targetResource", false);
  const authorizationBasis = str("authorizationBasis");
  const oversightActorId = str("oversightActorId", false);
  const oversightReason = str("oversightReason", false);
  const inputDigest = str("inputDigest", false);
  const outputDigest = str("outputDigest", false);

  const oversightMode = body.oversightMode ?? "none";
  if (typeof oversightMode !== "string" || !OVERSIGHT.has(oversightMode)) {
    errors.oversightMode = `must be one of ${[...OVERSIGHT].join(", ")}`;
  }

  const outcome = str("outcome");
  if (outcome && !OUTCOMES.has(outcome)) {
    errors.outcome = `must be one of ${[...OUTCOMES].join(", ")}`;
  }

  const riskClass = str("riskClass");
  if (riskClass && !RISKS.has(riskClass)) {
    errors.riskClass = `must be one of ${[...RISKS].join(", ")}`;
  }

  const grantedScopeRaw = body.grantedScope ?? [];
  let grantedScope: string[] = [];
  if (Array.isArray(grantedScopeRaw)) {
    grantedScope = grantedScopeRaw.filter((s): s is string => typeof s === "string");
  } else {
    errors.grantedScope = "must be an array of strings";
  }

  const detail = body.detail ?? {};
  if (typeof detail !== "object" || detail === null || Array.isArray(detail)) {
    errors.detail = "must be an object";
  }

  // Optional: an unstated occurrence time defaults to now. Passing
  // required=true here would reject every submission that omits it, which is
  // the common case.
  const occurredAt = str("occurredAt", false) ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(occurredAt))) {
    errors.occurredAt = "must be an ISO-8601 timestamp";
  }

  // Art. 14: an intervention that happened but has no recorded reason is not
  // reconstructable, which is the entire point of the record.
  const oversightModeStr = oversightMode as string;
  if (
    (oversightModeStr === "human-overrode" || oversightModeStr === "human-stopped") &&
    !body.oversightReason
  ) {
    errors.oversightReason = "required when a human overrode or stopped the agent";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      actorType: actorType as NewAgentActionRecord["actorType"],
      actorId: actorId as string,
      humanPrincipalId,
      agentVersion,
      action: action as string,
      targetSystem: targetSystem as string,
      targetResource,
      detail: detail as Record<string, unknown>,
      authorizationBasis: authorizationBasis as string,
      grantedScope,
      scopeExceeded: body.scopeExceeded === true,
      oversightMode: oversightMode as NewAgentActionRecord["oversightMode"],
      oversightActorId,
      oversightReason,
      riskClass: riskClass as NewAgentActionRecord["riskClass"],
      outcome: outcome as NewAgentActionRecord["outcome"],
      inputDigest: inputDigest ?? digestOf(body.input ?? null),
      outputDigest: outputDigest ?? digestOf(body.output ?? null),
      occurredAt: new Date(occurredAt).toISOString(),
    },
  };
}

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsed = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 50;

  const [records, stats, chain] = await Promise.all([
    store.recent(limit),
    store.stats(),
    store.verifyChain(),
  ]);

  return NextResponse.json({ records, stats, chain, limit });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validation failed.", fields: result.errors },
      { status: 422 },
    );
  }

  const record = await store.append(result.value);
  return NextResponse.json({ record }, { status: 201 });
}
