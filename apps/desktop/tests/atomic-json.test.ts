import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backupPathFor, readJsonWithBackup, writeJsonAtomic } from "../src/main/atomic-json.js";

let dirs: string[] = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "clawd-atomic-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("atomic json", () => {
  it("writes json and keeps a backup of the previous value", () => {
    const path = join(tempDir(), "data.json");
    writeJsonAtomic(path, { value: 1 }, 2);
    writeJsonAtomic(path, { value: 2 }, 2);

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ value: 2 });
    expect(JSON.parse(readFileSync(backupPathFor(path), "utf8"))).toEqual({ value: 1 });
  });

  it("falls back to backup when primary json is invalid", () => {
    const path = join(tempDir(), "data.json");
    writeFileSync(path, "{");
    writeFileSync(backupPathFor(path), JSON.stringify({ recovered: true }));

    expect(readJsonWithBackup(path)).toEqual({ recovered: true });
    expect(existsSync(path)).toBe(true);
  });
});
