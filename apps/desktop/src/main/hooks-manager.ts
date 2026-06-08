import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-json.js";
import { dirname } from "node:path";

export const REQUIRED_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification", "Stop"] as const;

export interface HooksStatus {
  installed: boolean;
  configExists: boolean;
  hookCount: number;
  requiredCount: number;
  missingEvents: string[];
  commandMatches: boolean;
}

interface HookCommand {
  type?: unknown;
  command?: unknown;
}

interface HookEntry {
  matcher?: unknown;
  hooks?: HookCommand[];
}

type SettingsJson = Record<string, unknown>;

export function checkHooks(settingsPath: string, command: string): HooksStatus {
  if (!existsSync(settingsPath)) {
    return missingStatus(false);
  }

  const settingsJson = readSettingsObject(settingsPath);
  if (!settingsJson) {
    return missingStatus(true);
  }

  const hooks = getHooksObject(settingsJson);
  const missing: string[] = [];
  let commandOk = true;
  let count = 0;

  for (const eventName of REQUIRED_HOOK_EVENTS) {
    const entries = getHookEntries(hooks[eventName]);
    if (!entries.some(entry => entryHasCommand(entry, command))) {
      missing.push(eventName);
      if (entries.length > 0) commandOk = false;
    } else {
      count++;
    }
  }

  return {
    installed: missing.length === 0 && commandOk,
    configExists: true,
    hookCount: count,
    requiredCount: REQUIRED_HOOK_EVENTS.length,
    missingEvents: missing,
    commandMatches: commandOk
  };
}

export function installHooks(settingsPath: string, backupPath: string, command: string): { success: boolean; error?: string } {
  try {
    const loaded = loadOrCreateSettings(settingsPath, backupPath);
    if ("error" in loaded) return { success: false, error: loaded.error };

    const hooks = ensureHooksObject(loaded.settingsJson);
    for (const eventName of REQUIRED_HOOK_EVENTS) {
      hooks[eventName] = upsertHookEntry(getHookEntries(hooks[eventName]), command, true);
    }

    writeSettings(settingsPath, loaded.settingsJson);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function repairHooks(settingsPath: string, backupPath: string, command: string): { success: boolean; fixed: string[]; error?: string } {
  try {
    const loaded = loadOrCreateSettings(settingsPath, backupPath);
    if ("error" in loaded) return { success: false, fixed: [], error: loaded.error };

    const hooks = ensureHooksObject(loaded.settingsJson);
    const fixed: string[] = [];

    for (const eventName of REQUIRED_HOOK_EVENTS) {
      const entries = getHookEntries(hooks[eventName]);
      if (!entries.some(entry => entryHasCommand(entry, command))) {
        fixed.push(eventName);
      }
      hooks[eventName] = upsertHookEntry(entries, command, true);
    }

    writeSettings(settingsPath, loaded.settingsJson);
    return { success: true, fixed };
  } catch (error) {
    return { success: false, fixed: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export function removeHooks(settingsPath: string, backupPath: string, command: string): { success: boolean; error?: string } {
  try {
    if (!existsSync(settingsPath)) return { success: true };

    const settingsJson = readSettingsObject(settingsPath);
    if (!settingsJson) {
      return { success: false, error: "settings.json 格式错误：期望对象" };
    }
    copyFileSync(settingsPath, backupPath);

    const hooks = getHooksObject(settingsJson);
    let changed = false;
    for (const eventName of REQUIRED_HOOK_EVENTS) {
      const entries = getHookEntries(hooks[eventName]);
      const nextEntries = entries
        .map(entry => removeCommandFromEntry(entry, command, true))
        .filter((entry): entry is HookEntry => entry !== null);
      if (nextEntries.length !== entries.length || nextEntries.some((entry, index) => entry !== entries[index])) {
        changed = true;
        if (nextEntries.length > 0) hooks[eventName] = nextEntries;
        else delete hooks[eventName];
      }
    }

    if (changed && Object.keys(hooks).length === 0) {
      delete settingsJson.hooks;
    }

    writeSettings(settingsPath, settingsJson);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function normalizeCommandPath(pathLike: string): string {
  return pathLike.replaceAll(String.fromCharCode(92), "/");
}

function missingStatus(configExists: boolean): HooksStatus {
  return {
    installed: false,
    configExists,
    hookCount: 0,
    requiredCount: REQUIRED_HOOK_EVENTS.length,
    missingEvents: [...REQUIRED_HOOK_EVENTS],
    commandMatches: false
  };
}

function readSettingsObject(settingsPath: string): SettingsJson | null {
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as SettingsJson;
  } catch {
    return null;
  }
}

function loadOrCreateSettings(settingsPath: string, backupPath: string): { settingsJson: SettingsJson } | { error: string } {
  if (!existsSync(settingsPath)) return { settingsJson: {} };

  const settingsJson = readSettingsObject(settingsPath);
  if (!settingsJson) return { error: "settings.json 格式错误：期望对象" };
  copyFileSync(settingsPath, backupPath);
  return { settingsJson };
}

function writeSettings(settingsPath: string, settingsJson: SettingsJson): void {
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeJsonAtomic(settingsPath, settingsJson, 2);
}

function getHooksObject(settingsJson: SettingsJson): Record<string, unknown> {
  if (!settingsJson.hooks || typeof settingsJson.hooks !== "object" || Array.isArray(settingsJson.hooks)) return {};
  return settingsJson.hooks as Record<string, unknown>;
}

function ensureHooksObject(settingsJson: SettingsJson): Record<string, unknown> {
  const hooks = getHooksObject(settingsJson);
  settingsJson.hooks = hooks;
  return hooks;
}

function getHookEntries(value: unknown): HookEntry[] {
  return Array.isArray(value) ? value.filter((entry): entry is HookEntry => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function companionHookEntry(command: string): HookEntry {
  return { matcher: "*", hooks: [{ type: "command", command }] };
}

function entryHasCommand(entry: HookEntry, command: string): boolean {
  return Array.isArray(entry.hooks) && entry.hooks.some(hook => hook?.type === "command" && hook.command === command);
}

function upsertHookEntry(entries: HookEntry[], command: string, replaceStaleCompanionHooks = false): HookEntry[] {
  if (entries.some(entry => entryHasCommand(entry, command))) return entries;
  const filtered = replaceStaleCompanionHooks ? entries.filter(entry => !entryIsCompanionHook(entry)) : entries;
  return [...filtered, companionHookEntry(command)];
}

function removeCommandFromEntry(entry: HookEntry, command: string, removeStaleCompanionHooks = false): HookEntry | null {
  if (!Array.isArray(entry.hooks)) return entry;
  if (removeStaleCompanionHooks && entryIsCompanionHook(entry)) return null;
  const nextHooks = entry.hooks.filter(hook => !(hook?.type === "command" && hook.command === command));
  if (nextHooks.length === entry.hooks.length) return entry;
  if (nextHooks.length === 0) return null;
  return { ...entry, hooks: nextHooks };
}

function entryIsCompanionHook(entry: HookEntry): boolean {
  return Array.isArray(entry.hooks) && entry.hooks.some(hook => hook?.type === "command" && typeof hook.command === "string" && hook.command.includes("hook-forwarder/index.js"));
}
