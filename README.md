# pi-ghost-text

Ghost-text prompt suggestions for the [pi coding agent](https://github.com/earendil-works/pi) — like Claude Code's inline autocomplete for the prompt box.

As you type (or after the agent finishes and the input is empty), a dimmed prediction of the likely next prompt appears after the cursor. Accept it, cycle alternatives, or keep typing.

## Requirements

- **Interactive TUI mode.** Suggestions are an editor feature and only appear in the interactive terminal (`pi` with no mode flag). They do not run in `-p`/`--print`, `--mode json`, or `--mode rpc`.
- **A model with a configured API key.** With the default `"model": "auto"`, the extension scans the available models for a fast/cheap one, in priority order: `haiku`, then `gpt-*mini`, then `flash`, then `nano`. If none match — or if an explicit `provider/model-id` isn't found — it falls back to the active session model. Set a specific model with `/suggest-model`.

## Install

```bash
pi install npm:pi-ghost-text
```

Remove it:

```bash
pi remove npm:pi-ghost-text
```

## Using it

| Key | Action |
|-----|--------|
| `Tab` | Cycle to the next candidate; accept when it's the last (or only) one |
| `→` (right arrow, cursor at end) | Accept the current suggestion |
| `Esc` | Dismiss the ghost, keeping what you've typed |
| Move the cursor away from the end | Dismiss |
| Keep typing | Shrink the ghost while it still matches, otherwise regenerate |

`Tab` only applies to the ghost when the file/command autocomplete dropdown is **not** open. Accepting inserts the suggestion into the editor for you to edit; press `Enter` to send it.

When `candidates` is `1` (the default), `Tab` simply accepts. Set `candidates` to `2` or `3` to fetch alternatives and cycle them.

## Commands

| Command | What it does |
|---------|--------------|
| `/suggest` | Choose mode: `both`, `while-typing`, `after-turn`, or `off` |
| `/suggest-model` | Pick the suggestion model (or `auto` to prefer a fast, cheap one) |
| `/suggest-context` | Set the context window (messages × chars per message) |
| `/suggest-sampling` | Set reasoning effort, max tokens, and temperature |

## Configuration

Stored as JSON, resolved `defaults ← global ← project`:

- global: `~/.pi/agent/prompt-suggestions.json`
- project: `.pi/prompt-suggestions.json`

```json
{
  "model": "auto",
  "mode": "both",
  "candidates": 1,
  "streaming": true,
  "contextMessages": 8,
  "contextChars": 600,
  "maxPerTurn": 0,
  "debug": false,
  "reasoning": "off",
  "maxTokens": 2048,
  "temperature": 0.3
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `model` | `"auto"` | `"auto"` (prefer a fast, cheap model) or an explicit `provider/model-id` |
| `mode` | `"both"` | `"both"`, `"while-typing"`, `"after-turn"`, or `"off"` |
| `candidates` | `1` | Alternatives to fetch (1–3); `Tab` cycles them |
| `streaming` | `true` | Stream the single suggestion token-by-token (ignored when `candidates > 1`) |
| `contextMessages` | `8` | Recent messages included in the suggestion prompt (`0` = none) |
| `contextChars` | `600` | Chars kept per message |
| `maxPerTurn` | `0` | Max suggestions shown per agent turn (`0` = unlimited) |
| `debug` | `false` | Append diagnostic lines to `~/.pi/agent/prompt-suggestions.log` |
| `reasoning` | `"off"` | Reasoning/thinking effort: `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, or `"max"` |
| `maxTokens` | `2048` | Max tokens per suggestion (1–32768); multiplied by the candidate count when `candidates > 1`. See below. |
| `temperature` | `0.3` | Sampling temperature (0–2) |

### Reasoning models need budget for both

A reasoning model spends `maxTokens` thinking before it writes any text. If the
cap is reached inside that phase the response comes back with an empty text
channel and no ghost is drawn — which looks identical to the extension being
broken. Measured on `nvidia/nemotron-3-nano-30b-a3b`: ~150–200 reasoning tokens
before the first character regardless of effort level.

So `reasoning` other than `"off"` needs a budget above `512`; the extension warns
at session start when the combination is starved. Budget is a cap, not a spend,
so unused tokens are free.

Reasoning also costs latency — the same completion measured ~0.46 s with
`reasoning: "off"` and ~1.2–2.2 s at `"low"`. For ghost text that appears as you
type, `"off"` is usually the better trade.

`mode`, `model`, `contextMessages`, `contextChars`, `reasoning`, `maxTokens`, and `temperature` are settable from the commands above; `candidates`, `streaming`, `maxPerTurn`, and `debug` are JSON-only. Commands write to the **global** scope, so a project override in `.pi/prompt-suggestions.json` takes precedence over a command-set value.

## Privacy

When enabled, the suggestion model receives only:

- the text you have typed so far, and
- the last `contextMessages` user/assistant messages, each trimmed to `contextChars` characters.

It is **never** sent:

- the full conversation transcript,
- tool outputs,
- file contents,
- project or session metadata.

Suggestions are advisory and best-effort; failures are never surfaced in the UI. With `"debug": true` they are logged to `~/.pi/agent/prompt-suggestions.log` with a stable category (`timeout` / `error` / `no-suggestion`).

## Troubleshooting

If no suggestion appears:

1. Confirm the mode is not `off` — run `/suggest`.
2. Confirm the suggestion model has an API key configured (or, for `auto`, that one of the fast/cheap models does). `/suggest-model` shows what's available. An explicit `model` that isn't found silently falls back to the active session model, so check the spelling as `provider/model-id`.
3. **While-typing suggestions** need ≥4 chars of plain text (not starting with `/` or `!`, not an `@file` completion in progress), a ~700ms pause, and the agent must be idle (not mid-response).
4. **After-turn suggestions** only appear when the editor is empty right after the agent settles.
5. If `maxPerTurn` is set, you may have hit the per-turn cap.
6. Set `"debug": true` and check `~/.pi/agent/prompt-suggestions.log` for `[prompt-suggestions]` lines — they state the reason (`timeout`, `error`, `no-suggestion`).
7. If the ghost flakes with streaming enabled, set `"streaming": false` to force the non-streaming path.

## Development

```bash
npm ci --ignore-scripts
npm test   # node --test (requires Node ≥ 23.6)
```

The rendering regression tests use the real `Editor` from the `@earendil-works/pi-tui` peer dependency, pinned by the committed `package-lock.json`.

## Prior art

Inspired by [supi-prompt-suggestions](https://pi.dev/packages/@mrclrchtr/supi-prompt-suggestions?name=supi). This adds inline while-typing autocomplete (prefix-anchored, shrink-on-type), multi-candidate cycling, streaming ghost text, scoped global/project config, and explicit modes on top of the empty-box next-prompt suggestion.
