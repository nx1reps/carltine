/**
 * Carltine record schema.
 *
 * Field choices are driven backwards from the evidence an auditor actually
 * demands, not from what is convenient to log. The groupings map to:
 *
 *   - EU AI Act Art. 12 (Record-keeping / logging): automatically recorded
 *     events over the system's lifetime, sufficient to reconstruct behaviour.
 *   - EU AI Act Art. 14 (Human oversight): the record must show a human was
 *     able to interpret, intervene in, and stop the system.
 *   - IETF draft-klrc-aiagent-auth: an agent action needs an identity, a
 *     delegation/authorization basis, and a scoped target.
 */

export type ActorType = "agent" | "human" | "system";

/**
 * How a human was involved. Art. 14 requires that oversight is *effective*,
 * not nominal, so we record the mechanism rather than a boolean.
 */
export type OversightMode =
  | "none"
  | "pre-approved"
  | "human-in-the-loop"
  | "human-approved"
  | "human-overrode"
  | "human-stopped";

export type Outcome = "succeeded" | "failed" | "denied" | "partial";

export type RiskClass = "minimal" | "limited" | "high";

export interface AgentActionRecord {
  /** Monotonic sequence number, starts at 0 for genesis. */
  seq: number;
  /** UUIDv4, stable external handle for the record. */
  id: string;

  // ---- Who acted -------------------------------------------------------
  actorType: ActorType;
  /** Agent name/id, employee id, or system principal. */
  actorId: string;
  /**
   * The human the agent acts on behalf of, when applicable. This is the
   * delegation chain: an auditor needs to know the agent was *someone's*
   * authorized instrument, not a free actor.
   */
  humanPrincipalId: string | null;
  /** Agent build/version, so behaviour can be attributed to a specific build. */
  agentVersion: string | null;

  // ---- What happened ---------------------------------------------------
  /** Dot-namespaced verb, e.g. "refund.issue", "db.write", "email.send". */
  action: string;
  targetSystem: string;
  targetResource: string | null;
  /** Machine-readable result detail. Redacted by convention, not enforced. */
  detail: Record<string, unknown>;

  // ---- Authorization basis (the field most logs are missing) -----------
  /** The policy, grant, or contract that authorized this specific action. */
  authorizationBasis: string;
  /** Scope that was in force, e.g. ["refund:*", "amount<500"]. */
  grantedScope: string[];
  /** True when the action exceeded the scope recorded in grantedScope. */
  scopeExceeded: boolean;

  // ---- Human oversight (Art. 14) --------------------------------------
  oversightMode: OversightMode;
  /** Identity of the human who intervened, when they did. */
  oversightActorId: string | null;
  /** What the human changed, when they overrode the agent. */
  oversightReason: string | null;

  // ---- Classification and outcome -------------------------------------
  riskClass: RiskClass;
  outcome: Outcome;
  /**
   * Input/output digests rather than raw payloads. Keeps the log useful
   * without turning it into a copy of the production data it describes.
   */
  inputDigest: string | null;
  outputDigest: string | null;

  // ---- Time ------------------------------------------------------------
  occurredAt: string;
  recordedAt: string;

  // ---- Tamper evidence -------------------------------------------------
  /** Hash of the previous record, forming the chain. Genesis = 64 zeros. */
  prevHash: string;
  /** SHA-256 over this record's canonical form plus prevHash. */
  hash: string;
  /** Signed by the recording service on ingest. */
  signature: string | null;
}

export type NewAgentActionRecord = Omit<
  AgentActionRecord,
  "seq" | "id" | "recordedAt" | "prevHash" | "hash" | "signature"
>;

export interface ChainVerification {
  valid: boolean;
  length: number;
  /** Index of the first record that fails to verify, if any. */
  brokenAt: number | null;
  reason: string | null;
  checkedAt: string;
  /** Head hash, useful for external anchoring (see /api/anchor). */
  headHash: string;
}
