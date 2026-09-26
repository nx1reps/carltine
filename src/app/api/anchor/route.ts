import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import { signRecord } from "@/lib/sign";

export const dynamic = "force-dynamic";

/**
 * Chain head anchoring.
 *
 * The chain proves a record was not altered *in place*. It does not stop
 * someone with database access from rebuilding the entire chain consistently —
 * every hash would recompute cleanly.
 *
 * The fix is to publish the head hash somewhere they do not control. Fetch this
 * endpoint periodically (or from a cron, or a free immutable timestamp service)
 * and the head becomes externally witnessed: a later divergence is provable
 * rather than arguable.
 *
 * GET returns the current head for anyone to record. HEAD does the same without
 * a body, for a scheduler that only needs the value.
 */

export async function GET() {
  const chain = await store.verifyChain();

  return NextResponse.json(
    {
      headHash: chain.headHash,
      length: chain.length,
      valid: chain.valid,
      // Signature over the head, so a third party can confirm the value came
      // from us and was not fabricated by whoever controls the database.
      signature: chain.valid ? signRecord(chain.headHash) : null,
      storage: store.storageMode(),
      checkedAt: chain.checkedAt,
    },
    { status: chain.valid ? 200 : 409 },
  );
}

export async function HEAD() {
  const chain = await store.verifyChain();
  return new NextResponse(null, {
    status: chain.valid ? 200 : 409,
    headers: {
      "X-Carltine-Head-Hash": chain.headHash,
      "X-Carltine-Chain-Length": String(chain.length),
      "X-Carltine-Valid": String(chain.valid),
    },
  });
}

/**
 * Compare a previously witnessed head against the current one.
 *
 * POST with `{"expectedHead": "<hex>"}` answers whether history still matches
 * what a third party recorded earlier. This is the actual guarantee: a stored
 * head plus a later mismatch is proof of a rewrite.
 */
export async function POST(request: NextRequest) {
  let expectedHead: string;
  try {
    const body = (await request.json()) as { expectedHead?: string };
    expectedHead = String(body.expectedHead ?? "");
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/.test(expectedHead)) {
    return NextResponse.json(
      { error: "expectedHead must be a 64-character hex SHA-256." },
      { status: 400 },
    );
  }

  const chain = await store.verifyChain();

  if (!chain.valid) {
    return NextResponse.json(
      {
        matches: false,
        reason: chain.reason,
        brokenAt: chain.brokenAt,
        expectedHead,
        currentHead: chain.headHash,
      },
      { status: 409 },
    );
  }

  if (chain.headHash !== expectedHead) {
    // A mismatch here is not automatically tampering — the chain legitimately
    // grows, so a witnessed head from earlier will not match after more
    // records. The caller compares lengths to tell a rewrite from an append.
    return NextResponse.json(
      {
        matches: false,
        reason:
          "witnessed head does not match the current head. If the current chain is longer, this is an append, not a rewrite. If it is shorter or the same length, treat it as a rewrite and investigate.",
        expectedHead,
        currentHead: chain.headHash,
        expectedLengthUnknown: true,
        currentLength: chain.length,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    matches: true,
    headHash: chain.headHash,
    length: chain.length,
  });
}
