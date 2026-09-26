import Link from "next/link";
import * as store from "@/lib/store";
import { isCatalogStale, catalogAgeDays } from "@/lib/catalog";
import { Badge, Card, DataRow } from "@/components/ui";
import { StorageTag } from "@/components/badges";
import { OutcomeBadge } from "@/components/badges";
import { shortHash } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Savings as absolute dollars, with a percentage only when it is not a
 * meaningless near-100% figure. Against a $10/$50 frontier model almost any
 * cheaper model reads as "99%", which is arithmetically true and says nothing
 * useful. The dollar figure is the one worth reading.
 */
function savingsLabel(savedUsd: number, frontierUsd: number): string {
  if (frontierUsd <= 0) return "$0";
  const pct = (savedUsd / frontierUsd) * 100;
  if (pct < 0.1) return `<$0.0001`;
  if (pct >= 99.5) return `$${savedUsd.toFixed(2)}`;
  if (savedUsd >= 0.01) return `$${savedUsd.toFixed(4)}`;
  return `$${savedUsd.toFixed(6)}`;
}

function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const tones = {
    default: "text-foreground",
    good: "text-accent",
    warn: "text-warn",
    bad: "text-danger",
  };
  return (
    <Card className="panel-hover">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tnum mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </Card>
  );
}

/** Pull routing-specific fields out of a record's detail payload. */
function routingDetail(detail: Record<string, unknown>) {
  const chosen = typeof detail.chosen === "string" ? detail.chosen : null;
  const baseline = typeof detail.baseline === "string" ? detail.baseline : null;
  const savingsPct = typeof detail.savingsPct === "number" ? detail.savingsPct : null;
  const difficulty = typeof detail.difficulty === "number" ? detail.difficulty : null;
  const saved = typeof detail.estimatedCostUsd === "number" ? detail.estimatedCostUsd : null;
  const frontier = typeof detail.frontierCostUsd === "number" ? detail.frontierCostUsd : null;
  return { chosen, baseline, savingsPct, difficulty, saved, frontier };
}

export default async function LedgerPage() {
  const [chain, records, stats] = await Promise.all([
    store.verifyChain(),
    store.recent(30),
    store.stats(),
  ]);

  const routing = records.filter((r) => r.action === "llm.route");
  const totalSaved = routing.reduce(
    (sum, r) => sum + (routingDetail(r.detail).saved ?? 0),
    0,
  );
  const totalFrontier = routing.reduce(
    (sum, r) => sum + (routingDetail(r.detail).frontier ?? 0),
    0,
  );
  const avgSavings =
    totalFrontier > 0 ? ((totalFrontier - totalSaved) / totalFrontier) * 100 : 0;

  const byModel = new Map<string, number>();
  for (const r of routing) {
    const { chosen } = routingDetail(r.detail);
    if (chosen) byModel.set(chosen, (byModel.get(chosen) ?? 0) + 1);
  }
  const topModels = [...byModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              chain.valid ? "text-accent" : "text-danger"
            }`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${
                chain.valid ? "bg-accent" : "bg-danger"
              }`}
            />
            {chain.valid ? `chain intact · ${chain.length} records` : "chain broken"}
          </span>
          <StorageTag mode={store.storageMode()} />
          {isCatalogStale() && (
            <Badge tone="warn">pricing {catalogAgeDays()}d old</Badge>
          )}
        </div>
        <Link
          href="/app/playground"
          className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          Route a request
        </Link>
      </section>

      {stats.total === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            The ledger is empty. Route a request from the playground and it will
            appear here, chained to whatever came before it.
          </p>
          <Link
            href="/app/playground"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
          >
            Open the playground
          </Link>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Routed requests" value={routing.length} hint="recorded" />
            <Stat
              label="Estimated spend"
              value={`$${totalSaved.toFixed(6)}`}
              hint="this ledger"
            />
            <Stat
              label="Saved vs frontier"
              value={savingsLabel(totalFrontier - totalSaved, totalFrontier)}
              tone={totalFrontier - totalSaved > 0 ? "good" : "warn"}
              hint={`${avgSavings > 0 ? avgSavings.toFixed(0) : "<1"}% · auditable from records`}
            />
            <Stat
              label="Distinct routers"
              value={new Set(routing.map((r) => r.actorId)).size || stats.distinctAgents}
              hint="acting in the chain"
            />
          </section>

          {topModels.length > 0 && (
            <section className="grid gap-5 lg:grid-cols-2">
              <Card>
                <div className="mb-3 text-sm font-semibold">Model distribution</div>
                <div className="space-y-2.5">
                  {topModels.map(([id, count]) => {
                    const pct = (count / routing.length) * 100;
                    return (
                      <div key={id}>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-mono text-foreground">{id}</span>
                          <span className="tnum text-muted">
                            {count} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <div className="mb-3 text-sm font-semibold">Chain</div>
                <DataRow label="Records" value={chain.length} mono />
                <DataRow label="Head hash" value={shortHash(chain.headHash, 16)} mono />
                <DataRow
                  label="Storage"
                  value={
                    store.storageMode() === "d1" ? "Cloudflare D1" : "local file"
                  }
                />
                <DataRow
                  label="Anchoring"
                  value={
                    <Link href="/api/anchor" className="text-accent hover:underline">
                      publish head hash
                    </Link>
                  }
                />
              </Card>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent routing decisions</h2>
              <Link
                href="/app/chain"
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                verify chain →
              </Link>
            </div>
            <div className="panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Routed to</th>
                    <th className="px-4 py-3 font-medium">Baseline</th>
                    <th className="px-4 py-3 font-medium">Difficulty</th>
                    <th className="px-4 py-3 font-medium">Saved (vs {routing[0] ? routingDetail(routing[0].detail).baseline : "frontier"})</th>
                    <th className="px-4 py-3 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {routing.map((r) => {
                    const d = routingDetail(r.detail);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-line/50 last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 text-muted">{r.seq}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {d.chosen ?? r.targetResource}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-subtle">
                          {d.baseline ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {d.difficulty !== null ? d.difficulty.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {d.saved !== null && d.frontier !== null ? (
                            <span
                              className="font-medium text-accent"
                              title={`${(d.savingsPct ?? 0).toFixed(1)}% vs the ${d.baseline} baseline`}
                            >
                              {savingsLabel(d.frontier - d.saved, d.frontier)}
                            </span>
                          ) : (
                            <OutcomeBadge outcome={r.outcome} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-subtle">
                          {shortHash(r.hash)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {routing.length === 0 && (
              <p className="mt-3 text-xs text-subtle">
                No routing decisions yet. The chain currently holds{" "}
                {stats.total} record{stats.total === 1 ? "" : "s"} of other types.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
