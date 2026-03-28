import { useRef, useCallback } from 'react'
import { AudioCaptureEngine } from '../audio/AudioCaptureEngine'
import { DEFAULT_CAPTURE_CONFIG } from '@shared/types'
import { useAppStore } from '../store/appStore'
import type { AudioFrameCallback } from '../audio/AudioCaptureEngine'

/**
 * useAudioCapture — manages the AudioCaptureEngine lifecycle.
 *
 * Returns start/stop functions that the LiveScreen uses to control capture.
 * The caller provides an onFrame callback to handle incoming audio data.
 */
export function useAudioCapture() {
  const engineRef = useRef<AudioCaptureEngine | null>(null)
  const setCapturing = useAppStore(s => s.setCapturing)
  const selectedDeviceId = useAppStore(s => s.session.selectedDeviceId)

  const startCapture = useCallback(async (onFrame: AudioFrameCallback): Promise<void> => {
    if (!engineRef.current) {
      engineRef.current = new AudioCaptureEngine()
    }

    const config = {
      ...DEFAULT_CAPTURE_CONFIG,
      deviceId: selectedDeviceId ?? 'default'
    }

    try {
      await engineRef.current.start(config, onFrame)
      setCapturing(true)
    } catch (err) {
      console.error('[useAudioCapture] Failed to start capture:', err)
      setCapturing(false)
      throw err
    }
  }, [selectedDeviceId, setCapturing])

  const stopCapture = useCallback(async (): Promise<void> => {
    if (engineRef.current) {
      await engineRef.current.stop()
    }
    setCapturing(false)
  }, [setCapturing])

  const isRunning = useCallback((): boolean => {
    return engineRef.current?.running ?? false
  }, [])

  return { startCapture, stopCapture, isRunning }
}
