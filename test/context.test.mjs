import { test } from "node:test";
import assert from "node:assert/strict";
import { clipForDigest, digestMessages } from "../src/context.ts";

/** True when the string contains a surrogate code unit without its partner. */
function hasLoneSurrogate(value) {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(i + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
			i++;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return true;
		}
	}
	return false;
}

const entry = (role, text) => ({ type: "message", message: { role, content: [{ type: "text", text }] } });

test("digestMessages returns oldest-first labels and truncates per message", () => {
	const entries = [
		entry("user", "first question"),
		entry("assistant", "first answer"),
		entry("user", "second question"),
	];
	const out = digestMessages(entries, { messages: 8, chars: 600 });
	assert.equal(out, "User: first question\n\nAssistant: first answer\n\nUser: second question");
});

test("digestMessages limits the number of messages", () => {
	const entries = [entry("user", "one"), entry("assistant", "two"), entry("user", "three")];
	assert.equal(digestMessages(entries, { messages: 2, chars: 600 }), "Assistant: two\n\nUser: three");
});

test("digestMessages caps chars per message", () => {
	const entries = [entry("user", "abcdefghij")];
	assert.equal(digestMessages(entries, { messages: 8, chars: 3 }), "User: abc");
});

test("digestMessages skips non-message entries and empty text", () => {
	const entries = [
		{ type: "toolResult", toolCallId: "x" },
		entry("user", "   "),
		entry("user", "real"),
	];
	assert.equal(digestMessages(entries, { messages: 8, chars: 600 }), "User: real");
});

test("digestMessages returns empty string when messages is 0", () => {
	const entries = [entry("user", "hello")];
	assert.equal(digestMessages(entries, { messages: 0, chars: 600 }), "");
});

// ── Head + tail clipping ──────────────────────────────────────────────────

test("clipForDigest leaves short text untouched", () => {
	assert.equal(clipForDigest("short", 600), "short");
	assert.equal(clipForDigest("exactly ten", 11), "exactly ten");
});

test("clipForDigest keeps both ends of a long message", () => {
	const text = `OPENING:${"m".repeat(2000)}:CLOSING`;
	const out = clipForDigest(text, 600);
	assert(out.startsWith("OPENING:"), "keeps the opening framing");
	assert(out.endsWith(":CLOSING"), "keeps the conclusion");
	assert(out.includes("…"), "marks the elision");
});

test("clipForDigest spends the budget exactly, ellipsis included", () => {
	for (const max of [25, 100, 600, 1500]) {
		const out = clipForDigest("x".repeat(5000), max);
		assert.equal(out.length, max, `budget ${max}`);
	}
});

test("clipForDigest gives the tail the larger share", () => {
	// A coding agent concludes at the end, so two thirds belong to the tail.
	const text = `HEAD${"-".repeat(4000)}TAIL`;
	const out = clipForDigest(text, 600);
	const [head, tail] = out.split("…");
	assert(tail.length > head.length, `tail ${tail.length} > head ${head.length}`);
});

test("clipForDigest falls back to a head slice when the budget is tiny", () => {
	// Splitting 20 characters leaves neither end meaningful.
	assert.equal(clipForDigest("abcdefghijklmnopqrstuvwxyz", 20), "abcdefghijklmnopqrst");
	assert.equal(clipForDigest("abcdefghij", 3), "abc");
});

test("clipForDigest never splits a surrogate pair", () => {
	const text = "😀".repeat(500) + "end";
	for (const max of [25, 40, 101, 600]) {
		assert.equal(hasLoneSurrogate(clipForDigest(text, max)), false, `budget ${max}`);
	}
});

test("digestMessages applies head+tail clipping per message", () => {
	const entries = [entry("assistant", `Assisted:${"a".repeat(2000)}:DONE`) ];
	const out = digestMessages(entries, { messages: 8, chars: 600 });
	assert(out.startsWith("Assistant: Assisted:"));
	assert(out.endsWith(":DONE"));
	assert(out.includes("…"));
	assert(out.length <= "Assistant: ".length + 600);
});
