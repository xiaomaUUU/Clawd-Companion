#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runForwarder, codexProvider } from "../../hook-forwarder-core/src/index.js";

const invokedDirectly = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  runForwarder({ provider: codexProvider }).catch((error) => {
    process.stderr.write(`[clawd][codex] forward error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(0);
  });
}
