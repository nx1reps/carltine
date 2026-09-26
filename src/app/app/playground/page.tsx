"use client";

import { useState } from "react";
import { ArrowRight, Coins, Cpu, Play, Sparkles } from "lucide-react";
import { Badge, Button, Card, DataRow } from "@/components/ui";
import { Backdrop } from "@/components/motion";
import { MODELS } from "@/lib/catalog";

interface Decision {
  chosen: string;
  chosenLabel: string;
  tier: number;
  difficulty: number;
  reasons: string[];
  considered: string[];
  contributors: string[];
  estimatedCostUsd: number;
  frontierCostUsd: number;
  savingsUsd: number;
  savingsPct: number;
  simulated: boolean;
  catalogStale: boolean;
  storage: string;
  recordId: string | null;
  error?: string;
}

const PRESETS = [
  { label: "Classify a ticket", prompt: "Classify as billing, bug, or other: 'I was charged twice this month'" },
  { label: "Extract fields", prompt: "Extract the company name and founding year from: 'Acme Corp was founded in 1999 in Boston.'" },
  { label: "Summarize code", prompt: "Summarize what this does:\n```ts\nexport const retry = (fn, n) => fn().catch(() => (n-- ? retry(fn, n) : null))\n```" },
  { label: "Debug this", prompt: "Debug and find the root cause:\n```py\ndef avg(xs):\n    return sum(xs) / len(xs)\n\nprint(avg([]))\n```" },
  {
    label: "Design architecture",
    prompt:
      "Design a distributed cache and justify the tradeoffs. Compare and contrast the consistency models, analyze the failure modes, and evaluate behavior under partial network partition.",
  },
  { label: "Long context", prompt: "Summarize the following thread and identify the open questions:\n" + "The team discussed the migration timeline at length. ".repeat(60) },
] as const;

function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.000001) return "<$0.000001";
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

/**
 * Savings are capped below 100 on display. A trivial request against a
 * frontier model genuinely saves nearly all of its cost, but "100% cheaper"
 * reads as a marketing claim rather than a measurement, and this product's whole
 * position is that its numbers are auditable.
 */
function formatSavings(pct: number): string {
  if (pct >= 99.5) return "≈99%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState<string>(PRESETS[0].prompt);
  const [priority, setPriority] = useState<"economy" | "balanced" | "quality">("balanced");
  const [model, setModel] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [result, setResult] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          priority,
          ...(model ? { model } : {}),
          ...(budget ? { maxCostUsd: Number(budget) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data?.error?.message ?? "Request failed" } as Decision);
        return;
      }
      const c = data.carltine;
      setResult({
        chosen: c.chosen,
        chosenLabel: data.model,
        tier: c.tier,
        difficulty: c.difficulty,
        reasons: c.reasons,
        considered: c.considered,
        contributors: c.signals ? c.signals.contributors : [],
        estimatedCostUsd: c.estimatedCostUsd,
        frontierCostUsd: c.frontierCostUsd,
        savingsUsd: c.savingsUsd,
        savingsPct: c.savingsPct,
        simulated: c.simulated,
        catalogStale: c.catalogStale,
        storage: c.storage,
        recordId: data.carltine.recordId,
      });
    } catch (e) {
      setResult({ error: (e as Error).message } as Decision);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <Backdrop />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Router playground</h1>
        <p className="mt-1 text-sm text-muted">
          Every request here is a real call to the routing endpoint, and every
          decision is written to the tamper-evident ledger.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <label htmlFor="prompt">Request</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            className="field resize-y font-mono text-xs leading-relaxed"
            placeholder="Paste a prompt…"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent-dim hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="field"
              >
                <option value="economy">economy</option>
                <option value="balanced">balanced</option>
                <option value="quality">quality</option>
              </select>
            </div>
            <div>
              <label htmlFor="model">Pin model</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="field"
              >
                <option value="">auto (route)</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="budget">Budget cap (USD)</label>
              <input
                id="budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="field"
                placeholder="0.001"
                inputMode="decimal"
              />
            </div>
          </div>

          <Button onClick={run} disabled={loading} className="mt-5 w-full">
            {loading ? "Routing…" : "Route this request"}
            {!loading && <Play className="size-4" />}
          </Button>
        </Card>

        <div className="space-y-5">
          {result?.error && (
            <Card className="ring-1 ring-danger/30">
              <div className="text-sm text-danger">{result.error}</div>
            </Card>
          )}

          {result && !result.error && (
            <>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted">Routed to</div>
                    <div className="mt-1 text-xl font-semibold text-accent">
                      {result.chosenLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Saved vs frontier</div>
                    <div className="mt-1 text-xl font-semibold text-accent">
                      {formatSavings(result.savingsPct)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="accent">
                    <Cpu className="size-3" />
                    tier {result.tier}
                  </Badge>
                  <Badge tone="sky">
                    difficulty {result.difficulty.toFixed(2)}
                  </Badge>
                  {result.simulated && <Badge tone="warn">simulated response</Badge>}
                  {result.catalogStale && <Badge tone="warn">pricing is stale</Badge>}
                </div>
              </Card>

              <Card>
                <div className="mb-3 text-sm font-semibold">Cost</div>
                <DataRow
                  label="This request"
                  value={usd(result.estimatedCostUsd)}
                  mono
                />
                <DataRow
                  label="Frontier default"
                  value={usd(result.frontierCostUsd)}
                  mono
                />
                <DataRow
                  label="Saved"
                  value={<span className="text-accent">{usd(result.savingsUsd)}</span>}
                  mono
                />
                <p className="mt-3 flex items-start gap-2 text-xs text-subtle">
                  <Coins className="mt-0.5 size-3.5 shrink-0" />
                  Estimated from the catalog price table. Real usage is metered
                  against your provider bill, which is why the ledger records the
                  decision rather than a promise.
                </p>
              </Card>

              <Card>
                <div className="mb-3 text-sm font-semibold">Why</div>
                <ul className="space-y-2">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted">
                      <ArrowRight className="mt-0.5 size-3 shrink-0 text-accent" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                {result.considered.length > 1 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="text-xs text-muted">Candidates considered</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.considered.map((id) => (
                        <span
                          key={id}
                          className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-accent" />
                  Recorded to the ledger
                </div>
                <p className="mt-2 text-xs text-muted">
                  Decision written as{" "}
                  <span className="font-mono text-foreground">llm.route</span> and
                  chained to the previous record.
                </p>
                {result.recordId && (
                  <p className="mt-2 break-all font-mono text-[10px] text-subtle">
                    {result.recordId}
                  </p>
                )}
              </Card>
            </>
          )}

          {!result && !loading && (
            <Card className="text-center">
              <p className="text-sm text-muted">
                Run a request to see the routing decision, the cost comparison, and
                why the router chose that model.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
