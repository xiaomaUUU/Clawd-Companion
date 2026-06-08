import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkHooks, installHooks, removeHooks, repairHooks } from "../src/main/hooks-manager.js";

const command = "node \"C:/Clawd/hook-forwarder/index.js\"";
const otherCommand = "node \"C:/other/hook.js\"";
const staleCompanionCommand = "node \"C:/Old/hook-forwarder/index.js\" --port 47634 --token old";

let dirs: string[] = [];
function tempPaths() {
  const dir = mkdtempSync(join(tmpdir(), "clawd-hooks-"));
  dirs.push(dir);
  return {
    settingsPath: join(dir, "settings.json"),
    backupPath: join(dir, "settings.clawd-backup.json")
  };
}

function readSettings(settingsPath: string) {
  return JSON.parse(readFileSync(settingsPath, "utf8"));
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("hooks manager", () => {
  it("installs companion hooks without replacing user hooks", () => {
    const { settingsPath, backupPath } = tempPaths();
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: otherCommand }] }]
      }
    }));

    expect(installHooks(settingsPath, backupPath, command).success).toBe(true);

    const settings = readSettings(settingsPath);
    expect(settings.hooks.PreToolUse).toHaveLength(2);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(otherCommand);
    expect(settings.hooks.PreToolUse[1].hooks[0].command).toBe(command);
  });

  it("repairs only missing companion hooks", () => {
    const { settingsPath, backupPath } = tempPaths();
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: "*", hooks: [{ type: "command", command }] }],
        Stop: [{ matcher: "*", hooks: [{ type: "command", command: otherCommand }] }]
      }
    }));

    const result = repairHooks(settingsPath, backupPath, command);

    expect(result.success).toBe(true);
    expect(result.fixed).not.toContain("SessionStart");
    expect(result.fixed).toContain("Stop");
    const settings = readSettings(settingsPath);
    expect(settings.hooks.Stop.map((entry: { hooks: Array<{ command: string }> }) => entry.hooks[0].command)).toEqual([otherCommand, command]);
  });

  it("replaces stale companion hooks when repairing", () => {
    const { settingsPath, backupPath } = tempPaths();
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        Stop: [
          { matcher: "Bash", hooks: [{ type: "command", command: otherCommand }] },
          { matcher: "*", hooks: [{ type: "command", command: staleCompanionCommand }] }
        ]
      }
    }));

    expect(repairHooks(settingsPath, backupPath, command).success).toBe(true);

    const settings = readSettings(settingsPath);
    expect(settings.hooks.Stop.map((entry: { hooks: Array<{ command: string }> }) => entry.hooks[0].command)).toEqual([otherCommand, command]);
  });

  it("removes only companion hooks and keeps user hooks", () => {
    const { settingsPath, backupPath } = tempPaths();
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: otherCommand }] },
          { matcher: "*", hooks: [{ type: "command", command: staleCompanionCommand }] },
          { matcher: "*", hooks: [{ type: "command", command }] }
        ],
        Stop: [{ matcher: "*", hooks: [{ type: "command", command }] }]
      }
    }));

    expect(removeHooks(settingsPath, backupPath, command).success).toBe(true);

    const settings = readSettings(settingsPath);
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(otherCommand);
    expect(settings.hooks.Stop).toBeUndefined();
  });

  it("reports installed only when each required event has companion command", () => {
    const { settingsPath, backupPath } = tempPaths();
    installHooks(settingsPath, backupPath, command);

    const status = checkHooks(settingsPath, command);

    expect(status.installed).toBe(true);
    expect(status.hookCount).toBe(status.requiredCount);
    expect(status.missingEvents).toEqual([]);
  });
});
