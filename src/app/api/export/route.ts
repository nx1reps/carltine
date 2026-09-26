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
    standard: {
      regulation: "EU AI Act",
      articles: ["12 (record-keeping)", "14 (human oversight)"],
    },
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
