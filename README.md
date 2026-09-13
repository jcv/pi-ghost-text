# pi-ghost-text

Ghost-text prompt suggestions for the [pi coding agent](https://github.com/earendil-works/pi) — like Claude Code's inline autocomplete for the prompt box.

As you type (or after the agent finishes and the input is empty), a dimmed prediction of the likely next prompt appears after the cursor. Accept it, cycle alternatives, or keep typing.

## Requirements

- **Interactive TUI mode.** Suggestions are an editor feature and only appear in the interactive terminal (`pi` with no mode flag). They do not run in `-p`/`--print`, `--mode json`, or `--mode rpc`.
- **A model with a configured API key.** With the default `"model": "auto"`, the extension picks the first available of a fast/cheap set (models matching `haiku`, `gpt-*-mini`, `flash`, or `nano`); otherwise it falls back to the active session model. Set a specific model with `/suggest-model`.

## Install

```bash
pi install /path/to/pi-ghost-text
```

Try it without installing:

```bash
pi -e /path/to/pi-ghost-text/src/index.ts
```

Remove it:

```bash
pi remove /path/to/pi-ghost-text
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
  "maxPerTurn": 0
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

`mode`, `model`, `contextMessages`, and `contextChars` are settable from the commands above; `candidates`, `streaming`, and `maxPerTurn` are JSON-only. Commands write to the **global** scope, so a project override in `.pi/prompt-suggestions.json` takes precedence over a command-set value.

## Privacy

When enabled, the suggestion model receives only:

- the text you have typed so far, and
- the last `contextMessages` user/assistant messages, each trimmed to `contextChars` characters.

It is **never** sent:

- the full conversation transcript,
- tool outputs,
- file contents,
- project or session metadata.

Suggestions are advisory and best-effort; failures are logged to stderr with a stable category (`timeout` / `error` / `no-suggestion`) rather than surfaced.

## Troubleshooting

If no suggestion appears:

1. Confirm the mode is not `off` — run `/suggest`.
2. Confirm the suggestion model has an API key configured (or, for `auto`, that one of the fast/cheap models does). `/suggest-model` shows what's available.
3. **While-typing suggestions** need ≥4 chars of plain text (not starting with `/` or `!`, not an `@file` completion in progress), a ~700ms pause, and the agent must be idle (not mid-response).
4. **After-turn suggestions** only appear when the editor is empty right after the agent settles.
5. If `maxPerTurn` is set, you may have hit the per-turn cap.
6. Check stderr for `[prompt-suggestions]` lines — they state the reason (`timeout`, `error`, `no-suggestion`).
7. If the ghost flakes with streaming enabled, set `"streaming": false` to force the non-streaming path.

## Development

```bash
npm test   # node --test, no dependencies (requires Node ≥ 23.6)
```
