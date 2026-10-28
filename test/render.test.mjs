import { test } from "node:test";
import assert from "node:assert/strict";
import { CURSOR_MARKER, Editor, visibleWidth } from "@earendil-works/pi-tui";
import { isCursorAtEnd, renderGhostText } from "../src/render.ts";

const dim = (text) => `\x1b[2m${text}\x1b[22m`;

// pi-tui >=1.4 draws the hardware cursor inside zero-width APC markers
// (`ESC _ pi:fc BEL` ... `ESC _ pi:/fc BEL`) and resolves them to inverse video
// later; older versions wrote the SGR spelling inline. Detect whichever the
// installed pi-tui emits so these assertions track the real host rather than a
// pinned version.
function closedCursor(line) {
	const at = line.indexOf(CURSOR_MARKER);
	if (at === -1) return null;
	const rest = line.slice(at + CURSOR_MARKER.length);
	const apc = /^\x1b_pi:fc\x07[\s\S]*?\x1b_pi:\/fc\x07/.exec(rest);
	if (apc) return CURSOR_MARKER + apc[0];
	const sgr = /^\x1b\[7m[\s\S]*?\x1b\[(?:0|27|)m/.exec(rest);
	if (sgr) return CURSOR_MARKER + sgr[0];
	return null;
}

// Synthetic rows independent of the Editor harness.
const row = (cursorClose, tail = " ".repeat(20)) => `abcd${CURSOR_MARKER}\x1b[7m ${cursorClose}${tail}`;

// Minimal TUI stub covering what Editor.render reads in the pi-tui version
// pinned by package-lock.json. The synthetic-line tests below don't depend on it.
function createEditor(text, focused = true) {
	const editor = new Editor(
		{ terminal: { rows: 24 }, requestRender() {} },
		{ borderColor: (text) => text },
	);
	editor.setText(text);
	editor.focused = focused;
	return editor;
}

test("ghost text renders after Pi's reset cursor without treating padding as content", () => {
	const editor = createEditor("abcd");
	const lines = editor.render(40);
	const original = [...lines];
	const cursor = closedCursor(lines[1]);
	assert.notEqual(cursor, null, "editor emits a closed fake cursor after CURSOR_MARKER");
	assert.equal(visibleWidth(lines[1]), 40);

	const rendered = renderGhostText(lines, 40, " prediction", true, dim);
	assert(rendered[1].includes(`${cursor}${dim(" prediction")}`));
	assert.equal(visibleWidth(rendered[1]), 40);
	assert.equal(rendered[0], original[0]);
	assert.equal(rendered[2], original[2]);
});

test("ghost text also supports the inverse-video-only cursor reset", () => {
	const line = row("\x1b[27m");
	const rendered = renderGhostText([line], visibleWidth(line), " prediction", true, dim);
	assert(rendered[0].includes(`\x1b[27m${dim(" prediction")}`));
	assert.equal(visibleWidth(rendered[0]), visibleWidth(line));
});

test("ghost text also supports the APC fake-cursor markers used by pi-tui >= 1.4", () => {
	const line = `abcd${CURSOR_MARKER}\x1b_pi:fc\x07 \x1b_pi:/fc\x07${" ".repeat(15)}`;
	const rendered = renderGhostText([line], visibleWidth(line), " prediction", true, dim);
	assert(rendered[0].includes(`\x1b_pi:/fc\x07${dim(" prediction")}`));
	assert.equal(visibleWidth(rendered[0]), visibleWidth(line));
});

test("ghost text stays hidden when the cursor is not at the logical end", () => {
	const editor = createEditor("abcd   ");
	assert.equal(isCursorAtEnd(editor.getLines(), editor.getCursor()), true);
	editor.handleInput("\x1b[D");
	const atEnd = isCursorAtEnd(editor.getLines(), editor.getCursor());
	assert.equal(atEnd, false);
	const lines = editor.render(40);
	assert.deepEqual(renderGhostText([...lines], 40, " prediction", atEnd, dim), lines);
});

test("missing ghost text or focused cursor marker leaves the editor unchanged", () => {
	const lines = createEditor("abcd").render(40);
	for (const ghost of [null, ""]) {
		assert.deepEqual(renderGhostText([...lines], 40, ghost, true, dim), lines);
	}
	const unfocused = createEditor("abcd", false).render(40);
	assert.deepEqual(renderGhostText([...unfocused], 40, " prediction", true, dim), unfocused);
});

test("ghost text leaves the editor unchanged when fewer than six columns remain", () => {
	const lines = createEditor("abcdefgh").render(15);
	assert.deepEqual(renderGhostText([...lines], 15, " prediction", true, dim), lines);
});

test("multiline ghost text only changes the final cursor row", () => {
	const lines = createEditor("first line\nabcd").render(40);
	const original = [...lines];
	const rendered = renderGhostText(lines, 40, " check\nfiles", true, dim);
	assert.equal(rendered[1], original[1]);
	assert(rendered[2].includes(dim(" check files")));
	assert.equal(visibleWidth(rendered[2]), 40);
});

test("wide-character suggestions on wrapped input fit the real editor cursor row", () => {
	const editor = createEditor("检查代码并确认中文宽字符不会导致光标和预测文本超出终端行宽");
	const lines = editor.render(24);
	assert(lines.length > 3, "input wraps across editor rows");
	const original = [...lines];
	const cursorRow = lines.findIndex((line) => line.includes(CURSOR_MARKER));
	const rendered = renderGhostText(lines, 24, "再检查预测文字是否正确截断", true, dim);
	assert(rendered[cursorRow].includes("\x1b[2m"));
	assert(rendered[cursorRow].includes("…"));
	assert(rendered.every((line) => visibleWidth(line) <= 24));
	for (let row = 0; row < rendered.length; row++) {
		if (row !== cursorRow) assert.equal(rendered[row], original[row]);
	}
});

test("isCursorAtEnd requires the last logical line", () => {
	assert.equal(isCursorAtEnd(["ab", "cd"], { line: 1, col: 2 }), true);
	assert.equal(isCursorAtEnd(["ab", "cd"], { line: 0, col: 2 }), false);
	assert.equal(isCursorAtEnd(["ab", "cd"], { line: 1, col: 1 }), false);
	assert.equal(isCursorAtEnd([""], { line: 0, col: 0 }), true);
});

for (const reset of ["\x1b[0m", "\x1b[27m", "\x1b[m", "\x1b[0;39m", "\x1b[27;22m"]) {
	test(`ghost text renders after a cursor closed with ${JSON.stringify(reset)}`, () => {
		const line = row(reset);
		const width = visibleWidth(line);
		const [rendered] = renderGhostText([line], width, " prediction", true, dim);
		assert(rendered.includes(`${reset}${dim(" prediction")}`));
		assert.equal(visibleWidth(rendered), width);
	});
}

test("ghost text keeps styling around the trailing padding", () => {
	const line = row("\x1b[0m", "\x1b[2m" + " ".repeat(20) + "\x1b[0m");
	const [rendered] = renderGhostText([line], visibleWidth(line), " prediction", true, dim);
	assert(rendered.endsWith("\x1b[0m"));
	assert.equal(visibleWidth(rendered), visibleWidth(line));
});

test("ghost text draws inside a framed editor and preserves its border", () => {
	// pi-pretty-tui wraps every editor row in border columns, so the row after
	// the cursor is padding followed by a `│`. Requiring spaces alone dropped the
	// ghost entirely whenever that frame was active.
	const line = row("\x1b[0m", " ".repeat(19) + "│");
	const width = visibleWidth(line);
	const [rendered] = renderGhostText([line], width, " prediction", true, dim);
	assert(rendered.includes(dim(" prediction")));
	assert(rendered.endsWith("│"), "frame border survives");
	assert.equal(visibleWidth(rendered), width);
});

test("ghost text respects a styled frame border from pi-pretty-tui", () => {
	const border = (text) => `\x1b[36m${text}\x1b[0m`;
	const line = `│abcd${CURSOR_MARKER}\x1b[7m \x1b[0m${" ".repeat(33)}${border("│")}`;
	const width = visibleWidth(line);
	const [rendered] = renderGhostText([line], width, " prediction", true, dim);
	assert(rendered.includes(dim(" prediction")));
	assert(rendered.endsWith(border("│")));
	assert.equal(visibleWidth(rendered), width);
});

test("ghost text leaves the row alone when content sits directly after the cursor", () => {
	const line = row("\x1b[0m", "x" + " ".repeat(18));
	assert.deepEqual(renderGhostText([line], visibleWidth(line), " prediction", true, dim), [line]);
});
