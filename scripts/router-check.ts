/**
 * Router test suite.
 *
 * Assertions encode the routing policy, not just "it returns something." The
 * failure that matters commercially is routing a hard request to a cheap model,
 * because that produces a bad answer rather than a visible error, so several
 * cases below assert the model is NOT too cheap.
 */
// MUST be first: resolves CARLTINE_INGEST_SECRET from .env.local exactly as the
// Next.js server does, so seeded records verify against the running app.
import "./load-env";
import { route, scoreDifficulty } from "../src/lib/router";
import { MODELS } from "../src/lib/catalog";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = "") {
  checks++;
  if (!condition) {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  PASS  ${label}`);
  }
}

const frontier = MODELS.reduce((a, b) =>
  a.inputPerM + a.outputPerM >= b.inputPerM + b.outputPerM ? a : b,
);

console.log("\nTier selection");
{
  const d = route({ messages: [{ role: "user", content: "Classify: positive" }] });
  check("trivial request routes to the cheapest tier", d.chosen.tier <= 2, `got tier ${d.chosen.tier}`);
}
{
  const d = route({
    messages: [
      { role: "user", content: "Design and justify a distributed cache architecture. " + "compare and contrast the tradeoffs ".repeat(10) },
    ],
  });
  check(
    "architecture question is NOT sent to a cheap model",
    d.chosen.tier >= 3,
    `got ${d.chosen.label} (tier ${d.chosen.tier})`,
  );
}
{
  const d = route({
    messages: [{ role: "user", content: "Review this code:\n```ts\nconst x: number = 1\n```" }],
  });
  check("code request is not tier 1", d.chosen.tier >= 3, `got ${d.chosen.label}`);
}

console.log("\nSavings are measured against the frontier, not the cheapest");
{
  const d = route({ messages: [{ role: "user", content: "hi" }] });
  check(
    "baseline is the frontier model",
    d.baseline.id === frontier.id,
    `baseline=${d.baseline.id}`,
  );
  check("savings are positive and below 100%", d.savingsPct > 0 && d.savingsPct < 100, `${d.savingsPct.toFixed(1)}%`);
  check(
    "chosen is cheaper than baseline",
    d.chosen.inputPerM + d.chosen.outputPerM < frontier.inputPerM + frontier.outputPerM,
  );
}

console.log("\nCapability filters");
{
  const d = route({
    messages: [{ role: "user", content: "call a tool" }],
    requiresTools: true,
  });
  check("tool request gets a tool-capable model", d.chosen.supportsTools, d.chosen.id);
}
{
  const d = route({
    messages: [{ role: "user", content: "describe this" }],
    requiresVision: true,
  });
  check("vision request gets a vision model", d.chosen.supportsVision, d.chosen.id);
}

console.log("\nPinning");
{
  const d = route({ messages: [{ role: "user", content: "hi" }], model: "gpt-6-astra" });
  check("pin is honoured", d.chosen.id === "gpt-6-astra");
  check("pin reports zero savings against itself is not claimed", d.savingsPct >= 0);
}
{
  const d = route({ messages: [{ role: "user", content: "hi" }], model: "qwen3.7-mini" });
  check("pinning a cheap model reports savings", d.savingsPct > 0, `${d.savingsPct.toFixed(1)}%`);
}

console.log("\nBudget cap");
{
  const d = route({
    messages: [{ role: "user", content: "x".repeat(50_000) }],
    maxCostUsd: 0.00001,
  });
  check("budget cap constrains the choice", d.chosen.inputPerM < frontier.inputPerM);
  check("budget decision is explained", d.reasons.some((r) => r.includes("cap")), d.reasons.join(" | "));
}
{
  const d = route({
    messages: [{ role: "user", content: "x".repeat(50_000) }],
    maxCostUsd: 1e-12,
  });
  check("impossible budget still returns a model, does not throw", Boolean(d.chosen));
  check(
    "impossible budget is flagged rather than hidden",
    d.reasons.some((r) => r.includes("exceeded") || r.includes("no candidate")),
  );
}

console.log("\nPriority is a floor, not a suggestion");
{
  const easy = { messages: [{ role: "user", content: "hi" }] };
  const economy = route({ ...easy, priority: "economy" });
  const quality = route({ ...easy, priority: "quality" });
  check("quality priority outranks economy", quality.chosen.tier > economy.chosen.tier, `${economy.chosen.tier} vs ${quality.chosen.tier}`);
}
{
  // Regression: a moderate-difficulty request used to override the priority
  // floor entirely, so `priority: "quality"` was silently ignored for exactly
  // the mid-difficulty requests a caller flagged as important.
  const moderate = {
    messages: [{ role: "user", content: "Summarize and explain:\n```js\nconst a = 1\n```" }],
  };
  const quality = route({ ...moderate, priority: "quality" });
  check(
    "quality priority holds on a moderate-difficulty request",
    quality.chosen.tier >= 4,
    `got tier ${quality.chosen.tier} (${quality.chosen.id})`,
  );
  const economy = route({ ...moderate, priority: "economy" });
  check(
    "economy priority does not force the floor above difficulty",
    economy.chosen.tier <= 3,
    `got tier ${economy.chosen.tier}`,
  );
}

console.log("\nSavings reporting is not inflated");
{
  // Comparing a $10/$50 frontier model against a $0.01/$0.04 model always
  // yields ~100%, which reads as a marketing claim. The router must expose
  // absolute cost too, so a reader can judge the number rather than take it.
  const d = route({ messages: [{ role: "user", content: "hi" }] });
  check("savings never exceed 100%", d.savingsPct <= 100, `${d.savingsPct}`);
  check("absolute costs are reported alongside percentages", d.chosenCostUsd >= 0 && d.baselineCostUsd > 0);
  check(
    "chosen cost is strictly below the frontier baseline",
    d.chosenCostUsd < d.baselineCostUsd,
    `${d.chosenCostUsd} vs ${d.baselineCostUsd}`,
  );
}

console.log("\nOpen-ended and regulated work is not under-routed");
{
  // Regression: a "design and justify a distributed cache" prompt used to score
  // 0.26 and land on tier 3. It has no checkable answer, so a wrong model
  // returns something plausible and wrong.
  const design = route({
    messages: [
      {
        role: "user",
        content:
          "Design a distributed cache and justify the tradeoffs. Compare and contrast the consistency models, analyze the failure modes, and evaluate behavior under partial network partition.",
      },
    ],
  });
  check(
    "architecture design prompt routes to tier 4+",
    design.chosen.tier >= 4,
    `got tier ${design.chosen.tier} (${design.chosen.id}) at difficulty ${design.signals.difficulty.toFixed(2)}`,
  );
}
{
  const legal = route({
    messages: [
      { role: "user", content: "Does this contract clause create liability under regulation, and what is the compliance exposure? Review it and critique the indemnification language." },
    ],
  });
  check(
    "regulated-domain prompt routes to tier 4+",
    legal.chosen.tier >= 4,
    `got tier ${legal.chosen.tier} at difficulty ${legal.signals.difficulty.toFixed(2)}`,
  );
}
{
  // The bias must be one-directional. A trivial classification must not be
  // dragged upward by the new weights.
  const trivial = route({
    messages: [{ role: "user", content: "Classify as yes or no: is the sky blue?" }],
  });
  check(
    "trivial prompt still routes to the cheap tier",
    trivial.chosen.tier <= 2,
    `got tier ${trivial.chosen.tier} at difficulty ${trivial.signals.difficulty.toFixed(2)}`,
  );
  const cheap = route({
    messages: [{ role: "user", content: "Extract the name from: Acme Corp" }],
  });
  check(
    "extraction still routes to the cheap tier",
    cheap.chosen.tier <= 2,
    `got tier ${cheap.chosen.tier}`,
  );
}

console.log("\nTool routing");
{
  const withTools = route({
    messages: [{ role: "user", content: "Book me a flight" }],
    requiresTools: true,
  });
  check("requiresTools excludes models without tool support", withTools.chosen.supportsTools);
}
{
  // Supplying tool schemas implies a tool-calling request even without the flag,
  // which is what a real OpenAI client does.
  const implied = route({
    messages: [
      { role: "user", content: "What is the weather in Berlin?" },
      { role: "assistant", content: "", tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Berlin"}' } }] },
      { role: "tool", content: "18C, clear", tool_call_id: "call_1" },
    ],
  });
  check(
    "a conversation containing tool results routes to a tool-capable model",
    implied.chosen.supportsTools,
    `got ${implied.chosen.id}`,
  );
  check(
    "tool results are not treated as a trivial request",
    implied.chosen.tier >= 2,
    `got tier ${implied.chosen.tier}`,
  );
}

console.log("\nRobustness");
{
  const d = route({ messages: [] });
  check("empty message array does not throw", Boolean(d.chosen));
}
{
  const d = route({ messages: [{ role: "user", content: "hi" }], model: "does-not-exist" });
  check("unknown pinned model falls back to routing", d.chosen.id !== "does-not-exist");
}
{
  const s = scoreDifficulty({ messages: [{ role: "user", content: "x".repeat(200_000) }] });
  check("difficulty is clamped to 1", s.difficulty <= 1, `${s.difficulty}`);
}
{
  const s = scoreDifficulty({ messages: [{ role: "user", content: "hi" }], difficultyHint: 1 });
  check("difficulty is never negative", s.difficulty >= 0);
}

console.log(
  failures === 0
    ? `\nAll ${checks} routing checks passed.`
    : `\n${failures} of ${checks} routing checks FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
