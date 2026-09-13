import { test } from "node:test";
import assert from "node:assert/strict";
import {
	countGraphemes,
	extractSuggestion,
	fitSuggestionToWidth,
	isEligible,
	normalizeSuggestionText,
	parseCandidates,
	splitGraphemes,
	truncateGraphemes,
	truncateToWidth,
} from "../src/normalize.ts";

// ── Graphemes ──────────────────────────────────────────────────────────────

test("splitGraphemes keeps multi-codepoint sequences together", () => {
	assert.deepEqual(splitGraphemes("a👨‍👩‍👧‍👦b"), ["a", "👨‍👩‍👧‍👦", "b"]);
});

test("countGraphemes counts clusters, not UTF-16 code units", () => {
	const skinToneThumbsUp = "👍🏽"; // U+1F44D U+1F3FD = 1 grapheme, 4 code units
	assert.equal(skinToneThumbsUp.length, 4);
	assert.equal(countGraphemes(skinToneThumbsUp), 1);
});

test("truncateGraphemes never splits a grapheme", () => {
	assert.equal(truncateGraphemes("😀😀😀", 2), "😀😀");
	assert.equal(truncateGraphemes("abc", 10), "abc");
});

// ── Width-aware truncation ─────────────────────────────────────────────────

const codePoints = (s) => [...s].length;

test("truncateToWidth fits text and appends ellipsis", () => {
	assert.equal(truncateToWidth("hello world", 8, codePoints), "hello w…");
});

test("truncateToWidth leaves short text unchanged", () => {
	assert.equal(truncateToWidth("abc", 10, codePoints), "abc");
});

test("truncateToWidth respects wide characters via the measure function", () => {
	// CJK ideographs are 2 columns each.
	const wide = (s) => [...s].reduce((w, ch) => w + (/[\u2E80-\u9FFF]/.test(ch) ? 2 : 1), 0);
	assert.equal(truncateToWidth("你好世界", 5, wide), "你好…"); // 2 chars = 4 cols + ellipsis = 5
});

test("fitSuggestionToWidth breaks at a word boundary when cut is mid-word", () => {
	// Truncation to 18 cols would land inside "deployment"; break at the prior
	// space (position 14 > minWordKeep 10) instead of showing "long de…".
	assert.equal(
		fitSuggestionToWidth("this is a long deployment target", 18, codePoints),
		"this is a long…",
	);
});

test("fitSuggestionToWidth keeps mid-width cuts when no boundary is worth keeping", () => {
	assert.equal(fitSuggestionToWidth("abcdefghij klm", 8, codePoints), "abcdefg…");
});

// ── Normalization & extraction ─────────────────────────────────────────────

test("normalizeSuggestionText strips wrapping quotes", () => {
	assert.equal(normalizeSuggestionText('"run the tests"'), "run the tests");
	assert.equal(normalizeSuggestionText("`npm install`"), "npm install");
});

test("normalizeSuggestionText rejects the NONE sentinel, quoted or not", () => {
	assert.equal(normalizeSuggestionText("NONE"), null);
	assert.equal(normalizeSuggestionText("none"), null);
	assert.equal(normalizeSuggestionText('"NONE"'), null);
});

test("normalizeSuggestionText rejects empty and whitespace-only", () => {
	assert.equal(normalizeSuggestionText("   "), null);
	assert.equal(normalizeSuggestionText(""), null);
});

test("extractSuggestion requires the partial prefix when given", () => {
	assert.equal(extractSuggestion("run the tests", "run the"), "run the tests");
	assert.equal(extractSuggestion("run the tests", "fix"), null);
});

test("extractSuggestion rejects a suggestion that adds nothing to the partial", () => {
	assert.equal(extractSuggestion("run", "run"), null);
});

test("extractSuggestion works with an empty partial", () => {
	assert.equal(extractSuggestion("commit the fix", ""), "commit the fix");
});

// ── Eligibility ────────────────────────────────────────────────────────────

test("isEligible skips commands and in-progress @file completion", () => {
	assert.equal(isEligible("/help", false), false);
	assert.equal(isEligible("!ls", false), false);
	assert.equal(isEligible("fix @foo", false), false);
});

test("isEligible handles empty input by allowEmpty", () => {
	assert.equal(isEligible("", true), true);
	assert.equal(isEligible("", false), false);
	assert.equal(isEligible("   ", false), false);
});

test("isEligible requires at least MIN_CHARS for non-empty input", () => {
	assert.equal(isEligible("ab", false), false);
	assert.equal(isEligible("abcd", false), true);
});

// ── Multi-candidate parsing ────────────────────────────────────────────────

test("parseCandidates splits on a --- separator line", () => {
	assert.deepEqual(parseCandidates("run the tests\n---\ncommit the fix", 3), [
		"run the tests",
		"commit the fix",
	]);
});

test("parseCandidates tolerates surrounding whitespace and blanks", () => {
	assert.deepEqual(parseCandidates("  one  \n\n --- \n\n two ", 3), ["one", "two"]);
});

test("parseCandidates caps the number of candidates", () => {
	assert.deepEqual(parseCandidates("a\n---\nb\n---\nc", 2), ["a", "b"]);
});

test("parseCandidates returns a single candidate when no separator", () => {
	assert.deepEqual(parseCandidates("just one suggestion", 3), ["just one suggestion"]);
});
