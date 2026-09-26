# Carltine

Route every LLM call to the cheapest model that can actually do the job — and
write every routing decision to a tamper-evident ledger, so the savings are
provable rather than claimed.

OpenAI-compatible endpoint. Bring your own provider key. No signup, no card, no
token markup.

## Quickstart

```bash
./scripts/setup.sh
npm run dev
```

Then open http://localhost:3000/app/playground.

No accounts required anywhere. `./scripts/setup.sh --d1` additionally provisions
Cloudflare D1 for durable storage (this one does need a Cloudflare account).

## Why this exists

Most teams pin one frontier model and pay frontier prices for classifying a
support ticket. Quality-preserving routing is well established — RouteLLM
reports ~85% cost reduction at 95% of GPT-4 quality on MT-Bench, and FrugalGPT
claims up to 98% on benchmarks.

The problem is not the algorithm. It is that **the savings claims are
unauditable**. Vendor numbers are computed on curated datasets, by the vendor,
with no way for a customer to check the arithmetic.

Carltine's position is that the interesting part is the *evidence*. Every
decision is written to a hash-chained, HMAC-signed ledger, so a finance team can
verify the number rather than take it on faith.

## How routing works

1. **Score difficulty** from cheap deterministic signals: prompt length, code
   fences, reasoning markers, tool structure, conversation shape, source
   count. No model call is made to route, so the router never costs more than it
   saves and adds no latency.
2. **Map to a capability tier** (1–5).
3. **Pick the cheapest model at exactly that tier**, subject to capability
   filters and any budget cap.
4. **Record the decision** to the ledger before responding.

Tier is a **floor, not a ceiling**. Filtering on `tier <= n` and then sorting by
price is the obvious implementation and it is wrong — it silently downgrades
every request to the cheapest model in the catalog. The router tests assert
against this specifically.

Pin any model with `{"model": "gpt-6-astra"}` to bypass routing entirely.

## API

```bash
curl -X POST http://localhost:3000/api/route \
  -H "content-type: application/json" \
  -H "authorization: Bearer $CARLTINE_API_KEY" \
  -d '{"messages":[{"role":"user","content":"Classify this ticket"}]}'
```

The response is OpenAI-shaped with an extra `carltine` object carrying the chosen
model, difficulty score, reasons, and cost comparison. OpenAI SDKs ignore
unknown fields, so a strict client is unaffected.

Supports six providers over their native HTTP APIs, with no SDK dependencies:
OpenAI, Anthropic, Google, DeepSeek, Qwen and Mistral. Set `stream: true` for
SSE, which is passed through as raw bytes so provider framing and latency are
preserved.

| Endpoint | Purpose |
|---|---|
| `POST /api/route` | Route a request. Records every decision. |
| `GET /api/records` | Recent records, stats, chain status. |
| `GET /api/verify` | Chain verification result. |
| `GET /api/anchor` | Head hash, for external anchoring. |
| `POST /api/anchor` | Compare a witnessed head against the current one. |
| `GET /api/export` | Signed audit bundle. `?format=csv` or `?format=json`. |

Pages: `/`, `/app`, `/app/playground`, `/app/chain`, `/docs`, `/about`,
`/security`, `/status`, `/changelog`, `/privacy`, `/terms`. Full reference at
`/docs`.

## Tests

```bash
npm run test:chain   # tamper detection: 3 attack modes
npm run test:router  # routing policy: 20 checks
```

`test:chain` covers the property the product rests on:

| Attack | Result |
|---|---|
| Untampered chain | valid |
| Edit a field, hash left stale | detected |
| Edit a field **and recompute its hash** | detected by the chain link |
| Delete a record from the middle | detected |

Re-signing a row defeats any per-record check. It cannot defeat the chain,
because the following record still commits to the old hash.

`test:router` asserts the routing *policy*, including several cases that the
chosen model is **not** too cheap — under-routing produces a silently bad
answer, which is worse than overpaying a fraction of a cent.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `CARLTINE_INGEST_SECRET` | shared envs | HMAC key for ingest signing |
| `CARLTINE_API_KEYS` | recommended | Comma-separated keys, stored as SHA-256 hashes |
| `CARLTINE_D1_ACCOUNT_ID` | durable deploy | Cloudflare D1 |
| `CARLTINE_D1_DATABASE_ID` | durable deploy | Cloudflare D1 |
| `CARLTINE_CF_API_TOKEN` | durable deploy | Cloudflare D1 (needs D1:Edit) |
| `CARLTINE_FREE_DAILY_LIMIT` | optional | Requests/day per key, default 5000 |
| `*_API_KEY` | optional | Provider keys; without one, responses are simulated |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | Analytics. Unset means no analytics load. |

## Honest limitations

**1. The difficulty score is heuristic.** It is hand-weighted against intuition,
not trained, and not evaluated on your traffic. It is deliberately biased toward
over-routing, because a cheap model returning a plausible wrong answer costs more
than a frontier model on a request that did not need one. Open-ended design work
and regulated-domain prompts carry extra weight for exactly that reason. The
ledger exists partly so you can measure its real accuracy rather than trusting
it. Expect to tune weights against your own traffic.

**2. Prices are hand-entered.** `src/lib/catalog.ts` carries a `verifiedAt`
stamp and the UI shows a staleness badge past 30 days. Nobody has built a
scraper for this and it should not be guesswork.

**3. Quotas are per-instance.** The free-tier counter is in-process. Real
enforcement needs the D1 counter; the current version stops a runaway loop, not
a distributed one.

**4. Serverless needs D1.** Without the D1 variables the chain falls back to a
local file, which is ephemeral on Netlify and Vercel. The UI shows a
`local file · not deploy-safe` badge when this happens — the state is never
silent.

**5. Concurrency.** `append` reads the tail, computes, then inserts. Two
concurrent appends can collide; D1's `seq` primary key turns that into a
constraint violation rather than a silent fork, which is the right failure mode
but it fails instead of retrying.

**6. The routing endpoint fails closed.** If the ledger is unavailable the
request is refused rather than served unrecorded. That is deliberate — savings
stop being provable the moment some requests are silently unrouted — but it does
mean the ledger is a hard dependency, not a nice-to-have.

**7. Fallback escalates rather than degrades.** When a provider fails the router
walks *up* the capability tiers to the next-cheapest model with a usable key.
Falling back to a weaker model would risk a silently bad answer, which is the one
failure this product exists to prevent. It does mean a provider outage makes
requests more expensive rather than cheaper.

**8. Tool-calling works, with one gap.** Tool schemas are forwarded to OpenAI,
Anthropic (translated to `input_schema`), DeepSeek, Qwen and Mistral, and tool
calls are returned in OpenAI shape regardless of provider. A conversation
carrying tool results is detected and routed to a tool-capable model even when
the caller does not set `requiresTools`. Tool definitions are not yet
auto-inferred from prompt content, and Google Gemini is excluded from tool
routing because its function-calling schema differs enough to be worth doing
properly rather than approximately.

## Deploying

```bash
./scripts/setup.sh --d1     # provision D1, print what to paste
npx netlify deploy --prod   # or: npx vercel
```

Note that carltine.com already points at a Netlify deploy serving an unrelated
project; publishing to that site will replace it.
