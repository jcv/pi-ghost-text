/**
 * Live harness: exercise the real suggestion pipeline against a real model.
 *
 * Usage:
 *   node scripts/live-suggest.mjs [provider/model-id] [partial text]
 *
 * Defaults: deepseek/deepseek-flash, partial "comm".
 *
 * Runs both generation paths the extension uses (streaming, then the
 * non-streaming complete fallback) with the extension's actual system prompt
 * and message shape, then prints the raw model output, timing, and what
 * extractSuggestion() would do with it. Dev tool only; not shipped.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SYSTEM_PROMPT, MAX_TOKENS, TEMPERATURE, GENERATION_TIMEOUT_MS } from "../src/client.ts";
import { extractSuggestion } from "../src/normalize.ts";

const PI_AI = "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai";
const { streamSimple, complete } = await import(`${PI_AI}/dist/compat.js`);

const modelArg = process.argv[2] ?? "deepseek/deepseek-flash";
const partial = process.argv[3] ?? "comm";
const [provider, modelId] = modelArg.split("/");

const store = JSON.parse(
	fs.readFileSync(path.join(os.homedir(), ".pi/agent/models-store.json"), "utf8"),
);
const model = store[provider]?.models?.find((m) => m.id === modelId);
if (!model) {
	console.error(`model ${modelArg} not found in models-store.json`);
	process.exit(1);
}

const authEntry = JSON.parse(
	fs.readFileSync(path.join(os.homedir(), ".pi/agent/auth.json"), "utf8"),
)[provider];
if (!authEntry) {
	console.error(`no auth for provider ${provider} in auth.json`);
	process.exit(1);
}
// api_key entries pass the key; oauth entries pass the access token as Bearer.
const auth = authEntry.type === "api_key"
	? { apiKey: authEntry.key, headers: undefined }
	: { apiKey: "", headers: { Authorization: `Bearer ${authEntry.access}` } };

// Same message shape as buildUserMessage(), with a canned conversation.
const digest = [
	"User: the ghost text extension's debug logging was leaking into the pi UI",
	"Assistant: Fixed — debug output is now opt-in via a `debug` config key and appends to ~/.pi/agent/prompt-suggestions.log instead of stderr, which the TUI was capturing.",
	"User: set debug to true in the config",
	"Assistant: Done. Reload pi and check the log for the enabled marker.",
].join("\n\n");
const inputSection = partial
	? `Partial input (must be the exact start of your output):\n"""${partial}"""`
	: "The input box is empty. Predict the user's next prompt.";
const text = `Recent conversation (oldest first):\n${digest}\n\n${inputSection}`;

const messages = [{ role: "user", content: [{ type: "text", text }], timestamp: Date.now() }];

console.log(`model: ${modelArg} (api=${model.api}, reasoning=${model.reasoning})`);
console.log(`partial input: ${JSON.stringify(partial)}\n`);

// ── Path 1: streaming (what the extension uses by default) ────────────────
{
	const t0 = performance.now();
	let acc = "";
	let deltas = 0;
	let firstDeltaMs = null;
	const ac = new AbortController();
	try {
		const stream = streamSimple(model, { systemPrompt: SYSTEM_PROMPT, messages }, {
			apiKey: auth.apiKey,
			headers: auth.headers,
			signal: ac.signal,
			maxTokens: MAX_TOKENS,
			temperature: TEMPERATURE,
			timeoutMs: GENERATION_TIMEOUT_MS,
		});
		for await (const event of stream) {
			if (event.type === "text_delta") {
				if (firstDeltaMs === null) firstDeltaMs = performance.now() - t0;
				deltas++;
				acc += event.delta;
			} else if (event.type === "text_end") {
				acc = event.content;
			} else if (event.type === "error") {
				throw new Error(event.error?.errorMessage ?? event.reason ?? "stream error");
			}
		}
		const ms = Math.round(performance.now() - t0);
		console.log(`── streaming: ${ms}ms total, first delta ${firstDeltaMs === null ? "never" : Math.round(firstDeltaMs) + "ms"}, ${deltas} deltas`);
		console.log(`raw: ${JSON.stringify(acc)}`);
		console.log(`extractSuggestion → ${JSON.stringify(extractSuggestion(acc, partial))}\n`);
	} catch (err) {
		console.log(`── streaming FAILED after ${Math.round(performance.now() - t0)}ms: ${err.message}`);
		console.log("(the extension would fall back to complete here)\n");
	}
}

// ── Path 2: complete (the non-streaming fallback) ─────────────────────────
{
	const t0 = performance.now();
	const ac = new AbortController();
	try {
		const response = await complete(model, { systemPrompt: SYSTEM_PROMPT, messages }, {
			apiKey: auth.apiKey,
			headers: auth.headers,
			signal: ac.signal,
			maxTokens: MAX_TOKENS,
			temperature: TEMPERATURE,
			timeoutMs: GENERATION_TIMEOUT_MS,
		});
		const ms = Math.round(performance.now() - t0);
		const textOut = (response.content ?? [])
			.filter((c) => c.type === "text")
			.map((c) => c.text ?? "")
			.join("");
		console.log(`── complete: ${ms}ms, stopReason=${response.stopReason}`);
		console.log(`raw: ${JSON.stringify(textOut)}`);
		console.log(`extractSuggestion → ${JSON.stringify(extractSuggestion(textOut, partial))}`);
	} catch (err) {
		console.log(`── complete FAILED after ${Math.round(performance.now() - t0)}ms: ${err.message}`);
	}
}
