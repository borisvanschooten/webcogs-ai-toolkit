#!/usr/bin/env node
import "dotenv/config";
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import process from "node:process";

import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

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
    resolveEdits,
    sha256Hex,
    splitLines
} from "./edit_engine.js";


marked.use(markedTerminal());


if (!process.env.OPENROUTER_API_KEY) {
    console.error(
        "OPENROUTER_API_KEY is missing. Add it to agent/.env before starting the agent."
    );
    process.exit(1);
}

const WORKSPACE_DIRECTORY = process.cwd();
const CONFIG_PATH = "webcogs/agent_config.json";
var config = {}
var DENIED_FILE_PATTERNS=[];
//import * as config from "./config.js";

const defaultHeaders = {
    "HTTP-Referer": "https://github.com/borisvanschooten/webcogs-ai-toolkit",
    "X-Openrouter-Title": "Webcogs Agent",
    "X-OpenRouter-Categories": "cli-agent",
};

var openai = null;


async function getAgentConfig() {
    const configpath = path.join(WORKSPACE_DIRECTORY,CONFIG_PATH);
    try {
        const configfile = await fs.readFile(configpath, "utf8")
        config = JSON.parse(configfile)
        console.log(`Config: ${configpath}`)
        config.WORKSPACE_DIRECTORY = WORKSPACE_DIRECTORY;
        config.LOG_DIRECTORY = path.join(config.WORKSPACE_DIRECTORY, config.LOG_RELATIVE_DIRECTORY);
        config.model = process.env.OPENROUTER_MODEL || config.model || "z-ai/glm-5.3-flash"; //"moonshotai/kimi-k3.1-pro";

        /*
        * Files the agent must never read, matched against the workspace-relative
        * path (with forward slashes) using case-insensitive regular expressions.
        * This keeps credentials, private keys, and similar secrets out of the
        * conversation.
        *
        * The built-in patterns can be extended (never replaced) through the
        * DENIED_FILE_PATTERNS environment variable, which holds a JSON array of
        * regular-expression source strings, for example in webcogs/.env:
        *
        *   DENIED_FILE_PATTERNS='["\\.htpasswd$", "\\.tfstate$"]'
        */
        DENIED_FILE_PATTERNS = [
            ...parseConfiguredDeniedFilePatterns(config.DEFAULT_DENIED_FILE_PATTERNS,""),
            ...parseConfiguredDeniedFilePatterns(process.env.DENIED_FILE_PATTERNS,"")
        ];

    } catch (err) {
        throw new Error(`Cannot read config file from ${configpath}.`)
    }

    openai = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: config.API_BASEURL || "https://openrouter.ai/api/v1",
        defaultHeaders
    });
}


function parseConfiguredDeniedFilePatterns(rawValue,modifier) {
    let parsedValue;

    if (Array.isArray(rawValue)) {
        parsedValue = rawValue;
    } else {
        if (typeof rawValue !== "string" || rawValue.trim() === "") {
            return [];
        }

        try {
            parsedValue = JSON.parse(rawValue);
        } catch (error) {
            console.error(
                `Ignoring DENIED_FILE_PATTERNS: expected a JSON array of regular-expression source strings (${error.message}).`
            );
            return [];
        }

        if (!Array.isArray(parsedValue)) {
            console.error(
                "Ignoring DENIED_FILE_PATTERNS: expected a JSON array of regular-expression source strings."
            );
            return [];
        }
    }

    const patterns = [];

    for (const entry of parsedValue) {
        if (typeof entry !== "string" || entry.trim() === "") {
            console.error(
                `Ignoring DENIED_FILE_PATTERNS entry ${JSON.stringify(entry)}: entries must be non-empty strings.`
            );
            continue;
        }

        try {
            patterns.push(new RegExp(entry, modifier));
        } catch (error) {
            console.error(
                `Ignoring DENIED_FILE_PATTERNS entry ${JSON.stringify(entry)}: ${error.message}`
            );
        }
    }

    return patterns;
}




