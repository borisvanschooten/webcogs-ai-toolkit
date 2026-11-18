/*
 * Unit tests for edit_engine.js.
 *
 * Run from the workspace root:
 *
 *   node clitools/agent/edit_engine_test.js
 */

import assert from "node:assert/strict";

import {
    EditEngineError,
    applyResolvedEdits,
    buildChangedRegion,
    capDiff,
    formatNumberedLines,
    formatUnifiedDiff,
    joinLines,
    lineNumberWidth,
    normalizeHash,
    normalizeWhitespace,
    parseEditLines,
    resolveEdits,
    sha256Hex,
    splitLines
} from "./edit_engine.js";

const tests = [];

function test(name, fn) {
    tests.push({ name, fn });
}

/* ------------------------------------------------------------------ */
/* splitLines / joinLines                                              */
/* ------------------------------------------------------------------ */

test("splitLines/joinLines round-trips CRLF files", () => {
    const content = "one\r\ntwo\r\n";
    const split = splitLines(content);

    assert.deepEqual(split.lines, ["one", "two"]);
    assert.equal(split.usesCrlf, true);
    assert.equal(split.trailingNewline, true);
    assert.equal(
        joinLines(split.lines, split.usesCrlf, split.trailingNewline),
        content
    );
});

test("splitLines/joinLines round-trips files without a trailing newline", () => {
    const content = "a\nb";
    const split = splitLines(content);

    assert.deepEqual(split.lines, ["a", "b"]);
    assert.equal(split.trailingNewline, false);
    assert.equal(joinLines(split.lines, false, false), content);
});

test("splitLines handles empty and newline-only content", () => {
    assert.deepEqual(splitLines("").lines, []);
    assert.equal(joinLines([], true, true), "");

    const singleNewline = splitLines("\n");
    assert.deepEqual(singleNewline.lines, [""]);
    assert.equal(singleNewline.trailingNewline, true);
    assert.equal(joinLines(singleNewline.lines, false, true), "\n");
});

/* ------------------------------------------------------------------ */
/* Numbered gutter                                                     */
/* ------------------------------------------------------------------ */

test("formatNumberedLines pads numbers with spaces and uses ' | '", () => {
    assert.equal(formatNumberedLines(["x", "y"], 9, 3), "  9 | x\n 10 | y");
    assert.equal(formatNumberedLines(["const a = 1;"], 42, 4), "  42 | const a = 1;");
});

test("formatNumberedLines shows tabs verbatim", () => {
    assert.equal(
        formatNumberedLines(["\tconst a = 1;"], 1, 1),
        "1 | \tconst a = 1;"
    );
});

test("lineNumberWidth grows with the line count", () => {
    assert.equal(lineNumberWidth(0), 1);
    assert.equal(lineNumberWidth(9), 1);
    assert.equal(lineNumberWidth(10), 2);
    assert.equal(lineNumberWidth(999), 3);
    assert.equal(lineNumberWidth(1000), 4);
});

/* ------------------------------------------------------------------ */
/* parseEditLines                                                      */
/* ------------------------------------------------------------------ */

test("parseEditLines ignores a single trailing newline", () => {
    assert.deepEqual(parseEditLines("a\n"), ["a"]);
    assert.deepEqual(parseEditLines("a"), ["a"]);
    assert.deepEqual(parseEditLines("a\n\n"), ["a", ""]);
    assert.deepEqual(parseEditLines(""), []);
    assert.deepEqual(parseEditLines("a\r\nb"), ["a", "b"]);
});

/* ------------------------------------------------------------------ */
/* resolveEdits: line-range resolution                                 */
/* ------------------------------------------------------------------ */

const sampleLines = [
    "function a() {",
    "  return 1;",
    "}",
    "",
    "function b() {",
    "  return 2;",
    "}"
];

test("a range edit replaces the range with new_text verbatim", () => {
    const resolved = resolveEdits(sampleLines, [
        {
            start_line: 5,
            end_line: 7,
            new_text: "function b() {\n\treturn 2;\n}"
        }
    ]);

    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].position, 4);
    assert.equal(resolved[0].oldLength, 3);

    const { newLines } = applyResolvedEdits(sampleLines, resolved);
    assert.deepEqual(newLines.slice(4), ["function b() {", "\treturn 2;", "}"]);
});

