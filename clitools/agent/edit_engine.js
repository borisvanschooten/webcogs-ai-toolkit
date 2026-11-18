/*
 * Pure helpers for content-anchored file editing and unified diff generation.
 *
 * The agent's edit_file tool treats the model's line numbers as hints only:
 * edits are anchored on their old_text content, the anchor is searched first
 * at the hinted line, then in a window around the hint, then through the
 * whole file, and ambiguous or missing anchors reject the whole patch
 * atomically. Failures carry structured data (matched line numbers, numbered
 * nearby lines, hashes) so the model can correct itself.
 *
 * This module deliberately contains no I/O and no terminal interaction, so
 * the matching, application, and diff logic can be unit-tested in isolation
 * (see edit_engine_test.js).
 */

import { createHash } from "node:crypto";

/*
 * How far from line_hint an edit's old_text may be found before the search
 * widens to the whole file (mimics GNU patch's offset search).
 */
const HINT_SEARCH_OFFSET = 20;

/* Numbered context lines reported when an anchor cannot be found. */
const NEARBY_LINES_BEFORE = 6;
const NEARBY_LINES_AFTER = 6;
const MAX_NEARBY_LINES = 24;

const MAX_MATCHES_REPORTED = 10;

/* Unified diff appearance. */
const DIFF_CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 400;

/*
 * The LCS table for the middle section of a diff is limited to this many
 * cells; beyond that the middle is reported as one replace block, which is
 * still a correct diff, just not a minimal one.
 */
const MAX_LCS_CELLS = 4000000;

/*
 * Errors of this class carry a structured `data` object that the agent
 * returns to the model alongside the message.
 */
export class EditEngineError extends Error {
    constructor(message, data) {
        super(message);
        this.name = "EditEngineError";
        this.data = data;
    }
}

export function sha256Hex(text) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

/*
 * Accepts the hash in any reasonable spelling ("ABC...", "sha256:abc...") and
 * normalizes it for comparison.
 */
export function normalizeHash(expectedHash) {
    return String(expectedHash ?? "")
        .trim()
        .replace(/^sha256:/i, "")
        .toLowerCase();
}

/*
 * Split raw file content into lines for editing and diffing. CRLF and LF
 * endings are normalized to LF in memory; `usesCrlf` records the file's
 * ending style and `trailingNewline` whether the file ended with a newline,
 * so joinLines can restore both exactly.
 */
export function splitLines(content) {
    if (content === "") {
        return { lines: [], usesCrlf: false, trailingNewline: false };
    }

    const usesCrlf = content.includes("\r\n");
    const lines = content
        .split("\n")
        .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));

    let trailingNewline = false;

    if (lines[lines.length - 1] === "") {
        lines.pop();
        trailingNewline = true;
    }

    return { lines, usesCrlf, trailingNewline };
}

export function joinLines(lines, usesCrlf, trailingNewline) {
    if (lines.length === 0) {
        return "";
    }

    const separator = usesCrlf ? "\r\n" : "\n";

    return lines.join(separator) + (trailingNewline ? separator : "");
}

export function lineNumberWidth(totalLines) {
    return String(Math.max(totalLines, 1)).length;
}

/*
 * Whitespace that the model must reproduce exactly is displayed escaped:
 * every tab becomes the two-character sequence "\t", so indentation can be
 * counted and copied from the display. All model-facing output (read_file
 * content, nearby-line error windows, changed-region previews) flows through
 * formatNumberedLines, so the convention is applied in one place.
 */
export function escapeTabsForDisplay(text) {
    return text.replace(/\t/g, "\\t");
}

/*
 * The matching counterpart: read the "\t" display sequences in model-supplied
 * text back as real tabs. Used only as a fallback when the verbatim text
 * does not match the file (see resolveEdit).
 */
export function unescapeTabsFromDisplay(text) {
    return text.includes("\\t") ? text.split("\\t").join("\t") : text;
}

/*
 * Numbered gutter used everywhere lines are shown to the model: a fixed-width
 * right-aligned number, padded with spaces, then " | ", then the line with
 * tabs escaped by escapeTabsForDisplay.
 */
export function formatNumberedLines(lines, firstLineNumber, width) {
    return lines
        .map(
            (line, index) =>
                `${String(firstLineNumber + index).padStart(width)} | ${escapeTabsForDisplay(line)}`
        )
        .join("\n");
}

/*
 * Parse an edit block's text into normalized lines. A single trailing newline
 * is ignored: models usually add it as block formatting, not as an intent to
 * insert a blank line.
 */
