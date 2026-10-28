import { test } from "node:test";
import assert from "node:assert/strict";
import {
	clampMaxTokens,
	clampTemperature,
	isReasoningSetting,
	MAX_MAX_TOKENS,
	MAX_TEMPERATURE,
	MIN_MAX_TOKENS,
	MIN_REASONING_BUDGET,
	MIN_TEMPERATURE,
	REASONING_SETTINGS,
	reasoningLevel,
	reasoningStarvedBudget,
} from "../src/sampling.ts";

test("isReasoningSetting accepts every advertised level", () => {
	for (const level of REASONING_SETTINGS) {
		assert.equal(isReasoningSetting(level), true, level);
	}
});

test("isReasoningSetting rejects anything else", () => {
	for (const bad of ["", "LOW", "low ", "none", "nonexistent", 0, null, undefined, {}, []]) {
		assert.equal(isReasoningSetting(bad), false, String(bad));
	}
});

test("reasoningLevel strips off to undefined", () => {
	assert.equal(reasoningLevel("off"), undefined);
	assert.equal(reasoningLevel("low"), "low");
	assert.equal(reasoningLevel("max"), "max");
});

test("clampMaxTokens clamps to range", () => {
	assert.equal(clampMaxTokens(150, 999), 150);
	assert.equal(clampMaxTokens(0, 150), MIN_MAX_TOKENS);
	assert.equal(clampMaxTokens(-5, 150), MIN_MAX_TOKENS);
	assert.equal(clampMaxTokens(1e9, 150), MAX_MAX_TOKENS);
});

test("clampMaxTokens floors fractional budgets", () => {
	assert.equal(clampMaxTokens(150.9, 999), 150);
});

test("clampMaxTokens keeps the fallback for non-numbers", () => {
	for (const bad of ["150", "", null, undefined, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
		assert.equal(clampMaxTokens(bad, 150), 150, String(bad));
	}
});

test("clampTemperature preserves the fractional default", () => {
	// The upstream default is 0.3; an integer clamp would silently zero it.
	assert.equal(clampTemperature(0.3, 0.9), 0.3);
	assert.equal(clampTemperature(0.7, 0.9), 0.7);
});

test("clampTemperature clamps to range", () => {
	assert.equal(clampTemperature(-1, 0.3), MIN_TEMPERATURE);
	assert.equal(clampTemperature(5, 0.3), MAX_TEMPERATURE);
	assert.equal(clampTemperature(0, 0.3), 0);
});

test("clampTemperature keeps the fallback for non-numbers", () => {
	for (const bad of ["0.5", "", null, undefined, {}, [], Number.NaN]) {
		assert.equal(clampTemperature(bad, 0.3), 0.3, String(bad));
	}
});

test("reasoningStarvedBudget flags a budget a reasoning model cannot answer within", () => {
	// The failure this guards: the model spends the cap thinking, returns an
	// empty text channel, and the ghost silently never appears.
	assert.equal(reasoningStarvedBudget("low", 150), true);
	assert.equal(reasoningStarvedBudget("low", MIN_REASONING_BUDGET - 1), true);
	assert.equal(reasoningStarvedBudget("max", 150), true);
});

test("reasoningStarvedBudget is quiet when reasoning is off or the budget is ample", () => {
	assert.equal(reasoningStarvedBudget("off", 150), false);
	assert.equal(reasoningStarvedBudget("low", MIN_REASONING_BUDGET), false);
	assert.equal(reasoningStarvedBudget("low", 600), false);
});
