import React, { useEffect, useState } from "react";
import type { EventHistoryEntry } from "../../shared/events";
import { useI18n } from "../useI18n";

export function HistoryPanel() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<EventHistoryEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    window.companion.getEventHistory().then(setEntries).catch(e => console.warn("[History] Get events:", e));
    const unsub = window.companion.onEvent(() => {
      window.companion.getEventHistory().then(setEntries).catch(e => console.warn("[History] Refresh:", e));
    });
    return unsub;
  }, []);

  const filtered = filter === "all" ? entries
    : filter === "tool" ? entries.filter(e => e.event.event === "tool_start" || e.event.event === "tool_end")
    : filter === "session" ? entries.filter(e => e.event.event === "session_start" || e.event.event === "prompt_submit")
    : filter === "error" ? entries.filter(e => e.event.event === "error")
    : entries;

  const clearHistory = async () => {
    await window.companion.clearEventHistory();
    setEntries([]);
  };

  return (
    <div className="panel-group-card">
      <div className="panel-header">
        <h3 className="panel-title">{t("history.title", "Event History")}</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["all", "tool", "session", "error"].map(f => (
            <button key={f} className="ghost-btn"
              style={filter === f ? { background: "rgba(234,187,88,0.2)", color: "var(--honey)" } : {}}
              onClick={() => setFilter(f)}>
              {t("history.filter" + (f === "all" ? "All" : f === "tool" ? "Tool" : f === "session" ? "Session" : "Error"), f)}
            </button>
          ))}
          <button className="ghost-btn danger" onClick={clearHistory}>{t("history.clear", "Clear")}</button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="empty">{t("history.empty", "No events")}</div>
      ) : (
        <div className="event-list">
          {filtered.slice(-30).reverse().map(entry => (
            <div key={entry.id} className="event-row">
              <em>{entry.event.event}</em>
              <strong>{entry.event.title}</strong>
              <p>{entry.event.message}</p>
              <span>{entry.event.tool ?? ""}</span>
              <small>{new Date(entry.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
