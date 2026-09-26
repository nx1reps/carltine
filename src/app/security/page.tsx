import { Card } from "@/components/ui";
import { Block, MarketingPage, ProseLink } from "@/components/marketing-layout";

export const metadata = {
  title: "Security",
  description:
    "How Carltine handles keys, prompt data, tamper evidence, and chain anchoring.",
};

export default function SecurityPage() {
  return (
    <MarketingPage
      eyebrow="Security"
      title="What we store, and what we don't"
      description="A short, specific account rather than a policy page nobody reads."
    >
      <Block title="API keys">
        <p>
          Keys supplied via <code className="font-mono text-foreground">CARLTINE_API_KEYS</code>{" "}
          are stored and compared as SHA-256 hashes, and the comparison is
          constant-time. Only a short fingerprint of a key ever reaches the audit
          trail, so a log dump cannot be used to recover a working credential.
        </p>
        <p>
          With no keys configured the write API is open. That is intended for
          local development and is a genuine security gap anywhere else, so it
          is called out in the interface rather than left implicit.
        </p>
      </Block>

      <Block title="Prompt data">
        <p>
          The ledger stores a SHA-256 digest of each request rather than its
          content. That is enough to prove which model handled a request and
          what it cost, without retaining your data. Prompts are forwarded only
          to whichever provider the router selected, and never to us.
        </p>
      </Block>

      <Block title="Tamper evidence">
        <p>
          Records are hash-chained and HMAC-signed at ingest using
          {" "}
          <code className="font-mono text-foreground">CARLTINE_INGEST_SECRET</code>.
          Verification recomputes every hash from the stored bytes rather than
          trusting a cached value, so a record edited in the database is caught
          even if the stored hash was updated to match.
        </p>
        <Card className="panel">
          <p className="text-xs">
            This property is covered by an automated test that runs three attack
            modes — a plain field edit, a field edit with a recomputed hash, and
            a deletion from the middle of the chain — and requires all three to be
            detected. See the <ProseLink href="/app/chain">chain integrity page</ProseLink>{" "}
            for a live demonstration you can break yourself.
          </p>
        </Card>
      </Block>

      <Block title="Full-chain rewrites">
        <p>
          A hash chain proves no record was altered in place. It does not stop
          someone with database access from rebuilding the entire chain
          consistently, because every hash would recompute cleanly.
        </p>
        <p>
          The mitigation is external witnessing.{" "}
          <code className="font-mono text-foreground">GET /api/anchor</code>{" "}
          returns the current head hash and a signature over it. Record that value
          somewhere you control — a file in version control, a scheduled
          job that emails itself, a public timestamp service — and a later
          divergence becomes provable rather than arguable. Automatic scheduled
          anchoring is on the Team tier.
        </p>
      </Block>

      <Block title="Failure behaviour">
        <p>
          The routing endpoint fails closed. If a decision cannot be written to
          the ledger, the request is refused rather than served unrecorded. That
          is deliberate: savings stop being provable the moment some requests are
          silently unrouted. It also means the ledger is a hard dependency, which
          is a real availability trade-off rather than a free choice.
        </p>
      </Block>

      <Block title="Reporting an issue">
        <p>
          Security reports are welcome via email to{" "}
          <a href="mailto:security@carltine.com" className="text-accent hover:underline">
            security@carltine.com
          </a>
          . We are a small team and cannot yet commit to a formal disclosure
          window, which we would rather state plainly than imply otherwise.
        </p>
      </Block>
    </MarketingPage>
  );
}
