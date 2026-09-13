/**
 * Scoped config for prompt suggestions.
 *
 * Resolved as `defaults <- global <- project`:
 * - global:  ~/.pi/agent/prompt-suggestions.json
 * - project: .pi/prompt-suggestions.json
 *
 * @module
 */

import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import * as os from "node:os";
import * as path from "node:path";
import { readJsonFile, updateJsonFile } from "./json-file.ts";
import { isMode, type SuggestMode } from "./mode.ts";

export type { SuggestMode } from "./mode.ts";

export interface Config {
	/** "auto" = auto-pick a fast model, or an explicit "provider/model-id". */
	model: string;
	/** Which suggestion behaviors are active. */
	mode: SuggestMode;
	/** Number of alternative suggestions to fetch (1..3). */
	candidates: number;
	/** Stream the single suggestion token-by-token (only when candidates === 1). */
	streaming: boolean;
	/** Number of recent messages included in the suggestion context. */
	contextMessages: number;
	/** Chars kept per message in the suggestion context. */
	contextChars: number;
	/** Max suggestions shown per agent turn (0 = unlimited). */
	maxPerTurn: number;
	/** Append debug lines to ~/.pi/agent/prompt-suggestions.log. */
	debug: boolean;
}

export const DEFAULT_CONFIG: Config = {
	model: "auto",
	mode: "both",
	candidates: 1,
	streaming: true,
	contextMessages: 8,
	contextChars: 600,
	maxPerTurn: 0,
	debug: false,
};

function clampInt(value: unknown, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

export function globalConfigPath(): string {
	return path.join(os.homedir(), CONFIG_DIR_NAME, "agent", "prompt-suggestions.json");
}

export function projectConfigPath(cwd: string): string {
	return path.join(cwd, CONFIG_DIR_NAME, "prompt-suggestions.json");
}

export function readConfig(cwd: string): Config {
	const merged: Config = { ...DEFAULT_CONFIG };
	let modeSeen = false;
	let legacyEnabled: boolean | undefined;

	for (const filePath of [globalConfigPath(), projectConfigPath(cwd)]) {
		const read = readJsonFile(filePath);
		if (read.status !== "ok") continue;
		const raw = read.value;
		if (typeof raw.model === "string" && raw.model) merged.model = raw.model;
		if (typeof raw.mode === "string" && isMode(raw.mode)) {
			merged.mode = raw.mode;
			modeSeen = true;
		}
		if (typeof raw.candidates !== "undefined") merged.candidates = clampInt(raw.candidates, 1, 3);
		if (typeof raw.streaming === "boolean") merged.streaming = raw.streaming;
		if (typeof raw.contextMessages !== "undefined") {
			merged.contextMessages = clampInt(raw.contextMessages, 0, 50);
		}
		if (typeof raw.contextChars !== "undefined") {
			merged.contextChars = clampInt(raw.contextChars, 0, 10_000);
		}
		if (typeof raw.maxPerTurn !== "undefined") {
			merged.maxPerTurn = clampInt(raw.maxPerTurn, 0, 1_000);
		}
		if (typeof raw.debug === "boolean") merged.debug = raw.debug;
		if (typeof raw.enabled === "boolean") legacyEnabled = raw.enabled;
	}

	// Legacy migration: before `mode` existed, `enabled: false` meant off.
	if (!modeSeen) merged.mode = legacyEnabled === false ? "off" : "both";
	return merged;
}

/**
 * Merge a partial config into the global config file, preserving keys not
 * in `partial`. Returns a backup path when the previous file existed but
 * was unparseable (its contents are preserved there, not destroyed).
 */
export function writeGlobalConfig(partial: Partial<Config>): { backupPath?: string } {
	return updateJsonFile(globalConfigPath(), partial, { deleteKeys: ["enabled"] });
}
