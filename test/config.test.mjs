import { test } from "node:test";
import assert from "node:assert/strict";
import { afterTurnEnabled, whileTypingEnabled } from "../src/mode.ts";

test("afterTurnEnabled", () => {
	assert.equal(afterTurnEnabled("both"), true);
	assert.equal(afterTurnEnabled("after-turn"), true);
	assert.equal(afterTurnEnabled("while-typing"), false);
	assert.equal(afterTurnEnabled("off"), false);
});

test("whileTypingEnabled", () => {
	assert.equal(whileTypingEnabled("both"), true);
	assert.equal(whileTypingEnabled("while-typing"), true);
	assert.equal(whileTypingEnabled("after-turn"), false);
	assert.equal(whileTypingEnabled("off"), false);
});
