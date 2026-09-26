/**
 * Seeds a realistic routing history.
 *
 * The mix is chosen to show the router's actual behaviour rather than a
 * flattering one: mostly cheap calls, a few hard ones, and one where a budget
 * cap was exceeded. A seed made entirely of easy wins would misrepresent how
 * the thing behaves on real traffic.
 */
// MUST be first: resolves CARLTINE_INGEST_SECRET from .env.local exactly as the
// Next.js server does, so seeded records verify against the running app.
import "./load-env";
import { append, verifyChain, all } from "../src/lib/store";
import { route, savingsVsFrontier } from "../src/lib/router";
import { catalogAgeDays } from "../src/lib/catalog";
import { digestOf } from "../src/lib/sign";
import type { NewAgentActionRecord } from "../src/lib/types";

/** Realistic request shapes, roughly ordered by how often they occur. */
const TRAFFIC: { prompt: string; priority?: "economy" | "balanced" | "quality"; budget?: number }[] = [
  { prompt: "Classify as billing, bug, or other: 'I was charged twice this month'" },
  { prompt: "Classify sentiment as positive, negative, or neutral: 'This is the worst product I have ever used'" },
  { prompt: "Extract the company name and founding year from: 'Acme Corp was founded in 1999 in Boston.'" },
  { prompt: "Extract all line items and totals from this invoice description." },
  { prompt: "Translate to Spanish: 'Your order has shipped and will arrive Tuesday.'" },
  { prompt: "Correct the grammar in: 'we was going to the store yesterday and buy some milk'" },
  { prompt: "Tag this support ticket by topic: billing, technical, account, or other." },
  { prompt: "Summarize this in one sentence: 'The quarterly report shows a twelve percent increase in revenue driven mainly by the enterprise segment, offset by churn in the small business tier.'" },
  { prompt: "Summarize what this does:\n```ts\nexport const retry = (fn, n) => fn().catch(() => (n-- ? retry(fn, n) : null))\n```" },
  { prompt: "Find the bug in this:\n```py\ndef avg(xs):\n    return sum(xs) / len(xs)\nprint(avg([]))\n```" },
  { prompt: "Write a SQL query to find duplicate email addresses in a users table." },
  {
    prompt: "Design a distributed cache and justify the tradeoffs. Compare and contrast the consistency models, analyze the failure modes, and evaluate behavior under partial network partition.",
  },
  {
    prompt:
      "Evaluate whether we should migrate from Postgres to a document store for our event log. Analyze the query patterns, consider the operational burden, and justify the recommendation with concrete criteria.",
    priority: "quality",
  },
  {
    prompt: "Summarize the following thread and identify the open questions:\n" +
      "The team discussed the migration timeline at length. ".repeat(60),
  },
  { prompt: "This is an enormous pasted document. Summarize it and flag anything that looks like a commitment or a deadline.", budget: 0.0005 },
  { prompt: "Route this to the most capable model: analyze our Q3 infrastructure spend and propose a three-month optimization plan with estimated savings per service." },
];

async function main() {
  const existing = await all();
  if (existing.length > 0) {
    console.log(`Chain already has ${existing.length} records; nothing seeded.`);
    return;
  }

  const counts = new Map<string, number>();
  let totalSaved = 0;
  let totalFrontier = 0;

  for (const item of TRAFFIC) {
    const decision = route({
      messages: [{ role: "user", content: item.prompt }],
      priority: item.priority ?? "balanced",
      maxCostUsd: item.budget,
    });
    const vs = savingsVsFrontier(decision);

    counts.set(decision.chosen.id, (counts.get(decision.chosen.id) ?? 0) + 1);
    totalSaved += decision.chosenCostUsd;
    totalFrontier += vs.frontierCostUsd;

    const record: NewAgentActionRecord = {
      actorType: "system",
      actorId: "carltine-router",
      humanPrincipalId: null,
      agentVersion: "router/seed",
      action: "llm.route",
      targetSystem: decision.chosen.provider,
      targetResource: decision.chosen.id,
      detail: {
        chosen: decision.chosen.id,
        baseline: decision.baseline.id,
        tier: decision.chosen.tier,
        difficulty: decision.signals.difficulty,
        contributors: decision.signals.contributors,
        reasons: decision.reasons,
        considered: decision.considered,
        inputTokens: decision.signals.inputTokens,
        estimatedCostUsd: decision.chosenCostUsd,
        frontierCostUsd: vs.frontierCostUsd,
        savingsPct: vs.savingsPct,
        simulated: true,
        catalogAgeDays: catalogAgeDays(),
        requestDigest: digestFor(item.prompt),
      },
      authorizationBasis: "ROUTE-policy-default-v1",
      grantedScope: [`model:${decision.chosen.id}`],
      scopeExceeded: false,
      oversightMode: "pre-approved",
      oversightActorId: null,
      oversightReason: null,
      riskClass: decision.chosen.tier >= 4 ? "high" : "limited",
      outcome: "succeeded",
      inputDigest: digestFor(item.prompt),
      outputDigest: null,
      occurredAt: new Date().toISOString(),
    };

    const r = await append(record);
    const flags = [
      decision.signals.contributors.length ? `[${decision.signals.contributors.join(", ")}]` : "",
      item.budget && decision.chosenCostUsd > item.budget ? "[OVER BUDGET]" : "",
    ].filter(Boolean).join(" ");
    // Report absolute cost, not a percentage. Rounding to "100% saved" against
    // a $10/$50 frontier model is arithmetically true and completely useless;
    // the dollar figure is the thing worth reading.
    console.log(
      `  #${String(r.seq).padStart(2)} tier ${decision.chosen.tier} ${decision.chosen.id.padEnd(16)}` +
        ` $${decision.chosenCostUsd.toFixed(7)} (was $${vs.frontierCostUsd.toFixed(5)})  ${flags}`,
    );
  }

  const chain = await verifyChain();

  console.log(`\nSeeded ${TRAFFIC.length} routing decisions.`);
  console.log(`Chain valid: ${chain.valid} | head: ${chain.headHash.slice(0, 16)}...`);
  console.log(
    `Total across seed: $${totalSaved.toFixed(7)} spent, $${(totalFrontier - totalSaved).toFixed(5)} saved vs frontier.`,
  );
  console.log("Model distribution:");
  for (const [id, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.padEnd(16)} ${n}`);
  }
  console.log(
    "\nNote: percentage savings are omitted on purpose. Against a $10/$50 frontier\n" +
      "model almost any cheaper model reads as '99%', which says nothing. The\n" +
      "absolute figures above are the honest comparison.",
  );
}

function digestFor(prompt: string): string {
  return digestOf(prompt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
