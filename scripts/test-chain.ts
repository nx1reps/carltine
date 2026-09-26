/**
 * Tamper-detection test.
 *
 * The product claim is that history cannot be altered without detection. That is
 * a security property, so it is tested like one: three realistic attacks, each
 * run in its own process against its own on-disk chain, each expected to fail
 * verification.
 *
 *   content  - edit a record's field, leave its hash alone
 *   rehash   - edit the field AND recompute that record's own hash
 *   delete   - remove a record from the middle entirely
 *
 * The `rehash` case is the important one. It defeats a per-row signature check,
 * and only the chain catches it, because the following record still commits to
 * the old hash.
 *
 * Usage: npm run test:chain
 */
// MUST be first: resolves CARLTINE_INGEST_SECRET from .env.local exactly as the
// Next.js server does, so seeded records verify against the running app.
import "./load-env";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const selfPath = fileURLToPath(import.meta.url);

type Phase = "write" | "verify" | "content" | "rehash" | "delete" | "none";

const phase = process.argv[2] as Phase | undefined;
const dataDir = process.env.CARLTINE_DATA_DIR;

// Only child phases touch a specific chain; the parent orchestrates and
// creates a fresh data dir per attack.
if (phase && !dataDir) {
  console.error("CARLTINE_DATA_DIR is required when running a phase directly.");
  process.exit(1);
}

/** Resolved lazily: the parent process has no chain of its own. */
function chainFile(): string {
  return path.join(dataDir as string, "chain.json");
}

async function writeChain() {
  const { append, all } = await import("../src/lib/store");
  const base = {
    actorType: "agent" as const,
    actorId: "test-agent",
    humanPrincipalId: "emp_1",
    agentVersion: "1.0.0",
    authorizationBasis: "POLICY-test-v1",
    grantedScope: ["test:*"],
    scopeExceeded: false,
    oversightMode: "none" as const,
    oversightActorId: null,
    oversightReason: null,
    inputDigest: null,
    outputDigest: null,
    targetResource: null,
    occurredAt: "2026-09-01T12:00:00.000Z",
  };
  for (const [i, action] of ["alpha.one", "beta.two", "gamma.three"].entries()) {
    await append({
      ...base,
      action,
      targetSystem: "test-system",
      detail: { i },
      riskClass: "limited" as const,
      outcome: "succeeded" as const,
    });
  }
  const records = await all();
  console.log(JSON.stringify({ ok: true, count: records.length }));
}

async function verify() {
  const { verifyChain } = await import("../src/lib/store");
  const result = await verifyChain();
  // Exit code is the signal the parent process checks.
  console.log(JSON.stringify(result));
  process.exit(result.valid ? 0 : 1);
}

async function readChainFile() {
  const raw = await fs.readFile(chainFile(), "utf8");
  return JSON.parse(raw) as { records: Record<string, unknown>[] };
}

async function writeChainFile(data: { records: Record<string, unknown>[] }) {
  await fs.writeFile(chainFile(), JSON.stringify(data, null, 2), "utf8");
}

async function tamperContent() {
  const data = await readChainFile();
  // Flip the outcome of the middle record. Leave its hash untouched.
  (data.records[1] as { outcome: string }).outcome = "denied";
  await writeChainFile(data);
  console.log("tampered: record 1 outcome -> denied (hash left stale)");
}

async function tamperRehash() {
  const { canonicalize, sha256 } = await import("../src/lib/canonical");
  const data = await readChainFile();
  const record = data.records[1] as Record<string, unknown>;
  record.outcome = "denied";
  // Recompute this record's own hash so a per-row signature check would pass.
  // `hash` is destructured only to exclude it from the body being rehashed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hash, ...rest } = record;
  record.hash = sha256(canonicalize(rest) + String(record.prevHash));
  await writeChainFile(data);
  console.log(`tampered: record 1 outcome + rehashed to ${String(record.hash).slice(0, 12)}...`);
}

async function tamperDelete() {
  const data = await readChainFile();
  // Excise the middle record entirely, renumbering nothing.
  data.records.splice(1, 1);
  await writeChainFile(data);
  console.log("tampered: removed record 1 from the middle of the chain");
}

const phases: Record<Phase, () => Promise<unknown>> = {
  write: writeChain,
  verify: verify,
  content: tamperContent,
  rehash: tamperRehash,
  delete: tamperDelete,
  none: async () => {},
};

if (phase && phases[phase]) {
  phases[phase]().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // ---- parent: orchestrate each attack in an isolated chain -------------
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });

  async function main() {    const run = (p: Phase, dir: string, expectValid: boolean): boolean => {
      // A fixed ingest secret across children. Without it each process derives
      // its own ephemeral key and signatures from an earlier process cannot be
      // verified, which would make the baseline check fail for a reason that
      // has nothing to do with chain integrity.
      const env = {
        ...process.env,
        CARLTINE_DATA_DIR: dir,
        CARLTINE_INGEST_SECRET: "test-secret-not-for-production-use",
      };
      if (p === "write") {
        execFileSync("npx", ["tsx", selfPath, "write"], { env, stdio: "pipe" });
      } else if (p === "verify") {
        try {
          const out = execFileSync("npx", ["tsx", selfPath, "verify"], {
            env,
            encoding: "utf8",
          });
          const result = JSON.parse(out.trim().split("\n").pop() ?? "{}") as { valid: boolean };
          return result.valid === expectValid;
        } catch {
          return expectValid === false; // non-zero exit means invalid, as expected
        }
      } else {
        execFileSync("npx", ["tsx", selfPath, p], { env, stdio: "pipe" });
      }
      return true;
    };

    let failures = 0;
    const check = (label: string, ok: boolean) => {
      console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`);
      if (!ok) failures++;
    };

    const attacks: { label: string; tamper: Phase }[] = [
      { label: "baseline: untampered chain verifies", tamper: "none" },
      { label: "edit a field, hash unchanged -> detected", tamper: "content" },
      { label: "edit a field AND rehash it -> detected by chain link", tamper: "rehash" },
      { label: "delete a record from the middle -> detected", tamper: "delete" },
    ];

    for (const attack of attacks) {
      console.log(`\n${attack.label}`);
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "carltine-test-"));
      try {
        run("write", dir, true);
        if (attack.tamper !== "none") run(attack.tamper, dir, false);
        const ok = run("verify", dir, attack.tamper === "none");
        check(attack.label, ok);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }

    console.log(
      failures === 0
        ? "\nAll tamper-detection checks passed."
        : `\n${failures} check(s) failed.`,
    );
    process.exit(failures === 0 ? 0 : 1);
  }
}
