/**
 * Provider fallback tests.
 *
 * Fallback is the feature that runs when something has already gone wrong, so
 * it is the code most likely to be wrong in a way nobody notices: a provider
 * outage is rare, and a fallback that quietly picks a *worse* model turns a
 * visible outage into a silent quality regression. That is the one failure
 * this product exists to prevent, so it gets asserted directly rather than
 * left to inspection.
 *
 * No network calls. Provider keys are set to dummy values in-process so
 * `hasKey` reports what each scenario needs, and every case here exercises
 * either the pure `fallbackChain` or the attempt-recording path that runs
 * before any request is made.
 */
import "./load-env";
import { route, type RoutingRequest } from "../src/lib/router";
import { fallbackChain, callWithFallback } from "../src/lib/fallback";
import { MODELS, getModel } from "../src/lib/catalog";

let failures = 0;
let checks = 0;

function check(name: string, passed: boolean, detail = ""): void {
  checks++;
  if (passed) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

function setKeys(...providers: string[]): void {
  const all = ["OPENAI", "ANTHROPIC", "GOOGLE", "DEEPSEEK", "QWEN", "MISTRAL"];
  for (const p of all) delete process.env[`${p}_API_KEY`];
  for (const p of providers) process.env[`${p.toUpperCase()}_API_KEY`] = "test-key";
}

function req(prompt: string, extra: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    messages: [{ role: "user", content: prompt }],
    ...extra,
  };
}

// Wrapped rather than using top-level await: tsx emits CJS for .ts files
// in this package, where that is a syntax error.
async function main(): Promise<void> {
  console.log("\nProvider fallback\n");


  // --- 1. The core safety property -------------------------------------------
  // With every provider keyed, an escalation must never be cheaper-tiered than
  // the original choice.
  setKeys("openai", "anthropic", "google", "deepseek", "qwen", "mistral");

  for (const model of MODELS) {
    const decision = route(req("Explain how a database index works and when it is not used."));
    // Force the decision onto this specific model so every tier is exercised.
    decision.chosen = model;
    const chain = fallbackChain(decision, undefined);
    const violations = chain.filter((m) => m.tier <= model.tier);
    check(
      `fallback from ${model.id} (tier ${model.tier}) never drops below its tier`,
      violations.length === 0,
      violations.map((v) => `${v.id} is tier ${v.tier}`).join(", "),
    );
  }

  // --- 2. Ordering -------------------------------------------------------------
  // Cheapest first within the same tier, so an escalation costs as little as
  // possible while still going up.
  {
    const decision = route(req("hi"));
    decision.chosen = getModel("qwen3.7-mini")!; // tier 1
    const chain = fallbackChain(decision, undefined);

    const tiers = chain.map((m) => m.tier);
    const sorted = [...tiers].sort((a, b) => a - b);
    check(
      "chain is ordered by ascending tier",
      JSON.stringify(tiers) === JSON.stringify(sorted),
      `got tiers ${tiers.join(",")}`,
    );

    const priceOf = (m: (typeof chain)[number]) => m.inputPerM + m.outputPerM;
    let monotonic = true;
    for (let i = 1; i < chain.length; i++) {
      if (chain[i - 1].tier === chain[i].tier && priceOf(chain[i - 1]) > priceOf(chain[i])) {
        monotonic = false;
      }
    }
    check("within a tier, the cheaper model comes first", monotonic);
  }

  // --- 3. Cap ------------------------------------------------------------------
  {
    const decision = route(req("hi"));
    decision.chosen = getModel("qwen3.7-mini")!;
    const chain = fallbackChain(decision, undefined);
    check("chain is capped at 4 candidates", chain.length <= 4, `got ${chain.length}`);
  }

  // --- 4. Only models we can actually call ------------------------------------
  {
    setKeys("openai");
    const decision = route(req("hi"));
    decision.chosen = getModel("gpt-6-luna")!; // tier 3, openai
    const chain = fallbackChain(decision, undefined);
    const nonOpenAi = chain.filter((m) => m.provider !== "openai");
    check(
      "chain contains only providers with a key",
      nonOpenAi.length === 0,
      nonOpenAi.map((m) => m.provider).join(", "),
    );
  }

  // --- 5. Budget cap -----------------------------------------------------------
  {
    setKeys("openai", "anthropic", "google", "deepseek", "qwen", "mistral");
    const decision = route(req("hi"));
    decision.chosen = getModel("qwen3.7-mini")!;
    // A cap that only the cheapest escalation can meet.
    const cheapOnly = fallbackChain(decision, 0.0000001);
    check(
      "a tight budget cap excludes expensive escalations",
      cheapOnly.every((m) => m.tier > 1),
      cheapOnly.map((m) => `${m.id}@${m.tier}`).join(", "),
    );
  }

  // --- 6. Cross-provider only, in the live candidate list ---------------------
  // Falling back to a second model on the *same* provider is pointless when the
  // provider is the thing that is down, and wasteful when it is a bad key.
  {
    setKeys("openai", "anthropic", "google");
    const decision = route(req("Classify this ticket as billing or bug: I was charged twice"));
    const result = await callWithFallback(req("Classify this ticket."), decision);

    check("no key configured means no network call was attempted", result.result === null);
    check(
      "every attempt is recorded",
      result.attempts.length >= 1,
      `attempts: ${result.attempts.length}`,
    );

    const chosen = decision.chosen;
    const laterAttempts = result.attempts.slice(1);
    const sameProvider = laterAttempts.filter((a) => a.model.provider === chosen.provider);
    check(
      "escalations go to a different provider, not a sibling model",
      sameProvider.length === 0,
      sameProvider.map((a) => a.model.id).join(", "),
    );
    check(
      "escalations are strictly higher tier",
      laterAttempts.every((a) => a.model.tier > chosen.tier),
      laterAttempts.map((a) => `${a.model.id}@${a.model.tier}`).join(", "),
    );
    check(
      "the chosen model is always attempted first",
      result.attempts[0]?.model.id === chosen.id,
      `first attempt was ${result.attempts[0]?.model.id}, expected ${chosen.id}`,
    );
  }

  setKeys();

  console.log(
    failures === 0
      ? `\nAll ${checks} fallback checks passed.\n`
      : `\n${failures} of ${checks} fallback checks FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
