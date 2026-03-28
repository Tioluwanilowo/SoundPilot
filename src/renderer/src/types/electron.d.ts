/**
 * Type declaration for the Electron preload bridge exposed via contextBridge.
 * window.api is available in the renderer after contextBridge.exposeInMainWorld.
 * This file does NOT import from electron — it's a pure ambient declaration.
 */
interface Window {
  api: {
    getPreferences: () => Promise<Record<string, unknown>>
    setPreferences: (prefs: Record<string, unknown>) => Promise<{ ok: boolean }>
    getPresets: () => Promise<unknown[]>
    savePreset: (preset: unknown) => Promise<{ ok: boolean }>
    deletePreset: (presetId: string) => Promise<{ ok: boolean }>
    getAppVersion: () => Promise<string>
  }
}
