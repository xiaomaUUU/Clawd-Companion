import React from "react";
import type { PetState, PermissionRequest } from "../../shared/events";
import { useI18n } from "../useI18n";
import { Shield, Check, X } from "lucide-react";

interface PermissionCardProps {
  permission: PermissionRequest;
  queueCount: number;
  onAllow: () => void;
  onDeny: () => void;
  settings: { permissionScale?: number; permissionOpacity?: number };
}

export function PermissionCard({ permission, queueCount, onAllow, onDeny, settings }: PermissionCardProps) {
  const { t } = useI18n();
  return (
    <div className="permission-card" style={{ opacity: settings.permissionOpacity ?? 1, transform: `scale(${settings.permissionScale ?? 1})` }}>
      <div className="permission-header">
        <Shield size={16} />
        <span>{t("pet.permissionTitle", "Need confirmation")}</span>
        {queueCount > 1 && <span className="permission-badge">{queueCount}</span>}
      </div>
      <div className="permission-tool">{permission.toolName}</div>
      {permission.toolDetail && <div className="permission-detail">{permission.toolDetail}</div>}
      <div className="permission-actions">
        <button className="ghost-btn allow-btn" onClick={onAllow}>
          <Check size={14} /> {t("pet.permissionAllow", "Allow")}
        </button>
        <button className="ghost-btn deny-btn" onClick={onDeny}>
          <X size={14} /> {t("pet.permissionDeny", "Deny")}
        </button>
      </div>
    </div>
  );
}
