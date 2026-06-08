import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkHooks, installHooks, removeHooks, repairHooks } from "../src/main/hooks-manager.js";
import { codexProvider } from "../src/shared/providers.js";

const command = 'node "C:/Clawd/hook-forwarder-codex/index.js"';
const windowsCommand = 'node "C:\\\\Clawd\\\\hook-forwarder-codex\\\\index.js"';
const expectedEscapedCommand = 'node \\"C:/Clawd/hook-forwarder-codex/index.js\\"';

let dirs: string[] = [];
function tempPath() {
  const dir = mkdtempSync(join(tmpdir(), "clawd-codex-hooks-"));
  dirs.push(dir);
  return {
    settingsPath: join(dir, "config.toml"),
    backupPath: join(dir, "config.clawd-backup.toml")
  };
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("hooks-manager (codex)", () => {
  it("installs Codex hooks into a fresh TOML file", () => {
    const { settingsPath } = tempPath();
    const result = installHooks(settingsPath, "", command, codexProvider);
    expect(result.success).toBe(true);

    const content = readFileSync(settingsPath, "utf8");
    expect(content).toContain("[[SessionStart]]");
    expect(content).toContain("[[PreToolUse]]");
    expect(content).toContain(expectedEscapedCommand);
  });

  it("preserves foreign sections like model and approval_policy", () => {
    const { settingsPath } = tempPath();
    writeFileSync(settingsPath, `model = "gpt-5"\napproval_policy = "on-request"\n`);
    const result = installHooks(settingsPath, "", command, codexProvider);
    expect(result.success).toBe(true);
    const content = readFileSync(settingsPath, "utf8");
    expect(content).toContain('model = "gpt-5"');
    expect(content).toContain('approval_policy = "on-request"');
  });

  it("reports installed only when every Codex event has the companion command", () => {
    const { settingsPath } = tempPath();
    installHooks(settingsPath, "", command, codexProvider);

    const status = checkHooks(settingsPath, command, codexProvider);
    expect(status.installed).toBe(true);
    expect(status.hookCount).toBe(codexProvider.requiredEvents.length);
    expect(status.missingEvents).toEqual([]);
  });

  it("repairs only the missing Codex events", () => {
    const { settingsPath } = tempPath();
    writeFileSync(
      settingsPath,
      `[[SessionStart]]
matcher = "*"
[[SessionStart.hooks]]
type = "command"
command = "${expectedEscapedCommand}"
timeout = 5
`
    );
    const result = repairHooks(settingsPath, "", command, codexProvider);
    expect(result.success).toBe(true);
    expect(result.fixed).not.toContain("SessionStart");
    expect(result.fixed).toContain("PreToolUse");
  });

  it("removes only companion Codex hooks", () => {
    const { settingsPath } = tempPath();
    installHooks(settingsPath, "", command, codexProvider);
    const result = removeHooks(settingsPath, "", command, codexProvider);
    expect(result.success).toBe(true);
    const content = readFileSync(settingsPath, "utf8");
    expect(content).not.toContain("[[SessionStart]]");
    expect(content).not.toContain("[[PreToolUse]]");
  });

  it("writes commandWindows on Windows alongside command", async () => {
    const { settingsPath } = tempPath();
    if (process.platform !== "win32") {
      const { writeTomlHooks } = await import("../src/main/toml-hooks.js");
      writeTomlHooks(
        settingsPath,
        { events: {}, preamble: "", foreignSections: [] },
        ["SessionStart"],
        { command, commandWindows: windowsCommand, timeout: 5 }
      );
      const content = readFileSync(settingsPath, "utf8");
      expect(content).toContain("commandWindows =");
      expect(content).toContain(windowsCommand);
    } else {
      const result = installHooks(settingsPath, "", command, codexProvider);
      expect(result.success).toBe(true);
      const content = readFileSync(settingsPath, "utf8");
      expect(content).toContain("commandWindows =");
    }
  });
});
