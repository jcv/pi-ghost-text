/**
 * Conversation context for suggestion prompts.
 *
 * Only `import type` from pi packages, so `digestMessages` is unit-testable
 * with plain Node.
 *
 * @module
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { UserMessage } from "@earendil-works/pi-ai";

export interface ContextWindow {
	messages: number;
	chars: number;
}

const ELLIPSIS = "…";
/** Below this, a head/tail split leaves both ends too short to mean anything. */
const MIN_SPLIT = 24;

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * Clip a message to `max` characters, keeping both ends.
 *
 * A coding agent's reply opens by restating the problem and closes with what it
 * actually did -- the file it changed, the command to run, the next step. Keeping
 * only the head hands the model the problem and withholds the conclusion, so a
 * long message keeps roughly a third at the front and two thirds at the back, with
 * an ellipsis marking the gap. Below `MIN_SPLIT` the split is pointless, so it
 * degrades to a plain head slice.
 *
 * The character budget is exact: the ellipsis counts against it.
 */
export function clipForDigest(text: string, max: number): string {
	if (max <= 0) return "";
	if (text.length <= max) return text;
	if (max <= MIN_SPLIT) return text.slice(0, max);

	const tailChars = Math.ceil(((max - ELLIPSIS.length) * 2) / 3);
	let headChars = max - ELLIPSIS.length - tailChars;

	// Never split a surrogate pair; half a code point renders as a replacement char.
	if (headChars > 0 && isHighSurrogate(text.charCodeAt(headChars - 1))) headChars--;
	let tailStart = text.length - tailChars;
	if (isLowSurrogate(text.charCodeAt(tailStart)) && isHighSurrogate(text.charCodeAt(tailStart - 1))) {
		tailStart++;
	}

	return text.slice(0, headChars) + ELLIPSIS + text.slice(tailStart);
}

export function extractTextContent(
	content: string | Array<{ type: string; text?: string }> | undefined,
): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("\n");
}

/**
 * Build a trimmed digest of the last few user/assistant messages, oldest first.
 * Pure over a session branch's entries so it can be unit-tested.
 */
export function digestMessages(entries: readonly unknown[], opts: ContextWindow): string {
	const parts: string[] = [];
	for (let i = entries.length - 1; i >= 0 && parts.length < opts.messages; i--) {
		const entry = entries[i] as {
			type?: string;
			message?: { role?: string; content?: string | Array<{ type: string; text?: string }> };
		};
		if (!entry || entry.type !== "message") continue;
		const msg = entry.message;
		if (!msg || typeof msg !== "object" || !("role" in msg)) continue;
		if (msg.role !== "user" && msg.role !== "assistant") continue;
		const text = extractTextContent(msg.content).trim();
		if (!text) continue;
		const label = msg.role === "user" ? "User" : "Assistant";
		parts.unshift(`${label}: ${clipForDigest(text, opts.chars)}`);
	}
	return parts.join("\n\n");
}

export function conversationDigest(ctx: ExtensionContext, opts: ContextWindow): string {
	return digestMessages(ctx.sessionManager.getBranch(), opts);
}

export function buildUserMessage(
	ctx: ExtensionContext,
	partial: string,
	opts: ContextWindow,
): UserMessage {
	const digest = conversationDigest(ctx, opts) || "(no conversation yet)";
	const inputSection = partial
		? `Partial input (must be the exact start of your output):\n"""${partial}"""`
		: `The input box is empty. Predict the user's next prompt.`;
	return {
		role: "user",
		content: [
			{
				type: "text",
				text: `Recent conversation (oldest first):\n${digest}\n\n${inputSection}`,
			},
		],
		timestamp: Date.now(),
	};
}
