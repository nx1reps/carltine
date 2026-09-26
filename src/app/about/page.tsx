import { Block, MarketingPage } from "@/components/marketing-layout";

export const metadata = {
  title: "About",
  description:
    "Why Carltine exists: the LLM routing algorithm is commodity, but the evidence behind the savings is not.",
};

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="About"
      title="Routing is a commodity. Proof is not."
      description="Carltine started from a narrow observation about how the LLM routing market reports its results."
    >
      <Block title="The problem">
        <p>
          Quality-preserving LLM routing is real and well established. RouteLLM
          reports roughly 85% cost reduction at 95% of GPT-4 quality on MT-Bench.
          FrugalGPT claims up to 98% on benchmarks. The algorithms are open
          source, and the field is crowded with capable competitors.
        </p>
        <p>
          What none of those numbers let you do is check them. They are measured
          on curated datasets, chosen by the vendor, computed by the vendor.
          There is no way for a customer to take their own traffic, run the
          comparison, and see whether the same number holds. A finance team
          approving a routing vendor has to take the claim on faith.
        </p>
      </Block>

      <Block title="What we think is actually defensible">
        <p>
          The router is not the moat. It is roughly a hundred lines of scoring
          logic, it is reproducible from a public paper, and a funded competitor
          could reimplement it in an afternoon. Pretending otherwise is how
          companies end up competing on benchmark numbers they cannot defend.
        </p>
        <p>
          The accumulated, externally-anchored record of real routing decisions
          is harder to fake. It compounds with usage, it cannot be backfilled
          honestly, and being the artifact a finance team accepts in a spend
          review is a positional advantage rather than a technical one.
        </p>
      </Block>

      <Block title="Why open source">
        <p>
          The core is MIT licensed. A routing layer people cannot inspect is a
          routing layer people cannot trust, and trust is the entire product.
          Self-hosting is a first-class path rather than an escape hatch, which
          is also what makes the free tier genuinely unlimited: you hold the
          provider key, we never mark up your tokens, so our cost is compute and
          not your spend.
        </p>
      </Block>

      <Block title="What we will not claim">
        <p>
          We do not publish a headline savings percentage, because against a
          frontier model priced at ten dollars per million input tokens almost
          any cheaper model reads as &ldquo;99% cheaper.&rdquo; That is
          arithmetically true and informationally useless. The product shows
          absolute dollar figures instead, derived from recorded decisions, so
          you can audit them.
        </p>
        <p>
          We would rather show a modest number that holds up than a spectacular
          one that evaporates the first time someone checks.
        </p>
      </Block>
    </MarketingPage>
  );
}
