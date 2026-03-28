// TypeScript 5.5+ requires explicit ArrayBuffer generic on TypedArrays
// when interacting with Web Audio API methods (which expect Float32Array<ArrayBuffer>).
// We use Float32Array<ArrayBuffer> throughout to satisfy lib.dom.d.ts typings.

/** Callback invoked every animation frame with raw audio data from the AnalyserNode. */
export type AudioFrameCallback = (
  fftData:    Float32Array<ArrayBuffer>,
  timeDomain: Float32Array<ArrayBuffer>,
  sampleRate: number
) => void

import type { AudioCaptureConfig } from '@shared/types'

/**
 * AudioCaptureEngine — manages the Web Audio API graph for capturing
 * and analyzing a live audio input.
 *
 * Signal flow:
 *   MediaStream → MediaStreamSourceNode → AnalyserNode
 *                                               ↓
 *                                (NOT connected to destination —
 *                                 avoids monitor feedback/bleed)
 *
 * On each animation frame, reads both frequency-domain (FFT) and
 * time-domain data from the analyser and invokes the `onFrame` callback.
 *
 * Ownership: React hook (useAudioCapture) owns one instance and calls
 * start()/stop() to control the capture lifecycle.
 *
 * Performance notes:
 *   - Buffers are allocated once in start() and reused every frame.
 *   - The callback receives direct buffer references. The AnalysisEngine
 *     makes a defensive copy of fftData; callers must not store timeDomain.
 *   - No SharedArrayBuffer is used — all buffers are plain ArrayBuffer.
 */
export class AudioCaptureEngine {
  private audioCtx:    AudioContext    | null = null
  private analyser:    AnalyserNode    | null = null
  private source:      MediaStreamAudioSourceNode | null = null
  private stream:      MediaStream     | null = null
  private rafHandle:   number          | null = null
  private fftBuffer:   Float32Array<ArrayBuffer> | null = null
  private timeBuffer:  Float32Array<ArrayBuffer> | null = null
  private onFrame:     AudioFrameCallback | null = null
  private _running = false

  get running(): boolean {
    return this._running
  }

  get sampleRate(): number {
    return this.audioCtx?.sampleRate ?? 44100
  }

  async start(config: AudioCaptureConfig, callback: AudioFrameCallback): Promise<void> {
    if (this._running) await this.stop()

    this.onFrame = callback

    // Request the audio stream from the chosen device.
    // Disable browser audio processing so the analysis sees the raw signal.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:         config.deviceId === 'default' ? undefined : { exact: config.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
        sampleRate:       config.sampleRate
      },
      video: false
    })

    // Build the audio graph
    this.audioCtx = new AudioContext({ sampleRate: config.sampleRate })
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize               = config.fftSize
    this.analyser.smoothingTimeConstant = config.smoothingTimeConstant
    this.analyser.maxDecibels           = 0
    this.analyser.minDecibels           = -100

    this.source = this.audioCtx.createMediaStreamSource(this.stream)
    this.source.connect(this.analyser)
    // Intentionally NOT connecting to audioCtx.destination to prevent feedback

    // Allocate typed arrays with explicit ArrayBuffer (TS 5.5+ requirement)
    this.fftBuffer  = new Float32Array(this.analyser.frequencyBinCount) as Float32Array<ArrayBuffer>
    this.timeBuffer = new Float32Array(this.analyser.fftSize)           as Float32Array<ArrayBuffer>

    this._running = true
    this.scheduleFrame()
  }

  async stop(): Promise<void> {
    this._running = false

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }

    this.source?.disconnect()
    this.source = null

    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null

    if (this.audioCtx) {
      await this.audioCtx.close()
      this.audioCtx = null
    }

    this.analyser   = null
    this.fftBuffer  = null
    this.timeBuffer = null
    this.onFrame    = null
  }

  private scheduleFrame(): void {
    this.rafHandle = requestAnimationFrame(() => {
      if (!this._running || !this.analyser || !this.fftBuffer || !this.timeBuffer) return

      // Populate buffers from the analyser (overwrites previous frame data)
      this.analyser.getFloatFrequencyData(this.fftBuffer)
      this.analyser.getFloatTimeDomainData(this.timeBuffer)

      this.onFrame?.(this.fftBuffer, this.timeBuffer, this.audioCtx?.sampleRate ?? 44100)

      if (this._running) this.scheduleFrame()
    })
  }
}
