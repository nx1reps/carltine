import {
  BadgeCheck,
  FileCheck2,
  GitBranch,
  Gauge,
  KeyRound,
  Layers,
  Lock,
  Network,
  Receipt,
  Scale,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/motion";
import { MODELS } from "@/lib/catalog";

const FEATURES = [
  {
    icon: Gauge,
    title: "Difficulty scoring, not guesswork",
    body: "Prompt length, code fences, reasoning markers, tool structure, and conversation shape combine into a difficulty score. No model call is made to route, so the router never costs more than it saves.",
  },
  {
    icon: Layers,
    title: "Hard capability floors",
    body: "Tier is a floor, not a ceiling. A tier-4 question gets a tier-4 model. Under-routing produces a bad answer; over-routing only costs a fraction of a cent.",
  },
  {
    icon: ShieldCheck,
    title: "Tamper-evident by construction",
    body: "Every routing decision is appended to a hash-chained ledger. Editing one record breaks every link after it, and a full rewrite is caught by anchoring the head hash externally.",
  },
  {
    icon: Scale,
    title: "Savings you can audit",
    body: "Reports compare against the frontier model you would otherwise pin, not against the cheapest model available. Every figure traces back to recorded decisions.",
  },
  {
    icon: KeyRound,
    title: "Your keys, your data",
    body: "Bring your own provider key or run it fully self-hosted. Requests are digested, not stored, so the ledger records what was routed without retaining your prompts.",
  },
  {
    icon: Zap,
    title: "Drop-in compatible",
    body: "The endpoint is shaped like OpenAI chat completions. Adoption is a base_url change, and pinning a model bypasses routing entirely for the calls that need it.",
  },
] as const;

const STEPS = [
  {
    icon: Network,
    title: "1. Point your client at us",
    body: 'Change base_url to the Carltine endpoint. Your existing SDK, agent framework, or eval harness keeps working — nothing else in your code changes.',
  },
  {
    icon: Wallet,
    title: "2. We score the request",
    body: "Cheap deterministic signals classify the difficulty in under a millisecond. No extra model call, no added latency, no prompt sent anywhere to make the decision.",
  },
  {
    icon: Gauge,
    title: "3. Cheapest capable model wins",
    body: "We pick the lowest-cost model that clears the required capability floor and satisfies any budget cap you set, then call it with your key.",
  },
  {
    icon: Receipt,
    title: "4. The decision is on record",
    body: "The choice, the signals behind it, and the cost comparison are written to the hash chain. That record is what makes the savings figure defensible in a budget review.",
  },
] as const;

export function Features() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="What it does"
            title="Routing that holds up under scrutiny"
            description="Cheap routers are easy to build. Routers that stay trustworthy as the bill grows require a ledger, capability floors, and honest denominators."
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <Card className="h-full">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
                  <f.icon className="size-5 text-accent" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four steps, one base_url change"
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <StaggerItem key={s.title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
                    <s.icon className="size-4 text-accent" />
                  </div>
                </div>
                <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function Proof() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="The difference"
              title="Anyone can claim savings. Almost nobody can show them."
              description="Vendor benchmarks report savings on curated datasets, computed by the vendor, with no way for you to check the arithmetic. That is the number we are refusing to compete on."
            />
            <div className="mt-8 space-y-4">
              <div className="flex gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-danger" />
                <p className="text-sm text-muted">
                  <span className="text-foreground">&ldquo;Up to 98% cheaper.&rdquo;</span>{" "}
                  Measured on a benchmark, on requests someone else chose, and
                  unauditable.
                </p>
              </div>
              <div className="flex gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-accent" />
                <p className="text-sm text-muted">
                  <span className="text-foreground">
                    &ldquo;Here is every decision we made.&rdquo;
                  </span>{" "}
                  Each one is in the ledger, with the signals and the cost
                  comparison, verifiable line by line.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="panel p-6">
              <div className="flex items-center gap-2 border-b border-line pb-4">
                <FileCheck2 className="size-4 text-accent" />
                <span className="font-mono text-xs text-muted">
                  audit-bundle.json
                </span>
                <Badge tone="accent" className="ml-auto">
                  verified
                </Badge>
              </div>
              <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
{`{
  "action": "llm.route",
  "chosen": "gpt-6-luna",
  "baseline": "gpt-6-astra",
  "difficulty": 0.19,
  "contributors": ["1 code block"],
  "estimatedCostUsd": 0.00000085,
  "frontierCostUsd": 0.00135,
  "savingsUsd": 0.00135,
  "prevHash": "0f1e6348e47d9568…",
  "hash": "d7d36ef1c2fedfe2…"
}`}
              </pre>
              <p className="mt-4 text-xs leading-relaxed text-subtle">
                Edit any field in that record and the next link fails to verify.
                Recompute the hash too and the chain still catches it, because the
                following record commits to the old value.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Stats() {
  return (
    <section className="border-t border-line py-16">
      <div className="container-page">
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: 85, suffix: "%", label: "upper end of reported savings", hint: "quality-preserving routing, published results" },
            { to: MODELS.length, label: "models in the catalog", hint: "across six providers" },
            { to: 0, label: "model calls to route", hint: "signals are deterministic" },
            { to: 1, label: "hash chain, fully auditable", hint: "every decision recorded" },
          ].map((s) => (
            <StaggerItem key={s.label}>
              <Card className="text-center">
                <div className="text-3xl font-semibold text-accent">
                  <CountUp
                    to={s.to}
                    suffix={s.suffix ?? ""}
                    durationMs={700}
                  />
                </div>
                <div className="mt-2 text-sm font-medium">{s.label}</div>
                <div className="mt-1 text-xs text-subtle">{s.hint}</div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-center text-xs text-subtle">
          Savings range reflects published results for quality-preserving routing.
          Your traffic will differ, which is why the ledger exists — you can check
          ours.
        </p>
      </div>
    </section>
  );
}

export function Moat() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Why it compounds"
            title="The ledger is the asset, not the router"
            description="The routing algorithm is open source and reproducible. The accumulated, externally-anchored record of real traffic and real decisions is not something a competitor can backfill."
          />
        </Reveal>
        <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: GitBranch,
              title: "Switching cost rises with time",
              body: "Reconstructing why a decision was made six months ago is impossible without the record. That history is the audit trail, and it is yours only if you kept it.",
            },
            {
              icon: Lock,
              title: "Anchoring is external",
              body: "Publish the head hash somewhere you do not control and a later rewrite becomes provable. Competitors have to match a public commitment, not just match features.",
            },
            {
              icon: FileCheck2,
              title: "Format, not model, advantage",
              body: "Being the artifact a finance team accepts in a spend review is positional. A rival cannot beat that by spending more on model quality.",
            },
          ].map((c) => (
            <StaggerItem key={c.title}>
              <Card className="h-full">
                <c.icon className="size-5 text-accent" />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
