import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { configureDebug, debug } from "../src/debug.ts";

test("debug is a no-op until enabled", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-debug-"));
	const logFile = path.join(dir, "debug.log");
	configureDebug({ enabled: false, logFile });
	debug("error", "should not be written");
	assert.equal(fs.existsSync(logFile), false);
});

test("debug appends categorized lines when enabled", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-debug-"));
	const logFile = path.join(dir, "nested", "debug.log");
	configureDebug({ enabled: true, logFile });
	debug("timeout", "8000ms");
	debug("no-suggestion");
	const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
	assert.equal(lines.length, 2);
	assert.match(lines[0], /\[prompt-suggestions\] timeout: 8000ms$/);
	assert.match(lines[1], /\[prompt-suggestions\] no-suggestion$/);
	configureDebug({ enabled: false });
});
