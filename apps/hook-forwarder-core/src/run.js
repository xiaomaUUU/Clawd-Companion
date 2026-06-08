import { text, readStdin, parseCliOptions, readConnectionConfig, forwarderLog } from "./io.js";
import { postEvent, requestPermission } from "./client.js";
import { wakeupCompanion } from "./wakeup.js";
function detectHookName(payload) {
    return text(payload.hook_event_name)
        ?? text(payload.hookEventName)
        ?? text(payload.event)
        ?? "Unknown";
}
export async function runForwarder(options) {
    const { provider, autoStartHookEvent = "SessionStart" } = options;
    const cliOptions = parseCliOptions(process.argv.slice(2));
    const fileConfig = readConnectionConfig();
    const port = Number(cliOptions.port ?? process.env.CLAWD_COMPANION_PORT ?? fileConfig.port ?? "47634");
    const token = cliOptions.token ?? process.env.CLAWD_COMPANION_TOKEN ?? fileConfig.token ?? "clawd-local";
    const privacyMode = process.env.CLAWD_PRIVACY_MODE ?? "safe";
    const clientType = process.env.CLAWD_CLIENT_TYPE;
    const clientLabel = process.env.CLAWD_CLIENT_LABEL?.trim() || undefined;
    const raw = readStdin();
    if (!raw.trim())
        return;
    let payload;
    try {
        payload = JSON.parse(raw);
    }
    catch {
        process.stderr.write(`[clawd][${provider.id}] forward error: invalid JSON from stdin\n`);
        return;
    }
    const hookName = detectHookName(payload);
    if (provider.isPermissionEvent(payload)) {
        try {
            // For permission events we need the tool+detail. The provider didn't
            // surface them, so we extract a couple of common fields directly.
            const tool = String(text(payload.tool_name) ?? text(payload.toolName) ?? "Unknown");
            const detail = text(payload.tool_input)
                ? JSON.stringify(payload.tool_input).slice(0, 200)
                : undefined;
            const sessionId = text(payload.session_id) ?? text(payload.sessionId);
            const result = await requestPermission(tool, detail, sessionId, payload, port, token, 120000);
            if (result.decision === "allow" || result.decision === "deny") {
                process.stdout.write(provider.formatPermissionDecision(result.decision, result.reason));
            }
        }
        catch {
            // 出错时不写 stdout，CLI 会使用原生权限流程
        }
        return;
    }
    if (hookName === autoStartHookEvent) {
        forwarderLog(`${autoStartHookEvent} received, attempting auto-start (${provider.id})`);
        await wakeupCompanion(port, (msg) => {
            process.stderr.write(msg + "\n");
            forwarderLog(msg);
        });
    }
    const event = provider.normalize(payload, { privacyMode, clientType, clientLabel });
    await postEvent(event, port, token);
}
