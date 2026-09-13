/**
 * Best-effort debug logging for prompt suggestions.
 *
 * Suggestions are advisory, so failures are never surfaced to the user as
 * errors. Instead they are logged to stderr with a stable category so "no
 * suggestion appeared" can be diagnosed from the logs.
 *
 * Categories:
 * - "timeout"       generation exceeded the timeout
 * - "error"         model/network error, or model reported stopReason error
 * - "no-suggestion" model returned nothing usable (NONE, empty, rejected)
 */

export type DebugCategory = "timeout" | "error" | "no-suggestion";

const PREFIX = "[prompt-suggestions]";

export function debug(category: DebugCategory, detail?: string): void {
  const suffix = detail ? `: ${detail}` : "";
  console.warn(`${PREFIX} ${category}${suffix}`);
}
