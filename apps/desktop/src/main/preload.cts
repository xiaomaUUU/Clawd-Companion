import { contextBridge, ipcRenderer } from "electron";
import type { CompanionConnectionStatus, CompanionEvent, CompanionSettings } from "../shared/events.js";

contextBridge.exposeInMainWorld("companion", {
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<CompanionSettings>,
  saveSettings: (settings: Partial<CompanionSettings>) => ipcRenderer.invoke("settings:save", settings) as Promise<CompanionSettings>,
  getConnectionStatus: () => ipcRenderer.invoke("connection:get") as Promise<CompanionConnectionStatus>,
  sendTestEvent: (event: CompanionEvent) => ipcRenderer.invoke("event:test", event) as Promise<void>,
  openSettings: () => ipcRenderer.invoke("window:open-settings") as Promise<void>,
  minimizeSettings: () => ipcRenderer.invoke("window:minimize-settings") as Promise<void>,
  toggleMaximizeSettings: () => ipcRenderer.invoke("window:toggle-maximize-settings") as Promise<void>,
  closeSettings: () => ipcRenderer.invoke("window:close-settings") as Promise<void>,
  onEvent: (callback: (event: CompanionEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: CompanionEvent) => callback(event);
    ipcRenderer.on("companion:event", handler);
    return () => ipcRenderer.off("companion:event", handler);
  },
  onSettings: (callback: (settings: CompanionSettings) => void) => {
    const handler = (_: Electron.IpcRendererEvent, settings: CompanionSettings) => callback(settings);
    ipcRenderer.on("companion:settings", handler);
    return () => ipcRenderer.off("companion:settings", handler);
  },
  onConnection: (callback: (status: CompanionConnectionStatus) => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: CompanionConnectionStatus) => callback(status);
    ipcRenderer.on("companion:connection", handler);
    return () => ipcRenderer.off("companion:connection", handler);
  },
  setPetInteractive: (interactive: boolean) => ipcRenderer.invoke("window:pet-interactive", interactive) as Promise<void>,
  dragPetTo: (x: number, y: number) => ipcRenderer.invoke("window:drag-pet", { x, y }) as Promise<void>,
  movePetBy: (dx: number, dy: number) => ipcRenderer.invoke("window:move-pet-by", { dx, dy }) as Promise<void>
});

declare global {
  interface Window {
    companion: {
      getSettings: () => Promise<CompanionSettings>;
      saveSettings: (settings: Partial<CompanionSettings>) => Promise<CompanionSettings>;
      getConnectionStatus: () => Promise<CompanionConnectionStatus>;
      sendTestEvent: (event: CompanionEvent) => Promise<void>;
      openSettings: () => Promise<void>;
      minimizeSettings: () => Promise<void>;
      toggleMaximizeSettings: () => Promise<void>;
      closeSettings: () => Promise<void>;
      onEvent: (callback: (event: CompanionEvent) => void) => () => void;
      onSettings: (callback: (settings: CompanionSettings) => void) => () => void;
      onConnection: (callback: (status: CompanionConnectionStatus) => void) => () => void;
      setPetInteractive: (interactive: boolean) => Promise<void>;
      dragPetTo: (x: number, y: number) => Promise<void>;
      movePetBy: (dx: number, dy: number) => Promise<void>;
    };
  }
}
