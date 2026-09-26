/**
 * Verify the on-disk chain and report the result.
 *
 * Exists as a command rather than only as an API route because the failure it
 * catches is a setup-time one. If CARLTINE_INGEST_SECRET changes after seeding,
 * every existing record fails its signature check and the ledger reports the
 * whole history as forged. That is correct behaviour, but it is alarming and
 * confusing unless you know the cause, so setup.sh runs this and fails loudly
 * rather than leaving a new user to discover it on their first visit.
 */
import "./load-env";
import { verifyChain, storageMode } from "../src/lib/store";
import { isEphemeralSigning } from "../src/lib/sign";

async function main(): Promise<void> {
  const result = await verifyChain();

  console.log(
    JSON.stringify({ ...result, storage: storageMode() }, null, 2),
  );

  if (!result.valid) {
    console.error(
      `\n✗ Chain broken at record ${result.brokenAt}: ${result.reason}\n` +
        "  If you recently changed CARLTINE_INGEST_SECRET, the existing records were\n" +
        "  signed with the previous key. Delete .carltine/ and re-run ./scripts/setup.sh\n" +
        "  to start a fresh chain.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n✓ ${result.length} record(s) verified against the current signing secret.`,
  );
  if (isEphemeralSigning()) {
    console.log(
      "  ! CARLTINE_INGEST_SECRET is unset, so a development key is being used.\n" +
        "    Signatures will not survive moving this chain to another machine.",
    );
  }
}

// Wrapped rather than using top-level await: tsx emits CJS here, where that is
// a syntax error.
void main();
