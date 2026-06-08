#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const roots = ["apps"];
const extensions = new Set([".ts", ".tsx", ".cts", ".mts", ".mjs"]);
const ignoredDirs = new Set(["node_modules", "dist", "release", ".git"]);

const checks = [
  { name: "ts-ignore", pattern: /@ts-ignore/, message: "Use @ts-expect-error with a reason instead of @ts-ignore." },
  { name: "console-log", pattern: /\bconsole\.log\s*\(/, message: "Avoid stray console.log in app code." },
  { name: "eslint-disable", pattern: /eslint-disable/, message: "Avoid disabling lint rules without review." }
];

const failures = [];

for (const root of roots) {
  walk(root);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`${failure.file}:${failure.line}: ${failure.message}`);
  }
  process.exit(1);
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) walk(path);
      continue;
    }
    if (!extensions.has(extname(path))) continue;
    if (path.includes(`${sep}tests${sep}`)) continue;
    checkFile(path);
  }
}

function checkFile(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((lineText, index) => {
    for (const check of checks) {
      if (check.pattern.test(lineText)) {
        failures.push({ file, line: index + 1, message: check.message });
      }
    }
  });
}

function extname(path) {
  const match = /\.[^.]+$/.exec(path);
  return match ? match[0] : "";
}
