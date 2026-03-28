import type { AudioDeviceInfo } from '@shared/types'

/**
 * AudioDeviceManager — wraps the Web Audio / MediaDevices API for
 * audio input device enumeration.
 *
 * Requires microphone permission to have been granted (or getUserMedia
 * to have been called at least once) before device labels are available.
 * In Electron, permission is pre-granted by the main process.
 */
export class AudioDeviceManager {
  /**
   * Returns all available audio input devices.
   * Triggers a permission prompt the first time if not already granted.
   */
  async getInputDevices(): Promise<AudioDeviceInfo[]> {
    // Calling getUserMedia first ensures labels are populated
    // (browsers/Electron hide labels until permission is granted)
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // Release immediately — we only needed this for the permission grant
      tempStream.getTracks().forEach(t => t.stop())
    } catch (err) {
      console.warn('[AudioDeviceManager] Permission request failed:', err)
      // Still try to enumerate — some contexts work without this
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({
        deviceId: d.deviceId,
        label:    d.label || `Microphone (${d.deviceId.substring(0, 8)}…)`,
        kind:     'audioinput' as const
      }))
  }

  /**
   * Register a callback for device change events (e.g., USB mic plugged in).
   * Returns a cleanup function.
   */
  onDeviceChange(callback: () => void): () => void {
    navigator.mediaDevices.addEventListener('devicechange', callback)
    return () => navigator.mediaDevices.removeEventListener('devicechange', callback)
  }
}

export const audioDeviceManager = new AudioDeviceManager()
