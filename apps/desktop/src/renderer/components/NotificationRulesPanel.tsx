import React from "react";
import type { NotificationRule, CompanionSettings } from "../../shared/events";
import { useI18n } from "../useI18n";
import { Toggle } from "./ui/Toggle";

export function NotificationRulesPanel({ settings, updateSettings }: { settings: any; updateSettings: (s: any) => void }) {
  const { t } = useI18n();
  const rules: NotificationRule[] = settings.notificationRules ?? [];
  const eventTypes = ["session_start", "tool_start", "tool_end", "done", "error", "permission_wait", "notification", "git_operation"];

  const toggleRule = (eventType: string) => {
    const existing = rules.find(r => r.eventType === eventType);
    if (existing) {
      updateSettings({ notificationRules: rules.filter(r => r.eventType !== eventType) } as any);
    } else {
      updateSettings({ notificationRules: [...rules, { eventType: eventType as any, enabled: true, systemNotification: true, playSound: false, showBubble: true }] } as any);
    }
  };

  return (
    <div className="panel-group-card">
      <h3 className="panel-title">{t("notifRules.title", "Notification Rules")}</h3>
      <p className="note">{t("notifications.notificationHint", "Control notification style per event type.")}</p>
      <div style={{ display: "grid", gap: 6 }}>
        {eventTypes.map(et => {
          const rule = rules.find(r => r.eventType === et);
          return (
            <div key={et} className="mapping-row" style={{ gridTemplateColumns: "100px 1fr" }}>
              <strong>{t("notifRules." + et, et)}</strong>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Toggle label={t("notifications.notificationToast", "Toast")}
                  checked={rule?.systemNotification ?? false}
                  onChange={v => {
                    const next = rules.filter(r => r.eventType !== et);
                    next.push({ eventType: et as any, enabled: true, systemNotification: v, playSound: rule?.playSound ?? false, showBubble: rule?.showBubble ?? true });
                    updateSettings({ notificationRules: next } as any);
                  }} />
                <Toggle label={t("notifications.notificationSound", "Sound")}
                  checked={rule?.playSound ?? false}
                  onChange={v => {
                    const next = rules.filter(r => r.eventType !== et);
                    next.push({ eventType: et as any, enabled: true, systemNotification: rule?.systemNotification ?? false, playSound: v, showBubble: rule?.showBubble ?? true });
                    updateSettings({ notificationRules: next } as any);
                  }} />
                <button className="ghost-btn"
                  onClick={() => toggleRule(et)}>
                  {rule ? t("notifications.removeRule", "Remove") : t("notifications.addRule", "Add")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
