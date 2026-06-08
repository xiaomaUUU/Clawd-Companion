import { describe, expect, it } from "vitest";
import { isCompanionEvent, isPermissionRoute, parsePermissionRequestBody, streamToken } from "../src/main/event-server.js";

const validEvent = {
  id: "event-1",
  source: "claude-code",
  event: "tool_start",
  title: "正在读文件",
  message: "Read 工具已开始。",
  timestamp: Date.now(),
  tool: "Read"
};

describe("event server validation", () => {
  it("accepts valid companion events", () => {
    expect(isCompanionEvent(validEvent)).toBe(true);
  });

  it("rejects unknown event types", () => {
    expect(isCompanionEvent({ ...validEvent, event: "unknown_event" })).toBe(false);
  });

  it("rejects oversized string fields", () => {
    expect(isCompanionEvent({ ...validEvent, message: "x".repeat(2001) })).toBe(false);
  });

  it("normalizes permission request payloads", () => {
    const parsed = parsePermissionRequestBody({ toolName: "Bash", toolDetail: "npm test", sessionId: "s1", rawPayload: { ok: true } });

    expect(parsed).toEqual({ toolName: "Bash", toolDetail: "npm test", sessionId: "s1", rawPayload: { ok: true } });
  });

  it("falls back to Unknown for invalid tool names", () => {
    const parsed = parsePermissionRequestBody({ toolName: "Shell", rawPayload: [] });

    expect(parsed?.toolName).toBe("Unknown");
    expect(parsed?.rawPayload).toEqual({});
  });

  it("parses stream tokens and permission routes", () => {
    expect(streamToken("/stream?token=abc")).toBe("abc");
    expect(streamToken("/events?token=abc")).toBe("");
    expect(isPermissionRoute("/permission/123")).toBe(true);
    expect(isPermissionRoute("/permissions")).toBe(false);
  });
});
