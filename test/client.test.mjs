import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyResponse } from "../src/client.ts";

const resp = (overrides = {}) => ({
	role: "assistant",
	api: "anthropic-messages",
	provider: "anthropic",
	model: "test",
	usage: {},
	stopReason: "stop",
	timestamp: Date.now(),
	content: [{ type: "text", text: "run the tests" }],
	...overrides,
});

test("classifyResponse extracts visible text", () => {
	assert.deepEqual(classifyResponse(resp()), { ok: true, text: "run the tests" });
});

test("classifyResponse reports a model error", () => {
	const out = classifyResponse(resp({ stopReason: "error", errorMessage: "boom" }));
	assert.equal(out.ok, false);
	assert.equal(out.reason, "error");
	assert.equal(out.message, "boom");
});

test("classifyResponse reports no content", () => {
	assert.deepEqual(classifyResponse(resp({ content: [] })), {
		ok: false,
		reason: "no-content",
	});
});

test("classifyResponse reports no text content", () => {
	assert.deepEqual(classifyResponse(resp({ content: [{ type: "thinking", text: "..." }] })), {
		ok: false,
		reason: "no-text",
	});
});