const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const tools = [
    {
        type: "function",
        name: "list_files",
        description:
            "List files and directories inside a workspace directory. The result is recursive up to the requested depth. Files matching the denied-file patterns (credentials, private keys, .env files, .git contents, and similar secrets) are omitted.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                directory: {
                    type: "string",
                    description:
                        "Workspace-relative directory to list. Use '.' for the workspace root."
                },
                max_depth: {
                    type: "integer",
                    minimum: 0,
                    maximum: 10,
                    description: "Maximum recursive directory depth."
                }
            },
            required: ["directory", "max_depth"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "read_file",
        description:
            "Read a UTF-8 text file inside the workspace. The lines are returned numbered in a fixed-width gutter (\"  42 | line text\") together with a sha256 hash that must be passed as expected_hash to edit_file. Optional line ranges limit the response for large files. Files matching the denied-file patterns (credentials, private keys, .env files, .git contents, and similar secrets) cannot be read.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "Workspace-relative path of the file to read."
                },
                start_line: {
                    type: ["integer", "null"],
                    minimum: 1,
                    description:
                        "Optional first line to return (1-based). Defaults to the first line of the file."
                },
                end_line: {
                    type: ["integer", "null"],
                    minimum: 1,
                    description:
                        "Optional last line to return (1-based, inclusive). Defaults to the last line of the file."
                }
            },
            required: ["file_path", "start_line", "end_line"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "edit_file",
        description:
            "Apply one or more exact search/replace edits to an existing UTF-8 text file, atomically. Each edit replaces old_text with new_text; old_text must match the file (after line-ending normalization) at exactly one location. line_hint is the 1-based line number where old_text is expected, taken from read_file's numbered output; it disambiguates multiple matches, and if the file has shifted, the surrounding lines are searched. expected_hash must be the sha256 hash from the most recent read_file or edit_file result for this file; if the file changed since it was read, the edit is rejected. All edits are resolved against the same file snapshot and must not overlap; if any edit cannot be applied, nothing is changed and the error reports the actual numbered lines nearby. The user must approve every edit before changes are made.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "Workspace-relative path of the file to edit."
                },
                expected_hash: {
                    type: "string",
                    description:
                        "The sha256 hash returned by the most recent read_file or edit_file call for this file."
                },
                edits: {
                    type: "array",
                    minItems: 1,
                    description:
                        "The edits to apply, all resolved against the same file snapshot.",
                    items: {
                        type: "object",
                        properties: {
                            line_hint: {
                                type: ["integer", "null"],
                                minimum: 1,
                                description:
                                    "1-based line number of old_text's first line, as shown by read_file's numbered output."
                            },
                            old_text: {
                                type: "string",
                                description:
                                    "Exact text to replace, copied from the numbered read without the ' N | ' gutter. Must match the file at exactly one location; include enough surrounding lines to make it unique. A single trailing newline is ignored."
                            },
                            new_text: {
                                type: "string",
                                description:
                                    "Replacement text. May be empty to delete the old lines. A single trailing newline is ignored."
                            }
                        },
                        required: ["line_hint", "old_text", "new_text"],
                        additionalProperties: false
                    }
                }
            },
            required: ["file_path", "expected_hash", "edits"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "write_file",
        description:
            "Create or completely replace a UTF-8 text file inside the workspace. Parent directories are created automatically. When an existing file is replaced, the original is first moved to a '<filename>.cogs_bak' backup file, replacing any existing backup. For targeted changes to existing files, prefer edit_file. The user must approve every write before any filesystem changes are made.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "Workspace-relative path of the file to write."
                },
                content: {
                    type: "string",
                    description:
                        "The complete new contents of the file to write."
                }
            },
            required: ["file_path", "content"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "delete_file",
        description:
            "Delete a single regular file inside the workspace. Directories are not deleted. The user must approve every deletion before any filesystem changes are made.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "Workspace-relative path of the file to delete."
                }
            },
            required: ["file_path"],
            additionalProperties: false
        }
    },
    {
        type: "function",
        name: "run_command",
        description:
            "Run a shell command from the workspace root. The user must approve every command before it executes.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description:
                        "The complete shell command, such as 'npm test' or 'git diff -- src/app.js'."
                },
                timeout_ms: {
                    type: "integer",
                    minimum: 1000,
                    maximum: 600000,
                    description: "Maximum time to allow the command to run."
                }
            },
            required: ["command", "timeout_ms"],
            additionalProperties: false
        }
    }
];

function resolveWorkspacePath(relativePath) {
    if (typeof relativePath !== "string" || relativePath.trim() === "") {
        throw new Error("A non-empty workspace-relative path is required.");
    }

    const resolvedPath = path.resolve(config.WORKSPACE_DIRECTORY, relativePath);
    const relativeToWorkspace = path.relative(
        config.WORKSPACE_DIRECTORY,
        resolvedPath
    );

    if (
        relativeToWorkspace === ".." ||
        relativeToWorkspace.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeToWorkspace)
    ) {
        throw new Error(
            `Access denied: "${relativePath}" is outside the workspace.`
        );
    }

    return resolvedPath;
}

function workspaceRelativePath(absolutePath) {
    const relativePath = path.relative(config.WORKSPACE_DIRECTORY, absolutePath);
    return relativePath === "" ? "." : relativePath.split(path.sep).join("/");
}

