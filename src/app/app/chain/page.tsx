import * as store from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chain integrity — Carltine" };

export default async function ChainPage() {
  const [chain, records] = await Promise.all([store.verifyChain(), store.all()]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Chain integrity</h2>
        <p className="mt-1 text-sm text-muted">
          Every hash below is recomputed from stored data, not read from a cached value.
          Editing any record breaks the link at that point and every one after it.
        </p>
      </div>

      <div
        className={`panel p-5 ${chain.valid ? "ring-1 ring-emerald-500/30" : "ring-1 ring-red-500/40"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              {chain.valid ? "Chain verified" : "Chain verification failed"}
            </div>
            <div className="mt-1 text-xs text-muted">
              {chain.length} records · checked {new Date(chain.checkedAt).toUTCString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">Head hash</div>
            <div className="mono-num mt-1 text-xs text-accent">
              {chain.headHash.slice(0, 24)}…
            </div>
          </div>
        </div>
        {chain.reason && (
          <p className="mt-3 border-t border-line pt-3 text-sm text-danger">{chain.reason}</p>
        )}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Commits to (prev)</th>
              <th className="px-4 py-3 font-medium">This record</th>
              <th className="px-4 py-3 font-medium">Signed</th>
            </tr>
          </thead>
          <tbody className="mono-num text-xs">
            {records.map((r) => (
              <tr key={r.id} className="border-b border-line/50 last:border-0">
                <td className="px-4 py-2.5 text-muted">{r.seq}</td>
                <td className="px-4 py-2.5 text-muted">
                  {r.prevHash === "0".repeat(64) ? (
                    <span className="text-accent">genesis</span>
                  ) : (
                    `${r.prevHash.slice(0, 16)}…`
                  )}
                </td>
                <td className="px-4 py-2.5 text-foreground">{r.hash.slice(0, 16)}…</td>
                <td className="px-4 py-2.5 text-muted">
                  {r.signature ? `${r.signature.slice(0, 12)}…` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold">Try breaking it</h3>
        <p className="mt-1 text-sm text-muted">
          Open <code className="mono-num text-foreground">.carltine/chain.json</code> in
          this project, change any field on any record, and reload this page. The
          verifier reports the first altered sequence number and the reason. That
          demonstration is the product.
        </p>
      </div>
    </div>
  );
}
