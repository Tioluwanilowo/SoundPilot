import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import type { AppPreferences } from '@shared/types'

/**
 * usePreferences — loads saved preferences from disk via IPC on first mount,
 * and persists changes back whenever the store's preferences update.
 *
 * Behaviour:
 *   - On mount: reads `window.api.getPreferences()` and merges into store
 *   - On change: debounced write back via `window.api.setPreferences()`
 *   - No-op if window.api is unavailable (e.g., running outside Electron)
 *
 * The debounce (800ms) prevents hammering disk while the user drags a slider.
 */
export function usePreferences(): void {
  const updatePreferences = useAppStore(s => s.updatePreferences)
  const preferences       = useAppStore(s => s.preferences)
  const isFirstLoad       = useRef(true)
  const debounceTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load preferences from disk on mount
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        if (!window.api) return
        const saved = await window.api.getPreferences()
        if (saved && typeof saved === 'object') {
          // Only apply keys that exist in our AppPreferences type
          const partial: Partial<AppPreferences> = {}
          const keys: (keyof AppPreferences)[] = [
            'analysisRefreshMs',
            'listeningWindowSec',
            'minimumSignalThresholdDb',
            'defaultChannelNumber'
          ]
          for (const key of keys) {
            if (key in saved && typeof saved[key] === 'number') {
              (partial as Record<string, unknown>)[key] = saved[key]
            }
          }
          if (Object.keys(partial).length > 0) {
            updatePreferences(partial)
          }
        }
      } catch (err) {
        console.warn('[usePreferences] Failed to load preferences:', err)
      } finally {
        isFirstLoad.current = false
      }
    }
    load()
  }, [updatePreferences])

  // Persist preferences back to disk (debounced)
  useEffect(() => {
    // Don't write back on the initial load
    if (isFirstLoad.current) return

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        if (!window.api) return
        await window.api.setPreferences(preferences as unknown as Record<string, unknown>)
      } catch (err) {
        console.warn('[usePreferences] Failed to save preferences:', err)
      }
    }, 800)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [preferences])
}
