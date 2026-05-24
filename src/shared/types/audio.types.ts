// Audio device and capture types

/** How a device was classified by AudioDeviceManager */
export type AudioDeviceClass = 'asio' | 'daw-virtual' | 'standard'

export interface AudioDeviceInfo {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
  /** Detected driver/routing class — populated by AudioDeviceManager */
  deviceClass?: AudioDeviceClass
}

export interface AudioCaptureConfig {
  deviceId: string
  sampleRate: number
  fftSize: number           // Must be power of 2; 4096 gives ~10 Hz resolution at 44100 Hz
  smoothingTimeConstant: number  // 0-1; higher = smoother FFT response
}

export const DEFAULT_CAPTURE_CONFIG: AudioCaptureConfig = {
  deviceId: 'default',
  sampleRate: 44100,
  fftSize: 4096,
  smoothingTimeConstant: 0.8
}
