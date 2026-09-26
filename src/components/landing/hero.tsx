"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Terminal } from "lucide-react";
import { GithubIcon } from "@/components/brand-icons";
import { ButtonLink, Badge } from "@/components/ui";
import { Backdrop } from "@/components/motion";
import { CarltineMarkAnimated } from "@/components/brand";
import { GITHUB_CLONE_URL, GITHUB_REPO } from "@/lib/site";

/**
 * Hero.
 *
 * The install command is copyable and shows the real value. The demo terminal
 * below is a real client that calls /api/route, so the numbers in it are
 * produced by the router rather than typed into a mock.
 */

// The package is not published yet, so the copy block gives a command that
// actually works today rather than one that 404s on the registry.
const INSTALL = `git clone ${GITHUB_CLONE_URL}`;

function CopyableInstall() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      onClick={copy}
      className="group inline-flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 text-left transition-colors hover:border-accent-dim"
      aria-label="Copy install command"
    >
      <Terminal className="size-4 shrink-0 text-accent" />
      <code className="font-mono text-sm">{INSTALL}</code>
      <span className="ml-1 text-xs text-muted transition-colors group-hover:text-foreground">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

/**
 * Shape of the routing response, as a partial because these fields come from a
 * network call. Every consumer treats them as optional.
 */
interface DemoResult {
  chosen?: string;
  difficulty?: number;
  savingsUsd?: number;
  savingsPct?: number;
  reasons?: string[];
  simulated?: boolean;
}

/**
 * Render savings without ever showing a bare "100%".
 *
 * A trivial request against a $10/$50 frontier model does save effectively all
 * of the money, but displaying "100% cheaper" reads as marketing rather than
 * measurement, which is the exact impression this product exists to avoid.
 */
function formatSavings(pct: number | undefined | null): string {
  // Defensive: the demo renders from an API response, and a missing or failed
  // field must not take down the whole landing page. TypeScript cannot catch
  // this because the response type is a claim about a remote server.
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "—";
  if (pct >= 99.5) return "≈99%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

/**
 * Dollars first, percentage second.
 *
 * The percentage is demoted to a hint because against a $10/$50 frontier model
 * nearly every alternative reads as "99%", which is arithmetically true and
 * informationally useless. The dollar figure is the one that means something,
 * and leading with it keeps the landing page consistent with the argument the
 * "The difference" section makes two screens down.
 */
function formatSaved(usd: number | undefined | null, pct: number | undefined | null): string {
  if (typeof usd !== "number" || !Number.isFinite(usd)) return formatSavings(pct);
  const dollars = usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(2)}`;
  return pct != null && Number.isFinite(pct)
    ? `${dollars} saved (${formatSavings(pct)} vs frontier)`
    : `${dollars} saved`;
}

const DEMO_PROMPTS: { label: string; text: string }[] = [
  { label: "Classify a support ticket", text: "Classify this ticket as billing, bug, or other: 'I was charged twice'" },
  { label: "Summarize code", text: "Summarize and explain this:\n```ts\nexport function retry(fn, n) { return fn().catch(() => n-- ? retry(fn, n) : null) }\n```" },
  { label: "Design an architecture", text: "Design a distributed cache and justify the design tradeoffs. Compare and contrast the consistency models, analyze the failure modes, and evaluate what happens under partial network partition." },
];

export function HeroDemo() {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fetch is defined outside the component so the mount effect can call it
  // without depending on a function that is re-created on every render.
  async function fetchRoute(i: number): Promise<DemoResult> {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: DEMO_PROMPTS[i].text }] }),
    });
    if (!res.ok) throw new Error((await res.json())?.error?.message ?? "request failed");
    const data = await res.json();
    return data.carltine as DemoResult;
  }

  useEffect(() => {
    // Runs once on mount so the demo shows a real result immediately. The
    // setState calls land in promise continuations, not synchronously, so this
    // does not cascade renders on mount.
    let cancelled = false;
    void fetchRoute(0)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(i: number) {
    setIndex(i);
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      setResult(await fetchRoute(i));
    } catch (e) {
      setErr((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-danger/60" />
          <span className="size-2.5 rounded-full bg-warn/60" />
          <span className="size-2.5 rounded-full bg-accent/60" />
        </div>
        <span className="ml-2 font-mono text-xs text-muted">carltine · live router</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
        {DEMO_PROMPTS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => run(i)}
            className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
              i === index
                ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4 font-mono text-xs">
        <div className="text-muted">
          <span className="text-sky">→ </span>
          {DEMO_PROMPTS[index].text.replace(/\n/g, " ")}
        </div>

        {loading && <div className="text-muted">routing…</div>}
        {err && <div className="text-danger">{err}</div>}

        {result && !loading && (
          <motion.div
            key={`${result.chosen}-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            <div>
              <span className="text-accent">← </span>
              <span className="text-foreground">{result.chosen ?? "—"}</span>
              {result.simulated && (
                <span className="ml-2 text-warn">[simulated · no provider key set]</span>
              )}
            </div>
            <div className="text-muted">
              difficulty{" "}
              {typeof result.difficulty === "number" ? result.difficulty.toFixed(2) : "—"}{" "}
              ·{" "}
              <span className="text-accent">
                {formatSaved(result.savingsUsd, result.savingsPct)}
              </span>{" "}
              against the frontier default
            </div>
            {result.reasons?.[0] && (
              <div className="truncate text-subtle">{result.reasons[0]}</div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
      <Backdrop />
      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge tone="accent">
                <CarltineMarkAnimated className="text-accent" />
                Open source · self-host in one command
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Route every LLM call to the
              <span className="text-accent"> cheapest model that can do the job</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg"
            >
              Most teams pin one frontier model and pay frontier prices for
              classifying a support ticket. Carltine scores each request, picks a
              capable-enough model, and writes the decision to a tamper-evident
              ledger so the savings are provable rather than claimed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <ButtonLink href="/app" size="lg">
                See the live ledger
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/app/playground" variant="secondary" size="lg">
                Try the router
              </ButtonLink>
              <ButtonLink
                href={GITHUB_REPO}
                variant="ghost"
                size="lg"
                external
              >
                <GithubIcon className="size-4" />
                GitHub
              </ButtonLink>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-8"
            >
              <CopyableInstall />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="mt-4 text-xs text-subtle"
            >
              Bring your own provider key. No signup, no card, no request
              metering on the free tier.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <HeroDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