function isDeniedFilePath(relativePath) {
    return DENIED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function shouldIgnoreDirectory(name) {
    return [
        ".git",
        "node_modules",
        ".next",
        "dist",
        "build",
        "coverage",
        ".cache",
        ".ssh",
        ".aws",
        "logs"
    ].includes(name);
}

async function listFilesRecursively(
    absoluteDirectory,
    currentDepth,
    maxDepth,
    lines
) {
    const entries = await fs.readdir(absoluteDirectory, {
        withFileTypes: true
    });

    entries.sort((left, right) => {
        if (left.isDirectory() && !right.isDirectory()) {
            return -1;
        }

        if (!left.isDirectory() && right.isDirectory()) {
            return 1;
        }

        return left.name.localeCompare(right.name);
    });

    for (const entry of entries) {
        const absoluteEntryPath = path.join(absoluteDirectory, entry.name);
        const relativeEntryPath = workspaceRelativePath(absoluteEntryPath);

        if (entry.isDirectory()) {
            lines.push(`${relativeEntryPath}/`);

            if (
                currentDepth < maxDepth &&
                !shouldIgnoreDirectory(entry.name)
            ) {
                await listFilesRecursively(
                    absoluteEntryPath,
                    currentDepth + 1,
                    maxDepth,
                    lines
                );
            }
        } else if (!isDeniedFilePath(relativeEntryPath)) {
            lines.push(relativeEntryPath);
        }

        if (lines.length >= config.MAX_DIRECTORY_LIST_LENGTH) {
            lines.push(
                `...listing stopped after {config.MAX_DIRECTORY_LIST_LENGTH} entries to limit response size`
            );
            return;
        }
    }
}

async function listFiles(args) {
    const directory = resolveWorkspacePath(args.directory);
    const stats = await fs.stat(directory);

    if (!stats.isDirectory()) {
        throw new Error(`"${args.directory}" is not a directory.`);
    }

    const maxDepth = Math.max(0, Math.min(10, args.max_depth));
    const lines = [];

    await listFilesRecursively(directory, 0, maxDepth, lines);

    return {
        workspace: config.WORKSPACE_DIRECTORY,
        directory: args.directory,
        entries: lines
    };
}

async function readFile(args) {
    const absoluteFilePath = resolveWorkspacePath(args.file_path);
    const relativeFilePath = workspaceRelativePath(absoluteFilePath);

    if (isDeniedFilePath(relativeFilePath)) {
        throw new Error(
            `Access denied: "${args.file_path}" matches a denied-file pattern, so its contents cannot be read.`
        );
    }

    const stats = await fs.stat(absoluteFilePath);

    if (!stats.isFile()) {
        throw new Error(`"${args.file_path}" is not a regular file.`);
    }

    if (stats.size > config.MAX_FILE_SIZE_BYTES) {
        throw new Error(
            `"${args.file_path}" is ${stats.size} bytes, which exceeds the ${config.MAX_FILE_SIZE_BYTES}-byte reading limit.`
        );
    }

    const content = await fs.readFile(absoluteFilePath, "utf8");
    const { lines } = splitLines(content);
    const totalLines = lines.length;

    const startLine = Number.isInteger(args.start_line)
        ? Math.max(1, Math.min(args.start_line, Math.max(totalLines, 1)))
        : 1;
    const endLine = Number.isInteger(args.end_line)
        ? Math.max(startLine, Math.min(args.end_line, totalLines))
        : totalLines;

    const selectedLines = lines.slice(startLine - 1, endLine);

    const numberedContent =
        selectedLines.length === 0
            ? "(the file is empty)"
            : formatNumberedLines(
                  selectedLines,
                  startLine,
                  lineNumberWidth(totalLines)
              );

    return {
        file_path: args.file_path,
        size_bytes: stats.size,
        hash: sha256Hex(content),
        total_lines: totalLines,
        start_line: startLine,
        end_line: endLine,
        content: numberedContent
    };
}

async function requestWriteApproval(filePath, content, previousContent) {
    console.log("\nThe agent wants to write this file:");
    console.log("------------------------------------------------------------");
    console.log(`File: ${filePath}`);
    console.log(
        `If this file already exists, its current contents will be moved to ${filePath}${config.BACKUP_FILE_SUFFIX} before overwriting.`
    );

    if (previousContent === null) {
        console.log("New file. Proposed content:");
        console.log(content);
    } else {
        const previousLines = splitLines(previousContent).lines;
        const proposedLines = splitLines(content).lines;

        const diffText = capDiff(
            formatUnifiedDiff(previousLines, proposedLines, {
                fromFile: `a/${filePath}`,
                toFile: `b/${filePath}`
            })
        );

        if (diffText === "") {
            console.log(
                "The proposed content has no line-level changes; only line endings or the trailing newline differ."
            );
        } else {
            console.log("Unified diff against the current contents:");
            console.log(diffText);
        }
    }

    console.log("------------------------------------------------------------");

    const answer = await terminal.question("Approve this file write? [y/N] ");
    const normalizedAnswer = answer.trim().toLowerCase();

    return normalizedAnswer === "y" || normalizedAnswer === "yes";
}

async function writeFile(args) {
    const absoluteFilePath = resolveWorkspacePath(args.file_path);
    const contentSize = Buffer.byteLength(args.content, "utf8");

    //if (contentSize > config.MAX_FILE_SIZE_BYTES) {
    //    throw new Error(
    //        `The proposed content is ${contentSize} bytes, which exceeds the ${config.MAX_FILE_SIZE_BYTES}-byte writing limit.`
    //    );
    //}

    let previousContent = null;

    try {
        previousContent = await fs.readFile(absoluteFilePath, "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    const approved = await requestWriteApproval(
        args.file_path,
        args.content,
        previousContent
    );

    if (!approved) {
        return {
            approved: false,
            file_path: args.file_path,
            changed: false,
            message: "The user declined to write this file."
        };
    }

    await fs.mkdir(path.dirname(absoluteFilePath), {
        recursive: true
    });

    if (previousContent === args.content) {
        return {
            approved: true,
            file_path: args.file_path,
            changed: false,
            message: "The file already had the requested content."
        };
    }

    let backupFilePath = null;

    if (previousContent !== null) {
        backupFilePath = `${absoluteFilePath}${config.BACKUP_FILE_SUFFIX}`;

        /*
         * Back up the original before it is overwritten. `fs.rename` replaces
         * an existing destination file on all supported platforms, so a
         * previous backup is simply overwritten.
         */
        await fs.rename(absoluteFilePath, backupFilePath);
    }

    await fs.writeFile(absoluteFilePath, args.content, "utf8");

    return {
        approved: true,
        file_path: args.file_path,
        changed: true,
        size_bytes: contentSize,
        backup_file_path:
            backupFilePath === null
                ? null
                : `${args.file_path}${config.BACKUP_FILE_SUFFIX}`,
        message:
            previousContent === null
                ? "File created successfully."
                : `File replaced successfully. The original was moved to ${args.file_path}${config.BACKUP_FILE_SUFFIX}.`
    };
}

async function requestEditApproval(
    filePath,
    editCount,
    diffText,
    oldLineCount,
    newLineCount
) {
    console.log("\nThe agent wants to edit this file:");
    console.log("------------------------------------------------------------");
    console.log(`File: ${filePath}`);
    console.log(
        `Edits: ${editCount} (${oldLineCount} lines before, ${newLineCount} lines after)`
    );
    console.log(
        "Unified diff (applied atomically; the current contents are backed up first):"
    );
    console.log(diffText);
    console.log("------------------------------------------------------------");

    const answer = await terminal.question("Approve this edit? [y/N] ");
    const normalizedAnswer = answer.trim().toLowerCase();

    return normalizedAnswer === "y" || normalizedAnswer === "yes";
}

/*
 * Apply one or more search/replace edits to an existing file.
 *
 * Reliability comes from four layers:
 *
 *  1. The expected_hash guard rejects edits based on a stale view of the
 *     file, including changes made outside the agent.
 *  2. Edits are anchored on their old_text content; the model's line_hint is
 *     verified first, then searched around, then the whole file, which must
 *     match uniquely.
 *  3. All edits are resolved and validated against the same snapshot and
 *     applied atomically: a single bad edit changes nothing.
 *  4. Failures return structured context (actual hashes, matching line
 *     numbers, numbered nearby lines) so the model can correct itself.
 */
async function editFile(args) {
    const absoluteFilePath = resolveWorkspacePath(args.file_path);
    const relativeFilePath = workspaceRelativePath(absoluteFilePath);

    if (isDeniedFilePath(relativeFilePath)) {
        throw new Error(
            `Access denied: "${args.file_path}" matches a denied-file pattern, so its contents cannot be read or edited.`
        );
    }

    if (
        typeof args.expected_hash !== "string" ||
        args.expected_hash.trim() === ""
    ) {
        throw new Error(
            "expected_hash is required. Take it from the most recent read_file or edit_file result for this file."
        );
    }

    if (!Array.isArray(args.edits) || args.edits.length === 0) {
        throw new Error("At least one edit is required.");
    }

    let stats;

    try {
        stats = await fs.stat(absoluteFilePath);
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(
                `"${args.file_path}" does not exist. Use write_file to create it.`
            );
        }

        throw error;
    }

    if (!stats.isFile()) {
        throw new Error(`"${args.file_path}" is not a regular file.`);
    }

    const content = await fs.readFile(absoluteFilePath, "utf8");
    const actualHash = sha256Hex(content);

    if (normalizeHash(args.expected_hash) !== actualHash) {
        throw new EditEngineError(
            `"${args.file_path}" changed since it was last read, so the edits were rejected. Re-read the file and retry with the fresh hash.`,
            {
                file_path: args.file_path,
                expected_hash: normalizeHash(args.expected_hash),
                actual_hash: actualHash
            }
        );
    }

    const { lines, usesCrlf, trailingNewline } = splitLines(content);
    const resolvedEdits = resolveEdits(lines, args.edits);
    const { newLines, changedRanges } = applyResolvedEdits(lines, resolvedEdits);
    const newContent = joinLines(newLines, usesCrlf, trailingNewline);

    if (newContent === content) {
        return {
            approved: true,
            file_path: args.file_path,
            changed: false,
            message: "The edits produced no changes."
        };
    }

    const newSize = Buffer.byteLength(newContent, "utf8");

    //if (newSize > config.MAX_FILE_SIZE_BYTES) {
    //    throw new Error(
    //        `The edited file would be ${newSize} bytes, which exceeds the ${config.MAX_FILE_SIZE_BYTES}-byte writing limit.`
    //    );
    //}

    const diffText = capDiff(
        formatUnifiedDiff(lines, newLines, {
            fromFile: `a/${args.file_path}`,
            toFile: `b/${args.file_path}`
        })
    );

    const approved = await requestEditApproval(
        args.file_path,
        resolvedEdits.length,
        diffText,
        lines.length,
        newLines.length
    );

    if (!approved) {
        return {
            approved: false,
            file_path: args.file_path,
            changed: false,
            message: "The user declined the edit."
        };
    }

    /*
     * Same backup scheme as write_file: `fs.rename` replaces an existing
     * destination file on all supported platforms, so a previous backup is
     * simply overwritten.
     */
    const backupFilePath = `${absoluteFilePath}${config.BACKUP_FILE_SUFFIX}`;

    await fs.rename(absoluteFilePath, backupFilePath);
    await fs.writeFile(absoluteFilePath, newContent, "utf8");

    return {
        approved: true,
        file_path: args.file_path,
        changed: true,
        edits_applied: resolvedEdits.length,
        changed_ranges: changedRanges,
        total_lines: newLines.length,
        hash: sha256Hex(newContent),
        backup_file_path: `${args.file_path}${config.BACKUP_FILE_SUFFIX}`,
        changed_region: buildChangedRegion(newLines, changedRanges),
        message:
            "Edits applied. Use the returned hash for follow-up edits; re-read only if the file changed outside edit_file."
    };
}

async function requestDeleteApproval(filePath, sizeBytes) {
    console.log("\nThe agent wants to delete this file:");
    console.log("------------------------------------------------------------");
    console.log(`File: ${filePath}`);
    console.log(`Size: ${sizeBytes} bytes`);
    console.log("------------------------------------------------------------");

    const answer = await terminal.question(
        "Approve this file deletion? [y/N] "
    );
    const normalizedAnswer = answer.trim().toLowerCase();

    return normalizedAnswer === "y" || normalizedAnswer === "yes";
}

async function deleteFile(args) {
    const absoluteFilePath = resolveWorkspacePath(args.file_path);
    const stats = await fs.stat(absoluteFilePath);

    if (!stats.isFile()) {
        throw new Error(`"${args.file_path}" is not a regular file.`);
    }

    const approved = await requestDeleteApproval(args.file_path, stats.size);

    if (!approved) {
        return {
            approved: false,
            file_path: args.file_path,
            deleted: false,
            message: "The user declined to delete this file."
        };
    }

    await fs.unlink(absoluteFilePath);

    return {
        approved: true,
        file_path: args.file_path,
        deleted: true,
        size_bytes: stats.size,
        message: "File deleted successfully."
    };
}

function truncateCommandOutput(text) {
    if (text.length <= config.MAX_COMMAND_OUTPUT_CHARACTERS) {
        return text;
    }

    return `${text.slice(
        0,
        config.MAX_COMMAND_OUTPUT_CHARACTERS
    )}\n\n...output truncated after ${config.MAX_COMMAND_OUTPUT_CHARACTERS} characters`;
}

async function requestCommandApproval(command) {
    console.log("\nThe agent wants to run this command:");
    console.log("------------------------------------------------------------");
    console.log(command);
    console.log("------------------------------------------------------------");

    const answer = await terminal.question("Approve this command? [y/N] ");
    const normalizedAnswer = answer.trim().toLowerCase();

    return normalizedAnswer === "y" || normalizedAnswer === "yes";
}

async function runCommand(args) {
    const approved = await requestCommandApproval(args.command);

    if (!approved) {
        return {
            approved: false,
            command: args.command,
            message: "The user declined to run this command."
        };
    }

    const timeoutMs = Number.isInteger(args.timeout_ms)
        ? Math.max(1000, Math.min(600000, args.timeout_ms))
        : config.DEFAULT_COMMAND_TIMEOUT_MS;

    return await new Promise((resolve) => {
        const child = spawn(args.command, {
            cwd: config.WORKSPACE_DIRECTORY,
            shell: true,
            env: process.env
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let settled = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");

            setTimeout(() => {
                if (!settled) {
                    child.kill("SIGKILL");
                }
            }, 2000);
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            const text = chunk.toString();
            stdout += text;
            process.stdout.write(text);
        });

        child.stderr.on("data", (chunk) => {
            const text = chunk.toString();
            stderr += text;
            process.stderr.write(text);
        });

        child.on("error", (error) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);

            resolve({
                approved: true,
                command: args.command,
                error: error.message,
                stdout: truncateCommandOutput(stdout),
                stderr: truncateCommandOutput(stderr)
            });
        });

        child.on("close", (exitCode, signal) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timer);

            resolve({
                approved: true,
                command: args.command,
                exit_code: exitCode,
                signal,
                timed_out: timedOut,
                stdout: truncateCommandOutput(stdout),
                stderr: truncateCommandOutput(stderr)
            });
        });
    });
}

