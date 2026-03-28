import { ipcMain } from 'electron'
import { getStorageService } from '../services/StorageService'

/**
 * All IPC channels used by SoundPilot.
 * The renderer calls these via the preload bridge (window.api).
 */
export const IPC_CHANNELS = {
  GET_PREFERENCES:   'sp:get-preferences',
  SET_PREFERENCES:   'sp:set-preferences',
  GET_PRESETS:       'sp:get-presets',
  SAVE_PRESET:       'sp:save-preset',
  DELETE_PRESET:     'sp:delete-preset',
  GET_APP_VERSION:   'sp:get-app-version'
} as const

export function registerIpcHandlers(): void {
  const storage = getStorageService()

  ipcMain.handle(IPC_CHANNELS.GET_PREFERENCES, () => {
    return storage.readPreferences()
  })

  ipcMain.handle(IPC_CHANNELS.SET_PREFERENCES, (_event, prefs: Record<string, unknown>) => {
    storage.writePreferences(prefs)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.GET_PRESETS, () => {
    return storage.readPresets()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_PRESET, (_event, preset: unknown) => {
    const presets = storage.readPresets() as Record<string, unknown>[]
    const typedPreset = preset as Record<string, unknown>
    const existing = presets.findIndex(p => p['id'] === typedPreset['id'])
    if (existing >= 0) {
      presets[existing] = typedPreset
    } else {
      presets.push(typedPreset)
    }
    storage.writePresets(presets)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_PRESET, (_event, presetId: string) => {
    const presets = storage.readPresets() as Record<string, unknown>[]
    const filtered = presets.filter(p => (p as Record<string, unknown>)['id'] !== presetId)
    storage.writePresets(filtered)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return process.env['npm_package_version'] ?? '0.1.0'
  })
}
