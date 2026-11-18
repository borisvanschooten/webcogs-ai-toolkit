/*
 * Unit tests for edit_engine.js.
 *
 * Run from the workspace root:
 *
 *   node webcogs/edit_engine_test.js
 */

import assert from "node:assert/strict";

import {
    EditEngineError,
    applyResolvedEdits,
    buildChangedRegion,
    capDiff,
    escapeTabsForDisplay,
    formatNumberedLines,
    formatUnifiedDiff,
    joinLines,
    lineNumberWidth,
    normalizeHash,
    parseEditLines,
    resolveEdits,
    sha256Hex,
    splitLines,
    unescapeTabsFromDisplay
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
/* resolveEdits anchor resolution                                      */
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

test("an exact line_hint anchors the edit", () => {
    const [resolved] = resolveEdits(sampleLines, [
        { line_hint: 6, old_text: "  return 2;", new_text: "  return 3;" }
    ]);

    assert.equal(resolved.position, 5);
    assert.equal(resolved.anchoredAtHint, true);
    assert.equal(resolved.offset, 0);
});

test("a stale line_hint is recovered by the offset search", () => {
    const [resolved] = resolveEdits(sampleLines, [
        { line_hint: 1, old_text: "  return 2;", new_text: "  return 3;" }
    ]);

    assert.equal(resolved.position, 5);
    assert.equal(resolved.anchoredAtHint, false);
    assert.equal(resolved.offset, 5);
});

test("a unique match is found without a line_hint", () => {
    const [resolved] = resolveEdits(sampleLines, [
        { old_text: "  return 2;", new_text: "  return 3;" }
    ]);

    assert.equal(resolved.position, 5);
    assert.equal(resolved.lineHint, null);
});

test("an ambiguous anchor without a hint is rejected with match lines", () => {
    assert.throws(
        () => resolveEdits(sampleLines, [{ old_text: "}", new_text: "  }" }]),
        (error) => {
            assert.ok(error instanceof EditEngineError);
            assert.equal(error.data.matches_found, 2);
            assert.deepEqual(error.data.matching_lines, [3, 7]);
            return true;
        }
    );
});

test("a line_hint disambiguates an otherwise ambiguous anchor", () => {
    const [resolved] = resolveEdits(sampleLines, [
        { line_hint: 7, old_text: "}", new_text: "  }" }
    ]);

    assert.equal(resolved.position, 6);
    assert.equal(resolved.anchoredAtHint, true);
});

test("a missing anchor reports numbered nearby lines", () => {
    try {
        resolveEdits(sampleLines, [
            { line_hint: 2, old_text: "  return 99;", new_text: "" }
        ]);
        assert.fail("expected a missing-anchor error");
    } catch (error) {
        assert.ok(error instanceof EditEngineError);
        assert.equal(error.data.matches_found, 0);
        const firstNearbyLine = error.data.nearby_lines.split("\n")[0];
        assert.equal(firstNearbyLine, "1 | function a() {");
    }
});

test("an anchor beyond the offset window is still found globally", () => {
    const lines = Array.from({ length: 30 }, (unused, index) =>
        index === 26 ? "TARGET" : `filler ${index}`
    );

    const [resolved] = resolveEdits(lines, [
        { line_hint: 1, old_text: "TARGET", new_text: "REPLACED" }
    ]);

    assert.equal(resolved.position, 26);
    assert.equal(resolved.offset, 26);
});

test("matching is immune to CRLF line endings", () => {
    const { lines } = splitLines("a\r\nTARGET\r\n");

    const [resolved] = resolveEdits(lines, [
        { old_text: "TARGET", new_text: "REPLACED" }
    ]);

    assert.equal(resolved.position, 1);
});

test("empty old_text is rejected", () => {
    assert.throws(
        () => resolveEdits(sampleLines, [{ old_text: "", new_text: "x" }]),
        EditEngineError
    );
});

test("identical old_text and new_text is rejected", () => {
    assert.throws(
        () => resolveEdits(sampleLines, [{ old_text: "}", new_text: "}" }]),
        EditEngineError
    );
});

test("overlapping edits are rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    line_hint: 1,
                    old_text: "function a() {",
                    new_text: "function z() {"
                },
                {
                    line_hint: 1,
                    old_text: "function a() {\n  return 1;",
                    new_text: "function a() {\n  return 9;"
                }
            ]),
        /overlap/
    );
});

test("adjacent (non-overlapping) edits are allowed", () => {
    const resolved = resolveEdits(sampleLines, [
        { line_hint: 1, old_text: "function a() {", new_text: "function z() {" },
        { line_hint: 2, old_text: "  return 1;", new_text: "  return 9;" }
    ]);

    assert.equal(resolved.length, 2);
    assert.deepEqual(
        resolved.map((edit) => edit.position),
        [0, 1]
    );
});