/*
 * Command line arguments:
 *
 *   node agent.js
 *   node agent.js --resume <conversation-log.json>
 *
 * --resume loads the raw conversation JSON written next to the markdown
 * transcripts and continues that conversation in a fresh session.
 */
function parseCommandLineArguments(argv) {
    let resumeValue = null;

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];

        if (argument === "--help" || argument === "-h") {
            printUsage();
            process.exit(0);
        }

        if (argument === "--resume" || argument === "-r") {
            if (index + 1 >= argv.length) {
                return {
                    error:
                        "The --resume option requires the path of a conversation JSON log."
                };
            }

            resumeValue = argv[index + 1];
            index += 1;
        } else if (argument.startsWith("--resume=")) {
            resumeValue = argument.slice("--resume=".length);

            if (resumeValue === "") {
                return {
                    error:
                        "The --resume option requires the path of a conversation JSON log."
                };
            }
        } else {
            return { error: `Unknown command line argument: ${argument}` };
        }
    }

    return { resumeValue };
}

function printUsage() {
    console.log("Usage: node agent.js [--resume <conversation-log.json>]");
    console.log("");
    console.log("Options:");
    console.log(
        "  -r, --resume <path>  Continue a conversation saved by an earlier session."
    );
    console.log(
        "                       The path may be absolute, relative to the workspace,"
    );
    console.log(
        "                       or a file name inside the logs directory; the .json"
    );
    console.log("                       suffix may be omitted.");
}

