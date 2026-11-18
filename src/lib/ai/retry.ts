import { ResponseValidationError } from "../prompts/schemas";
import { PromptLeakError } from "../prompts/guard";
import { ProviderError } from "./types";

export interface RetryInfo {
  retryable: boolean;
  retryAfterMs?: number;
  message: string;
}

/** Classifies SDK / validation errors into retryable vs fatal. */
export function classifyError(err: unknown): RetryInfo {
  if (err instanceof PromptLeakError) return { retryable: false, message: err.message };
  if (err instanceof ResponseValidationError) return { retryable: true, message: `Invalid response: ${err.message}` };
  if (err instanceof ProviderError) return { retryable: err.retryable, retryAfterMs: err.retryAfterMs, message: err.message };
  const e = err as { status?: number; name?: string; message?: string; headers?: unknown };
  const msg = e?.message ?? String(err);
  if (e?.name === "AbortError" || /timed? ?out/i.test(msg)) return { retryable: true, message: `Timeout: ${msg}` };
  const status = typeof e?.status === "number" ? e.status : undefined;
  if (status === 429) {
    let retryAfterMs: number | undefined;
    const h = e.headers as { get?: (k: string) => string | null } | Record<string, string> | undefined;
    const ra = h && typeof (h as { get?: unknown }).get === "function"
      ? (h as { get: (k: string) => string | null }).get("retry-after")
      : (h as Record<string, string> | undefined)?.["retry-after"];
    if (ra && !isNaN(Number(ra))) retryAfterMs = Number(ra) * 1000;
    return { retryable: true, retryAfterMs, message: `Rate limited (429): ${msg}` };
  }
  if (status !== undefined && (status >= 500 || status === 408 || status === 409)) return { retryable: true, message: `Server error ${status}: ${msg}` };
  if (status !== undefined) return { retryable: false, message: `API error ${status}: ${msg}` };
  // Network errors without a status
  return { retryable: true, message: `Network error: ${msg}` };
}

export const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);

export function backoffMs(attempt: number, info: RetryInfo) {
  if (info.retryAfterMs) return Math.min(info.retryAfterMs, 30_000);
  return Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 300);
}
