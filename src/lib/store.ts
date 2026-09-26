import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GENESIS_HASH, canonicalize, sha256 } from "./canonical";
import { d1Config, d1Insert, d1LoadAll, type D1Config } from "./d1";
import { signRecord, verifySignature } from "./sign";
import type {
  AgentActionRecord,
  ChainVerification,
  NewAgentActionRecord,
} from "./types";

/**
 * Append-only, hash-chained event store.
 *
 * Design constraints that are load-bearing rather than incidental:
 *
 *  1. There is no update or delete path. `append` is the only mutation, and it
 *     only ever extends the tail. This is the property an auditor checks first.
 *  2. Each record commits to its predecessor, so editing any historical row
 *     invalidates every row after it. Detection does not depend on trusting
 *     the store.
 *  3. Verification re-derives every hash from stored data instead of trusting a
 *     cached value, so a tampered row is caught even if the tamperer also
 *     rewrote the stored hashes.
 */

const DATA_DIR = process.env.CARLTINE_DATA_DIR ?? path.join(process.cwd(), ".carltine");
const DATA_FILE = path.join(DATA_DIR, "chain.json");

const memory = {
  records: [] as AgentActionRecord[],
  loaded: false,
  /**
   * False once a write to disk has failed. While false, reads trust memory,
   * because the file is no longer a faithful mirror and re-reading would
   * silently discard records.
   */
  persistHealthy: true,
  /** Serializes appends so concurrent requests cannot both read the same tail. */
  writeQueue: Promise.resolve<unknown>(undefined),
};

/**
 * Which store is authoritative.
 *
 * D1 when configured, because Netlify's filesystem is ephemeral and a chain
 * that resets on every cold start is useless. The local file otherwise, which
 * is what local dev uses.
 */
function activeDriver(): "d1" | "file" {
  return d1Config() ? "d1" : "file";
}

export function storageMode(): "d1" | "file" {
  return activeDriver();
}

async function readFromDisk(): Promise<AgentActionRecord[] | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as { records?: unknown };
    if (Array.isArray(parsed?.records)) {
      return parsed.records as AgentActionRecord[];
    }
  } catch {
    // Missing or unreadable file: handled by the caller.
  }
  return null;
}

async function ensureLoaded(): Promise<AgentActionRecord[]> {
  if (activeDriver() === "d1") {
    // D1 is the system of record, so always read it. Caching would let a record
    // altered directly in the database go unnoticed, which would break the one
    // guarantee this product makes.
    memory.records = await d1LoadAll(d1Config() as D1Config);
    memory.loaded = true;
    return memory.records;
  }

  // Reads re-sync from disk on every call. Caching them would mean a record
  // altered directly in storage is never re-derived, which would quietly break
  // the central guarantee: verification has to see the bytes that are actually
  // stored, not the bytes this process happened to read earlier.
  if (memory.persistHealthy) {
    const fromDisk = await readFromDisk();
    if (fromDisk) {
      memory.records = fromDisk;
    } else if (memory.records.length === 0) {
      // First run, nothing persisted yet.
      memory.records = [];
    }
  }
  memory.loaded = true;
  return memory.records;
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ version: 1, records: memory.records }, null, 2),
      "utf8",
    );
  } catch (err) {
    memory.persistHealthy = false;
    // Read-only or ephemeral filesystems (some serverless hosts) cannot
    // persist. The in-memory chain still works for the life of the process;
    // durability is a deployment concern, not a correctness one.
    console.warn(
      "[carltine] chain persistence unavailable, continuing in memory:",
      (err as Error).message,
    );
  }
}

/**
 * The fields covered by the chain hash.
 *
 * `hash` obviously cannot cover itself, and `signature` is derived *from* the
 * hash, so neither can be in the hashed body. Verification must therefore
 * exclude both, or every record would fail to recompute.
 */
type HashedBody = Omit<AgentActionRecord, "hash" | "signature">;

function computeHash(record: HashedBody): string {
  return sha256(canonicalize(record) + record.prevHash);
}

export async function append(
  input: NewAgentActionRecord,
): Promise<AgentActionRecord> {
  // Queue behind any in-flight append so the tail is read atomically.
  const run = memory.writeQueue.then(async () => {
    const records = await ensureLoaded();
    const prev = records[records.length - 1];

    const unsigned: HashedBody = {
      seq: prev ? prev.seq + 1 : 0,
      id: randomUUID(),
      ...input,
      recordedAt: new Date().toISOString(),
      prevHash: prev ? prev.hash : GENESIS_HASH,
    };

    const hash = computeHash(unsigned);
    const record: AgentActionRecord = { ...unsigned, hash, signature: signRecord(hash) };

    if (activeDriver() === "d1") {
      // Insert before mutating the local copy, so a failed write cannot leave
      // an in-memory record that was never actually stored.
      await d1Insert(d1Config() as D1Config, record);
      records.push(record);
    } else {
      records.push(record);
      await persist();
    }
    return record;
  });

  memory.writeQueue = run.catch(() => undefined);
  return run;
}