/*
 * Resolve a --resume value to an existing conversation JSON log. Besides
 * absolute and workspace-relative paths, a bare file name is looked up in the
 * logs directory, and a missing .json suffix is tolerated.
 */
async function resolveConversationLogPath(rawValue) {
    const candidatePaths = [rawValue];

    if (!path.isAbsolute(rawValue)) {
        candidatePaths.push(path.join(config.LOG_DIRECTORY, rawValue));
    }

    const candidates = [];

    for (const candidatePath of candidatePaths) {
        candidates.push(candidatePath);

        if (!candidatePath.endsWith(".json")) {
            candidates.push(`${candidatePath}.json`);
        }
    }

    for (const candidatePath of candidates) {
        try {
            const stats = await fs.stat(candidatePath);

            if (stats.isFile()) {
                return candidatePath;
            }
        } catch {
            /* Try the next candidate. */
        }
    }

    throw new Error(
        `Could not find a conversation log for "${rawValue}". Tried: ${candidates.join(", ")}`
    );
}

async function loadConversation(conversationFilePath) {
    let content;

    try {
        content = await fs.readFile(conversationFilePath, "utf8");
    } catch (error) {
        throw new Error(
            `Could not read the conversation log "${conversationFilePath}": ${error.message}`
        );
    }

    let conversation;

    try {
        conversation = JSON.parse(content);
    } catch (error) {
        throw new Error(
            `The conversation log "${conversationFilePath}" is not valid JSON: ${error.message}`
        );
    }

    if (!Array.isArray(conversation)) {
        throw new Error(
            `The conversation log "${conversationFilePath}" does not contain a JSON array of conversation items.`
        );
    }

    return conversation;
}

