import type { AudioDeviceInfo, AudioDeviceClass } from '@shared/types'

// Label fragments that identify ASIO driver devices (case-insensitive)
const ASIO_PATTERNS = [
  'asio', 'steinberg low latency', 'yamaha usb asio', 'behringer asio',
  'focusrite asio', 'motu asio', 'rme asio', 'universal audio asio',
  'scarlett asio', 'ssl asio', 'presonus asio', 'audient asio'
]

// Label fragments that identify virtual / DAW routing devices
const DAW_VIRTUAL_PATTERNS = [
  'virtual', 'loopback', 'blackhole', 'soundflower',
  'vb-audio', 'vb-cable', 'vb cable', 'voicemeeter',
  'iac driver', 'iac bus', 'obs virtual', 'obs-audio',
  'cable output', 'cable input', 'audio router',
  'dante virtual', 'netio', 'wasapi loopback',
  'rewire', 'jack audio', 'jack2', 'audiohijack',
  'loopback audio', 'existential audio'
]

/**
 * Classify an audio device from its label string.
 * Returns 'asio', 'daw-virtual', or 'standard'.
 */
export function classifyDeviceLabel(label: string): AudioDeviceClass {
  const l = label.toLowerCase()
  if (ASIO_PATTERNS.some(p => l.includes(p))) return 'asio'
  if (DAW_VIRTUAL_PATTERNS.some(p => l.includes(p))) return 'daw-virtual'
  return 'standard'
}

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
   * Returns all available audio input devices, classified by driver type.
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
      .map(d => {
        const label = d.label || `Microphone (${d.deviceId.substring(0, 8)}…)`
        return {
          deviceId:    d.deviceId,
          label,
          kind:        'audioinput' as const,
          deviceClass: classifyDeviceLabel(label)
        }
      })
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