export function parseEditLines(text) {
    if (typeof text !== "string") {
        throw new EditEngineError("Edit text must be a string.");
    }

    const lines = text
        .split("\n")
        .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));

    if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }

    return lines;
}

function matchesAt(lines, oldLines, position) {
    if (position < 0 || position + oldLines.length > lines.length) {
        return false;
    }

    for (let index = 0; index < oldLines.length; index++) {
        if (lines[position + index] !== oldLines[index]) {
            return false;
        }
    }

    return true;
}

function findAllMatches(lines, oldLines) {
    const matches = [];
    const firstLine = oldLines[0];

    for (
        let position = 0;
        position + oldLines.length <= lines.length;
        position++
    ) {
        if (lines[position] !== firstLine) {
            continue;
        }

        if (matchesAt(lines, oldLines, position)) {
            matches.push(position);
        }
    }

    return matches;
}

function ambiguousAnchorError(label, editIndex, hint, matchPositions) {
    const reported = matchPositions
        .slice(0, MAX_MATCHES_REPORTED)
        .map((position) => position + 1);

    return new EditEngineError(
        `${label}: old_text matches ${matchPositions.length} locations (lines ${reported.join(
            ", "
        )}${matchPositions.length > reported.length ? ", ..." : ""}). Extend old_text with more surrounding lines so it matches exactly one location, or pass a line_hint pointing at the intended one.`,
        {
            edit_index: editIndex,
            matches_found: matchPositions.length,
            matching_lines: reported,
            line_hint: hint
        }
    );
}

function missingAnchorError(label, editIndex, hint, lines, oldLines) {
    const data = { edit_index: editIndex, matches_found: 0, line_hint: hint };
    let message = `${label}: old_text was not found in the file.`;

    if (hint !== null) {
        if (hint >= 1 && hint <= lines.length) {
            message += ` Line ${hint} is ${JSON.stringify(lines[hint - 1])}.`;
        } else {
            message += ` The file has ${lines.length} lines, so line ${hint} does not exist.`;
        }

        const start = Math.max(1, hint - NEARBY_LINES_BEFORE);
        let end = Math.min(
            lines.length,
            hint - 1 + oldLines.length - 1 + NEARBY_LINES_AFTER
        );

        if (end < start) {
            end = start;
        }

        if (end - start + 1 > MAX_NEARBY_LINES) {
            end = start + MAX_NEARBY_LINES - 1;
        }

        data.nearby_lines = formatNumberedLines(
            lines.slice(start - 1, end),
            start,
            lineNumberWidth(lines.length)
        );
    } else {
        message +=
            " Read the file to get numbered lines, then retry with an exact old_text and a line_hint, or replace the lines by range with start_line and end_line.";
    }

    return new EditEngineError(message, data);
}

/*
 * Anchor resolution for a content edit, most specific first: exact match at
 * the hint, then a match within HINT_SEARCH_OFFSET lines of the hint (the
 * file may have shifted since it was read), then the whole file, which must
 * match uniquely. An exact hit at the hint disambiguates even if the same
 * text occurs elsewhere. Throws an EditEngineError when the anchor is
 * missing or ambiguous.
 */
function resolveContentAnchor(lines, oldLines, hint, index, label) {
    const globalMatches = findAllMatches(lines, oldLines);

    let position = -1;
    let anchoredAtHint = false;

    if (hint !== null && matchesAt(lines, oldLines, hint - 1)) {
        position = hint - 1;
        anchoredAtHint = true;
    } else if (hint !== null) {
        const windowMatches = globalMatches.filter(
            (match) => Math.abs(match - (hint - 1)) <= HINT_SEARCH_OFFSET
        );

        if (windowMatches.length > 1) {
            throw ambiguousAnchorError(label, index, hint, windowMatches);
        }

        if (windowMatches.length === 1) {
            position = windowMatches[0];
        }
    }

    if (position === -1) {
        if (globalMatches.length === 1) {
            position = globalMatches[0];
        } else if (globalMatches.length === 0) {
            throw missingAnchorError(label, index, hint, lines, oldLines);
        } else {
            throw ambiguousAnchorError(label, index, hint, globalMatches);
        }
    }

    return { position, anchoredAtHint };
}

