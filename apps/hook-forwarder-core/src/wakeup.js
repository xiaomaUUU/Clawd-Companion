import { existsSync } from "node:fs";
import { request } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { autoStartMarkerPath } from "./io.js";
/**
 * Detect how to launch the Clawd Companion main app based on where this
 * forwarder lives. Returns null if we cannot determine a launch path.
 *
 * Dev layout:   <project>/dist/hook-forwarder[-codex]/index.js  →  npm start in <project>
 * Prod layout:  <install>/resources/hook-forwarder[-codex]/index.js  →  <install>/Clawd Companion.exe
 */
export function findCompanionExecutable() {
    let here;
    try {
        here = fileURLToPath(import.meta.url);
    }
    catch {
        return null;
    }
    const norm = here.replaceAll("\\", "/");
    const devSuffix = "/dist/hook-forwarder/index.js";
    const prodSuffix = "/resources/hook-forwarder/index.js";
    const devSuffixCodex = "/dist/hook-forwarder-codex/index.js";
    const prodSuffixCodex = "/resources/hook-forwarder-codex/index.js";
    if (norm.endsWith(devSuffix) || norm.endsWith(devSuffixCodex)) {
        const projectRoot = norm.endsWith(devSuffix)
            ? norm.slice(0, -devSuffix.length)
            : norm.slice(0, -devSuffixCodex.length);
        // 直接 spawn electron.exe 而非 npm.cmd —— Node 22 在 Windows 上禁止
        // 直接 spawn .cmd 文件（会抛 EINVAL），绕开 npm 是最简单的修法
        const electronExe = process.platform === "win32"
            ? `${projectRoot}/node_modules/electron/dist/electron.exe`
            : `${projectRoot}/node_modules/electron/dist/electron`;
        return { command: electronExe, args: [projectRoot] };
    }
    if (norm.endsWith(prodSuffix) || norm.endsWith(prodSuffixCodex)) {
        const installDir = norm.endsWith(prodSuffix)
            ? norm.slice(0, -prodSuffix.length)
            : norm.slice(0, -prodSuffixCodex.length);
        const exeName = process.platform === "win32" ? "Clawd Companion.exe" : "Clawd Companion";
        return { command: `${installDir}/${exeName}`, args: [] };
    }
    return null;
}
/** Quick TCP-level ping: returns true if Clawd Companion is already serving /health. */
export function pingHealth(port, timeoutMs = 500) {
    return new Promise((resolve) => {
        const req = request({
            host: "127.0.0.1",
            port,
            path: "/health",
            method: "GET",
            timeout: timeoutMs
        }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => { req.destroy(); resolve(false); });
        req.end();
    });
}
/**
 * Resolve whether the user has enabled CLI auto-start. Default is OFF.
 */
export function isAutoStartEnabled() {
    const envOverride = process.env.CLAWD_COMPANION_AUTOSTART;
    if (envOverride === "0")
        return false;
    if (envOverride === "1")
        return true;
    return existsSync(autoStartMarkerPath);
}
/**
 * Wake up Clawd Companion. Best-effort, never throws.
 */
export async function wakeupCompanion(port, log = () => { }) {
    const envOverride = process.env.CLAWD_COMPANION_AUTOSTART ?? "(unset)";
    const markerExists = existsSync(autoStartMarkerPath);
    log(`[clawd] auto-start: env=${envOverride} marker=${autoStartMarkerPath} exists=${markerExists}`);
    if (!isAutoStartEnabled()) {
        log("[clawd] auto-start: disabled");
        return false;
    }
    if (await pingHealth(port)) {
        log("[clawd] auto-start: companion already running on /health");
        return true;
    }
    const target = findCompanionExecutable();
    if (!target) {
        log("[clawd] auto-start: cannot determine companion path (forwarder location unrecognized)");
        return false;
    }
    log(`[clawd] auto-start: spawning ${target.command} ${target.args.join(" ")}`);
    try {
        const child = spawn(target.command, target.args, {
            detached: true,
            stdio: "ignore",
            cwd: target.cwd,
            windowsHide: true
        });
        child.on("error", err => log(`[clawd] auto-start: spawn error: ${err.message}`));
        child.unref();
        log(`[clawd] auto-start: spawned (pid=${child.pid})`);
        return true;
    }
    catch (err) {
        log(`[clawd] auto-start: failed to spawn: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}
