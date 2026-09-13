/**
 * Prompt Suggestion - Claude Code-style ghost text in the prompt editor.
 *
 * As you type (or when the agent finishes and the input box is empty), a dimmed
 * suggestion of the likely prompt appears after the cursor.
 *
 * - Tab cycles candidates (or accepts) · Right arrow accepts
 * - Keep typing: the ghost shrinks if it still matches, otherwise it regenerates
 * - Escape / cursor movement away from the end: dismiss
 * - /suggest: choose mode (off / after-turn / while-typing / both)
 * - /suggest-model: pick the model used for suggestions
 * - /suggest-context: set context window (messages + chars per message)
 *
 * Config (resolved defaults <- global <- project):
 *   global:  ~/.pi/agent/prompt-suggestions.json
 *   project: .pi/prompt-suggestions.json
 *
 * Install as a pi package: pi install /path/to/pi-test
 * Quick test: pi -e ./src/index.ts
 *
 * @module
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_CONFIG,
	readConfig,
	writeGlobalConfig,
	type Config,
} from "./config.ts";
import type { SuggestMode } from "./mode.ts";
import { scopedOrAvailable } from "./model-selection.ts";
import { extractTextContent } from "./context.ts";
import { SuggestingEditor } from "./editor.ts";

const MODES: Array<{ label: string; value: SuggestMode }> = [
	{ label: "both (while typing + after turn)", value: "both" },
	{ label: "while-typing (inline autocomplete)", value: "while-typing" },
	{ label: "after-turn (next prompt when empty)", value: "after-turn" },
	{ label: "off", value: "off" },
];

export default function (pi: ExtensionAPI): void {
	let config: Config = DEFAULT_CONFIG;
	let editor: SuggestingEditor | null = null;

	pi.registerCommand("suggest", {
		description: "Choose when prompt suggestions appear",
		handler: async (_args, ctx) => {
			const choice = await ctx.ui.select(
				"Suggestion mode:",
				MODES.map((m) => m.label),
			);
			if (!choice) return;
			const mode = MODES.find((m) => m.label === choice)?.value ?? "off";
			config.mode = mode;
			writeGlobalConfig({ mode });
			if (!whileTypingOrAfterTurn(mode)) editor?.clearGhost();
			ctx.ui.notify(`Prompt suggestions: ${mode}`, "info");
		},
	});

	pi.registerCommand("suggest-model", {
		description: "Choose the model used for prompt suggestions",
		handler: async (_args, ctx) => {
			const pool = scopedOrAvailable(ctx);
			const entries = [
				{ label: "auto (auto-pick a fast, cheap model)", value: "auto" },
				...pool.map((m) => ({ label: `${m.provider}/${m.id}`, value: `${m.provider}/${m.id}` })),
			];
			const choice = await ctx.ui.select("Suggestion model:", entries.map((e) => e.label));
			if (!choice) return;
			const picked = entries.find((e) => e.label === choice);
			const value = picked ? picked.value : "auto";
			config.model = value;
			writeGlobalConfig({ model: value });
			ctx.ui.notify(`Suggestion model: ${value}`, "info");
		},
	});

	pi.registerCommand("suggest-context", {
		description: "Set the conversation context window for suggestions",
		handler: async (_args, ctx) => {
			const messages = await ctx.ui.input(
				"Context: number of recent messages",
				String(config.contextMessages),
			);
			if (messages === undefined) return;
			const chars = await ctx.ui.input(
				"Context: chars kept per message",
				String(config.contextChars),
			);
			if (chars === undefined) return;

			const messagesCount = clampInt(Number(messages), 0, 50, config.contextMessages);
			const charsCount = clampInt(Number(chars), 0, 10_000, config.contextChars);
			config.contextMessages = messagesCount;
			config.contextChars = charsCount;
			writeGlobalConfig({ contextMessages: messagesCount, contextChars: charsCount });
			ctx.ui.notify(`Suggestion context: ${messagesCount} messages × ${charsCount} chars`, "info");
		},
	});

	pi.on("session_start", (_event, ctx) => {
		config = readConfig(ctx.cwd);
		if (ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			editor = new SuggestingEditor(tui, theme, keybindings, ctx, () => config);
			seedHistoryFromSession(editor, ctx);
			return editor;
		});
	});

	// Suggest a next prompt when the agent finishes and the input box is empty.
	pi.on("agent_settled", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		editor?.onAgentSettled();
	});

	pi.on("before_agent_start", () => {
		editor?.clearGhost();
	});

	pi.on("session_shutdown", () => {
		editor?.dispose();
		editor = null;
	});
}

function whileTypingOrAfterTurn(mode: SuggestMode): boolean {
	return mode !== "off";
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Repopulate the editor's UP-arrow history from the session branch so it
 * survives `/reload` (which reinstantiates the editor with empty history).
 */
function seedHistoryFromSession(editor: SuggestingEditor, ctx: ExtensionContext): void {
	const branch = ctx.sessionManager.getBranch();
	for (const entry of branch) {
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (!("role" in msg) || msg.role !== "user") continue;
		const text = extractTextContent(msg.content).trim();
		if (text) editor.addToHistory(text);
	}
}
