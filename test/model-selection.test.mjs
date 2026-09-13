import { test } from "node:test";
import assert from "node:assert/strict";
import { pickAutoModel } from "../src/model-selection.ts";

const mk = (id) => ({ id, provider: "p", name: id });

test("pickAutoModel prefers the first matching preference in order", () => {
	const pool = [mk("claude-opus-4-5"), mk("gpt-5.4-mini"), mk("deepseek-flash")];
	// "gpt-.*mini" comes before "flash" in MODEL_PREFERENCES.
	assert.equal(pickAutoModel(pool, undefined).id, "gpt-5.4-mini");
});

test("pickAutoModel matches haiku before later preferences", () => {
	const pool = [mk("gpt-5.4-mini"), mk("claude-haiku-4-5")];
	assert.equal(pickAutoModel(pool, undefined).id, "claude-haiku-4-5");
});

test("pickAutoModel falls back to the provided model", () => {
	const fallback = mk("k3");
	assert.equal(pickAutoModel([mk("big-model")], fallback), fallback);
});

test("pickAutoModel returns undefined when nothing matches and no fallback", () => {
	assert.equal(pickAutoModel([mk("big-model")], undefined), undefined);
});
