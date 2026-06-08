import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendPluginRun, canRunPlugin, normalizePlugin } from "../src/main/plugin-runner.js";
import type { CompanionEvent, CustomPlugin, PluginRunRecord } from "../src/shared/events.js";

const basePlugin: CustomPlugin = {
  id: "p1",
  name: "Plugin",
  scriptPath: __filename,
  enabled: true,
  trusted: true,
  events: ["done"],
  permissions: ["event"]
};

const doneEvent: CompanionEvent = {
  id: "e1",
  source: "manual",
  event: "done",
  title: "Done",
  message: "Done",
  timestamp: Date.now()
};

let dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("plugin runner", () => {
  it("requires trust before running plugins", () => {
    expect(canRunPlugin({ ...basePlugin, trusted: false }, doneEvent)).toEqual({ ok: false, reason: "not trusted" });
    expect(canRunPlugin(basePlugin, doneEvent)).toEqual({ ok: true });
  });

  it("normalizes optional plugin fields", () => {
    const plugin = normalizePlugin({ ...basePlugin, permissions: undefined, trusted: undefined });
    expect(plugin.permissions).toEqual([]);
    expect(plugin.trusted).toBe(false);
  });

  it("exposes manifest parse errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "clawd-plugin-"));
    dirs.push(dir);
    const scriptPath = join(dir, "plugin.js");
    writeFileSync(scriptPath, "");
    writeFileSync(join(dir, "plugin.manifest.json"), "{");

    const plugin = normalizePlugin({ ...basePlugin, scriptPath });

    expect(plugin.manifestError).toBeTruthy();
  });

  it("keeps recent plugin records bounded", () => {
    let records: PluginRunRecord[] = [];
    for (let i = 0; i < 60; i++) {
      records = appendPluginRun(records, {
        id: String(i),
        pluginId: "p1",
        pluginName: "Plugin",
        eventType: "done",
        startedAt: i,
        durationMs: 1,
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: ""
      });
    }
    expect(records).toHaveLength(50);
    expect(records[0].id).toBe("10");
  });
});
