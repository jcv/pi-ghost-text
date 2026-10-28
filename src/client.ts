/**
 * Suggestion model client — prompt and completion options, plus response
 * classification.
 *
 * Only `import type` from pi packages, so `classifyResponse` is testable
 * with plain Node.
 *
 * @module
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";

export const GENERATION_TIMEOUT_MS = 8_000;
/**
 * Output cap per suggestion.
 *
 * Two things set the floor here. A reasoning model spends the budget thinking
 * before it writes anything (nemotron-3-nano-30b-a3b burns ~150-200 tokens even
 * at low effort), and a prompt the user is clearly going to expand can be a
 * short paragraph. 2048 leaves room for both; unused budget costs nothing.
 */
export const MAX_TOKENS = 2048;
export const TEMPERATURE = 0.3;

export const SYSTEM_PROMPT = `You complete prompts in an AI coding assistant's input box, like ghost-text autocomplete.

Given the recent conversation and the text the user has typed so far, predict the full prompt the user is most likely to submit.

Rules:
- Output ONLY the predicted prompt text. No quotes, no explanation, no markdown.
- If partial input is provided, your output MUST begin with that exact text, unchanged.
- Match the length the request implies: usually a single line, but a short paragraph is fine when the user is clearly about to ask for something that needs the detail.
- Be specific to the conversation. Prefer concrete next steps (run the tests, commit, fix the file just discussed) over generic requests.
- Always carry the typed text forward with at least a few more words. Never return the typed text unchanged.
- If there is no confident prediction, output exactly: NONE`;

export type ResponseClass =
	| { ok: true; text: string }
	| { ok: false; reason: "error" | "no-content" | "no-text"; message?: string };

/**
 * Classify a completion response into usable suggestion text or a structured
 * failure reason. Extracts only visible text content.
 */
export function classifyResponse(response: AssistantMessage): ResponseClass {
	if (response.stopReason === "error") {
		return { ok: false, reason: "error", message: response.errorMessage ?? response.stopReason };
	}
	if (!response.content || response.content.length === 0) {
		return { ok: false, reason: "no-content" };
	}
	const text = response.content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("");
	if (!text.trim()) {
		return { ok: false, reason: "no-text" };
	}
	return { ok: true, text };
}

/** System prompt for one suggestion, or for several delimited alternatives. */
export function systemPromptFor(candidates: number): string {
	if (candidates <= 1) return SYSTEM_PROMPT;
	return `${SYSTEM_PROMPT}

Additional instruction: provide ${candidates} clearly DIFFERENT alternatives. Output each alternative with no numbering or bullets, separated by a line containing only "---". Each alternative must independently satisfy all the rules above.`;
}
