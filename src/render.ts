/** Overlay ghost text on the focused editor's rendered cursor line. */
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import { fitSuggestionToWidth } from "./normalize.ts";

const SGR_RUN = /^(?:\x1b\[[0-9;:]*m)*/;
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
	// reset spelling the theme uses to close the inverse-video cursor works.
	pos += SGR_RUN.exec(line.slice(pos))![0].length;
	const glyph = graphemes.segment(line.slice(pos))[Symbol.iterator]().next().value?.segment;
	if (!glyph) return lines;
	pos += glyph.length;
	pos += SGR_RUN.exec(line.slice(pos))![0].length;

	// Only overwrite plain trailing padding; anything else after the cursor
	// (a border, styled content) means the layout isn't what we expect.
	const pad = /^((?:\x1b\[[0-9;:]*m)*)( *)((?:\x1b\[[0-9;:]*m)*)$/.exec(line.slice(pos));
	if (!pad) return lines;
	const [, lead, spaces, trail] = pad;

	const room = Math.min(spaces!.length, width - visibleWidth(line.slice(0, pos))) - 1;
	if (room < 6) return lines;

	const shown = fitSuggestionToWidth(ghost.replace(/\s+/g, " "), room, visibleWidth);
	const shownWidth = visibleWidth(shown);
	lines[idx] = line.slice(0, pos) + dim(shown) + lead + " ".repeat(spaces!.length - shownWidth) + trail;
	return lines;
}
