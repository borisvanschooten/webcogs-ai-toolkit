/*
 * Pure helpers for line-range file editing and unified diff generation.
 *
 * The agent's edit_file tool replaces an inclusive 1-based line range with
 * new text; the replaced lines are never reproduced. Line numbers come from
 * read_file's numbered output, and the expected_hash guard in agent.js keeps
 * them trustworthy: an edit is only attempted while the hash still matches
 * the file that was read. Each edit may additionally carry an optional
 * old_text anchor that must match the lines it replaces (ignoring whitespace
 * differences), which catches wrong coordinates even under a fresh hash.
 * Multiple edits are resolved against the same snapshot, sorted by position,
 * checked for overlap, and applied atomically. Failures carry structured
 * data (actual hashes, line counts, anchor locations) so the model can
 * correct itself.
 *
 * This module deliberately contains no I/O and no terminal interaction, so
 * the application and diff logic can be unit-tested in isolation (see
 * edit_engine_test.js).
 */

import { createHash } from "node:crypto";

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
 * Anchor verification (optional old_text per edit). The anchor's
 * whitespace-normalized lines must equal the range's; a mismatch reports the
 * verbatim lines at the range plus the positions where the anchor occurs.
 */
const MAX_ANCHOR_MATCHES = 10;
const MAX_ANCHOR_RANGE_PREVIEW_LINES = 40;

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
 * Numbered gutter used everywhere lines are shown to the model: a fixed-width
 * right-aligned number, padded with spaces, then " | ", then the line
 * verbatim. Tabs appear as real characters and new_text is verbatim too, so
 * text can be copied between read_file output and edit_file input without
 * any conversion.
 */
export function formatNumberedLines(lines, firstLineNumber, width) {
    return lines
        .map(
            (line, index) =>
                `${String(firstLineNumber + index).padStart(width)} | ${line}`
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

/*
 * Whitespace-insensitive form of a line for anchor matching: leading and
 * trailing whitespace are removed and internal whitespace runs collapse to a
 * single space, so an anchor written with different indentation, tabs, or
 * spacing still matches the same code. A whitespace-only line and an empty
 * line both normalize to "".
 */
export function normalizeWhitespace(line) {
    return line.replace(/\s+/g, " ").trim();
}

/*
 * The 1-based positions where the (already whitespace-normalized) anchor
 * occurs in the (already whitespace-normalized) file lines, capped at
 * MAX_ANCHOR_MATCHES. `capped` reports whether the scan stopped early.
 */
function findAnchorMatches(lines, anchorLines) {
    const matches = [];
    let capped = false;

    if (anchorLines.length === 0 || anchorLines.length > lines.length) {
        return { matches, capped };
    }

    for (let start = 0; start + anchorLines.length <= lines.length; start++) {
        let matched = true;

        for (let offset = 0; offset < anchorLines.length; offset++) {
            if (lines[start + offset] !== anchorLines[offset]) {
                matched = false;
                break;
            }
        }

        if (matched) {
            matches.push(start + 1);

            if (matches.length === MAX_ANCHOR_MATCHES) {
                capped = start + 1 + anchorLines.length <= lines.length;
                break;
            }
        }
    }

    return { matches, capped };
}

/*
 * Optional anchor check for one edit: when old_text is provided, its
 * whitespace-normalized lines must equal the whitespace-normalized lines the
 * range replaces. A mismatch throws before anything is applied, and the
 * error data carries the verbatim lines currently at the range plus the
 * positions where the anchor does occur, so the model can correct its
 * coordinates (or its anchor) without re-reading the file.
 */
function verifyOldTextAnchor(lines, edit, index, label, startLine, endLine) {
    if (edit.old_text === undefined || edit.old_text === null) {
        return;
    }

    if (typeof edit.old_text !== "string") {
        throw new EditEngineError(
            `${label}: old_text must be a string when provided.`,
            { edit_index: index }
        );
    }

    if (parseEditLines(edit.old_text).length === 0) {
        throw new EditEngineError(
            `${label}: old_text was provided but is empty; omit it, or give the text expected at lines ${startLine}-${endLine}.`,
            {
                edit_index: index,
                start_line: startLine,
                end_line: endLine
            }
        );
    }

    const anchorLines = parseEditLines(edit.old_text).map(normalizeWhitespace);
    const rangeLines = lines
        .slice(startLine - 1, endLine)
        .map(normalizeWhitespace);

    if (
        anchorLines.length === rangeLines.length &&
        anchorLines.every((line, offset) => line === rangeLines[offset])
    ) {
        return;
    }

    const anchorOccurrence = findAnchorMatches(
        lines.map(normalizeWhitespace),
        anchorLines
    );

    const actualLines = lines.slice(startLine - 1, endLine);
    let actualLinesAtRange = formatNumberedLines(
        actualLines.slice(0, MAX_ANCHOR_RANGE_PREVIEW_LINES),
        startLine,
        lineNumberWidth(lines.length)
    );

    if (actualLines.length > MAX_ANCHOR_RANGE_PREVIEW_LINES) {
        actualLinesAtRange += `\n... ${
            actualLines.length - MAX_ANCHOR_RANGE_PREVIEW_LINES
        } more line(s) not shown`;
    }

    const where =
        anchorOccurrence.matches.length > 0
            ? `The anchor text occurs at line(s) ${anchorOccurrence.matches.join(
                  ", "
              )}; retry with those coordinates.`
            : "The anchor text does not occur anywhere in the file; re-read the file and rebuild the edit.";

    throw new EditEngineError(
        `${label}: old_text does not match the current contents of lines ${startLine}-${endLine}, so the whole call was rejected and nothing was applied. ${where} Either move the range to where the anchor occurs, or update old_text to match actual_lines_at_range.`,
        {
            edit_index: index,
            start_line: startLine,
            end_line: endLine,
            range_line_count: rangeLines.length,
            anchor_line_count: anchorLines.length,
            actual_lines_at_range: actualLinesAtRange,
            anchor_found_at_lines: anchorOccurrence.matches,
            anchor_matches_capped: anchorOccurrence.capped
        }
    );
}

/*
 * A range edit replaces the inclusive 1-based line range with new_text, so
 * the replaced lines never have to be reproduced. The expected_hash guard in
 * agent.js keeps the line numbers trustworthy, and an optional old_text
 * anchor is verified against the range (see verifyOldTextAnchor). new_text
 * is used verbatim.
 */
function resolveRangeEdit(lines, edit, index, label) {
    const startLine = edit.start_line;
    const endLine = edit.end_line;

    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
        throw new EditEngineError(
            `${label}: start_line and end_line are required integers.`,
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

    verifyOldTextAnchor(lines, edit, index, label, startLine, endLine);

    return {
        editIndex: index,
        position: startLine - 1,
        oldLength: endLine - startLine + 1,
        newLines: parseEditLines(edit.new_text)
    };
}

function resolveEdit(lines, edit, index, totalEdits) {
    const label = `Edit ${index + 1} of ${totalEdits}`;

    if (edit === null || typeof edit !== "object") {
        throw new EditEngineError(
            `${label}: each edit must provide start_line, end_line, and new_text.`,
            { edit_index: index }
        );
    }

    if (typeof edit.new_text !== "string") {
        throw new EditEngineError(`${label}: new_text is a required string.`, {
            edit_index: index
        });
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