function resolveContentEdit(lines, edit, index, label) {
    const oldLines = parseEditLines(edit.old_text);

    if (oldLines.length === 0) {
        throw new EditEngineError(
            `${label}: old_text is empty. Use write_file to create a file or replace its whole contents.`,
            { edit_index: index }
        );
    }

    if (edit.old_text === edit.new_text) {
        throw new EditEngineError(
            `${label}: old_text and new_text are identical, so nothing would change.`,
            { edit_index: index }
        );
    }

    const hint = Number.isInteger(edit.line_hint) ? edit.line_hint : null;
    let newLines = parseEditLines(edit.new_text);
    let usedTabEscape = false;
    let anchor;

    try {
        anchor = resolveContentAnchor(lines, oldLines, hint, index, label);
    } catch (exactError) {
        /*
         * Fallback for the "\t" display convention: text copied from
         * read_file contains the two-character sequence "\t" for every real
         * tab. When the verbatim text is not found at all, retry with those
         * sequences read as tabs. An ambiguous verbatim match does not
         * trigger the fallback: the text was found, so the model must add
         * context instead. When the fallback matches, new_text is
         * interpreted the same way.
         */
        const unescapedOldText = unescapeTabsFromDisplay(edit.old_text);
        const isMissingAnchor =
            exactError instanceof EditEngineError &&
            exactError.data &&
            exactError.data.matches_found === 0;

        if (unescapedOldText === edit.old_text || !isMissingAnchor) {
            throw exactError;
        }

        try {
            anchor = resolveContentAnchor(
                lines,
                parseEditLines(unescapedOldText),
                hint,
                index,
                label
            );
        } catch (fallbackError) {
            /* A fallback ambiguity found the text and is more informative. */
            if (
                fallbackError instanceof EditEngineError &&
                fallbackError.data &&
                fallbackError.data.matches_found > 0
            ) {
                throw fallbackError;
            }

            throw exactError;
        }

        usedTabEscape = true;
        newLines = parseEditLines(unescapeTabsFromDisplay(edit.new_text));
    }

    return {
        editIndex: index,
        position: anchor.position,
        oldLength: oldLines.length,
        newLines,
        lineHint: hint,
        anchoredAtHint: anchor.anchoredAtHint,
        offset:
            anchor.anchoredAtHint || hint === null
                ? 0
                : anchor.position + 1 - hint,
        usedTabEscape
    };
}

/*
 * A range edit replaces the inclusive 1-based line range with new_text, so
 * the old text never has to be reproduced. The expected_hash guard keeps the
 * line numbers trustworthy. new_text is used verbatim: real tabs, not the
 * "\t" display sequence.
 */
function resolveRangeEdit(lines, edit, index, label) {
    const startLine = edit.start_line;
    const endLine = edit.end_line;

    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
        throw new EditEngineError(
            `${label}: provide either old_text, or both start_line and end_line.`,
            { edit_index: index }
        );
    }

    if (startLine < 1 || endLine < startLine || endLine > lines.length) {
        throw new EditEngineError(
            `${label}: the line range ${startLine}-${endLine} is invalid for a file with ${lines.length} line(s).`,
            {
                edit_index: index,
                start_line: startLine,
                end_line: endLine,
                total_lines: lines.length
            }
        );
    }

    return {
        editIndex: index,
        position: startLine - 1,
        oldLength: endLine - startLine + 1,
        newLines: parseEditLines(edit.new_text),
        lineHint: null,
        anchoredAtHint: false,
        offset: 0,
        usedTabEscape: false,
        range: { start_line: startLine, end_line: endLine }
    };
}

function resolveEdit(lines, edit, index, totalEdits) {
    const label = `Edit ${index + 1} of ${totalEdits}`;

    if (edit === null || typeof edit !== "object") {
        throw new EditEngineError(
            `${label}: each edit must provide old_text, or start_line and end_line, plus new_text.`,
            { edit_index: index }
        );
    }

    if (typeof edit.new_text !== "string") {
        throw new EditEngineError(`${label}: new_text is a required string.`, {
            edit_index: index
        });
    }

    if (typeof edit.old_text === "string") {
        if (
            (edit.start_line !== undefined && edit.start_line !== null) ||
            (edit.end_line !== undefined && edit.end_line !== null)
        ) {
            throw new EditEngineError(
                `${label}: provide either old_text or start_line/end_line, not both.`,
                { edit_index: index }
            );
        }

        return resolveContentEdit(lines, edit, index, label);
    }

    return resolveRangeEdit(lines, edit, index, label);
}

/*
 * Resolve every edit against the original lines, or throw before anything is
 * applied. The returned edits are sorted by position and guaranteed not to
 * overlap, so they can be applied in one pass against the same snapshot.
 */
