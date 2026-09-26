import { Block, MarketingPage } from "@/components/marketing-layout";

export const metadata = {
  title: "Terms",
  description: "Terms of use for the Carltine hosted service.",
};

export default function TermsPage() {
  return (
    <MarketingPage
      eyebrow="Terms"
      title="Terms of use"
      description="Last updated 26 September 2026. Plain language, no surprises."
    >
      <Block title="The service">
        <p>
          Carltine routes requests to a model provider you select and records the
          decision. We do not generate content ourselves and we are not a party
          to the relationship between you and your model provider.
        </p>
      </Block>

      <Block title="Your keys, your responsibility">
        <p>
          You supply the provider credentials. You are responsible for the usage
          those credentials incur and for complying with your provider&rsquo;s terms.
          We do not mark up, resell, or take a margin on token spend.
        </p>
      </Block>

      <Block title="Accuracy">
        <p>
          Routing decisions, difficulty scores, and cost estimates are produced
          by heuristic software and can be wrong. The ledger records what was
          decided and why; it does not certify that the decision was optimal.
        </p>
        <p>
          Pricing in the model catalog is hand-maintained and may be out of
          date. Savings figures are estimates derived from that catalog, not
          measurements from your provider bill. Do not rely on them for
          financial reporting without verifying against your own invoices.
        </p>
      </Block>

      <Block title="Availability">
        <p>
          The hosted service is provided as-is and without a service level
          agreement on the free tier. The routing endpoint fails closed when the
          audit ledger is unavailable, which will reject requests rather than
          serve them unrecorded. That behaviour is intentional and is described
          in the{" "}
          <a href="/security" className="text-accent hover:underline">
            security documentation
          </a>
          .
        </p>
      </Block>

      <Block title="Self-hosted">
        <p>
          The MIT-licensed core carries no warranty of any kind. If you run it
          yourself, these hosted terms do not apply to your deployment.
        </p>
      </Block>
    </MarketingPage>
  );
}
