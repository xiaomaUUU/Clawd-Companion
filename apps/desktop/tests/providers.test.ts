import { describe, expect, it } from "vitest";
import { claudeCodeProvider, codexProvider, getProvider, hermesProvider, providers } from "../src/shared/providers.js";
import { stateFromEvent } from "../src/shared/events.js";

describe("provider registry", () => {
  it("exposes both built-in providers in a stable order", () => {
    expect(Object.keys(providers)).toEqual(["claude-code", "codex", "hermes"]);
  });

  it("returns the same provider instance by id", () => {
    expect(getProvider("claude-code")).toBe(claudeCodeProvider);
    expect(getProvider("codex")).toBe(codexProvider);
    expect(getProvider("hermes")).toBe(hermesProvider);
  });
});

describe("claudeCodeProvider.normalize", () => {
  it("maps PreToolUse Read to a tool_start event", () => {
    const event = claudeCodeProvider.normalize(
      { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/tmp/a.ts" }, session_id: "s1", cwd: "/tmp" },
      { privacyMode: "detailed" }
    );
    expect(event.source).toBe("claude-code");
    expect(event.event).toBe("tool_start");
    expect(event.tool).toBe("Read");
    expect(event.detail).toBe("a.ts");
    expect(stateFromEvent(event)).toBe("tool_read");
  });

  it("respects privacyMode safe by stripping details", () => {
    const event = claudeCodeProvider.normalize(
      { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /" } },
      { privacyMode: "safe" }
    );
    expect(event.detail).toBeUndefined();
  });

  it("skips permission flow when permission_mode is auto", () => {
    expect(claudeCodeProvider.isPermissionEvent({ hook_event_name: "PreToolUse", permission_mode: "auto" })).toBe(false);
    expect(claudeCodeProvider.isPermissionEvent({ hook_event_name: "PreToolUse", permission_mode: "default" })).toBe(true);
  });

  it("skips permission flow when permission_mode is missing (sub-agent scenario)", () => {
    expect(claudeCodeProvider.isPermissionEvent({ hook_event_name: "PreToolUse" })).toBe(false);
  });

  it("formats permission decisions in Claude's wire format", () => {
    const stdout = claudeCodeProvider.formatPermissionDecision("allow", "user said yes");
    expect(JSON.parse(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "user said yes"
      },
      continue: true
    });
  });
});

describe("codexProvider.normalize", () => {
  it("maps SessionStart to a session_start event with codex source", () => {
    const event = codexProvider.normalize(
      { event: "SessionStart", session_id: "c-1", cwd: "/repo" },
      {}
    );
    expect(event.source).toBe("codex");
    expect(event.event).toBe("session_start");
    expect(event.clientLabel).toBe("OpenAI Codex CLI");
    expect(stateFromEvent(event)).toBe("thinking");
  });

  it("maps PreToolUse shell to tool_bash via the new Shell ToolName", () => {
    const event = codexProvider.normalize(
      { event: "PreToolUse", tool_name: "shell", tool_input: { command: "ls -la" } },
      { privacyMode: "detailed" }
    );
    expect(event.event).toBe("tool_start");
    expect(event.tool).toBe("Shell");
    expect(stateFromEvent(event)).toBe("tool_bash");
  });

  it("maps update_plan to task pet state", () => {
    const event = codexProvider.normalize(
      { event: "PreToolUse", tool_name: "update_plan" },
      {}
    );
    expect(event.tool).toBe("UpdatePlan");
    expect(stateFromEvent(event)).toBe("task");
  });

  it("maps apply_patch to tool_edit and view_image to tool_read", () => {
    expect(stateFromEvent(codexProvider.normalize({ event: "PreToolUse", tool_name: "apply_patch" }, {}))).toBe("tool_edit");
    expect(stateFromEvent(codexProvider.normalize({ event: "PreToolUse", tool_name: "view_image" }, {}))).toBe("tool_read");
  });

  it("treats PermissionRequest as a permission event with the Codex wire format", () => {
    expect(codexProvider.isPermissionEvent({ event: "PermissionRequest", tool_name: "shell" })).toBe(true);
    expect(codexProvider.isPermissionEvent({ event: "PreToolUse" })).toBe(false);
    const stdout = codexProvider.formatPermissionDecision("deny", "blocked by user");
    expect(JSON.parse(stdout)).toEqual({ continue: true, decision: "deny", reason: "blocked by user" });
  });

  it("maps Stop to done and SubagentStart to agent", () => {
    expect(stateFromEvent(codexProvider.normalize({ event: "Stop" }, {}))).toBe("done");
    expect(stateFromEvent(codexProvider.normalize({ event: "SubagentStart" }, {}))).toBe("agent");
  });

  it("falls back to a notification for unknown events", () => {
    const event = codexProvider.normalize({ event: "SomethingNew" }, {});
    expect(event.event).toBe("notification");
  });
});

describe("hermesProvider.normalize", () => {
  it("maps pre_tool_call terminal to a tool_start event", () => {
    const event = hermesProvider.normalize(
      { event: "pre_tool_call", tool_name: "terminal", args: { command: "npm test" }, session_id: "h-1", cwd: "/repo" },
      { privacyMode: "detailed" }
    );

    expect(event.source).toBe("hermes");
    expect(event.event).toBe("tool_start");
    expect(event.tool).toBe("Shell");
    expect(event.sessionId).toBe("h-1");
    expect(event.detail).toBe("npm test");
    expect(stateFromEvent(event)).toBe("tool_bash");
  });

  it("maps post_tool_call success to a tool_end event", () => {
    const event = hermesProvider.normalize(
      { event: "post_tool_call", tool_name: "read_file", args: { path: "/repo/src/app.ts" }, status: "success" },
      { privacyMode: "detailed" }
    );

    expect(event.source).toBe("hermes");
    expect(event.event).toBe("tool_end");
    expect(event.tool).toBe("Read");
    expect(event.detail).toBe("app.ts");
    expect(stateFromEvent(event)).toBe("idle");
  });

  it("respects safe privacy mode for command details", () => {
    const event = hermesProvider.normalize(
      { event: "pre_tool_call", tool_name: "terminal", args: { command: "rm -rf /tmp/example" } },
      { privacyMode: "safe" }
    );

    expect(event.detail).toBeUndefined();
  });

  it("maps session and approval lifecycle events", () => {
    expect(hermesProvider.normalize({ event: "on_session_start" }, {}).event).toBe("session_start");
    expect(hermesProvider.normalize({ event: "on_session_end" }, {}).event).toBe("done");
    expect(hermesProvider.normalize({ event: "pre_approval_request", command: "rm -rf /tmp/example" }, {}).event).toBe("permission_wait");
  });
});