/*
 * A conversation interrupted between a function call and its output, whether
 * by a crashed session or a turn that failed midway, contains an unanswered
 * function_call, which the Responses API rejects. Pair every dangling call
 * with a synthetic error output so the conversation can continue; the model
 * sees that the tool call never completed. Returns a new array and leaves
 * the input untouched.
 */
function pairDanglingFunctionCalls(conversation) {
    const answeredCallIds = new Set(
        conversation
            .filter((item) => item && item.type === "function_call_output")
            .map((item) => item.call_id)
    );

    const pairedConversation = [];

    for (const item of conversation) {
        pairedConversation.push(item);

        if (
            item &&
            item.type === "function_call" &&
            !answeredCallIds.has(item.call_id)
        ) {
            pairedConversation.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify({
                    ok: false,
                    error:
                        "The agent was stopped before this tool call completed."
                })
            });
        }
    }

    return pairedConversation;
}

/*
 * Persist the complete raw conversation: the exact `input` item array that is
 * sent to the Responses API. The file is rewritten after every change, so it
 * is always a valid, resumable snapshot even if the agent is interrupted.
 */
async function saveConversation(conversationFilePath, conversation) {
    await fs.writeFile(
        conversationFilePath,
        JSON.stringify(conversation, null, 2),
        "utf8"
    );
}

/*
 * Create the log file pair for a session: a human-readable markdown
 * transcript and a raw conversation JSON log with the same base name. When
 * resuming, the JSON log is seeded with the loaded conversation so the new
 * session remains self-contained; the original log files are left untouched.
 */
async function createSessionFiles(initialConversation, resumedFrom) {
    const startedAt = new Date();
    const filenameTimestamp = startedAt.toISOString().replace(/[:.]/g, "-");
    const fileBaseName = `conversation-${filenameTimestamp}-${randomUUID().slice(0, 8)}`;
    const transcriptFilePath = path.join(config.LOG_DIRECTORY, `${fileBaseName}.md`);
    const conversationFilePath = path.join(
        config.LOG_DIRECTORY,
        `${fileBaseName}.json`
    );

    await fs.mkdir(config.LOG_DIRECTORY, { recursive: true });

    let header = `\`\`\`\nConversation transcript\nStarted: ${startedAt.toISOString()}\nModel: ${config.model}\n`;

    if (resumedFrom !== null) {
        header += `Resumed from: ${resumedFrom}\n`;
    }

    header += `\`\`\`\n`;

    await fs.writeFile(transcriptFilePath, header, {
        encoding: "utf8",
        flag: "wx"
    });

    await saveConversation(conversationFilePath, initialConversation);

    return { transcriptFilePath, conversationFilePath };
}

