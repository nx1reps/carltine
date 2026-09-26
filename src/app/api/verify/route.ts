import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { d1Config } from "@/lib/d1";

export const dynamic = "force-dynamic";

/**
 * Chain verification.
 *
 * Returns the full verification result rather than a bare boolean: an auditor
 * needs the record count, the head hash, and the precise point of failure.
 */
export async function GET() {
  const chain = await store.verifyChain();
  return NextResponse.json(
    { ...chain, storage: store.storageMode(), d1Configured: d1Config() !== null },
    { status: chain.valid ? 200 : 409 },
  );
}

/**
 * Head hash. Publishing the chain head externally at a point in time is what
 * turns "we could have altered this later" into "we could not have altered this
 * later without detection". Free public anchors for this hash are the intended
 * use, not this endpoint.
 */
export async function HEAD() {
  const chain = await store.verifyChain();
  return new NextResponse(null, {
    status: chain.valid ? 200 : 409,
    headers: {
      "X-Carltine-Chain-Length": String(chain.length),
      "X-Carltine-Head-Hash": chain.headHash,
    },
  });
}
