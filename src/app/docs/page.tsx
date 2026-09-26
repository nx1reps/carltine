import { Badge, Card } from "@/components/ui";
import { Reveal } from "@/components/motion";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
      {children}
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-24 border-b border-line py-10 last:border-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
          {children}
        </div>
      </section>
    </Reveal>
  );
}

export const metadata = {
  title: "Docs",
  description: "Quickstart, configuration, and self-hosting for the Carltine LLM router.",
};

export default function DocsPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <Badge tone="accent">Documentation</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Carltine API reference
        </h1>
        <p className="mt-3 text-muted">
          One endpoint, shaped like OpenAI chat completions. Adoption is a{" "}
          <code className="font-mono text-foreground">base_url</code> change.
        </p>

        <div className="mt-10">
          <Section id="quickstart" title="Quickstart">
            <p>
              Point any OpenAI-compatible client at the routing endpoint. Nothing
              else in your code changes.
            </p>
            <Code>{`curl -X POST https://your-instance/api/route \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $CARLTINE_API_KEY" \\
  -d '{
    "messages": [{"role": "user", "content": "Classify this ticket"}]
  }'`}</Code>
            <p>With the OpenAI SDK:</p>
            <Code>{`from openai import OpenAI

client = OpenAI(
    base_url="https://your-instance/api/route",
    api_key=os.environ["CARLTINE_API_KEY"],
)

resp = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Classify this ticket"}],
)
print(resp.choices[0].message.content)
print(resp.carltine["savingsPct"])`}</Code>
            <p>
              The response includes a <code className="font-mono text-foreground">carltine</code>{" "}
              object with the chosen model, the difficulty score, the reasons, and
              the cost comparison. OpenAI SDKs ignore unknown fields, so a strict
              client is unaffected.
            </p>
          </Section>

          <Section id="routing" title="Request options">
            <Card className="panel">
              <ul className="space-y-3 text-xs">
                {[
                  ["model", "string", "Pin a model by id and bypass routing entirely. Use this for the calls that must not be rerouted."],
                  ["priority", "economy | balanced | quality", "Sets the capability floor. quality raises the floor to tier 4."],
                  ["maxCostUsd", "number", "Hard cap for this request. If no candidate fits, the cheapest is used and the overage is reported."],
                  ["requiresTools", "boolean", "Restrict candidates to tool-capable models."],
                  ["requiresVision", "boolean", "Restrict candidates to vision-capable models."],
                  ["difficultyHint", "number 0-1", "Blend your own difficulty estimate in at 40% weight."],
                ].map(([name, type, desc]) => (
                  <li key={name} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0">
                    <div className="flex items-baseline gap-2">
                      <code className="font-mono text-foreground">{name}</code>
                      <span className="text-subtle">{type}</span>
                    </div>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>

          <Section id="self-hosting" title="Self-hosting">
            <p>
              The core is MIT licensed and runs anywhere Node 24 does. With no
              environment variables at all it stores the chain in a local file,
              which is fine for local use.
            </p>
            <Code>{`git clone https://github.com/carltine/carltine
cd carltine
npm install
npm run seed
npm run dev`}</Code>
            <p>For a durable deployment, point it at Cloudflare D1:</p>
            <Code>{`npx wrangler d1 create carltine
npx wrangler d1 execute carltine --file=db/schema.sql

export CARLTINE_INGEST_SECRET="$(openssl rand -hex 32)"
export CARLTINE_D1_ACCOUNT_ID=...
export CARLTINE_D1_DATABASE_ID=...
export CARLTINE_CF_API_TOKEN=...`}</Code>
            <p className="text-warn">
              Without those variables the app falls back to a local file, which is
              ephemeral on serverless hosts. The UI shows a warning badge when this
              happens, so the state is never silent.
            </p>
          </Section>

          <Section id="security" title="Security">
            <Card className="panel space-y-3 text-xs">
              <p>
                <span className="font-medium text-foreground">API keys.</span>{" "}
                Set <code className="font-mono">CARLTINE_API_KEYS</code> to a
                comma-separated list. Keys are stored and compared as SHA-256
                hashes in constant time, and only a short fingerprint reaches the
                audit trail. With no keys configured the API is open, which is
                intended for local development only.
              </p>
              <p>
                <span className="font-medium text-foreground">Data retention.</span>{" "}
                The ledger stores a SHA-256 digest of each request, not its
                content. Prompts are forwarded only to whichever provider the
                router selected.
              </p>
              <p>
                <span className="font-medium text-foreground">Tamper evidence.</span>{" "}
                Records are hash-chained and HMAC-signed at ingest. Verifying
                recomputes every hash from stored bytes rather than trusting a
                cached value. See{" "}
                <a href="/app/chain" className="text-accent hover:underline">
                  chain integrity
                </a>{" "}
                for a live demonstration.
              </p>
              <p>
                <span className="font-medium text-foreground">Anchoring.</span>{" "}
                <code className="font-mono">GET /api/anchor</code> returns the
                current head hash. Record it somewhere you do not control and a
                later full-chain rewrite becomes provable rather than arguable.
              </p>
            </Card>
          </Section>

          <Section id="endpoints" title="All endpoints">
            <Card className="panel">
              <ul className="space-y-2.5 text-xs">
                {[
                  ["POST /api/route", "OpenAI-compatible routing. Records every decision."],
                  ["GET  /api/records", "List recent records with stats and chain status."],
                  ["GET  /api/verify", "Chain verification result."],
                  ["GET  /api/anchor", "Current head hash, for external anchoring."],
                  ["POST /api/anchor", "Compare a witnessed head against the current one."],
                  ["GET  /api/export", "Signed audit bundle. Add ?format=csv or ?format=json."],
                ].map(([path, desc]) => (
                  <li key={path} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0 sm:flex-row sm:gap-4">
                    <code className="font-mono text-foreground sm:w-48 sm:shrink-0">{path}</code>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}
