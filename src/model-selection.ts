/**
 * Suggestion model resolution.
 *
 * Only `import type` from pi packages, so the pure helpers here are
 * unit-testable with plain Node.
 *
 * @module
 */

import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Prefer a fast, cheap model for suggestions. */
export const MODEL_PREFERENCES = [/haiku/i, /gpt-.*mini/i, /flash/i, /nano/i];

/**
 * Pick the first pool model matching a preference pattern, else the fallback.
 */
export function pickAutoModel(
	pool: Model<any>[],
	fallback: Model<any> | undefined,
): Model<any> | undefined {
	for (const pattern of MODEL_PREFERENCES) {
		const match = pool.find((m) => pattern.test(m.id));
		if (match) return match;
	}
	return fallback;
}

/** Scoped models when scoping is configured, else every available model. */
export function scopedOrAvailable(ctx: ExtensionContext): Model<any>[] {
	const scoped = ctx.scopedModels.map((s) => s.model);
	return scoped.length > 0 ? scoped : ctx.modelRegistry.getAvailable();
}

export function resolveSuggestionModel(
	ctx: ExtensionContext,
	modelSetting: string,
): Model<any> | undefined {
	const pool = scopedOrAvailable(ctx);
	if (modelSetting === "auto") return pickAutoModel(pool, ctx.model);

	const match = pool.find((m) => `${m.provider}/${m.id}` === modelSetting);
	return match ?? ctx.model;
}
