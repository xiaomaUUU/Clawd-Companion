import { request, type IncomingMessage } from "node:http";
import type { CompanionEvent } from "./types.js";

export function postEvent(event: CompanionEvent, port: number, token: string): Promise<void> {
  const body = JSON.stringify(event);
  return new Promise((resolve, reject) => {
    const req = request({
      host: "127.0.0.1",
      port,
      path: "/events",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "authorization": `Bearer ${token}`
      },
      timeout: 3000
    }, (res: IncomingMessage) => {
      res.resume();
      res.on("end", resolve);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
}

export interface PermissionPollResult {
  status: "approved" | "denied" | "expired" | "error";
  decision?: "allow" | "deny";
  reason?: string;
}

export function requestPermission(tool: string, detail: string | undefined, sessionId: string | undefined, rawPayload: unknown, port: number, token: string, timeoutMs: number): Promise<PermissionPollResult> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      toolName: tool,
      toolDetail: detail,
      sessionId,
      rawPayload
    });

    const req = request({
      host: "127.0.0.1",
      port,
      path: "/permission",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "authorization": `Bearer ${token}`
      },
      timeout: 5000
    }, (res: IncomingMessage) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          const id = result.id;
          if (!id) {
            resolve({ status: "error", reason: "No permission ID" });
            return;
          }
          longPollPermission(id, port, token, timeoutMs).then(resolve);
        } catch {
          resolve({ status: "error", reason: "Invalid response" });
        }
      });
    });

    req.on("error", () => resolve({ status: "error", reason: "Server unavailable" }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "error", reason: "Request timeout" });
    });
    req.write(body);
    req.end();
  });
}

export function longPollPermission(id: string, port: number, token: string, timeout: number): Promise<PermissionPollResult> {
  return new Promise((resolve) => {
    const req = request({
      host: "127.0.0.1",
      port,
      path: `/permission/${id}`,
      method: "GET",
      headers: {
        "authorization": `Bearer ${token}`
      },
      timeout
    }, (res: IncomingMessage) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          resolve(result as PermissionPollResult);
        } catch {
          resolve({ status: "error", reason: "Invalid poll response" });
        }
      });
    });

    req.on("error", () => resolve({ status: "error", reason: "Poll error" }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "expired", reason: "Poll timeout" });
    });
    req.end();
  });
}
