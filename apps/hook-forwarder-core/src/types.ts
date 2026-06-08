// Mirrors the desktop app's CompanionEvent shape, but kept locally so the
// forwarder doesn't have to depend on the desktop app's build setup.

export type ToolName =
  | "Read"
  | "Edit"
  | "Write"
  | "Bash"
  | "Grep"
  | "Glob"
  | "WebFetch"
  | "WebSearch"
  | "Notebook"
  | "Agent"
  | "Skill"
  | "Task"
  | "TaskCreate"
  | "TaskUpdate"
  | "AskUserQuestion"
  | "MCP"
  | "Shell"
  | "UpdatePlan"
  | "ApplyPatch"
  | "ViewImage"
  | "Unknown";

export type CompanionEventType =
  | "session_start"
  | "prompt_submit"
  | "tool_start"
  | "tool_end"
  | "notification"
  | "permission_wait"
  | "done"
  | "error"
  | "heartbeat"
  | "git_operation";

export type ClientType = "cli" | "desktop" | "vscode" | "unknown";

export interface CompanionEvent {
  id: string;
  source: "claude-code" | "codex" | "cc-haha" | "manual";
  event: CompanionEventType;
  sessionId?: string;
  clientType?: ClientType;
  clientLabel?: string;
  tool?: ToolName;
  cwd?: string;
  title: string;
  message: string;
  detail?: string;
  timestamp: number;
}

export type ProviderId = "claude-code" | "codex";
