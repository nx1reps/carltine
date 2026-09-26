import { Block, MarketingPage } from "@/components/marketing-layout";

export const metadata = {
  title: "Privacy",
  description: "What data Carltine stores, what it does not, and what leaves your infrastructure.",
};

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Privacy"
      title="Short, because there is not much to say"
      description="Last updated 26 September 2026."
    >
      <Block title="What we store">
        <p>
          For each routed request the ledger stores a SHA-256 digest of the
          request, the model that was selected, the difficulty score and the
          signals behind it, the cost comparison, and a hash-chained record id.
          It does not store the request content.
        </p>
        <p>
          API keys are stored as SHA-256 hashes. A short fingerprint of a key
          appears in the audit trail so you can tell callers apart; the key
          itself never does.
        </p>
      </Block>

      <Block title="What we do not store">
        <p>
          Prompt content, completion content, or generated images. Those exist
          only in the request you sent to whichever provider the router selected,
          and are governed by that provider&rsquo;s own policy.
        </p>
      </Block>

      <Block title="Third parties">
        <p>
          Requests are forwarded to the model provider you configured, and are
          subject to that provider&rsquo;s terms. We are not a party to that
          relationship.
        </p>
        <p>
          Analytics are disabled unless an operator explicitly configures
          PostHog. The client is not loaded at all when no key is set, so a
          self-hosted deployment sends usage data nowhere.
        </p>
      </Block>

      <Block title="Self-hosting">
        <p>
          If you run Carltine yourself, none of this applies. The core is MIT
          licensed and you control where the ledger is stored, whether anchoring
          runs, and whether any analytics exist.
        </p>
      </Block>

      <Block title="Contact">
        <p>
          Questions or deletion requests:{" "}
          <a href="mailto:privacy@carltine.com" className="text-accent hover:underline">
            privacy@carltine.com
          </a>
          .
        </p>
      </Block>
    </MarketingPage>
  );
}
