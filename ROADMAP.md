# Prompt Suggestions — replacement roadmap

## Open items (2026-09-13)

Rename to `pi-ghost-text` is committed, the public GitHub remote
`jcv/pi-ghost-text` is pushed, and `assets/social-preview.png` (the `pi.image`
gallery preview and the repo's social card) is live. No demo video: the
`pi.video` field was dropped.

**Token streaming is live-verified** via `scripts/live-suggest.mjs`, which
replays the extension's exact system prompt and message shape against real
models (deepseek-flash, claude-haiku-4-5, kimi-highspeed): both the streaming
and `complete` paths return prefix-anchored, conversation-specific suggestions
in ~600–900ms (kimi ~2s). A quality probe found deepseek-flash is fine for
this; `no-suggestion` outcomes are usually the model legitimately answering
NONE on ambiguous input.

**Debug logging is opt-in** ( `"debug": true` config key, default off): pi's
TUI captures console output into the chat area, so the old stderr `console.warn`
logging was user-visible. Lines now append to
`~/.pi/agent/prompt-suggestions.log`, with an `enabled` marker line written at
config load so an absent log unambiguously means "not wired up".

**Published to npm as `pi-ghost-text@0.1.0`** (verified via `npm view`).

No open items: rename done, GitHub remote live, gallery preview live,
streaming live-verified, debug logging opt-in, npm published.

Goal: turn `extensions/prompt-suggestion.ts` into a full-quality replacement for
`@mrclrchtr/supi-prompt-suggestions`, with more features.

## Context

- **Enabled today:** `npm:@mrclrchtr/supi-prompt-suggestions` (+ `supi-settings`),
  configured to use `deepseek/deepseek-flash` in `~/.pi/agent/supi/config.json`.
- **Candidate:** `extensions/prompt-suggestion.ts` (this repo, not yet installed).
- The candidate is already feature-superior on the core: it does **live mid-typing
  ghost autocomplete** (prefix-anchored, shrink-on-type) in addition to the
  empty-editor "next prompt" suggestion. supi only does the empty-editor case.
  The gap is production quality: persistence, config, feedback, packaging, tests.

## Feature comparison (as of analysis)

| Capability | supi 6.4.0 | candidate |
|---|---|---|
| Suggest when editor empty (after turn) | yes | yes |
| Suggest while typing (debounced) | no | **yes** |
| Ghost shrink-on-type | no | **yes** |
| Context sent to model | last assistant msg only | last 8 msgs × 600 chars |
| Model selection | `/supi-settings` picker | hardcoded regex list |
| Scoped config (global/project) | yes | no |
| Persisted enabled state | yes | no |
| Settings UI | yes | no |
| Generation feedback (spinner/status) | yes | no |
| History survives `/reload` | yes | no |
| Grapheme-safe truncation | yes | no |
| Timeout/abort/stale-guard | yes | yes |
| Debug/telemetry | yes | no |
| Packaging (npm, `pi` manifest) | yes | no |
| Tests | yes | no |
| `/suggest` toggle command | no | **yes** |
| Command/`@file` completion guard | no | **yes** |

## Phases

### Phase 1 — parity (DONE)
Close the persistence/config/feedback/robustness gaps so the candidate is a
drop-in replacement.

- [x] **Config + persistence.** New config file, resolved `defaults ← global ← project`:
  - global: `~/.pi/agent/prompt-suggestions.json`
  - project: `.pi/prompt-suggestions.json`
  - shape: `{ "enabled": true, "model": "auto" }` (`model` is `"auto"` or `"provider/model-id"`).
- [x] **Model picker.** `/suggest-model` opens a `ctx.ui.select` over the scoped
  model set (`ctx.scopedModels`), with an `auto` choice. `auto` keeps the cheap-model
  regex preference list, now searched over the *scoped* set first, falling back to
  `ctx.model`.
- [x] **Persisted toggle.** `/suggest` now flips `enabled` and writes it to the global
  config file (survives restarts).
- [x] **Generation feedback.** A `suggesting…` footer status via `ctx.ui.setStatus`
  while a suggestion is in flight; cleared on settle/stale/error.
- [x] **History re-seed.** On `session_start`, repopulate the editor's UP-arrow
  history from `ctx.sessionManager.getBranch()` so it survives `/reload`.
- [x] **Grapheme-safe truncation.** `Intl.Segmenter` for the suggestion cap and the
  in-render ellipsis truncation (no more split emoji).

### Phase 2 — quality (DONE)
- [x] **Package it.** `package.json` at the repo root with `"pi": { "extensions": ["./src/index.ts"] }`,
  `keywords: ["pi-package"]`, `type: "module"`, and peer deps on
  `@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui`. Verified loading via
  `pi -e ./src/index.ts` (single file) and `pi -e .` (package manifest).
- [x] **Split the monolith into modules** — `src/index.ts` (entrypoint),
  `editor.ts`, `client.ts`, `normalize.ts`, `context.ts`, `model-selection.ts`,
  `config.ts`, `debug.ts`. Pure modules (`normalize`, `model-selection`,
  `client`) use only `import type` from pi so they run under plain Node.
- [x] **Unit tests** for `extractSuggestion`, normalization, width-aware truncation,
  eligibility, `pickAutoModel`, and `classifyResponse`. Run with `npm test`
  (`node --test`, no dependencies). 25 passing.
- [x] **Debug/error observability.** `debug.ts` logs a stable category
  (`timeout` / `error` / `no-suggestion`) to stderr instead of `catch {}`
  swallowing everything. Superseded in-flight requests stay silent by design.
- [x] **Precise cell-width-aware truncation.** `fitSuggestionToWidth` / `truncateToWidth`
  in `normalize.ts` are measure-injected (pure, tested) and use pi-tui's
  `visibleWidth` at runtime, so wide/CJK chars are counted correctly; still
  breaks at a word boundary when possible.

### Phase 3 — exceed (DONE)
- [x] **Explicit modes.** `mode` config (`off` / `after-turn` / `while-typing` /
  `both`) via `/suggest`; both behaviors independently gated. Pure helpers in
  `src/mode.ts` (tested).
- [x] **Adaptive context window.** `contextMessages` + `contextChars` config,
  `/suggest-context` command, `digestMessages` pure core (tested).
- [x] **Multiple candidates.** `candidates` config (1–3); a single call with a
  `---`-delimited multi-alternative prompt; Tab cycles. `parseCandidates` pure (tested).
- [x] **Streaming partial ghost.** `streaming` config (default true): token-by-token
  ghost via `streamSimple` + `getApiKeyAndHeaders`, with a `complete` fallback on
  any streaming failure.
- [x] **Cost/energy guard.** skips while the agent is streaming (`ctx.isIdle()`);
  `maxPerTurn` config caps suggestions per turn (reset on `agent_settled`).
- [x] **Privacy documentation.** `README.md` documents commands, config keys,
  and exactly what is sent vs never sent.

## Handoff / resume notes

- **How to test:** from this directory, `pi -e ./src/index.ts` (quick) or
  `pi -e .` (package manifest). Try `/suggest` (mode picker), `/suggest-model`,
  `/suggest-context`, type >4 chars and wait ~700ms for a ghost, Tab to cycle
  candidates, and confirm UP-arrow history survives `/reload`. Run unit tests with
  `npm test` (or `node --test`).
- **Layout:** `src/` modules + `test/*.test.mjs` + `scripts/live-suggest.mjs`
  (live model harness) + `package.json` (the `pi` package) + `README.md`.
  The old `extensions/prompt-suggestion.ts` monolith was removed.
- **Config keys** (`~/.pi/agent/prompt-suggestions.json`, project override in
  `.pi/prompt-suggestions.json`): `model`, `mode`, `candidates`, `streaming`,
  `contextMessages`, `contextChars`, `maxPerTurn`, `debug` (see README for defaults).
- **Status: swapped in and active.** Removed both `@mrclrchtr/supi-*` packages
  from `~/.pi/agent/settings.json` (and their npm manifest + node_modules +
  orphaned config files), then `pi install /Users/chrisv/Projects/pi-ghost-text`.
  The package is now loaded globally as a local path (`../../Projects/pi-ghost-text`
  relative to `~/.pi/agent`). To run without installing, `pi -e ./src/index.ts`
  still works.
- **Streaming is live-verified** (see Open items). To exercise it again:
  `node scripts/live-suggest.mjs [provider/model-id] [partial]`.
- **Known limitation:** `/suggest`, `/suggest-model`, `/suggest-context` always write
  to the *global* scope. If a project override exists, the global write won't change
  the effective value.