export async function all(): Promise<AgentActionRecord[]> {
  const records = await ensureLoaded();
  return [...records].sort((a, b) => a.seq - b.seq);
}

/** Most recent first, for the dashboard. */
export async function recent(limit = 50): Promise<AgentActionRecord[]> {
  const records = await all();
  return records.slice(-limit).reverse();
}

export async function get(id: string): Promise<AgentActionRecord | null> {
  const records = await all();
  return records.find((r) => r.id === id) ?? null;
}

/**
 * Recompute the entire chain from stored bytes.
 *
 * Deliberately does not trust stored `hash`/`prevHash` values except to read
 * the *next* record's expected predecessor: each hash is re-derived and
 * compared, so a row edited in the database fails even if its stored hash was
 * updated to match.
 */
export async function verifyChain(): Promise<ChainVerification> {
  const records = await all();
  let expectedPrev = GENESIS_HASH;

  for (const record of records) {
    // hash and signature are destructured only to exclude them from the
    // hashed body; they are compared separately below.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hash, signature, ...body } = record;
    const expectedHash = computeHash(body);

    if (record.prevHash !== expectedPrev) {
      return {
        valid: false,
        length: records.length,
        brokenAt: record.seq,
        reason: `record ${record.seq} does not follow the previous record (chain reordered or removed)`,
        checkedAt: new Date().toISOString(),
        headHash: expectedPrev,
      };
    }

    if (record.hash !== expectedHash) {
      return {
        valid: false,
        length: records.length,
        brokenAt: record.seq,
        reason: `record ${record.seq} has been altered since it was written`,
        checkedAt: new Date().toISOString(),
        headHash: expectedPrev,
      };
    }

    if (record.signature && !verifySignature(record.hash, record.signature)) {
      return {
        valid: false,
        length: records.length,
        brokenAt: record.seq,
        reason: `record ${record.seq} was not signed by this ingest service`,
        checkedAt: new Date().toISOString(),
        headHash: expectedPrev,
      };
    }

    expectedPrev = record.hash;
  }

  return {
    valid: true,
    length: records.length,
    brokenAt: null,
    reason: null,
    checkedAt: new Date().toISOString(),
    headHash: expectedPrev,
  };
}

export async function stats() {
  const records = await all();
  const byRisk: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const byOversight: Record<string, number> = {};
  const agents = new Set<string>();

  for (const r of records) {
    byRisk[r.riskClass] = (byRisk[r.riskClass] ?? 0) + 1;
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    byOversight[r.oversightMode] = (byOversight[r.oversightMode] ?? 0) + 1;
    if (r.actorType === "agent") agents.add(r.actorId);
  }

  const escalated = records.filter(
    (r) => r.oversightMode === "human-overrode" || r.oversightMode === "human-stopped",
  ).length;
  const scopeViolations = records.filter((r) => r.scopeExceeded).length;
  const unauthorized = records.filter((r) => r.outcome === "denied").length;

  return {
    total: records.length,
    distinctAgents: agents.size,
    humanOversightRate:
      records.length === 0
        ? 0
        : records.filter((r) => r.oversightMode !== "none").length / records.length,
    escalated,
    scopeViolations,
    unauthorized,
    byRisk,
    byOutcome,
    byOversight,
  };
}

/** CSV for the auditor who does not want to run anything. */
export function toCsv(records: AgentActionRecord[]): string {
  // Column order is the order a reader needs them in, and the always-empty
  // columns are omitted.
  //
  // The record type still carries the EU AI Act fields from the schema this
  // started as, but humanPrincipalId, oversightActorId, oversightReason and
  // riskClass are never populated for a routing decision. Exporting them put
  // four permanently-blank columns in front of anyone opening the file, which
  // reads as an unfinished export rather than as a deliberate schema.
  const columns = [
    "seq",
    "occurredAt",
    "action",
    "targetSystem",
    "targetResource",
    "authorizationBasis",
    "grantedScope",
    "scopeExceeded",
    "outcome",
    "inputDigest",
    "outputDigest",
    "id",
    "actorType",
    "actorId",
    "agentVersion",
    "oversightMode",
    "prevHash",
    "hash",
    "signature",
  ] as const;

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join(" ") : String(v);
    // Prefix formula-like cells so a spreadsheet does not evaluate them.
    const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const rows = records.map((r) =>
    columns.map((c) => escape(r[c] as unknown)).join(","),
  );
  return [columns.join(","), ...rows].join("\n");
}