test("a range edit can delete its range with empty new_text", () => {
    const resolved = resolveEdits(sampleLines, [
        { start_line: 4, end_line: 7, new_text: "" }
    ]);

    const { newLines } = applyResolvedEdits(sampleLines, resolved);
    assert.deepEqual(newLines, ["function a() {", "  return 1;", "}"]);
});

test("a single-line range edit works", () => {
    const resolved = resolveEdits(sampleLines, [
        { start_line: 2, end_line: 2, new_text: "  return 42;" }
    ]);

    const { newLines } = applyResolvedEdits(sampleLines, resolved);
    assert.deepEqual(newLines, [
        "function a() {",
        "  return 42;",
        "}",
        "",
        "function b() {",
        "  return 2;",
        "}"
    ]);
});

test("multiple range edits are resolved against the original snapshot", () => {
    const lines = ["a", "b", "c", "d", "e"];

    const resolved = resolveEdits(lines, [
        { start_line: 4, end_line: 5, new_text: "D" },
        { start_line: 2, end_line: 2, new_text: "B1\nB2" }
    ]);

    assert.deepEqual(
        resolved.map((edit) => edit.position),
        [1, 3]
    );

    const { newLines, changedRanges } = applyResolvedEdits(lines, resolved);

    assert.deepEqual(newLines, ["a", "B1", "B2", "c", "D"]);
    assert.deepEqual(
        changedRanges.map((range) => range.old_start_line),
        [2, 4]
    );
});

test("an out-of-file line range is rejected with the line count", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                { start_line: 6, end_line: 9, new_text: "x" }
            ]),
        (error) => {
            assert.ok(error instanceof EditEngineError);
            assert.equal(error.data.total_lines, 7);
            return true;
        }
    );
});

test("an out-of-file range on an empty file is rejected", () => {
    assert.throws(
        () => resolveEdits([], [{ start_line: 1, end_line: 1, new_text: "x" }]),
        (error) => {
            assert.ok(error instanceof EditEngineError);
            assert.equal(error.data.total_lines, 0);
            return true;
        }
    );
});

test("an inverted line range is rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                { start_line: 3, end_line: 2, new_text: "x" }
            ]),
        EditEngineError
    );
});

test("missing start_line or end_line is rejected", () => {
    assert.throws(
        () => resolveEdits(sampleLines, [{ new_text: "x" }]),
        EditEngineError
    );

    assert.throws(
        () => resolveEdits(sampleLines, [{ start_line: 1, new_text: "x" }]),
        EditEngineError
    );
});

test("a non-object edit is rejected", () => {
    assert.throws(() => resolveEdits(sampleLines, [null]), EditEngineError);
});

test("overlapping edits are rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                { start_line: 1, end_line: 3, new_text: "x" },
                { start_line: 3, end_line: 4, new_text: "y" }
            ]),
        /overlap/
    );
});

test("adjacent (non-overlapping) edits are allowed", () => {
    const resolved = resolveEdits(sampleLines, [
        { start_line: 1, end_line: 2, new_text: "x" },
        { start_line: 3, end_line: 3, new_text: "y" }
    ]);

    assert.equal(resolved.length, 2);
    assert.deepEqual(
        resolved.map((edit) => edit.position),
        [0, 2]
    );
});

/* ------------------------------------------------------------------ */
/* old_text anchor verification                                        */
/* ------------------------------------------------------------------ */

test("normalizeWhitespace trims and collapses whitespace runs", () => {
    assert.equal(normalizeWhitespace("\tconst a\t=  1;  "), "const a = 1;");
    assert.equal(normalizeWhitespace("   "), "");
    assert.equal(normalizeWhitespace(""), "");
});

test("an exact old_text anchor passes", () => {
    const resolved = resolveEdits(sampleLines, [
        {
            start_line: 5,
            end_line: 7,
            new_text: "function b() {\n\treturn 2;\n}",
            old_text: "function b() {\n  return 2;\n}"
        }
    ]);

    assert.equal(resolved.length, 1);
});

test("an old_text anchor ignores indentation and tab/space differences", () => {
    const resolved = resolveEdits(sampleLines, [
        {
            start_line: 1,
            end_line: 3,
            new_text: "x",
            old_text: "function a() {\n\treturn 1;\n}"
        }
    ]);

    assert.equal(resolved.length, 1);
});