/* ------------------------------------------------------------------ */
/* applyResolvedEdits                                                  */
/* ------------------------------------------------------------------ */

test("applyResolvedEdits applies insertion, replacement, and deletion", () => {
    const lines = ["a", "b", "c", "d", "e"];

    const resolved = resolveEdits(lines, [
        { line_hint: 2, old_text: "b", new_text: "B1\nB2" },
        { line_hint: 5, old_text: "d\ne", new_text: "" }
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
        { line_hint: 2, old_text: "b", new_text: "B1\nB2" },
        { line_hint: 5, old_text: "d\ne", new_text: "" }
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
/* Tab display escaping                                                */
/* ------------------------------------------------------------------ */

test("formatNumberedLines shows tabs as the two characters \\t", () => {
    assert.equal(
        formatNumberedLines(["\tconst a = 1;"], 1, 1),
        "1 | \\tconst a = 1;"
    );
    assert.equal(escapeTabsForDisplay("a\tb"), "a\\tb");
    assert.equal(unescapeTabsFromDisplay("a\\tb"), "a\tb");
    assert.equal(unescapeTabsFromDisplay("no escapes"), "no escapes");
});

test("old_text with \\t display sequences falls back to real tabs", () => {
    const lines = ["\tfunction a() {", "\t\treturn 1;", "\t}"];

    const [resolved] = resolveEdits(lines, [
        {
            line_hint: 2,
            old_text: "\\t\\treturn 1;",
            new_text: "\\t\\treturn 2;"
        }
    ]);

    assert.equal(resolved.position, 1);
    assert.equal(resolved.usedTabEscape, true);
    assert.deepEqual(resolved.newLines, ["\t\treturn 2;"]);
});

test("literal backslash-t text matches verbatim without the fallback", () => {
    const lines = ["if (ch === '\\t') {"];

    const [resolved] = resolveEdits(lines, [
        {
            line_hint: 1,
            old_text: "if (ch === '\\t') {",
            new_text: "if (ch === '\\v') {"
        }
    ]);

    assert.equal(resolved.position, 0);
    assert.equal(resolved.usedTabEscape, false);
    assert.deepEqual(resolved.newLines, ["if (ch === '\\v') {"]);
});

test("an ambiguous tab fallback reports the matching lines", () => {
    const lines = [
        "\treturn 1;",
        "\treturn 2;",
        "x",
        "\treturn 1;",
        "\treturn 2;"
    ];

    assert.throws(
        () =>
            resolveEdits(lines, [
                { old_text: "\\treturn 1;\n\\treturn 2;", new_text: "" }
            ]),
        (error) => {
            assert.ok(error instanceof EditEngineError);
            assert.equal(error.data.matches_found, 2);
            assert.deepEqual(error.data.matching_lines, [1, 4]);
            return true;
        }
    );
});

/* ------------------------------------------------------------------ */
/* Line-range edits                                                    */
/* ------------------------------------------------------------------ */

test("a line-range edit replaces the range without old_text", () => {
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
    assert.deepEqual(resolved[0].range, { start_line: 5, end_line: 7 });

    const { newLines } = applyResolvedEdits(sampleLines, resolved);
    assert.deepEqual(newLines.slice(4), ["function b() {", "\treturn 2;", "}"]);
});

test("a line-range edit can delete its range with empty new_text", () => {
    const resolved = resolveEdits(sampleLines, [
        { start_line: 4, end_line: 7, new_text: "" }
    ]);

    const { newLines } = applyResolvedEdits(sampleLines, resolved);
    assert.deepEqual(newLines, ["function a() {", "  return 1;", "}"]);
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

test("an edit must provide old_text or a line range", () => {
    assert.throws(
        () => resolveEdits(sampleLines, [{ new_text: "x" }]),
        EditEngineError
    );
});

test("an edit cannot provide both old_text and a line range", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    old_text: "function a() {",
                    start_line: 1,
                    end_line: 3,
                    new_text: "x"
                }
            ]),
        /not both/
    );
});

test("overlapping range and content edits are rejected", () => {
    assert.throws(
        () =>
            resolveEdits(sampleLines, [
                {
                    line_hint: 1,
                    old_text: "function a() {",
                    new_text: "function z() {"
                },
                { start_line: 1, end_line: 2, new_text: "x" }
            ]),
        /overlap/
    );
});

/* ------------------------------------------------------------------ */
/* Runner                                                             */
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
