import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTomlHooks, parseTomlHooks, readTomlHooks, writeTomlHooks, TomlParseError } from "../src/main/toml-hooks.js";

let dirs: string[] = [];
function tempPath(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "clawd-toml-"));
  dirs.push(dir);
  return join(dir, name);
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("parseTomlHooks", () => {
  it("parses a known Codex config with foreign sections", () => {
    const source = `# Top comment
model = "gpt-5"
approval_policy = "on-request"
sandbox = "workspace-write"

[[SessionStart]]
matcher = "*"
[[SessionStart.hooks]]
type = "command"
command = "node /tmp/old.js"
timeout = 5

[[PreToolUse]]
matcher = "*"
[[PreToolUse.hooks]]
type = "command"
command = "node /tmp/old.js"
timeout = 5

[[mcp_servers]]
name = "filesystem"
command = "npx"
`;
    const file = parseTomlHooks(source);
    expect(file.events.SessionStart).toHaveLength(1);
    expect(file.events.PreToolUse).toHaveLength(1);
    expect(file.events.SessionStart[0].body).toContain('command = "node /tmp/old.js"');
    expect(file.foreignSections.join("")).toContain("[[mcp_servers]]");
  });

  it("returns empty events when source has only foreign content", () => {
    const file = parseTomlHooks(`model = "gpt-5"\n`);
    expect(file.events).toEqual({});
  });

  it("refuses unknown top-level syntax", () => {
    expect(() => parseTomlHooks("weirdKey = ???\n")).toThrow(TomlParseError);
  });
});

describe("writeTomlHooks round-trip", () => {
  it("installs companion hooks without disturbing foreign sections", () => {
    const path = tempPath("config.toml");
    const initial = `# Codex config
model = "gpt-5"
approval_policy = "on-request"

[[PreToolUse]]
matcher = "*"
[[PreToolUse.hooks]]
type = "command"
command = "node /tmp/user-hook.js"
timeout = 3
`;
    writeFileSync(path, initial);

    const before = readTomlHooks(path);
    writeTomlHooks(
      path,
      before,
      ["SessionStart", "PreToolUse"],
      { command: "node /usr/share/hook-forwarder-codex/index.js", commandWindows: 'node "C:\\hook-forwarder-codex\\index.js"', timeout: 5 }
    );

    const serialized = readFileSync(path, "utf8");
    expect(serialized).toContain('model = "gpt-5"');
    expect(serialized).toContain('approval_policy = "on-request"');
    expect(serialized).toContain("node /tmp/user-hook.js");
    expect(serialized).toContain("node /usr/share/hook-forwarder-codex/index.js");
    expect(serialized).toContain("commandWindows =");

    const after = readTomlHooks(path);
    const status = checkTomlHooks(after, ["SessionStart", "PreToolUse"], "node /usr/share/hook-forwarder-codex/index.js");
    expect(status.installed).toBe(true);
    expect(status.missingEvents).toEqual([]);
  });

  it("creates the parent directory and the config file when missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "clawd-toml-empty-"));
    dirs.push(dir);
    const path = join(dir, "codex", "config.toml");
    expect(existsSync(path)).toBe(false);

    writeTomlHooks(
      path,
      { events: {}, preamble: "", foreignSections: [] },
      ["SessionStart"],
      { command: "node /path/to/forwarder.js" }
    );

    expect(existsSync(path)).toBe(true);
    const parsed = readTomlHooks(path);
    expect(parsed.events.SessionStart).toHaveLength(1);
  });

  it("refuses to read a corrupt TOML and writeTomlHooks skips parsing when no file", () => {
    const path = tempPath("config.toml");
    writeFileSync(path, "this is not valid TOML at all !!!\n");
    expect(() => readTomlHooks(path)).toThrow(TomlParseError);
    // Caller-side (hooks-manager) catches the read error and propagates;
    // we don't touch the original file.
    expect(existsSync(path)).toBe(true);
    const before = readFileSync(path, "utf8");
    expect(before).toContain("this is not valid TOML");
  });
});

describe("checkTomlHooks", () => {
  it("reports missing events when no companion command is present", () => {
    const file: ReturnType<typeof parseTomlHooks> = { events: { SessionStart: [] }, preamble: "", foreignSections: [] };
    const status = checkTomlHooks(file, ["SessionStart", "PreToolUse"], "node /comp.js");
    expect(status.installed).toBe(false);
    expect(status.missingEvents).toContain("PreToolUse");
  });
});
