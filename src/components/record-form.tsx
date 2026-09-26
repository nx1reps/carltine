"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTIONS = [
  "refund.issue",
  "db.write",
  "db.read",
  "email.send",
  "deploy.trigger",
  "policy.amend",
];

const SYSTEMS = ["stripe", "prod-postgres", "sendgrid", "github-actions", "carltine"];

/**
 * Record submission.
 *
 * Deliberately built around the fields most logging systems omit — the
 * authorization basis, the granted scope, and the human oversight mode — since
 * those are what determine whether the record survives an audit.
 */
export function RecordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [scopeText, setScopeText] = useState("refund:*, amount<500");
  const [detailText, setDetailText] = useState('{ "amount": 120, "currency": "usd" }');
  const [humanOversight, setHumanOversight] = useState("none");
  const [scopeExceeded, setScopeExceeded] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      actorType: form.get("actorType"),
      actorId: form.get("actorId"),
      humanPrincipalId: form.get("humanPrincipalId") || null,
      agentVersion: form.get("agentVersion") || null,
      action: form.get("action"),
      targetSystem: form.get("targetSystem"),
      targetResource: form.get("targetResource") || null,
      authorizationBasis: form.get("authorizationBasis"),
      grantedScope: scopeText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      scopeExceeded,
      oversightMode: humanOversight,
      oversightActorId: form.get("oversightActorId") || null,
      oversightReason: form.get("oversightReason") || null,
      riskClass: form.get("riskClass"),
      outcome: form.get("outcome"),
      detail: parseDetail(detailText),
    };

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
          setError("Validation failed — see the highlighted fields.");
        } else {
          setError(data.error ?? "Could not record this action.");
        }
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Nothing was written to the chain.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) =>
    fieldErrors[k] ? (
      <span className="mt-1 block text-xs text-danger">{fieldErrors[k]}</span>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <fieldset className="panel p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Who acted
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="actorType">Actor type</label>
            <select id="actorType" name="actorType" className="field" defaultValue="agent">
              <option value="agent">agent</option>
              <option value="human">human</option>
              <option value="system">system</option>
            </select>
            {err("actorType")}
          </div>
          <div>
            <label htmlFor="actorId">Actor id</label>
            <input
              id="actorId"
              name="actorId"
              className="field"
              placeholder="refund-agent-01"
              required
            />
            {err("actorId")}
          </div>
          <div>
            <label htmlFor="humanPrincipalId">Human principal (delegation)</label>
            <input
              id="humanPrincipalId"
              name="humanPrincipalId"
              className="field"
              placeholder="emp_4471"
            />
          </div>
          <div>
            <label htmlFor="agentVersion">Agent version</label>
            <input id="agentVersion" name="agentVersion" className="field" placeholder="2.4.1" />
          </div>
        </div>
      </fieldset>

      <fieldset className="panel p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
          What happened
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="action">Action</label>
            <select id="action" name="action" className="field" defaultValue={ACTIONS[0]}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {err("action")}
          </div>
          <div>
            <label htmlFor="targetSystem">Target system</label>
            <select
              id="targetSystem"
              name="targetSystem"
              className="field"
              defaultValue={SYSTEMS[0]}
            >
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {err("targetSystem")}
          </div>
          <div>
            <label htmlFor="targetResource">Target resource</label>
            <input
              id="targetResource"
              name="targetResource"
              className="field"
              placeholder="ch_3Px8Kq2"
            />
          </div>
          <div>
            <label htmlFor="detail">Detail (JSON)</label>
            <input id="detail" className="field" value={detailText} onChange={(e) => setDetailText(e.target.value)} />
            {err("detail")}
          </div>
        </div>
      </fieldset>

      <fieldset className="panel p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Authorization basis — Article 12
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="authorizationBasis">Policy / grant in force</label>
            <input
              id="authorizationBasis"
              name="authorizationBasis"
              className="field"
              placeholder="POLICY-refund-agent-v7"
              required
            />
            {err("authorizationBasis")}
          </div>
          <div>
            <label htmlFor="scope">Granted scope (comma separated)</label>
            <input
              id="scope"
              className="field"
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
            />
            {err("grantedScope")}
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={scopeExceeded}
            onChange={(e) => setScopeExceeded(e.target.checked)}
            className="h-4 w-4 accent-red-500"
          />
          This action exceeded its granted scope
        </label>
      </fieldset>

      <fieldset className="panel p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Human oversight — Article 14
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="oversightMode">Oversight mode</label>
            <select
              id="oversightMode"
              className="field"
              value={humanOversight}
              onChange={(e) => setHumanOversight(e.target.value)}
            >
              <option value="none">none</option>
              <option value="pre-approved">pre-approved</option>
              <option value="human-in-the-loop">human-in-the-loop</option>
              <option value="human-approved">human-approved</option>
              <option value="human-overrode">human-overrode</option>
              <option value="human-stopped">human-stopped</option>
            </select>
            {err("oversightMode")}
          </div>
          <div>
            <label htmlFor="oversightActorId">Overseeing human</label>
            <input
              id="oversightActorId"
              name="oversightActorId"
              className="field"
              placeholder="emp_2210"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="oversightReason">Reason for intervention</label>
            <input
              id="oversightReason"
              name="oversightReason"
              className="field"
              placeholder="Required when a human overrode or stopped the agent"
            />
            {err("oversightReason")}
          </div>
        </div>
      </fieldset>

      <fieldset className="panel p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Classification
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="riskClass">Risk class</label>
            <select id="riskClass" name="riskClass" className="field" defaultValue="limited">
              <option value="minimal">minimal</option>
              <option value="limited">limited</option>
              <option value="high">high</option>
            </select>
            {err("riskClass")}
          </div>
          <div>
            <label htmlFor="outcome">Outcome</label>
            <select id="outcome" name="outcome" className="field" defaultValue="succeeded">
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="denied">denied</option>
              <option value="partial">partial</option>
            </select>
            {err("outcome")}
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Writing to chain…" : "Append to chain"}
      </button>
      <p className="text-center text-xs text-muted">
        Append-only. Once written, a record cannot be changed or removed.
      </p>
    </form>
  );
}

function parseDetail(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // The API rejects non-objects, but a malformed field should not throw here
    // and lose the rest of the form.
    return {};
  }
}
