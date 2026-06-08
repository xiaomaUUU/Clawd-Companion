import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
export function readStdin() {
    try {
        return readFileSync(0, "utf8");
    }
    catch {
        return "";
    }
}
export function asObject(value) {
    return value && typeof value === "object" ? value : {};
}
export function text(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
export const connectionConfigPath = join(homedir(), ".clawd-companion", "connection.json");
export const autoStartMarkerPath = join(homedir(), ".clawd-companion", "auto-start-with-cli.flag");
export const forwarderLogPath = join(homedir(), ".clawd-companion", "forwarder.log");
export function readConnectionConfig() {
    try {
        const parsed = JSON.parse(readFileSync(connectionConfigPath, "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
export function parseCliOptions(args) {
    const options = {};
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--port")
            options.port = args[++index];
        else if (arg.startsWith("--port="))
            options.port = arg.slice("--port=".length);
        else if (arg === "--token")
            options.token = args[++index];
        else if (arg.startsWith("--token="))
            options.token = arg.slice("--token=".length);
    }
    return options;
}
export function forwarderLog(msg) {
    try {
        const dir = dirname(forwarderLogPath);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        appendFileSync(forwarderLogPath, `[${new Date().toISOString()}] ${msg}\n`);
    }
    catch {
        // ignore — logging must never break the hook
    }
}