export function resolveEdits(lines, edits) {
    if (!Array.isArray(edits) || edits.length === 0) {
        throw new EditEngineError("At least one edit is required.", {
            edits_required: true
        });
    }

    const resolved = [];

    for (let index = 0; index < edits.length; index++) {
        resolved.push(resolveEdit(lines, edits[index], index, edits.length));
    }

    resolved.sort((left, right) => left.position - right.position);

    for (let index = 1; index < resolved.length; index++) {
        const previous = resolved[index - 1];
        const current = resolved[index];

        if (previous.position + previous.oldLength > current.position) {
            throw new EditEngineError(
                `Edits ${previous.editIndex + 1} and ${
                    current.editIndex + 1
                } overlap; combine them into a single edit.`,
                {
                    edit_index: current.editIndex,
                    overlapping_edits: [
                        previous.editIndex + 1,
                        current.editIndex + 1
                    ]
                }
            );
        }
    }

    return resolved;
}

/*
 * Apply resolved edits to the original lines in one pass. Line numbers in
 * `changedRanges` are 1-based; for pure deletions new_end_line is
 * new_start_line - 1 (an empty range at the deletion point in the new file).
 */
export function applyResolvedEdits(lines, resolvedEdits) {
    const newLines = [];
    const changedRanges = [];
    let originalPosition = 0;
    let delta = 0;

    for (const edit of resolvedEdits) {
        while (originalPosition < edit.position) {
            newLines.push(lines[originalPosition]);
            originalPosition += 1;
        }

        const oldStartLine = edit.position + 1;
        const newStartLine = edit.position + delta + 1;

        for (const line of edit.newLines) {
            newLines.push(line);
        }

        originalPosition += edit.oldLength;
        delta += edit.newLines.length - edit.oldLength;

        changedRanges.push({
            edit_index: edit.editIndex + 1,
            old_start_line: oldStartLine,
            old_end_line: oldStartLine + edit.oldLength - 1,
            new_start_line: newStartLine,
            new_end_line: newStartLine + edit.newLines.length - 1
        });
    }

    while (originalPosition < lines.length) {
        newLines.push(lines[originalPosition]);
        originalPosition += 1;
    }

    return { newLines, changedRanges };
}

/*
 * A numbered window around the applied changes in the new file, so a
 * follow-up edit can use fresh line numbers without re-reading the file.
 */
export function buildChangedRegion(newLines, changedRanges) {
    if (changedRanges.length === 0 || newLines.length === 0) {
        return null;
    }

    const firstRange = changedRanges[0];
    const lastRange = changedRanges[changedRanges.length - 1];
    const firstEnd = Math.max(
        firstRange.new_end_line,
        firstRange.new_start_line - 1
    );
    const lastEnd = Math.max(
        lastRange.new_end_line,
        lastRange.new_start_line - 1
    );

    let startLine = Math.max(1, firstRange.new_start_line - 3);
    let endLine = Math.min(newLines.length, lastEnd + 3);

    if (endLine - startLine + 1 > 60) {
        endLine = Math.min(newLines.length, firstEnd + 3);
    }

    return {
        start_line: startLine,
        end_line: endLine,
        preview: formatNumberedLines(
            newLines.slice(startLine - 1, endLine),
            startLine,
            lineNumberWidth(newLines.length)
        )
    };
}

/*
 * Line diff as a list of { type: "same" | "del" | "add", line } operations.
 * Common prefix and suffix are trimmed first; the remaining middle is diffed
 * with an LCS table while it stays within MAX_LCS_CELLS cells, and otherwise
 * reported as one replace block.
 */
export function diffLines(oldLines, newLines) {
    const ops = [];

    let prefix = 0;

    while (
        prefix < oldLines.length &&
        prefix < newLines.length &&
        oldLines[prefix] === newLines[prefix]
    ) {
        prefix += 1;
    }

    let suffix = 0;

    while (
        suffix < oldLines.length - prefix &&
        suffix < newLines.length - prefix &&
        oldLines[oldLines.length - 1 - suffix] ===
            newLines[newLines.length - 1 - suffix]
    ) {
        suffix += 1;
    }

    const oldMiddle = oldLines.slice(prefix, oldLines.length - suffix);
    const newMiddle = newLines.slice(prefix, newLines.length - suffix);

    for (let index = 0; index < prefix; index++) {
        ops.push({ type: "same", line: oldLines[index] });
    }

    pushMiddleDiff(ops, oldMiddle, newMiddle);

    for (let index = oldLines.length - suffix; index < oldLines.length; index++) {
        ops.push({ type: "same", line: oldLines[index] });
    }

    return ops;
}