async function appendTranscriptEntry(transcriptFilePath, heading, content) {
    const timestamp = new Date().toISOString();
    const entry = `# [${timestamp}] ${heading}\n${content}\n\n`;

    await fs.appendFile(transcriptFilePath, entry, "utf8");
}

/*
 * Normalize an error into a JSON-friendly object. Errors thrown by the
 * OpenAI SDK carry the HTTP status, response headers, and the parsed response
 * body; for OpenRouter, the upstream provider details live in that body's
 * `metadata` field (for example `provider_name` and the raw provider error).
 * Every field is optional so plain filesystem and parsing errors are handled
 * the same way.
 */
function extractErrorDetails(error) {
    if (!(error instanceof Error)) {
        return { message: String(error) };
    }

    const details = {
        name: error.name,
        message: error.message
    };

    if (typeof error.status === "number") {
        details.status = error.status;
    }

    const body = error.error;

    if (body && typeof body === "object") {
        details.response_body = {
            code: body.code ?? body.error?.code,
            message: body.message ?? body.error?.message,
            metadata: body.metadata ?? body.error?.metadata ?? null
        };
    }

    const headers = error.headers;

    const retryAfter =
        typeof headers?.get === "function"
            ? headers.get("retry-after")
            : headers?.["retry-after"];

    if (retryAfter !== undefined && retryAfter !== null) {
        details.retry_after = retryAfter;
    }

    if (typeof error.request_id === "string" && error.request_id !== "") {
        details.request_id = error.request_id;
    }

    /*
     * Structured context attached by EditEngineError (matched line numbers,
     * numbered nearby lines, hashes) is passed through to the model so it can
     * correct itself.
     */
    if (error.data !== undefined) {
        details.data = error.data;
    }

    return details;
}

async function executeTool(name, args) {
    switch (name) {
        case "list_files":
            return await listFiles(args);

        case "read_file":
            return await readFile(args);

        case "edit_file":
            return await editFile(args);

        case "write_file":
            return await writeFile(args);

        case "delete_file":
            return await deleteFile(args);

        case "run_command":
            return await runCommand(args);

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

async function executeToolCall(toolCall, transcriptFilePath) {
    let parsedArguments;

    try {
        parsedArguments = JSON.parse(toolCall.arguments);
    } catch (error) {
        await appendTranscriptEntry(
            transcriptFilePath,
            `Tool call: ${toolCall.name}: error parsing arguments:`,
             toolCall.arguments
        );

        return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: JSON.stringify({
                ok: false,
                error: `Invalid JSON arguments: ${error.message}`
            })
        };
    }

    console.log(`\n[Tool] ${toolCall.name}`);
    console.log(JSON.stringify(parsedArguments, null, 4));

    await appendTranscriptEntry(
        transcriptFilePath,
        `Tool call: ${toolCall.name}`,
        "```json\n"+JSON.stringify(parsedArguments, null, 4)+"\n```"
    );

    try {
        const result = await executeTool(toolCall.name, parsedArguments);

        if (result && result.approved === false) {
            await appendTranscriptEntry(
                transcriptFilePath,
                `Tool call: ${toolCall.name}: rejected by user`,
                "```json\n"+JSON.stringify(result, null, 4)+"\n```"
            );
        }

        return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: JSON.stringify({
                ok: true,
                result
            })
        };
    } catch (error) {
        const details = extractErrorDetails(error);

        await appendTranscriptEntry(
            transcriptFilePath,
            `Tool call: ${toolCall.name}: error`,
            "```json\n" + JSON.stringify(details, null, 4) + "\n```"
        );

        const output = {
            ok: false,
            error: details.message
        };

        if (details.data !== undefined) {
            output.data = details.data;
        }

        return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: JSON.stringify(output)
        };
    }
}

async function continueUntilComplete(
    conversation,
    transcriptFilePath,
    conversationFilePath
) {
    while (true) {
        const response = await openai.responses.create({
            model:config.model,
            instructions: config.instructions,
            input: conversation,
            tools
        });

        conversation.push(...response.output);
        await saveConversation(conversationFilePath, conversation);

        const functionCalls = response.output.filter(
            (item) => item.type === "function_call"
        );

        if (functionCalls.length === 0) {
            return {
                response,
                conversation
            };
        }

        /*
         * Execute calls sequentially because one file operation may depend on
         * the result of an earlier file operation.
         */
        for (const functionCall of functionCalls) {
            const toolOutput = await executeToolCall(
                functionCall,
                transcriptFilePath
            );
            conversation.push(toolOutput);
            await saveConversation(conversationFilePath, conversation);
        }
    }
}

/*
 * Append the user message to the caller's conversation in place and drive it
 * to completion. Working on the caller's array keeps it identical to what is
 * persisted: when a request fails midway, the items that were already saved
 * (the user message and any partial output) stay in the conversation instead
 * of being lost to a stale copy, so the next request continues from the same
 * state that is on disk.
 */
