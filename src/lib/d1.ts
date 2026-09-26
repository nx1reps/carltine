import type { AgentActionRecord } from "./types";

/**
 * Cloudflare D1 driver.
 *
 * Netlify functions have an ephemeral filesystem, so the local JSON chain
 * cannot be the store of record there. D1 is SQLite over Cloudflare's REST
 * API, which means the Next.js app can talk to it directly without changing
 * runtime or adding a native SQLite dependency.
 *
 * The full record is stored as a JSON payload alongside the columns we need to
 * index. The hash and prev_hash columns are duplicated out of the payload on
 * purpose: they are the columns verification queries and chain walks need, and
 * re-parsing every payload to check ordering would be wasteful.
 */

const API = "https://api.cloudflare.com/client/v4";

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export function d1Config(): D1Config | null {
  const accountId = process.env.CARLTINE_D1_ACCOUNT_ID;
  const databaseId = process.env.CARLTINE_D1_DATABASE_ID;
  const apiToken = process.env.CARLTINE_CF_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

export const D1_SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  seq        INTEGER PRIMARY KEY,
  id         TEXT    NOT NULL UNIQUE,
  prev_hash  TEXT    NOT NULL,
  hash       TEXT    NOT NULL,
  payload    TEXT    NOT NULL,
  recorded_at TEXT   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_recorded_at ON records (recorded_at);
`;

type QueryResponse = {
  success: boolean;
  errors: { message: string }[];
  result: { results: Record<string, unknown>[] };
};

async function query(
  config: D1Config,
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${API}/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );

  if (!res.ok) {
    throw new Error(
      `D1 request failed: ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }

  const body = (await res.json()) as QueryResponse;
  if (!body.success) {
    // Do not swallow this. Falling back to a local file here would silently
    // split the chain across two stores, which is worse than being down.
    throw new Error(
      `D1 query error: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return body.result.results;
}

export async function d1LoadAll(config: D1Config): Promise<AgentActionRecord[]> {
  const rows = await query(config, "SELECT payload FROM records ORDER BY seq ASC");
  return rows.map((r) => JSON.parse(String(r.payload)) as AgentActionRecord);
}

export async function d1Insert(config: D1Config, record: AgentActionRecord): Promise<void> {
  await query(
    config,
    `INSERT INTO records (seq, id, prev_hash, hash, payload, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.seq,
      record.id,
      record.prevHash,
      record.hash,
      JSON.stringify(record),
      record.recordedAt,
    ],
  );
}

/** True when the table is missing, so the app can say so instead of 500ing. */
export async function d1IsInitialised(config: D1Config): Promise<boolean> {
  try {
    const rows = await query(
      config,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='records'",
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
