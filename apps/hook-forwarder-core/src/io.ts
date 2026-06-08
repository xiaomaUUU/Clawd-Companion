import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type HookPayload = Record<string, unknown>;

export function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const connectionConfigPath = join(homedir(), ".clawd-companion", "connection.json");
export const autoStartMarkerPath = join(homedir(), ".clawd-companion", "auto-start-with-cli.flag");
export const forwarderLogPath = join(homedir(), ".clawd-companion", "forwarder.log");

export interface ConnectionConfig {
  port?: number;
  token?: string;
}

export function readConnectionConfig(): ConnectionConfig {
  try {
    const parsed = JSON.parse(readFileSync(connectionConfigPath, "utf8")) as ConnectionConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function parseCliOptions(args: string[]): { port?: string; token?: string } {
  const options: { port?: string; token?: string } = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--port") options.port = args[++index];
    else if (arg.startsWith("--port=")) options.port = arg.slice("--port=".length);
    else if (arg === "--token") options.token = args[++index];
    else if (arg.startsWith("--token=")) options.token = arg.slice("--token=".length);
  }
  return options;
}

export function forwarderLog(msg: string): void {
  try {
    const dir = dirname(forwarderLogPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(forwarderLogPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // ignore — logging must never break the hook
  }
}

export function basename(pathLike: string | undefined): string | undefined {
  if (!pathLike) return undefined;
  const parts = pathLike.replaceAll("\\", "/").split("/").filter(Boolean);
  return parts.at(-1);
}

export function summarizeCommand(command: string | undefined): string | undefined {
  if (!command) return undefined;
  const trimmed = command.replace(/\s+/g, " ").trim();
  return trimmed.length > 80 ? trimmed.slice(0, 77) + "..." : trimmed;
}
