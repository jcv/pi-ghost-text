import { test } from "node:test";
import assert from "node:assert/strict";
import { digestMessages } from "../src/context.ts";

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
