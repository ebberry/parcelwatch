/**
 * Minimal Anthropic Messages API client (raw fetch, no SDK dependency).
 *
 * The ONLY paid external dependency in the stack. Gated by ANTHROPIC_API_KEY:
 * when unset, aiEnabled() is false and every AI feature degrades to its non-AI
 * behavior (like the Census-key pattern). The key lives in .env (gitignored) and
 * is never committed.
 *
 * We default to a small, cheap model (Haiku) — the AI tasks here are short
 * classify/summarize calls, and results are cached, so steady-state cost is tiny.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

/** True when a key is configured — every AI feature checks this first. */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** One non-streaming Messages call. Returns the assistant's text. */
export async function claudeMessage(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("ANTHROPIC_API_KEY is not set");

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel(),
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
    });
  } catch (e) {
    throw new AiError(`Anthropic request failed: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === "text")?.text;
  if (typeof text !== "string") {
    throw new AiError("Unexpected Anthropic response shape (no text block)");
  }
  return text;
}

/**
 * Extract a JSON value from a model response — tolerant of ```code fences``` and
 * surrounding prose. Pure (exported for tests). Throws AiError on no/invalid JSON.
 */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new AiError("No JSON found in model response");
  // Find the matching end by scanning from the last closing bracket.
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (end < start) throw new AiError("No JSON found in model response");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch (e) {
    throw new AiError(`Model returned invalid JSON: ${(e as Error).message}`);
  }
}
