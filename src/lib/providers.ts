import type { ModelSpec } from "./catalog";

/**
 * Upstream provider calls.
 *
 * Every provider is reached through its own HTTP API rather than through an
 * SDK, which keeps the dependency surface at zero and makes the request shape
 * visible at the call site.
 *
 * Two behaviours matter more than the plumbing:
 *
 *  - Streaming is passed through as a byte stream. Re-buffering it would add
 *    latency to the exact interactive requests users notice most, and would
 *    make a long completion feel broken behind a proxy.
 *  - Errors are translated into a single UpstreamError. Callers should not have
 *    to know which of six providers produced a 429, and a router that leaks
 *    provider internals to its own clients is a bad neighbour.
 */

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface ChatMessage {
  role: string;
  content: string;
  /**
   * Present on `tool` messages: the id of the call this result answers.
   * Forwarded to providers that key tool results by id.
   */
  toolCallId?: string;
  /**
   * Present on `assistant` messages that requested tools.
   * OpenAI-shaped; translated for providers that use a different shape.
   */
  toolCalls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface CallOptions {
  model: ModelSpec;
  messages: ChatMessage[];
  /** Tool schemas to expose to the model. */
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface UpstreamResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string | null;
  latencyMs: number;
  /** Tool calls the model requested, if the caller supplied tool schemas. */
  toolCalls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}

/** Per-provider env var holding the caller's key. */
const KEY_ENV: Record<ModelSpec["provider"], string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "QWEN_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

export function providerKey(model: ModelSpec): string | null {
  const key = process.env[KEY_ENV[model.provider]];
  return key && key.length > 0 ? key : null;
}

export function hasKey(model: ModelSpec): boolean {
  return providerKey(model) !== null;
}

export function availableProviders(): ModelSpec["provider"][] {
  return (Object.keys(KEY_ENV) as ModelSpec["provider"][]).filter((p) =>
    process.env[KEY_ENV[p]],
  );
}

interface Endpoint {
  /**
   * Resolve the request URL. A function because Google carries the model in the
   * path rather than the body, so the URL depends on the model id.
   */
  url: (model: ModelSpec) => string;
  build: (opts: CallOptions, key: string) => { headers: Record<string, string>; body: unknown };
  parse: (json: Record<string, unknown>) => UpstreamResult;
}

const ENDPOINTS: Record<ModelSpec["provider"], Endpoint> = {
  openai: {
    url: () => "https://api.openai.com/v1/chat/completions",
    build: ({ model, messages, tools, temperature, maxTokens }, key) => ({
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: {
        model: model.id,
        messages: toOpenAIMessages(messages),
        ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      },
    }),
    parse: (json) => {
      const choice = (json.choices as { message?: { content?: string; tool_calls?: unknown[] }; finish_reason?: string }[])?.[0];
      const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      const toolCalls = choice?.message?.tool_calls as UpstreamResult["toolCalls"] | undefined;
      return {
        content: choice?.message?.content ?? "",
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        finishReason: choice?.finish_reason ?? null,
        latencyMs: 0,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      };
    },
  },

  anthropic: {
    url: () => "https://api.anthropic.com/v1/messages",
    build: ({ model, messages, tools, temperature, maxTokens }, key) => ({
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: {
        model: model.id,
        // Anthropic requires system prompts outside the message array.
        system: messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n\n") || undefined,
        messages: toAnthropicMessages(messages),
        ...(tools && tools.length > 0
          ? { tools: tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) }
          : {}),
        max_tokens: maxTokens ?? 4096,
        ...(temperature !== undefined ? { temperature } : {}),
      },
    }),
    parse: (json) => {
      const content = (json.content as { type: string; text?: string }[] | undefined) ?? [];
      const usage = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      const toolUses = content.filter((c) => c.type === "tool_use") as unknown as { id: string; name: string; input: unknown }[];
      return {
        ...(toolUses.length > 0
          ? {
              toolCalls: toolUses.map((t) => ({
                id: t.id,
                type: "function" as const,
                function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) },
              })),
            }
          : {}),
        content: content.filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        finishReason: (json.stop_reason as string) ?? null,
        latencyMs: 0,
      };
    },
  },

  google: {
    url: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent`,
    // Google takes the model in the URL rather than the body, so `model` is
    // deliberately absent from this destructure.
    build: ({ messages, temperature, maxTokens }, key) => ({
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: {
        contents: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        systemInstruction: messages.find((m) => m.role === "system")
          ? { parts: [{ text: messages.find((m) => m.role === "system")!.content }] }
          : undefined,
        generationConfig: {
          ...(temperature !== undefined ? { temperature } : {}),
          ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
        },
      },
    }),
    parse: (json) => {
      const parts = (json.candidates as { content?: { parts?: { text?: string }[] }; finishReason?: string }[])?.[0];
      const usage = json.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
      return {
        content: parts?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        finishReason: parts?.finishReason ?? null,
        latencyMs: 0,
      };
    },
  },

  // DeepSeek, Qwen and Mistral all speak the OpenAI wire format, so they reuse
  // its request and response shapes against their own base URLs.
  deepseek: {
    url: () => "https://api.deepseek.com/chat/completions",
    build: ({ model, messages, tools, temperature, maxTokens }, key) => ({
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: {
        model: model.id,
        messages: toOpenAIMessages(messages),
        ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      },
    }),
    parse: (json) => ENDPOINTS.openai.parse(json),
  },

  qwen: {
    url: () => "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    build: ({ model, messages, tools, temperature, maxTokens }, key) => ({
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: {
        model: model.id,
        messages: toOpenAIMessages(messages),
        ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      },
    }),
    parse: (json) => ENDPOINTS.openai.parse(json),
  },

  mistral: {
    url: () => "https://api.mistral.ai/v1/chat/completions",
    build: ({ model, messages, tools, temperature, maxTokens }, key) => ({
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: {
        model: model.id,
        messages: toOpenAIMessages(messages),
        ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      },
    }),
    parse: (json) => ENDPOINTS.openai.parse(json),
  },
};

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Normalize messages into the OpenAI chat shape.
 *
 * Providers in the OpenAI-compatible family accept `tool` and `tool_calls`
 * verbatim, but a router has to be tolerant of callers that omit `tool_call_id`
 * or send roles in unexpected order. Dropping unknown roles is safer than
 * forwarding something the upstream will reject with a 400.
 */
function toOpenAIMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls && m.toolCalls.length > 0 ? { tool_calls: m.toolCalls } : {}),
      ...(m.role === "tool" && m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    }));
}

/**
 * Translate to Anthropic's message format.
 *
 * Two structural differences matter: Anthropic carries the system prompt in a
 * top-level field, and a `tool` result becomes a `user` message whose content
 * is a `tool_result` block. Getting this wrong produces a 400, so it is done
 * once here rather than inline in the builder.
 */
function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: m.toolCallId ?? "unknown",
              content: m.content,
            },
          ],
        };
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant" as const,
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            ...m.toolCalls.map((c) => ({
              type: "tool_use" as const,
              id: c.id,
              name: c.function.name,
              input: safeParse(c.function.arguments),
            })),
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });
}

/** Tool arguments are a JSON string on the wire but an object in Anthropic. */
function safeParse(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A retryable status is one where a different model or a later attempt helps. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export async function callProvider(opts: CallOptions): Promise<UpstreamResult> {
  const { model } = opts;
  const key = providerKey(model);
  if (!key) {
    throw new UpstreamError(
      `No API key configured for provider "${model.provider}" (${KEY_ENV[model.provider]}).`,
      model.provider,
      401,
      false,
    );
  }

  const endpoint = ENDPOINTS[model.provider];
  const { headers, body } = endpoint.build(opts, key);

  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Combine the caller's cancellation with our own timeout so a client
  // disconnect does not leave an upstream request running.
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  const started = Date.now();
  let res: Response;

  try {
    res = await fetch(endpoint.url(model), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const aborted = timeout.aborted;
    throw new UpstreamError(
      aborted
        ? `Provider "${model.provider}" timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms.`
        : `Could not reach provider "${model.provider}": ${(err as Error).message}`,
      model.provider,
      aborted ? 504 : 502,
      true,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(
      `Provider "${model.provider}" returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      model.provider,
      res.status,
      isRetryableStatus(res.status),
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  return { ...endpoint.parse(json), latencyMs: Date.now() - started };
}

/**
 * Stream from the provider, returning the raw body.
 *
 * The stream is passed through untouched rather than re-encoded, so SSE framing
 * and any provider-specific fields survive to the client unchanged.
 */
export async function streamProvider(opts: CallOptions): Promise<Response> {
  const { model } = opts;
  const key = providerKey(model);
  if (!key) {
    throw new UpstreamError(
      `No API key configured for provider "${model.provider}" (${KEY_ENV[model.provider]}).`,
      model.provider,
      401,
      false,
    );
  }

  const endpoint = ENDPOINTS[model.provider];
  const base = endpoint.url(model);
  // Google signals SSE with a query param rather than an Accept header alone.
  const url = model.provider === "google" ? `${base.replace(":generateContent", ":streamGenerateContent")}?alt=sse` : base;

  const { headers, body } = endpoint.build(opts, key);
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, accept: "text/event-stream" },
      body: JSON.stringify({ ...(body as Record<string, unknown>), stream: true }),
      signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new UpstreamError(
        `Provider "${model.provider}" returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        model.provider,
        res.status,
        isRetryableStatus(res.status),
      );
    }
    return res;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(
      `Could not reach provider "${model.provider}": ${(err as Error).message}`,
      model.provider,
      502,
      true,
    );
  }
}