test("an old_text anchor ignores runs of internal spaces", () => {
    const resolved = resolveEdits(["const total = a + b;"], [
        {
            start_line: 1,
            end_line: 1,
            new_text: "const total = a - b;",
            old_text: "const  total  =  a + b;"
        }
    ]);

    assert.equal(resolved.length, 1);
});

test("an old_text anchor matches whitespace-only lines against blank lines", () => {
    const resolved = resolveEdits(sampleLines, [
        {
            start_line: 3,
            end_line: 5,
            new_text: "}",
            old_text: "}\n   \nfunction b() {"
        }
    ]);

    assert.equal(resolved.length, 1);
});

test("a wrong old_text anchor is rejected and reports where the anchor occurs", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    start_line: 1,
                    end_line: 3,
                    new_text: "x",
                    old_text: "function b() {\n  return 2;\n}"
                }
            ]),
        (error) => {
            assert.ok(error instanceof EditEngineError);
            assert.equal(error.data.edit_index, 0);
            assert.equal(error.data.start_line, 1);
            assert.equal(error.data.end_line, 3);
            assert.equal(error.data.range_line_count, 3);
            assert.equal(error.data.anchor_line_count, 3);
            assert.deepEqual(error.data.anchor_found_at_lines, [5]);
            assert.equal(error.data.anchor_matches_capped, false);
            assert.match(error.message, /old_text does not match/);
            assert.match(error.message, /occurs at line\(s\) 5/);
            assert.equal(
                error.data.actual_lines_at_range.split("\n")[0],
                "1 | function a() {"
            );
            return true;
        }
    );
});

test("an anchor that occurs nowhere reports no positions", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    start_line: 1,
                    end_line: 2,
                    new_text: "x",
                    old_text: "class c {\n  return 9;\n}"
                }
            ]),
        (error) => {
            assert.deepEqual(error.data.anchor_found_at_lines, []);
            assert.match(error.message, /does not occur anywhere/);
            return true;
        }
    );
});

test("an anchor with a different line count than the range is rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    start_line: 5,
                    end_line: 7,
                    new_text: "x",
                    old_text: "function b() {"
                }
            ]),
        (error) => {
            assert.equal(error.data.range_line_count, 3);
            assert.equal(error.data.anchor_line_count, 1);
            return true;
        }
    );
});

test("an anchor occurring several times reports every position", () => {
    assert.throws(
        () =>
            resolveEdits(["}", "a", "}", "b", "}"], [
                { start_line: 2, end_line: 2, new_text: "x", old_text: "}" }
            ]),
        (error) => {
            assert.deepEqual(error.data.anchor_found_at_lines, [1, 3, 5]);
            return true;
        }
    );
});

test("a non-string or empty old_text is rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                { start_line: 1, end_line: 1, new_text: "x", old_text: 5 }
            ]),
        /old_text must be a string/
    );

    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                { start_line: 1, end_line: 1, new_text: "x", old_text: "" }
            ]),
        /old_text was provided but is empty/
    );
});
/* ------------------------------------------------------------------ */
/* applyResolvedEdits                                                  */
/* ------------------------------------------------------------------ */

test("applyResolvedEdits applies growth, replacement, and deletion", () => {
    const lines = ["a", "b", "c", "d", "e"];

    const resolved = resolveEdits(lines, [
        { start_line: 2, end_line: 2, new_text: "B1\nB2" },
        { start_line: 4, end_line: 5, new_text: "" }
    ]);

    const { newLines, changedRanges } = applyResolvedEdits(lines, resolved);

    assert.deepEqual(newLines, ["a", "B1", "B2", "c"]);
    assert.deepEqual(changedRanges, [
        {
            edit_index: 1,
            old_start_line: 2,
            old_end_line: 2,
            new_start_line: 2,
            new_end_line: 3
        },
        {
            edit_index: 2,
            old_start_line: 4,
            old_end_line: 5,
            new_start_line: 5,
            new_end_line: 4
        }
    ]);
});

