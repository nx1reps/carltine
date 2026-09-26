import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";
import { signRecord } from "@/lib/sign";

export const dynamic = "force-dynamic";

/**
 * Evidence export.
 *
 * JSON  - the full chain, for ingestion into another system
 * CSV   - for the auditor who will not run anything
 * bundle - JSON plus a verification result and a signature over the head hash,
 *          which is the artifact you actually hand across the table
 */
export async function GET(request: NextRequest) {
  const format = (request.nextUrl.searchParams.get("format") ?? "bundle").toLowerCase();
  const records = await store.all();
  const chain = await store.verifyChain();

  if (format === "json") {
    return new NextResponse(JSON.stringify({ version: 1, records }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="carltine-chain.json"`,
      },
    });
  }

  if (format === "csv") {
    return new NextResponse(store.toCsv(records), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="carltine-chain.csv"`,
      },
    });
  }

  const bundle = {
    issuer: "Carltine",
    generatedAt: new Date().toISOString(),
    // Describes what this artifact is, rather than asserting a regulatory
    // standard. The previous version claimed "EU AI Act, articles 12 and 14",
    // inherited from when this project was a compliance log. Nothing here is
    // certified against anything, and putting a regulation number on an audit
    // bundle is exactly the kind of unsupported claim that destroys trust in
    // the one artifact whose entire value is being trustworthy.
    contents:
      "Tamper-evident record of LLM routing decisions: the model chosen, the " +
      "signals behind it, the cost comparison, and the hash chain linking each " +
      "record to the one before it.",
    recordCount: records.length,
    verification: chain,
    // Signature over the head hash, so a recipient can prove the bundle
    // corresponds to this exact chain and not a truncated copy of it.
    headSignature: chain.valid ? signRecord(chain.headHash) : null,
    records,
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: chain.valid ? 200 : 409,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="carltine-audit-bundle.json"`,
    },
  });
}
