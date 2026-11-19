import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

/*
 * Windows: raw-mode terminal input (cursor keys, in-line editing) requires a
 * real console handle. In a standalone Git Bash (mintty) window, node.exe
 * does not get one: its stdin/stdout are pipes, and readline then silently
 * skips setRawMode (pipes have no such method), so the inquirer prompts fall
 * back to line-based input. Running under `winpty` gives node.exe a hidden
 * real console and restores full raw-mode interactivity.
 *
 * To keep `cogsagent` fully interactive in mintty without changing how it is
 * launched, the agent relaunches itself through winpty when it detects that
 * both stdin and stdout are pipes. In terminals that already provide a
 * console (VS Code integrated terminal, Windows Terminal, cmd, PowerShell)
 * it simply runs directly.
 *
 * If winpty is not installed or cannot start, the agent silently falls back
 * to running directly (line-based prompts, the previous behavior).
 */

const RELAUNCH_GUARD = "WEBCOGS_AGENT_WINPTY_CHILD";

function shouldRelaunchUnderWinpty() {
    if (process.platform !== "win32") return false;
    if (process.env[RELAUNCH_GUARD] === "1") return false;
    if (!process.argv[1]) return false;
    /*
     * Only relaunch when the process is fully detached from a console (piped
     * stdin AND stdout). When either side is a real console, readline
     * already gets raw mode there, and pipes must be preserved so stdin
     * redirections keep working.
     */
    if (process.stdin?.isTTY || process.stdout?.isTTY) return false;
    return true;
}

if (shouldRelaunchUnderWinpty()) {
    const scriptPath = path.resolve(process.argv[1]);
    const result = spawnSync(
        "winpty",
        /*
         * -Xallow-non-tty: the relaunch inherits the agent's piped stdio,
         * which plain winpty refuses ("stdin is not a tty"). The flag makes
         * winpty bridge those pipes onto its hidden console, exactly like an
         * interactive `winpty node agent.js` from a Git Bash prompt.
         */
        [
            "-Xallow-non-tty",
            process.execPath,
            scriptPath,
            ...process.argv.slice(2)
        ],
        {
            stdio: ["inherit", "inherit", "pipe"],
            env: {
                ...process.env,
                [RELAUNCH_GUARD]: "1",
                /*
                 * force_color.js skips itself on a real console; keep the
                 * forced colors so styling survives whatever mode the
                 * winpty-hosted console negotiated.
                 */
                FORCE_COLOR: process.env.FORCE_COLOR ?? "1"
            }
        }
    );

    const stderrText = result.stderr?.toString() ?? "";
    const winptyItselfFailed =
        result.error !== undefined ||
        (result.status !== 0 &&
            /winpty|assert|not a tty/i.test(stderrText));

    if (!winptyItselfFailed) {
        /*
         * The relaunched agent ran to completion; propagate its exit status.
         * stderr is buffered by spawnSync, so flush anything the child wrote.
         */
        if (stderrText) process.stderr.write(stderrText);
        process.exit(result.status ?? (result.signal ? 1 : 0));
    }

    /*
     * winpty is unavailable or could not create a console (for example in
     * headless environments, where it aborts with an assertion because no
     * console size is available). Fall through: the agent continues
     * directly with line-based prompts. The winpty error output is
     * suppressed to keep the fallback seamless.
     */
}
