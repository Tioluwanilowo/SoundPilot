/**
 * MultiChannelCaptureEngine — opens a USB audio device as an N-channel
 * stream and routes each channel through its own AnalyserNode.
 *
 * Signal flow:
 *   getUserMedia (N-channel stream)
 *     → MediaStreamSourceNode
 *       → ChannelSplitterNode
 *           → AnalyserNode[0]   (USB channel 1)
 *           → AnalyserNode[1]   (USB channel 2)
 *           → ...
 *           → AnalyserNode[N-1] (USB channel N)
 *
 * Intentionally NOT connected to AudioContext.destination — prevents monitoring bleed.
 *
 * The RAF loop reads all N analysers on every frame and fires the callback with
 * an array of per-channel { fftData, timeDomain } pairs.
 *
 * Buffer allocation:
 *   Typed arrays are allocated once in start() and reused every frame.
 *   The callback receives direct buffer references — callers must not hold them
 *   across frames (AnalysisEngine makes defensive copies as needed).
 */

export type MultiChannelFrameCallback = (
  channels: ReadonlyArray<{
    fftData:    Float32Array<ArrayBuffer>
    timeDomain: Float32Array<ArrayBuffer>
  }>,
  sampleRate: number
) => void

const DEFAULT_FFT_SIZE = 4096

export class MultiChannelCaptureEngine {
  private audioCtx:    AudioContext              | null = null
  private source:      MediaStreamAudioSourceNode | null = null
  private splitter:    ChannelSplitterNode        | null = null
  private stream:      MediaStream                | null = null
  private analysers:   AnalyserNode[]  = []
  private fftBuffers:  Float32Array<ArrayBuffer>[] = []
  private timeBuffers: Float32Array<ArrayBuffer>[] = []
  private rafHandle:   number | null = null
  private onFrame:     MultiChannelFrameCallback | null = null
  private _running      = false
  private _channelCount = 0

  get running(): boolean      { return this._running }
  get channelCount(): number  { return this._channelCount }
  get sampleRate(): number    { return this.audioCtx?.sampleRate ?? 48000 }

  /**
   * Open the audio device and start the capture loop.
   *
   * @param deviceId           Audio device ID from enumerateDevices (or 'default')
   * @param requestedChannels  How many channels to request — may get fewer if the
   *                           device/driver exposes fewer.
   * @param callback           Called every animation frame with per-channel data.
   * @param fftSize            AnalyserNode FFT size (default 4096 → 2048 bins).
   * @returns                  The actual number of channels the OS provided.
   */
  async start(
    deviceId:         string,
    requestedChannels: number,
    callback:         MultiChannelFrameCallback,
    fftSize:          number = DEFAULT_FFT_SIZE
  ): Promise<number> {
    if (this._running) await this.stop()

    this.onFrame = callback

    // Request the multi-channel stream.
    // The OS driver decides how many channels are actually delivered.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:         deviceId === 'default' ? undefined : { exact: deviceId },
        channelCount:     { ideal: requestedChannels, min: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
        sampleRate:       48000      // Ui24R requires 48kHz
      },
      video: false
    })

    this.audioCtx = new AudioContext({ sampleRate: 48000 })
    this.source   = this.audioCtx.createMediaStreamSource(this.stream)

    // Actual channel count from the OS — may differ from requestedChannels
    const actual = this.source.channelCount
    this._channelCount = actual

    this.splitter = this.audioCtx.createChannelSplitter(actual)
    this.source.connect(this.splitter)
    // NOT connecting to destination — prevents monitoring feedback

    // Allocate one AnalyserNode + buffers per channel
    this.analysers   = []
    this.fftBuffers  = []
    this.timeBuffers = []

    for (let i = 0; i < actual; i++) {
      const analyser = this.audioCtx.createAnalyser()
      analyser.fftSize               = fftSize
      analyser.smoothingTimeConstant = 0.8
      analyser.maxDecibels           = 0
      analyser.minDecibels           = -100

      // ChannelSplitter output i → Analyser (single-channel mono input)
      this.splitter.connect(analyser, i, 0)
      this.analysers.push(analyser)

      this.fftBuffers.push(
        new Float32Array(analyser.frequencyBinCount) as Float32Array<ArrayBuffer>
      )
      this.timeBuffers.push(
        new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
      )
    }

    this._running = true
    this.scheduleFrame()
    return actual
  }

  async stop(): Promise<void> {
    this._running = false

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }

    this.splitter?.disconnect()
    this.source?.disconnect()
    this.source   = null
    this.splitter = null

    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null

    if (this.audioCtx) {
      await this.audioCtx.close()
      this.audioCtx = null
    }

    this.analysers   = []
    this.fftBuffers  = []
    this.timeBuffers = []
    this.onFrame     = null
    this._channelCount = 0
  }

  private scheduleFrame(): void {
    this.rafHandle = requestAnimationFrame(() => {
      if (!this._running || this.analysers.length === 0) return

      // Read all N channels in one pass — buffers are reused (no allocation)
      const channels = this.analysers.map((analyser, i) => {
        analyser.getFloatFrequencyData(this.fftBuffers[i])
        analyser.getFloatTimeDomainData(this.timeBuffers[i])
        return {
          fftData:    this.fftBuffers[i],
          timeDomain: this.timeBuffers[i]
        }
      })

      this.onFrame?.(channels, this.audioCtx?.sampleRate ?? 48000)

      if (this._running) this.scheduleFrame()
    })
  }
}
