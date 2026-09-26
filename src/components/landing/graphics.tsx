import { Card, SectionHeading } from "@/components/ui";
import { PriceSpreadChart, TierLadder } from "@/components/brand";
import { Reveal } from "@/components/motion";

/**
 * Visual argument for the product.
 *
 * Two charts, both built from the real catalog rather than illustrative
 * numbers: the price spread that makes routing worth doing, and the tier ladder
 * that explains the floor-not-ceiling rule most people get wrong.
 */
export function Graphics() {
  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            eyebrow="The spread"
            title="Two orders of magnitude between the floor and the ceiling"
            description="Most of what teams pay for is tier they do not need. These are real prices from the catalog, drawn on a log scale so the cheap end stays visible."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Card>
              <PriceSpreadChart />
            </Card>
          </Reveal>
          <div>
            <Reveal delay={0.08}>
              <Card>
                <TierLadder />
                <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-subtle">
                  A common mistake is filtering{" "}
                  <code className="font-mono text-muted">tier ≤ n</code> and sorting
                  by price, which sends every request to the cheapest model in the
                  catalog. The selected tier is a minimum, not a maximum.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* Full width rather than stacked in the right column: the price chart
            is much taller than the ladder, and nesting the third card there
            left a column of dead space on wide screens. */}
        <Reveal delay={0.06}>
          <div className="mt-5">
            <TrafficShape />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Request-shape distribution.
 *
 * Illustrative rather than measured — it is labelled as such, because inventing
 * a chart that looks like telemetry would undercut the whole premise.
 */
export function TrafficShape() {
  const shapes = [
    { label: "classify / extract", share: 62, tier: 2 },
    { label: "summarize / rewrite", share: 18, tier: 3 },
    { label: "code", share: 12, tier: 3 },
    { label: "design / analyse", share: 6, tier: 5 },
    { label: "regulated domain", share: 2, tier: 5 },
  ];

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-sm font-semibold">Where traffic goes</div>
        <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium text-warn ring-1 ring-warn/25">
          illustrative
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Not measured data. Shown to make the point that most requests do not need
        a frontier model.
      </p>

      {/* Stacked bar: the shape of traffic in one glance. */}
      <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full">
        {shapes.map((s) => (
          <div
            key={s.label}
            className="h-full"
            style={{
              width: `${s.share}%`,
              background: s.tier >= 5 ? "#f0b429" : s.tier === 3 ? "#6ba8f5" : "#4ade9b",
              opacity: 0.85,
            }}
            title={`${s.label}: ${s.share}%`}
          />
        ))}
      </div>

      <div className="mt-5 space-y-2.5">
        {shapes.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted">
              <span
                className="size-2 rounded-sm"
                style={{
                  background: s.tier >= 5 ? "#f0b429" : s.tier === 3 ? "#6ba8f5" : "#4ade9b",
                }}
              />
              {s.label}
            </span>
            <span className="font-mono text-subtle">
              {s.share}% · tier {s.tier}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
