/** Overlay ghost text on the focused editor's rendered cursor line. */
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import { fitSuggestionToWidth } from "./normalize.ts";

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
	const markerPos = line.indexOf(CURSOR_MARKER);
	let pos = markerPos + CURSOR_MARKER.length;

	// Skip over the inverse-video cursor glyph that follows the marker.
	const rest = line.slice(pos);
	if (rest.startsWith("\x1b[7m")) {
		const end = /\x1b\[(?:0|27)m/.exec(rest);
		if (!end) return lines;
		pos += end.index + end[0].length;
	}

	const before = line.slice(0, pos);
	const after = line.slice(pos);

	const room = width - visibleWidth(before) - 1;
	if (room < 6) return lines;

	const shown = fitSuggestionToWidth(ghost.replace(/\s+/g, " "), room, visibleWidth);

	// Replace an equal amount of trailing padding so the line stays within width.
	const shownWidth = visibleWidth(shown);
	lines[idx] = before + dim(shown) + after.slice(shownWidth);
	return lines;
}
