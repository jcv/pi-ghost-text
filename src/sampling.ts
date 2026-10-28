/**
 * Sampling and reasoning knobs for suggestion requests.
 *
 * Deliberately free of pi imports so the parsing and clamping helpers stay
 * unit-testable with plain Node (see `test/sampling.test.mjs`).
 *
 * @module
 */

/**
 * Mirrors pi-ai's `ThinkingLevel`, plus `"off"` to send no reasoning directive
 * at all. `"off"` is the default so behavior matches upstream until a host opts
 * in.
 */
export type ReasoningSetting = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export const REASONING_SETTINGS: readonly ReasoningSetting[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
];

export const MIN_MAX_TOKENS = 1;
export const MAX_MAX_TOKENS = 32_768;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 2;

export function isReasoningSetting(value: unknown): value is ReasoningSetting {
	return typeof value === "string" && (REASONING_SETTINGS as readonly string[]).includes(value);
}

/**
 * Integer token budget, clamped to a sane range.
 *
 * Anything non-numeric or non-finite keeps `fallback`, so a bad config value
 * can never produce a zero-token or absurd-budget request.
 */
export function clampMaxTokens(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, Math.floor(value)));
}

/**
 * Fractional temperature, clamped to `[0, 2]`.
 *
 * Fractional matters: the upstream default is `0.3`, so this must not go
 * through an integer clamp.
 */
export function clampTemperature(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, value));
}

/** The reasoning level to send to pi-ai, or `undefined` when reasoning is off. */
export function reasoningLevel(
	setting: ReasoningSetting,
): Exclude<ReasoningSetting, "off"> | undefined {
	return setting === "off" ? undefined : setting;
}

/**
 * Token budget below which a reasoning model cannot produce any visible text.
 *
 * A reasoning model spends the budget thinking first; if the cap is reached
 * inside that phase the response returns with an empty text channel, which
 * looks exactly like "the extension isn't working".
 */
export const MIN_REASONING_BUDGET = 512;

/** True when reasoning is enabled with too little budget left for actual text. */
export function reasoningStarvedBudget(
	setting: ReasoningSetting,
	maxTokens: number,
): boolean {
	return setting !== "off" && maxTokens < MIN_REASONING_BUDGET;
}
