import { useEffect, useState } from "react";
import { Bot, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "../useI18n";
import { Toggle } from "./ui/Toggle";
import type { ProviderId } from "../../shared/events";

interface ProviderStatus {
  installed: boolean;
  configExists: boolean;
  hookCount: number;
  requiredCount: number;
  missingEvents: string[];
  commandMatches: boolean;
}

interface HermesStatus extends ProviderStatus {
  endpointPath?: string;
  endpointMatches: boolean;
  tokenConfigured: boolean;
}

interface DoctorProviders {
  [id: string]: {
    hooks: ProviderStatus | HermesStatus;
    forwarder: { expectedPath: string; exists: boolean };
  };
}

const PROVIDER_META: Record<string, { label: string; tagline: string; Icon: React.ComponentType<{ size?: number }> }> = {
  "claude-code": {
    label: "Claude Code",
    tagline: "默认启用，跟随 Claude Code 会话",
    Icon: Bot
  },
  "codex": {
    label: "OpenAI Codex",
    tagline: "跟踪 Codex CLI 事件",
    Icon: Sparkles
  },
  "hermes": {
    label: "Hermes Agent",
    tagline: "通过 Hermes 插件转发工具调用事件",
    Icon: PlugZap
  }
};

function isHookProviderId(id: string): id is Exclude<ProviderId, "hermes"> {
  return id === "claude-code" || id === "codex";
}

function isHermesStatus(status: ProviderStatus | HermesStatus): status is HermesStatus {
  return "endpointMatches" in status;
}

export function SourcesPanel() {
  const { t } = useI18n();
  const formatText = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

  const [providers, setProviders] = useState<DoctorProviders | null>(null);
  const [action, setAction] = useState<{ id: string; verb: string } | null>(null);
  const [result, setResult] = useState<{ id: string; message: string } | null>(null);
  const [guardEnabled, setGuardEnabled] = useState(true);
  const [guardInterval, setGuardInterval] = useState(30);

  useEffect(() => {
    window.companion.getSettings().then((s) => {
      setGuardEnabled(s.hooksGuardEnabled !== false);
      setGuardInterval(Math.round((s.hooksGuardIntervalMs ?? 30000) / 1000));
      setProviders(null);
    });
    window.companion.getDoctorReport().then((report) => {
      setProviders(report.providers ?? null);
    });
  }, []);

  async function handle(id: Exclude<ProviderId, "hermes">, verb: "install" | "repair" | "remove") {
    setAction({ id, verb });
    setResult(null);
    let res: { success: boolean; error?: string; fixed?: string[] };
    if (verb === "install") res = await window.companion.installHooks(id);
    else if (verb === "repair") res = await window.companion.repairHooks(id);
    else res = await window.companion.removeHooks(id);

    if (res.success) {
      const meta = PROVIDER_META[id];
      const suffix = meta ? `（${meta.label}）` : "";
      if (verb === "install") setResult({ id, message: t("doctor.installDone", "安装成功！重启会话后生效。") + suffix });
      else if (verb === "repair") setResult({ id, message: formatText(t("doctor.repairDone", "修复完成，修复了 {count} 项配置。"), { count: res.fixed?.length ?? 0 }) });
      else setResult({ id, message: t("doctor.removeDone", "已移除所有 Clawd hooks。") + suffix });
    } else {
      setResult({ id, message: formatText(t("doctor.installFailed", "安装失败: {error}"), { error: res.error ?? "" }) });
    }
    const report = await window.companion.getDoctorReport();
    setProviders(report.providers ?? null);
    setAction(null);
  }

  if (!providers) {
    return <p className="note">{t("doctor.loading", "正在加载…")}</p>;
  }

  const ids = Object.keys(providers);
  if (ids.length === 0) {
    return <p className="note">未配置任何数据源。</p>;
  }

  return (
    <div className="sources-panel">
      <div className="hooks-guard-row">
        <div className="hooks-guard-info">
          <ShieldCheck size={16} />
          <span>{t("hooks.guardLabel", "配置守护")}</span>
          <small className="note">{t("hooks.guardDesc", "检测到 hooks 配置丢失时自动修复（如 ccs 切换模型覆盖了 settings.json）")}</small>
        </div>
        <div className="hooks-guard-controls">
          <div className="hooks-guard-slider-row">
            <label>{t("hooks.guardInterval", "检测间隔")}</label>
            <input type="range" min={5} max={60} step={1} value={guardInterval} disabled={!guardEnabled} onChange={(e) => {
              const v = Number(e.target.value);
              setGuardInterval(v);
              window.companion.saveSettings({ hooksGuardIntervalMs: v * 1000 });
            }} />
            <span className="hooks-guard-slider-value">{guardInterval}s</span>
          </div>
          <Toggle label="" checked={guardEnabled} onChange={(v) => { setGuardEnabled(v); window.companion.saveSettings({ hooksGuardEnabled: v }); }} />
        </div>
      </div>
      <p className="note sources-note sources-note-span">{t("doctor.backupNote", "安装 hooks 后，Claude / Codex 会自动将事件发送到 Clawd Companion；Hermes 通过插件转发。备份文件分别保存在 ~/.claude/settings.clawd-backup.json 和 ~/.codex/settings.clawd-backup.toml")}</p>
      {ids.map((id) => {
        const info = providers[id];
        const meta = PROVIDER_META[id] ?? { label: id, tagline: "", Icon: PlugZap };
        const status = info.hooks;
        const isHermes = id === "hermes";
        const hermesStatus = isHermes && isHermesStatus(status) ? status : null;
        const hermesInstalled = Boolean(hermesStatus?.installed);
        const hermesHealthy = Boolean(hermesInstalled && hermesStatus?.endpointMatches && hermesStatus?.tokenConfigured);
        const tone: "good" | "wait" | "bad" = isHermes
          ? hermesHealthy
            ? "good"
            : hermesInstalled
            ? "wait"
            : "bad"
          : status.installed
          ? "good"
          : status.configExists
          ? "wait"
          : "bad";
        const isBusy = action?.id === id;
        return (
          <div key={id} className="source-card">
            <StatusCard
              icon={<meta.Icon size={18} />}
              label={
                id === "codex"
                  ? <>{formatText(t("doctor.statusLabel", "{provider} 状态"), { provider: meta.label })}<sup className="beta-badge">{t("behavior.testing", "测试中")}</sup></>
                  : formatText(t("doctor.statusLabel", "{provider} 状态"), { provider: meta.label })
              }
              value={
                isHermes
                  ? hermesHealthy
                    ? t("status.connected", "已连接")
                    : hermesInstalled
                    ? t("status.waiting", "等待连接")
                    : t("hooks.notInstalled", "未安装")
                  : status.installed
                  ? formatText(t("hooks.installedToProvider", "已安装到 {provider}"), { provider: meta.label })
                  : status.configExists
                  ? t("doctor.partial", "部分安装")
                  : t("hooks.notInstalled", "未安装")
              }
              tone={tone}
            />

            <div className="hooks-detail">
              {isHermes ? (
                <>
                  <span>{meta.tagline}</span>
                  <span>{info.forwarder.exists ? "Hermes 插件已安装" : "复制 plugins/hermes-agent 到 ~/.hermes/plugins/clawd-companion 后启用"}</span>
                  {hermesStatus?.endpointPath && <span>{`事件端点：${hermesStatus.endpointPath}`}</span>}
                  {hermesStatus && !hermesStatus.endpointMatches && (
                    <span className="hooks-mismatch">插件未读取 Clawd 当前连接配置，建议重开 Hermes 会话</span>
                  )}
                  {hermesStatus && !hermesStatus.tokenConfigured && (
                    <span className="hooks-mismatch">缺少连接令牌，Hermes 事件还不能通过认证</span>
                  )}
                </>
              ) : (
                <>
                  <span>{formatText(t("doctor.configuredCount", "已配置 {count} / {total} 个事件"), { count: status.hookCount, total: status.requiredCount })}</span>
                  {status.missingEvents.length > 0 && (
                    <span className="hooks-missing">
                      {formatText(t("doctor.missingPrefix", "缺少: {events}"), { events: status.missingEvents.join(", ") })}
                    </span>
                  )}
                  {!status.commandMatches && status.configExists && (
                    <span className="hooks-mismatch">{t("doctor.mismatchHint", "命令路径不匹配，建议修复")}</span>
                  )}
                  {!info.forwarder.exists && (
                    <span className="hooks-mismatch">{t("doctor.forwarderMissing", "Forwarder 文件未找到")}</span>
                  )}
                </>
              )}
            </div>

            {isHermes ? (
              <p className="note">Hermes 现在按原本 forwarder 的格式读取 `~/.clawd-companion/connection.json`。装好插件后，重开 Hermes 会话并触发一次工具调用即可连上。</p>
            ) : (
              <div className="hooks-actions">
                <button onClick={() => isHookProviderId(id) && handle(id, "install")} disabled={!!action}>
                  {isBusy && action!.verb === "install" ? t("doctor.installing", "安装中...") : t("doctor.oneClickInstall", "一键安装")}
                </button>
                <button onClick={() => isHookProviderId(id) && handle(id, "repair")} disabled={!!action}>
                  {isBusy && action!.verb === "repair" ? t("doctor.repairing", "修复中...") : t("doctor.repairConfig", "修复配置")}
                </button>
                <button className="danger" onClick={() => isHookProviderId(id) && handle(id, "remove")} disabled={!!action}>
                  {isBusy && action!.verb === "remove" ? t("doctor.removing", "移除中...") : t("doctor.removeHooks", "移除 Hooks")}
                </button>
              </div>
            )}

            {result && result.id === id && <p className="hooks-result">{result.message}</p>}
          </div>
        );
      })}
    </div>
  );
}

function StatusCard({ icon, label, value, tone }: { icon: React.ReactNode; label: React.ReactNode; value: string; tone: "good" | "bad" | "wait" | "neutral" }) {
  return (
    <article className={`status-card ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
