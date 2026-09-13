/**
 * Suggestion modes — pure, no pi imports (unit-testable).
 *
 * @module
 */

export type SuggestMode = "off" | "after-turn" | "while-typing" | "both";

export function afterTurnEnabled(mode: SuggestMode): boolean {
	return mode === "after-turn" || mode === "both";
}

export function whileTypingEnabled(mode: SuggestMode): boolean {
	return mode === "while-typing" || mode === "both";
}

export function isMode(value: unknown): value is SuggestMode {
	return value === "off" || value === "after-turn" || value === "while-typing" || value === "both";
}
