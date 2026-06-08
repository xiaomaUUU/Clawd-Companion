import { request } from "node:http";
export function postEvent(event, port, token) {
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
        }, (res) => {
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
export function requestPermission(tool, detail, sessionId, rawPayload, port, token, timeoutMs) {
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
        }, (res) => {
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
                }
                catch {
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
export function longPollPermission(id, port, token, timeout) {
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
        }, (res) => {
            let data = "";
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                }
                catch {
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
