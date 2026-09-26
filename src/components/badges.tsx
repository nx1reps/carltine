import type { Outcome, OversightMode, RiskClass } from "@/lib/types";

const outcomeStyles: Record<Outcome, string> = {
  succeeded: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  failed: "bg-red-500/10 text-red-400 ring-red-500/30",
  denied: "bg-orange-500/10 text-orange-400 ring-orange-500/30",
  partial: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ${outcomeStyles[outcome]}`}
    >
      {outcome}
    </span>
  );
}

const riskStyles: Record<RiskClass, string> = {
  minimal: "text-muted",
  limited: "text-sky-400",
  high: "text-red-400",
};

export function RiskTag({ risk }: { risk: RiskClass }) {
  return <span className={`text-xs font-medium ${riskStyles[risk]}`}>{risk}</span>;
}

/** Art. 14 oversight, shown explicitly because "who stopped it" is the question. */
export function OversightTag({ mode }: { mode: OversightMode }) {
  if (mode === "none") return <span className="text-xs text-muted">—</span>;
  const isIntervention = mode === "human-overrode" || mode === "human-stopped";
  return (
    <span
      className={`text-xs font-medium ${isIntervention ? "text-warn" : "text-accent"}`}
    >
      {mode.replace("human-", "human ")}
    </span>
  );
}

export function ChainStatus({ valid, length }: { valid: boolean; length: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        valid ? "text-accent" : "text-danger"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          valid ? "bg-accent" : "bg-danger"
        }`}
      />
      {valid ? `chain intact · ${length} records` : "chain broken"}
    </span>
  );
}

/**
 * Which store is authoritative.
 *
 * Shown because "file" on a serverless host means the chain resets on cold
 * start. That should be visible, not something a user discovers by noticing
 * their audit history vanished.
 */
export function StorageTag({ mode }: { mode: "d1" | "file" }) {
  const durable = mode === "d1";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ring-1 ${
        durable
          ? "bg-sky-500/10 text-sky-400 ring-sky-500/30"
          : "bg-warn/10 text-warn ring-warn/30"
      }`}
      title={
        durable
          ? "Records persist in Cloudflare D1"
          : "Records persist to a local file, which is ephemeral on serverless hosts"
      }
    >
      {durable ? "durable · D1" : "local file · not deploy-safe"}
    </span>
  );
}
