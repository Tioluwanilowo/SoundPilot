import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../main/ipc/handlers'

/**
 * Exposes a safe, typed API to the renderer via contextBridge.
 * The renderer accesses this as window.api.
 * No Node.js internals are exposed — only well-defined IPC calls.
 */
const api = {
  getPreferences: (): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PREFERENCES),

  setPreferences: (prefs: Record<string, unknown>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_PREFERENCES, prefs),

  getPresets: (): Promise<unknown[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PRESETS),

  savePreset: (preset: unknown): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PRESET, preset),

  deletePreset: (presetId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_PRESET, presetId),

  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
