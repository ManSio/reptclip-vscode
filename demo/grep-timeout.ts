/**
 * Demonstration of the bounded grep, for review. Run it with:
 *
 *   npx tsx demo/grep-timeout.ts
 *
 * It builds a throwaway repository, then runs the same `moreContext` entry point
 * the panel uses, with a short bound so the demo does not take 15 seconds.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import Module from "node:module";

// `moreContext` imports the scanner, which does not need vscode; the mock keeps
// the module graph happy in a plain Node process.
const originalLoad = (Module as any)._load;
(Module as any)._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "vscode") {
    return { Uri: {}, workspace: {}, window: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

interface Case {
  label: string;
  command: string;
  timeoutMs: number;
}

const CASES: Case[] = [
  {
    label: "textbook nested quantifier (refused before running)",
    command: 'grep "(a+)+" .',
    timeoutMs: 1000,
  },
  {
    label: "optional item in a repeated group (hangs without the bound)",
    command: 'grep "^(.*a){10}$" .',
    timeoutMs: 1000,
  },
  {
    label: "alternation that repeats (hangs without the bound)",
    command: 'grep "^(a|aa)+$" .',
    timeoutMs: 1000,
  },
  {
    label: "a number with an optional dot (linear, must work)",
    command: 'grep "^[0-9]+[.]?[0-9]+$" .',
    timeoutMs: 1000,
  },
  {
    label: "a URL shape (linear, must work)",
    command: 'grep "^https?://[a-z]+([.][a-z]+)+$" .',
    timeoutMs: 1000,
  },
  {
    label: "literal search for the same hostile text (-F, no regex)",
    command: 'grep -F "^(a+)+$" .',
    timeoutMs: 1000,
  },
];

async function main(): Promise<void> {
  const { moreContext } = require("../src/core/moreContext") as typeof import("../src/core/moreContext");

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "reptclip-demo-"));
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  await fs.writeFile(path.join(root, "hostile.txt"), "a".repeat(20000) + "!\n");
  await fs.writeFile(path.join(root, "numbers.txt"), "42\n3.14\n");
  await fs.writeFile(path.join(root, "links.txt"), "https://example.com/docs\n");
  await fs.writeFile(path.join(root, "plain.txt"), "nothing interesting\n");

  console.log(`demo repo: ${root}\n`);
  for (const item of CASES) {
    const started = performance.now();
    try {
      const result = await moreContext(root, item.command, {
        grepTimeoutMs: item.timeoutMs,
      });
      const matches = (result.markdown.match(/^## /gm) ?? []).length;
      console.log(
        `OK      ${String(Math.round(performance.now() - started)).padStart(5)} ms  ${item.label}  (${matches} section(s))`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const kind = /ran for more than/.test(message) ? "STOPPED" : "REFUSED";
      console.log(
        `${kind.padEnd(8)}${String(Math.round(performance.now() - started)).padStart(5)} ms  ${item.label}`,
      );
      console.log(`         ${message.split("\n")[0].slice(0, 110)}`);
    }
  }

  // After several stopped searches the process must still work.
  const after = await moreContext(root, 'grep "42" .', { grepTimeoutMs: 1000 });
  console.log(
    `\nafter all cases, a normal search still works: ${/42/.test(after.markdown) ? "yes" : "NO"}`,
  );
  await fs.rm(root, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
