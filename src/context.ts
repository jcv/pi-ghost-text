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
		parts.unshift(`${label}: ${text.slice(0, opts.chars)}`);
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
