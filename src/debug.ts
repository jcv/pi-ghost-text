/**
 * Opt-in debug logging for prompt suggestions.
 *
 * Suggestions are advisory, so failures are never surfaced to the user as
 * errors. Logging is off by default — pi's TUI captures console output and
 * shows it in the chat area, so even stderr logging is user-visible noise.
 * Enable it with `"debug": true` in the config; lines are then appended to
 * the configured log file (default ~/.pi/agent/prompt-suggestions.log) so
 * "no suggestion appeared" can be diagnosed after the fact.
 *
 * No pi imports — this module is unit-testable with plain Node.
 *
 * Categories:
 * - "timeout"       generation exceeded the timeout
 * - "error"         model/network error, or model reported stopReason error
 * - "no-suggestion" model returned nothing usable (NONE, empty, rejected)
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type DebugCategory = "timeout" | "error" | "no-suggestion";

const PREFIX = "[prompt-suggestions]";

let enabled = false;
let logFile: string | null = null;

export function configureDebug(options: { enabled: boolean; logFile?: string }): void {
	enabled = options.enabled;
	if (options.logFile) logFile = options.logFile;
}

export function debug(category: DebugCategory, detail?: string): void {
	if (!enabled || !logFile) return;
	const suffix = detail ? `: ${detail}` : "";
	const line = `${new Date().toISOString()} ${PREFIX} ${category}${suffix}\n`;
	try {
		fs.mkdirSync(path.dirname(logFile), { recursive: true });
		fs.appendFileSync(logFile, line, "utf8");
	} catch {
		// Debug logging must never break suggestions.
	}
}
