import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

/**
 * Simple JSON-file-based storage for preferences and presets.
 * Stored in the OS user data directory (e.g., AppData/Roaming/SoundPilot on Windows).
 * No SQLite needed at MVP scale — plain JSON is fast enough for settings.
 */
class StorageService {
  private dataDir: string
  private prefsPath: string
  private presetsPath: string

  constructor() {
    this.dataDir = join(app.getPath('userData'), 'data')
    this.prefsPath = join(this.dataDir, 'preferences.json')
    this.presetsPath = join(this.dataDir, 'presets.json')
    this.ensureDataDir()
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }
  }

  readPreferences(): Record<string, unknown> {
    try {
      if (!existsSync(this.prefsPath)) return {}
      return JSON.parse(readFileSync(this.prefsPath, 'utf-8'))
    } catch {
      return {}
    }
  }

  writePreferences(data: Record<string, unknown>): void {
    writeFileSync(this.prefsPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  readPresets(): unknown[] {
    try {
      if (!existsSync(this.presetsPath)) return []
      return JSON.parse(readFileSync(this.presetsPath, 'utf-8'))
    } catch {
      return []
    }
  }

  writePresets(data: unknown[]): void {
    writeFileSync(this.presetsPath, JSON.stringify(data, null, 2), 'utf-8')
  }
}

// Singleton — only instantiated when first imported in the main process
let instance: StorageService | null = null
export function getStorageService(): StorageService {
  if (!instance) instance = new StorageService()
  return instance
}
