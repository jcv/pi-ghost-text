import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readJsonFile, updateJsonFile, writeJsonFileAtomic } from "../src/json-file.ts";

function tmpdir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "ps-json-file-"));
}

test("readJsonFile distinguishes ok / missing / invalid", () => {
	const dir = tmpdir();
	assert.equal(readJsonFile(path.join(dir, "nope.json")).status, "missing");

	const ok = path.join(dir, "ok.json");
	fs.writeFileSync(ok, '{"a": 1}');
	const read = readJsonFile(ok);
	assert.equal(read.status, "ok");
	assert.deepEqual(read.status === "ok" && read.value, { a: 1 });

	const bad = path.join(dir, "bad.json");
	fs.writeFileSync(bad, '{"a": 1'); // torn write
	assert.equal(readJsonFile(bad).status, "invalid");

	const notObject = path.join(dir, "arr.json");
	fs.writeFileSync(notObject, "[1, 2]");
	assert.equal(readJsonFile(notObject).status, "invalid");
});

test("updateJsonFile merges and preserves unrelated keys", () => {
	const dir = tmpdir();
	const file = path.join(dir, "config.json");
	fs.writeFileSync(file, '{"model": "x/y", "mode": "both", "drop": 1}');
	const result = updateJsonFile(file, { contextChars: 2000 }, { deleteKeys: ["drop"] });
	assert.equal(result.backupPath, undefined);
	assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
		model: "x/y",
		mode: "both",
		contextChars: 2000,
	});
});

test("updateJsonFile on an invalid file preserves it as .bak instead of clobbering", () => {
	const dir = tmpdir();
	const file = path.join(dir, "config.json");
	fs.writeFileSync(file, '{"model": "x/y", '); // torn
	const result = updateJsonFile(file, { mode: "off" });
	assert.equal(result.backupPath, `${file}.bak`);
	// The original (unparseable) contents survive in the backup.
	assert.equal(fs.readFileSync(result.backupPath, "utf8"), '{"model": "x/y", ');
	assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { mode: "off" });
});

test("updateJsonFile creates a missing file from scratch", () => {
	const dir = tmpdir();
	const file = path.join(dir, "nested", "config.json");
	const result = updateJsonFile(file, { mode: "off" });
	assert.equal(result.backupPath, undefined);
	assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { mode: "off" });
});

test("writeJsonFileAtomic leaves no tmp file behind", () => {
	const dir = tmpdir();
	const file = path.join(dir, "config.json");
	writeJsonFileAtomic(file, { a: 1 });
	assert.deepEqual(fs.readdirSync(dir), ["config.json"]);
});