test("buildChangedRegion returns a numbered window with fresh line numbers", () => {
    const lines = ["a", "b", "c", "d", "e"];

    const resolved = resolveEdits(lines, [
        { start_line: 2, end_line: 2, new_text: "B1\nB2" },
        { start_line: 4, end_line: 5, new_text: "" }
    ]);

    const { newLines, changedRanges } = applyResolvedEdits(lines, resolved);
    const region = buildChangedRegion(newLines, changedRanges);

    assert.equal(region.start_line, 1);
    assert.equal(region.end_line, 4);
    assert.equal(region.preview, "1 | a\n2 | B1\n3 | B2\n4 | c");
});

/* ------------------------------------------------------------------ */
/* Unified diff                                                        */
/* ------------------------------------------------------------------ */

test("formatUnifiedDiff produces two hunks with correct headers", () => {
    const oldLines = [
        "l1", "l2", "l3", "l4", "l5", "l6",
        "l7", "l8", "l9", "l10", "l11", "l12"
    ];
    const newLines = [
        "l1", "L2", "l3", "l4", "l5", "l6",
        "l7", "l8", "l9", "L10", "l11", "l12"
    ];

    assert.equal(
        formatUnifiedDiff(oldLines, newLines, {
            fromFile: "a/test.txt",
            toFile: "b/test.txt"
        }),
        [
            "--- a/test.txt",
            "+++ b/test.txt",
            "@@ -1,5 +1,5 @@",
            " l1",
            "-l2",
            "+L2",
            " l3",
            " l4",
            " l5",
            "@@ -7,6 +7,6 @@",
            " l7",
            " l8",
            " l9",
            "-l10",
            "+L10",
            " l11",
            " l12"
        ].join("\n")
    );
});

test("formatUnifiedDiff handles interleaved changes in one hunk", () => {
    assert.equal(
        formatUnifiedDiff(["a", "b", "c", "d", "e"], ["a", "x", "c", "y", "e"]),
        [
            "--- a",
            "+++ b",
            "@@ -1,5 +1,5 @@",
            " a",
            "-b",
            "+x",
            " c",
            "-d",
            "+y",
            " e"
        ].join("\n")
    );
});

test("formatUnifiedDiff handles insertion at the top and deletion of everything", () => {
    assert.equal(
        formatUnifiedDiff(["b", "c"], ["a", "b", "c"]),
        ["--- a", "+++ b", "@@ -1,2 +1,3 @@", "+a", " b", " c"].join("\n")
    );

    assert.equal(
        formatUnifiedDiff(["a", "b"], []),
        ["--- a", "+++ b", "@@ -1,2 +0,0 @@", "-a", "-b"].join("\n")
    );
});

test("formatUnifiedDiff returns an empty string when nothing changed", () => {
    assert.equal(formatUnifiedDiff(["a", "b"], ["a", "b"]), "");
});

test("very large middles fall back to one replace block instead of an LCS table", () => {
    const oldLines = Array.from({ length: 3000 }, (unused, index) => `old${index}`);
    const newLines = Array.from({ length: 3000 }, (unused, index) => `new${index}`);

    const diff = formatUnifiedDiff(oldLines, newLines);

    assert.ok(diff.includes("@@ -1,3000 +1,3000 @@"));
    assert.ok(diff.includes("-old0"));
    assert.ok(diff.includes("+new2999"));
});

test("capDiff truncates with an explanatory note", () => {
    assert.equal(capDiff("l1\nl2\nl3", 2), "l1\nl2\n... diff truncated after 2 lines (1 more)");
    assert.equal(capDiff("l1\nl2", 5), "l1\nl2");
});

/* ------------------------------------------------------------------ */
/* Hashes                                                              */
/* ------------------------------------------------------------------ */

test("sha256Hex produces lowercase hex digests", () => {
    assert.match(sha256Hex("hello"), /^[0-9a-f]{64}$/);
});

test("normalizeHash tolerates prefixes, whitespace, and casing", () => {
    assert.equal(normalizeHash(" SHA256:AbC123\n"), "abc123");
    assert.equal(normalizeHash("AbC123"), "abc123");
    assert.equal(normalizeHash(null), "");
});

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

let failed = 0;

for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        failed += 1;
        console.error(`FAIL - ${name}`);
        console.error(error);
    }
}

if (failed === 0) {
    console.log(`\nAll ${tests.length} tests passed.`);
} else {
    console.error(`\n${failed} of ${tests.length} tests failed.`);
    process.exitCode = 1;
}
