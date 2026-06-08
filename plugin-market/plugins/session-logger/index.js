#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => processInput(input));

// Fallback: if stdin "end" never fires (Windows pipe issue), process after 500ms silence
let idleTimer;
process.stdin.on("data", () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => processInput(input), 500);
});

function processInput(raw) {
  if (idleTimer) clearTimeout(idleTimer);
  try {
    const event = JSON.parse(raw || "{}");
    const settings = JSON.parse(process.env.CLAWD_PLUGIN_SETTINGS || "{}");
    const pluginDir = process.env.CLAWD_PLUGIN_DIR || ".";
    const logPath = path.resolve(pluginDir, settings.logPath || "clawd-events.log");
    const format = settings.format || "json";

    let line;
    if (format === "json") {
      const record = { timestamp: new Date().toISOString(), event: event.event, title: event.title };
      if (settings.includeDetail && event.detail) record.detail = event.detail;
      line = JSON.stringify(record);
    } else {
      line = `[${new Date().toISOString()}] ${event.event}: ${event.title}`;
      if (settings.includeDetail && event.detail) line += ` | ${event.detail}`;
    }

    fs.appendFileSync(logPath, line + "\n");
    console.log(`Logged to ${logPath}`);
  } catch (err) {
    console.error("Logger error:", err.message);
    process.exit(1);
  }
}
