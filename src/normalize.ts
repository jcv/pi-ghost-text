/**
 * Pure text helpers for suggestion extraction and truncation.
 *
 * No pi imports — this module is unit-testable with plain Node.
 *
 * @module
 */

export const MAX_SUGGESTION_GRAPHEMES = 300;
export const MIN_CHARS = 4;

const NO_SUGGESTION = /^NONE$/i;

// ── Grapheme helpers ───────────────────────────────────────────────────────

export function splitGraphemes(text: string): string[] {
	const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
	return Array.from(segmenter.segment(text), (segment) => segment.segment);
}

export function countGraphemes(text: string): number {
	return splitGraphemes(text).length;
}

/** Truncate to at most `max` grapheme clusters without splitting any. */
export function truncateGraphemes(text: string, max: number): string {
	const graphemes = splitGraphemes(text);
	if (graphemes.length <= max) return text;
	return graphemes.slice(0, max).join("").trimEnd();
}

// ── Width-aware truncation ─────────────────────────────────────────────────

/**
 * Truncate to fit a visible-width budget, appending an ellipsis when cut.
 *
 * Widths are measured by the caller-supplied `measure` function so this stays
 * pure and testable; the editor passes pi-tui's `visibleWidth`, which counts
 * terminal columns (wide CJK chars = 2, combining marks = 0).
 */
export function truncateToWidth(
	text: string,
	maxWidth: number,
	measure: (s: string) => number,
	ellipsis = "…",
): string {
	if (measure(text) <= maxWidth) return text;

	const graphemes = splitGraphemes(text);
	let out = "";
	for (const g of graphemes) {
		if (measure(out + g) + measure(ellipsis) > maxWidth) break;
		out += g;
	}
	return `${out.trimEnd()}${ellipsis}`;
}

/**
 * Truncate a suggestion to fit `maxWidth`, preferring to break on a word
 * boundary when the cut would otherwise happen mid-word (beyond `minWordKeep`).
 */
export function fitSuggestionToWidth(
	text: string,
	maxWidth: number,
	measure: (s: string) => number,
	minWordKeep = 10,
): string {
	if (measure(text) <= maxWidth) return text;

	const truncated = truncateToWidth(text, maxWidth, measure);
	const content = truncated.endsWith("…") ? truncated.slice(0, -1) : truncated;
	const lastSpace = content.lastIndexOf(" ");
	if (lastSpace > minWordKeep) {
		return `${content.slice(0, lastSpace).trimEnd()}…`;
	}
	return truncated;
}

// ── Normalization & extraction ─────────────────────────────────────────────

/**
 * Normalize raw model output into a suggestion, or null when unusable.
 *
 * Trims, rejects the NONE sentinel, strips wrapping quotes/backticks, and
 * applies the grapheme safety cap.
 */
export function normalizeSuggestionText(text: string): string | null {
	let normalized = text.trim();
	if (!normalized || NO_SUGGESTION.test(normalized)) return null;

	normalized = normalized.replace(/^["'`]+|["'`]+$/g, "").trim();
	if (!normalized || NO_SUGGESTION.test(normalized)) return null;

	if (countGraphemes(normalized) > MAX_SUGGESTION_GRAPHEMES) return null;
	return normalized;
}

/**
 * Extract a suggestion from raw model text, validating the partial-input
 * prefix contract. Returns null when there is no usable suggestion.
 */
export function extractSuggestion(rawText: string, partial: string): string | null {
	const text = normalizeSuggestionText(rawText);
	if (!text) return null;

	if (partial) {
		if (!text.startsWith(partial)) return null;
		if (!text.slice(partial.length).trim()) return null;
	}
	return text;
}

/** Whether the current editor text is eligible for a suggestion. */
export function isEligible(text: string, allowEmpty: boolean): boolean {
	if (text.startsWith("/") || text.startsWith("!")) return false; // commands
	if (/@[^\s]*$/.test(text)) return false; // @file completion in progress
	if (text.trim().length === 0) return allowEmpty;
	return text.length >= MIN_CHARS;
}

// ── Multi-candidate parsing ────────────────────────────────────────────────

const CANDIDATE_SEPARATOR = /^\s*---\s*$/m;

/** Split a multi-alternative model response into up to `count` raw candidates. */
export function parseCandidates(rawText: string, count: number): string[] {
	return rawText
		.split(CANDIDATE_SEPARATOR)
		.map((c) => c.trim())
		.filter((c) => c.length > 0)
		.slice(0, count);
}
