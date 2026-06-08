#!/usr/bin/env node
const https = require("https");
const http = require("http");
const { URL } = require("url");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => sendWebhook(input));

// Fallback for Windows pipe issue
let idleTimer;
process.stdin.on("data", () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => sendWebhook(input), 500);
});

function sendWebhook(raw) {
  if (idleTimer) clearTimeout(idleTimer);
  try {
    const event = JSON.parse(raw || "{}");
    const settings = JSON.parse(process.env.CLAWD_PLUGIN_SETTINGS || "{}");
    const url = settings.webhookUrl;
    if (!url) { console.log("No webhook URL configured"); return; }

    // Filter events
    const filter = settings.eventFilter || "done_error";
    if (filter === "done_error" && event.event !== "done" && event.event !== "error") return;
    if (filter === "error_only" && event.event !== "error") return;

    const body = formatPayload(url, event, settings);
    postJson(url, body, (err) => {
      if (err) { console.error("Webhook error:", err.message); process.exit(1); }
      else console.log(`Webhook sent: ${event.event}`);
    });
  } catch (err) {
    console.error("Webhook error:", err.message);
    process.exit(1);
  }
}

function formatPayload(url, event, settings) {
  const emoji = { done: "\u2705", error: "\u274c", session_start: "\ud83d\ude80" }[event.event] || "\ud83d\udce2";
  const detail = settings.includeDetail && event.detail ? `\n${event.detail.slice(0, 500)}` : "";
  const mention = settings.mentionOn && event.event === "error" ? "@everyone " : "";

  // Discord webhook
  if (url.includes("discord.com")) {
    const color = { done: 0x56a67b, error: 0xea5950, session_start: 0x5865f2 }[event.event] || 0x99aab5;
    return JSON.stringify({
      content: mention || undefined,
      embeds: [{
        title: `${emoji} ${event.title}`,
        description: `${event.message}${detail}`,
        color,
        fields: [
          { name: "Event", value: event.event, inline: true },
          ...(event.tool ? [{ name: "Tool", value: event.tool, inline: true }] : []),
          ...(event.clientLabel ? [{ name: "Source", value: event.clientLabel, inline: true }] : [])
        ],
        timestamp: new Date(event.timestamp).toISOString()
      }]
    });
  }

  // Slack webhook
  if (url.includes("slack.com")) {
    return JSON.stringify({
      text: `${mention}${emoji} *${event.title}*\n${event.message}${detail}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${emoji} ${event.title}` } },
        { type: "section", text: { type: "mrkdwn", text: `${event.message}${detail}` } },
        { type: "context", elements: [
          { type: "mrkdwn", text: `*Event:* ${event.event}${event.tool ? ` | *Tool:* ${event.tool}` : ""}` }
        ]}
      ]
    });
  }

  // Generic JSON POST
  return JSON.stringify({
    event: event.event,
    title: event.title,
    message: event.message,
    detail: settings.includeDetail ? event.detail : undefined,
    tool: event.tool,
    clientLabel: event.clientLabel,
    timestamp: event.timestamp
  });
}

function postJson(urlStr, body, callback) {
  const url = new URL(urlStr);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: url.pathname + url.search,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  };
  const transport = url.protocol === "https:" ? https : http;
  const req = transport.request(options, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) callback(null);
    else callback(new Error(`HTTP ${res.statusCode}`));
    res.resume();
  });
  req.on("error", callback);
  req.setTimeout(5000, () => { req.destroy(new Error("timeout")); });
  req.write(body);
  req.end();
}
