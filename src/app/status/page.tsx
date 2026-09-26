import { Badge, Card } from "@/components/ui";
import { MarketingPage } from "@/components/marketing-layout";
import { availableProviders } from "@/lib/providers";
import { MODELS, isCatalogStale, catalogAgeDays, CATALOG_VERIFIED_AT } from "@/lib/catalog";
import * as store from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Status",
  description: "Live status for the Carltine router, chain, and provider configuration.",
};

/**
 * Status page.
 *
 * Reports real state from the running instance rather than a hardcoded "all
 * operational". On a self-hosted deploy this page is genuinely diagnostic,
 * which is more useful than a green tick.
 */
export default async function StatusPage() {
  const chain = await store.verifyChain();
  const providers = availableProviders();
  const allProviderIds = [...new Set(MODELS.map((m) => m.provider))];

  return (
    <MarketingPage
      eyebrow="Status"
      title="Current state of this instance"
      description="Read live from the running deployment rather than from a status database."
    >
      <Card className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Routing endpoint</div>
            <div className="mt-1 text-xs text-muted">POST /api/route</div>
          </div>
          <Badge tone="accent">operational</Badge>
        </div>
      </Card>

      <Card className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Audit chain</div>
            <div className="mt-1 text-xs text-muted">
              {chain.length} records · head {chain.headHash.slice(0, 16)}…
            </div>
          </div>
          <Badge tone={chain.valid ? "accent" : "danger"}>
            {chain.valid ? "intact" : "broken"}
          </Badge>
        </div>
      </Card>

      <Card className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Ledger storage</div>
            <div className="mt-1 text-xs text-muted">
              {store.storageMode() === "d1"
                ? "Cloudflare D1 (durable)"
                : "local file (ephemeral on serverless hosts)"}
            </div>
          </div>
          <Badge tone={store.storageMode() === "d1" ? "accent" : "warn"}>
            {store.storageMode() === "d1" ? "durable" : "not deploy-safe"}
          </Badge>
        </div>
      </Card>

      <Card className="panel">
        <div className="text-sm font-medium">Provider keys configured</div>
        <p className="mt-1 text-xs text-muted">
          Requests routed to a provider without a key return a clearly labelled
          simulated response rather than failing.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allProviderIds.map((p) => {
            const configured = providers.includes(p);
            const count = MODELS.filter((m) => m.provider === p).length;
            return (
              <div
                key={p}
                className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
              >
                <span className="text-xs capitalize">{p}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-subtle">{count} models</span>
                  <Badge tone={configured ? "accent" : "neutral"}>
                    {configured ? "key set" : "simulated"}
                  </Badge>
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Model pricing catalog</div>
            <div className="mt-1 text-xs text-muted">
              verified {CATALOG_VERIFIED_AT} · {catalogAgeDays()} days old
            </div>
          </div>
          <Badge tone={isCatalogStale() ? "warn" : "accent"}>
            {isCatalogStale() ? "stale" : "current"}
          </Badge>
        </div>
        {isCatalogStale() && (
          <p className="mt-3 text-xs text-warn">
            Savings figures may be inaccurate. Prices are hand-maintained and have
            not been re-verified within {30} days.
          </p>
        )}
      </Card>

      <Card className="panel">
        <div className="text-sm font-medium">Anchoring</div>
        <p className="mt-1 text-xs text-muted">
          The chain head is not externally witnessed on this instance. Fetch{" "}
          <code className="font-mono text-foreground">/api/anchor</code> from
          somewhere you control to close the full-rewrite gap.
        </p>
        <div className="mt-3 font-mono text-xs text-accent">
          {chain.headHash}
        </div>
      </Card>
    </MarketingPage>
  );
}
