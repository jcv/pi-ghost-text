/**
 * Safe JSON file read/update helpers.
 *
 * No pi imports — this module is unit-testable with plain Node.
 *
 * The failure mode these exist to prevent: a read-modify-write where the
 * read silently fails (torn read during a concurrent non-atomic write, a
 * hand-edit in progress) and the write then persists only the new partial,
 * erasing every other key. So:
 * - reads distinguish "missing" from "exists but unparseable", and
 * - updates refuse to trust an unparseable file: it is preserved as a
 *   `.bak` sibling before the merged write, which is itself atomic
 *   (tmp file + rename) so concurrent readers never see a torn file.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type JsonRead =
	| { status: "ok"; value: Record<string, unknown> }
	| { status: "missing" }
	| { status: "invalid" };

export function readJsonFile(filePath: string): JsonRead {
	let raw: string;
	try {
		raw = fs.readFileSync(filePath, "utf8");
	} catch {
		return { status: "missing" };
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return { status: "ok", value: parsed as Record<string, unknown> };
		}
	} catch {
		// Unparseable; fall through.
	}
	return { status: "invalid" };
}

/** Atomic write: tmp file + rename, so readers never see a partial file. */
export function writeJsonFileAtomic(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	fs.renameSync(tmp, filePath);
}

export interface UpdateResult {
	/** Set when the previous file existed but was unparseable and was preserved here. */
	backupPath?: string;
}

/**
 * Merge `partial` into the JSON object at `filePath`, preserving all keys
 * not in `partial`. An unparseable existing file is copied to `<path>.bak`
 * before being replaced, so its contents are never silently destroyed.
 */
export function updateJsonFile(
	filePath: string,
	partial: Record<string, unknown>,
	options?: { deleteKeys?: string[] },
): UpdateResult {
	const read = readJsonFile(filePath);
	let backupPath: string | undefined;
	if (read.status === "invalid") {
		backupPath = `${filePath}.bak`;
		fs.copyFileSync(filePath, backupPath);
	}
	const existing = read.status === "ok" ? read.value : {};
	for (const key of options?.deleteKeys ?? []) delete existing[key];
	writeJsonFileAtomic(filePath, { ...existing, ...partial });
	return { backupPath };
}