function pushMiddleDiff(ops, oldMiddle, newMiddle) {
    if (oldMiddle.length === 0 && newMiddle.length === 0) {
        return;
    }

    if (oldMiddle.length * newMiddle.length > MAX_LCS_CELLS) {
        for (const line of oldMiddle) {
            ops.push({ type: "del", line });
        }

        for (const line of newMiddle) {
            ops.push({ type: "add", line });
        }

        return;
    }

    const width = newMiddle.length + 1;
    const table = new Int32Array((oldMiddle.length + 1) * width);

    for (let i = oldMiddle.length - 1; i >= 0; i--) {
        for (let j = newMiddle.length - 1; j >= 0; j--) {
            table[i * width + j] =
                oldMiddle[i] === newMiddle[j]
                    ? table[(i + 1) * width + j + 1] + 1
                    : Math.max(
                          table[(i + 1) * width + j],
                          table[i * width + j + 1]
                      );
        }
    }

    let i = 0;
    let j = 0;

    while (i < oldMiddle.length && j < newMiddle.length) {
        if (oldMiddle[i] === newMiddle[j]) {
            ops.push({ type: "same", line: oldMiddle[i] });
            i += 1;
            j += 1;
        } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
            ops.push({ type: "del", line: oldMiddle[i] });
            i += 1;
        } else {
            ops.push({ type: "add", line: newMiddle[j] });
            j += 1;
        }
    }

    while (i < oldMiddle.length) {
        ops.push({ type: "del", line: oldMiddle[i] });
        i += 1;
    }

    while (j < newMiddle.length) {
        ops.push({ type: "add", line: newMiddle[j] });
        j += 1;
    }
}

/*
 * Format a unified diff with context lines, merging changed regions that are
 * closer together than their context into a single hunk. Returns "" when the
 * line lists are identical.
 */
export function formatUnifiedDiff(oldLines, newLines, options = {}) {
    const contextSize = options.contextLines ?? DIFF_CONTEXT_LINES;
    const fromFile = options.fromFile ?? "a";
    const toFile = options.toFile ?? "b";

    const ops = diffLines(oldLines, newLines);

    if (!ops.some((op) => op.type !== "same")) {
        return "";
    }

    const changedIndexes = [];

    for (let index = 0; index < ops.length; index++) {
        if (ops[index].type !== "same") {
            changedIndexes.push(index);
        }
    }

    const ranges = [];

    for (const changedIndex of changedIndexes) {
        const start = Math.max(0, changedIndex - contextSize);
        const end = Math.min(ops.length - 1, changedIndex + contextSize);
        const last = ranges[ranges.length - 1];

        if (last !== undefined && start <= last.end + 1) {
            last.end = Math.max(last.end, end);
        } else {
            ranges.push({ start, end });
        }
    }

    const output = [`--- ${fromFile}`, `+++ ${toFile}`];

    let oldLine = 1;
    let newLine = 1;
    let cursor = 0;

    for (const range of ranges) {
        while (cursor < range.start) {
            if (ops[cursor].type !== "add") {
                oldLine += 1;
            }

            if (ops[cursor].type !== "del") {
                newLine += 1;
            }

            cursor += 1;
        }

        const hunkStartOld = oldLine;
        const hunkStartNew = newLine;
        let oldCount = 0;
        let newCount = 0;
        const hunkLines = [];

        for (let index = range.start; index <= range.end; index++) {
            const op = ops[index];

            if (op.type === "same") {
                hunkLines.push(` ${op.line}`);
                oldCount += 1;
                newCount += 1;
            } else if (op.type === "del") {
                hunkLines.push(`-${op.line}`);
                oldCount += 1;
            } else {
                hunkLines.push(`+${op.line}`);
                newCount += 1;
            }

            if (op.type !== "add") {
                oldLine += 1;
            }

            if (op.type !== "del") {
                newLine += 1;
            }
        }

        cursor = range.end + 1;

        /*
         * A hunk with no old-file (or new-file) lines is a pure insertion
         * (or deletion); unified diff places it at the line before the
         * change point (0 at the start of the file).
         */
        const oldHeaderStart = oldCount === 0 ? hunkStartOld - 1 : hunkStartOld;
        const newHeaderStart = newCount === 0 ? hunkStartNew - 1 : hunkStartNew;

        output.push(
            `@@ -${oldHeaderStart},${oldCount} +${newHeaderStart},${newCount} @@`
        );
        output.push(...hunkLines);
    }

    return output.join("\n");
}

/* Cap a diff for display, noting how much was left out. */
export function capDiff(diffText, maxLines = MAX_DIFF_LINES) {
    const lines = diffText.split("\n");

    if (lines.length <= maxLines) {
        return diffText;
    }

    return `${lines
        .slice(0, maxLines)
        .join("\n")}\n... diff truncated after ${maxLines} lines (${
        lines.length - maxLines
    } more)`;
}
