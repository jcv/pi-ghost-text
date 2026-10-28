/** Overlay ghost text on the focused editor's rendered cursor line. */
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import { fitSuggestionToWidth } from "./normalize.ts";

/**
 * One zero-width decoration: an SGR sequence or an APC string.
 *
 * pi-tui >=1.4 wraps the cell drawn as the hardware cursor in zero-width APC
 * markers (`ESC _ pi:fc BEL` ... `ESC _ pi:/fc BEL`) and only resolves them to
 * inverse video later, in `resolveFakeCursors()`. Older versions emitted that
 * cursor as plain `ESC[7m ... ESC[0m`. Both spellings have to be skippable
 * here, or the padding check below fails and the ghost is never drawn.
 */
const DECOR = String.raw`(?:\x1b\[[0-9;:]*m|\x1b_[^\x07]*\x07)`;
const DECOR_RUN = new RegExp(`^${DECOR}*`);
/**
 * Trailing run of blank cells, with whatever chrome the frame drew after it.
 *
 * The suffix matters: pi-pretty-tui monkey-patches `CustomEditor.prototype.render`
 * to re-render at `width - 2` and wrap every line in `│ ... │`. Requiring the rest
 * of the row to be spaces alone made the check fail on that right-hand border, so
 * the ghost was silently dropped with a styled editor frame in use.
 */
const PADDING = new RegExp(`^(${DECOR}*)( *)(${DECOR}*)(.*)$`);
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** True when the cursor sits after the last character of the last logical line. */
export function isCursorAtEnd(lines: readonly string[], cursor: { line: number; col: number }): boolean {
	return cursor.line === lines.length - 1 && cursor.col >= (lines[lines.length - 1] ?? "").length;
}

export function renderGhostText(
	lines: string[],
	width: number,
	ghost: string | null,
	cursorAtEnd: boolean,
	dim: (text: string) => string,
): string[] {
	if (!ghost || !cursorAtEnd) return lines;

	// The focused editor emits CURSOR_MARKER right before the fake cursor.
	// Inserting the ghost after the cursor keeps this independent of the
	// editor's internal wrap/scroll layout.
	const idx = lines.findIndex((l) => l.includes(CURSOR_MARKER));
	if (idx === -1) return lines;

	const line = lines[idx]!;
	let pos = line.indexOf(CURSOR_MARKER) + CURSOR_MARKER.length;

	// Skip the cursor cell as styling + one grapheme + styling, so any SGR
	// reset spelling the theme uses to close the inverse-video cursor works,
	// and so do pi-tui's APC fake-cursor markers.
	pos += DECOR_RUN.exec(line.slice(pos))![0].length;
	const glyph = graphemes.segment(line.slice(pos))[Symbol.iterator]().next().value?.segment;
	if (!glyph) return lines;
	pos += glyph.length;
	pos += DECOR_RUN.exec(line.slice(pos))![0].length;

	// Only overwrite plain trailing padding. A suffix after it is chrome from a
	// framing extension and is preserved verbatim, with its width reserved so the
	// ghost can never overdraw the frame.
	const pad = PADDING.exec(line.slice(pos));
	if (!pad) return lines;
	const [, lead, spaces, trail, suffix] = pad;
	if (suffix!.includes(CURSOR_MARKER)) return lines; // not the layout we think it is

	const reserved = visibleWidth(suffix!);
	const room =
		Math.min(spaces!.length, width - visibleWidth(line.slice(0, pos)) - reserved) - 1;
	if (room < 6) return lines;

	const shown = fitSuggestionToWidth(ghost.replace(/\s+/g, " "), room, visibleWidth);
	const shownWidth = visibleWidth(shown);
	lines[idx] =
		line.slice(0, pos) +
		dim(shown) +
		lead +
		" ".repeat(spaces!.length - shownWidth) +
		trail +
		suffix!;
	return lines;
}
