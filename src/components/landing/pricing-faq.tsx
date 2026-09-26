"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Check, ChevronDown, Minus, Sparkles, X } from "lucide-react";
import { Badge, ButtonLink, Card, SectionHeading } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { GITHUB_REPO } from "@/lib/site";

const TIERS = [
  {
    name: "Self-hosted",
    price: "Free",
    priceNote: "forever, MIT licensed",
    description: "Run it yourself. Nothing leaves your infrastructure, and the ledger is yours alone.",
    features: [
      "Full router and difficulty scoring",
      "Tamper-evident chain with signing",
      "Audit bundle and CSV export",
      "Head-hash anchoring",
      "Unlimited requests, no metering",
    ],
    cta: "Deploy on your infra",
    href: GITHUB_REPO,
    highlighted: false,
  },
  {
    name: "Cloud",
    price: "$0",
    priceNote: "free tier, no card, no signup",
    description: "A managed endpoint for trying it out. Bring your own provider key and we never bill you for tokens.",
    features: [
      "Everything in Self-hosted",
      "Hosted routing endpoint",
      "5,000 requests per day",
      "Multi-provider fallback",
      "Community support",
    ],
    cta: "Start free",
    href: "/app/playground",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    priceNote: "per month, from 500k requests",
    description: "For teams that need the savings report to survive a procurement conversation.",
    features: [
      "Everything in Cloud",
      "Scheduled external anchoring",
      "Spend alerts and budget caps",
      "Savings reports for finance",
      "SSO and audit log export",
      "Priority support",
    ],
    cta: "Talk to us",
    href: "mailto:hello@carltine.com",
    highlighted: false,
  },
] as const;

/** Exported so the JSON-LD structured data renders the same questions. */
export const FAQS = [
  {
    q: "Is this just OpenRouter with fewer features?",
    a: "No. OpenRouter aggregates models and takes a margin on tokens. Carltine never touches your tokens: you hold the provider key, we route the call. That is why the free tier can be genuinely unlimited, and why self-hosting is a first-class option rather than an escape hatch.",
  },
  {
    q: "How accurate is the difficulty score?",
    a: "The scoring is deliberately conservative. Signals are chosen to err toward sending a request to a more capable model, because under-routing produces a silently bad answer while over-routing costs a fraction of a cent. The ledger records the score and its contributors on every decision, so you can measure real accuracy on your own traffic instead of trusting a benchmark.",
  },
  {
    q: "What happens when the router picks wrong?",
    a: "Pin the model. Passing an explicit model name bypasses routing entirely, so you can opt any call out. Because every decision is on record, you can also review which signals mispredicted and correct the scoring rather than guessing.",
  },
  {
    q: "Do you store my prompts?",
    a: "No. The ledger stores a SHA-256 digest of the request, not its content, plus the routing decision and cost comparison. That is enough to prove what was routed and what it cost, without retaining your data. Prompts go only to whichever provider the router selected.",
  },
  {
    q: "What if the audit chain goes down?",
    a: "The routing endpoint fails closed. If a decision cannot be written to the chain, the request is refused rather than served unrecorded. The whole premise is that savings are provable, and that stops being true the moment some requests are silently unrouted.",
  },
  {
    q: "Can I run it against my own models?",
    a: "Yes. The catalog is a plain data file, so adding a self-hosted vLLM or Ollama endpoint means adding a row. Routing already treats capability tier as the primary constraint, so private models at a given tier compete on price like any other.",
  },
] as const;

export function Pricing() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Free is not a trial"
            description="We make money from teams that need the audit trail to hold up. We do not make money by marking up your tokens, so the free tier has no reason to be stingy."
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <StaggerItem key={tier.name}>
              <Card
                className={`relative flex h-full flex-col ${
                  tier.highlighted ? "ring-1 ring-accent/40" : ""
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-6">
                    <Badge tone="accent">
                      <Sparkles className="size-3" />
                      Start here
                    </Badge>
                  </div>
                )}
                <h3 className="font-semibold">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{tier.price}</span>
                  <span className="text-xs text-subtle">{tier.priceNote}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {tier.description}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="text-muted">{f}</span>
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={tier.href}
                  variant={tier.highlighted ? "primary" : "secondary"}
                  className="mt-6 w-full"
                  external={tier.href.startsWith("http") || tier.href.startsWith("mailto")}
                >
                  {tier.cta}
                </ButtonLink>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-accent" />
              MIT licensed core
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-accent" />
              Your keys stay yours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-accent" />
              No token markup, ever
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="size-3.5 text-subtle" />
              No seat-based pricing
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Questions worth asking" />
        </Reveal>
        <Reveal delay={0.08}>
          <Accordion.Root
            type="single"
            collapsible
            className="mx-auto mt-12 max-w-3xl"
          >
            {FAQS.map((f) => (
              <Accordion.Item
                key={f.q}
                value={f.q}
                className="border-b border-line"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-accent">
                    <span className="font-medium">{f.q}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden text-sm leading-relaxed text-muted data-[state=closed]:animate-none">
                  <div className="pb-5 pr-8">{f.a}</div>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </Reveal>
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <div className="panel relative overflow-hidden p-10 text-center sm:p-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-glow opacity-70" />
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Find out what you are overspending on.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted">
              Point the router at your traffic for a day and read the ledger. No
              signup, no card, and you can delete the whole thing afterwards.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/app/playground" size="lg">
                Try the router free
              </ButtonLink>
              <ButtonLink
                href={GITHUB_REPO}
                variant="secondary"
                size="lg"
                external
              >
                Self-host it
              </ButtonLink>
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-subtle">
              <Minus className="size-3" />
              Bring your own key. We never bill for tokens.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
