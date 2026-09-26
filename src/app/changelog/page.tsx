import { Badge } from "@/components/ui";
import { MarketingPage } from "@/components/marketing-layout";

export const metadata = {
  title: "Changelog",
  description: "What has changed in Carltine, including the bugs we found and fixed.",
};

interface Entry {
  version: string;
  date: string;
  changes: { kind: "added" | "fixed" | "changed"; text: string }[];
}

const ENTRIES: Entry[] = [
  {
    version: "0.2.0",
    date: "2026-09-26",
    changes: [
      { kind: "added", text: "Real upstream provider calls for OpenAI, Anthropic, Google, DeepSeek, Qwen and Mistral, over each provider's native HTTP API with no SDK dependencies." },
      { kind: "added", text: "Server-sent-event streaming, passed through as raw bytes so provider framing and latency are preserved." },
      { kind: "added", text: "Automatic provider fallback. When the chosen model is rate-limited or down, the router escalates to the next-cheapest model with a usable key rather than retrying into the same failure." },
      { kind: "added", text: "Real token metering. Spend is now computed from the provider's reported usage rather than an estimate." },
      { kind: "fixed", text: "priority: \"quality\" was silently ignored on medium-difficulty requests. The tier floor was only applied when difficulty was low, so the flag was overwritten by the difficulty tier. Found by inspecting seeded output; there is now a regression test." },
      { kind: "changed", text: "Removed headline savings percentages from the interface. Against a $10/$50 frontier model nearly every cheaper model reads as \"99%\", so the UI shows absolute dollar figures instead." },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-20",
    changes: [
      { kind: "added", text: "Difficulty scoring router with capability tiers, capability filters, and per-request budget caps." },
      { kind: "added", text: "Append-only, hash-chained, HMAC-signed audit ledger with verification that recomputes every hash from stored bytes." },
      { kind: "added", text: "Audit bundle export in JSON and CSV, plus a head-hash anchoring endpoint." },
      { kind: "added", text: "API key authentication using hashed keys and constant-time comparison." },
    ],
  },
];

const KIND_TONE = { added: "accent", fixed: "danger", changed: "sky" } as const;

export default function ChangelogPage() {
  return (
    <MarketingPage
      eyebrow="Changelog"
      title="What changed, including what we got wrong"
      description="Bug fixes are listed alongside features, because the bugs are the more useful signal."
    >
      {ENTRIES.map((entry) => (
        <div key={entry.version}>
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <span className="font-mono text-sm text-foreground">v{entry.version}</span>
            <span className="text-xs text-subtle">{entry.date}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {entry.changes.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <Badge tone={KIND_TONE[c.kind]} className="mt-0.5 h-fit shrink-0">
                  {c.kind}
                </Badge>
                <span className="leading-relaxed text-muted">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </MarketingPage>
  );
}