async function sendUserRequest(
    userMessage,
    conversation,
    transcriptFilePath,
    conversationFilePath
) {
    conversation.push({
        role: "user",
        content: userMessage
    });

    /*
     * Persist the user message before the request so it survives even if the
     * API call fails.
     */
    await saveConversation(conversationFilePath, conversation);

    return await continueUntilComplete(
        conversation,
        transcriptFilePath,
        conversationFilePath
    );
}

async function main() {
    console.log("Webcogs Software Development Agent");
    await getAgentConfig();
    /*
     * Make the agent process itself live in the workspace root. This runs
     * after module-level imports, so `import "dotenv/config"` has already
     * resolved `webcogs/.env` relative to the original working directory.
     */
    process.chdir(config.WORKSPACE_DIRECTORY);

    const parsedArguments = parseCommandLineArguments(process.argv.slice(2));

    if (parsedArguments.error !== undefined) {
        console.error(`Error: ${parsedArguments.error}`);
        console.error("");
        printUsage();
        process.exit(1);
    }

    let resumedFrom = null;
    let loadedConversation = null;

    if (parsedArguments.resumeValue !== null) {
        try {
            resumedFrom = await resolveConversationLogPath(
                parsedArguments.resumeValue
            );
            loadedConversation = await loadConversation(resumedFrom);
        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    }

    console.log(`Model: ${config.model}`);
    console.log(`Workspace: ${config.WORKSPACE_DIRECTORY}`);
    console.log(`Log folder: ${config.LOG_DIRECTORY}`);

    if (resumedFrom !== null) {
        console.log(
            `Resuming conversation from ${resumedFrom} (${loadedConversation.length} items).`
        );
    }

    console.log("");
    console.log("Enter a development request.");
    console.log("Enter /reset to start a new conversation.");
    console.log("Enter /exit to stop the agent.");
    console.log(
        "Start with --resume <conversation-log.json> to continue a logged conversation."
    );

    let conversation = [];

    if (resumedFrom !== null) {
        conversation = pairDanglingFunctionCalls(loadedConversation);
    }

    let transcriptFilePath = null;
    let conversationFilePath = null;

    while (true) {
        const userMessage = await terminal.question("\nYou> ");
        const trimmedMessage = userMessage.trim();

        if (trimmedMessage === "") {
            continue;
        }

        if (
            trimmedMessage.toLowerCase() === "/exit" ||
            trimmedMessage.toLowerCase() === "/quit"
        ) {
            break;
        }

        if (trimmedMessage.toLowerCase() === "/reset") {
            conversation = [];
            transcriptFilePath = null;
            conversationFilePath = null;
            resumedFrom = null;
            console.log("Conversation reset.");
            continue;
        }

        try {
            console.log("\nAgent is working...");

            if (transcriptFilePath === null) {
                const sessionFiles = await createSessionFiles(
                    conversation,
                    resumedFrom
                );

                transcriptFilePath = sessionFiles.transcriptFilePath;
                conversationFilePath = sessionFiles.conversationFilePath;

                console.log(`Transcript: ${transcriptFilePath}`);
                console.log(`Conversation JSON: ${conversationFilePath}`);
            }

            await appendTranscriptEntry(
                transcriptFilePath,
                "User",
                trimmedMessage
            );

            const result = await sendUserRequest(
                trimmedMessage,
                conversation,
                transcriptFilePath,
                conversationFilePath
            );
            conversation = result.conversation;

            const finalResponse = result.response;
            const agentMessage =
                finalResponse.output_text ||
                "The request completed without a textual response.";

            await appendTranscriptEntry(
                transcriptFilePath,
                "Agent",
                agentMessage
            );

            console.log("\nAgent>");
            console.log(marked(agentMessage));
        } catch (error) {
            const details = extractErrorDetails(error);

            console.error("\nAgent error:");
            console.error(details.message);

            if (details.status !== undefined) {
                console.error(`Status: ${details.status}`);
            }

            const metadata = details.response_body?.metadata;

            if (metadata) {
                console.error("Provider metadata:");
                console.error(JSON.stringify(metadata, null, 4));
            }

            if (transcriptFilePath !== null) {
                try {
                    await appendTranscriptEntry(
                        transcriptFilePath,
                        "Agent error",
                        "```json\n" + JSON.stringify(details, null, 4) + "\n```"
                    );
                } catch {
                    /* Don't let a transcript failure mask the original error. */
                }
            }

            /*
             * Keep the in-memory conversation and the log in sync after a
             * failure. The failed turn's items (the user message and any
             * partial output) are already in `conversation` and on disk, so
             * the next request continues from them; pairing dangling function
             * calls and re-persisting here keeps that state resumable.
             */
            try {
                conversation = pairDanglingFunctionCalls(conversation);

                if (conversationFilePath !== null) {
                    await saveConversation(conversationFilePath, conversation);
                }
            } catch {
                /* Don't let a repair failure mask the original error. */
            }
        }
    }

    terminal.close();
    console.log("Agent stopped.");
}

main().catch((error) => {
    console.error(error);
    terminal.close();
    process.exitCode = 1;
});
