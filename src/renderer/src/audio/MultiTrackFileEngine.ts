/**
 * MultiTrackFileEngine — decodes audio files and plays them through independent
 * AnalyserNodes for offline multitrack analysis.
 *
 * Signal flow per track:
 *   AudioBuffer (decoded from File)
 *     → AudioBufferSourceNode
 *       → ChannelMergerNode (stereo → mono-sum)
 *         → AnalyserNode
 *           (NOT connected to destination — silent analysis)
 *
 * All tracks share one AudioContext and start simultaneously at t=0.
 * Each track's AnalyserNode is read every animation frame.
 * Completion is tracked per-track via source.onended.
 *
 * Max analysis duration: 120 seconds. Files longer than 2 minutes are
 * analyzed from the beginning only. A future "fast mode" using
 * OfflineAudioContext will remove this limit.
 */

export const MAX_ANALYSIS_SECONDS = 120

export type ImportFrameCallback = (
  tracks: ReadonlyArray<{
    id:         string
    fftData:    Float32Array<ArrayBuffer>
    timeDomain: Float32Array<ArrayBuffer>
    /** 0–1 playback progress through the analysis window */
    progress:   number
    ended:      boolean
  }>,
  sampleRate: number
) => void

interface TrackEntry {
  id:         string
  buffer:     AudioBuffer
  source:     AudioBufferSourceNode | null
  analyser:   AnalyserNode
  fftBuf:     Float32Array<ArrayBuffer>
  timeBuf:    Float32Array<ArrayBuffer>
  duration:   number     // capped at MAX_ANALYSIS_SECONDS
  ended:      boolean
}

const FFT_SIZE = 4096

export class MultiTrackFileEngine {
  private audioCtx:  AudioContext | null = null
  private tracks:    Map<string, TrackEntry> = new Map()
  private rafHandle: number | null = null
  private onFrame:   ImportFrameCallback | null = null
  private _running = false

  get running(): boolean { return this._running }

  // ── File decoding ───────────────────────────────────────────────────────────

  /**
   * Decode one audio file and store the resulting AudioBuffer.
   * Must be called before startAnalysis().
   *
   * @returns { duration, sampleRate, channels } metadata from the decoded buffer
   */
  async loadFile(id: string, file: File): Promise<{
    duration:    number
    sampleRate:  number
    channels:    number
  }> {
    const arrayBuffer = await file.arrayBuffer()

    // Temporary context just for decoding — closed immediately after
    const tempCtx = new AudioContext()
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer)
    await tempCtx.close()

    // Store the decoded buffer (keyed by track id)
    // We don't build the full entry yet — that happens in startAnalysis()
    this._decodedBuffers.set(id, audioBuffer)

    return {
      duration:   audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels:   audioBuffer.numberOfChannels
    }
  }

  private _decodedBuffers: Map<string, AudioBuffer> = new Map()

  removeTrack(id: string): void {
    this._decodedBuffers.delete(id)
    this.tracks.delete(id)
  }

  clearAll(): void {
    this._decodedBuffers.clear()
    this.tracks.clear()
  }

  // ── Playback analysis ───────────────────────────────────────────────────────

  /**
   * Start simultaneous playback + analysis of all loaded tracks.
   *
   * @param trackIds   IDs to analyze (must all have been loaded via loadFile)
   * @param callback   Called every animation frame with per-track FFT data
   */
  async startAnalysis(
    trackIds: string[],
    callback: ImportFrameCallback
  ): Promise<void> {
    if (this._running) await this.stop()

    this.onFrame  = callback
    this._running = true
    this.tracks.clear()

    // All tracks share one AudioContext (same clock, same start time)
    this.audioCtx = new AudioContext({ sampleRate: 48000 })

    for (const id of trackIds) {
      const buffer = this._decodedBuffers.get(id)
      if (!buffer) continue

      const ctx       = this.audioCtx
      const duration  = Math.min(buffer.duration, MAX_ANALYSIS_SECONDS)

      // Build analysis graph
      const analyser  = ctx.createAnalyser()
      analyser.fftSize               = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8
      analyser.maxDecibels           = 0
      analyser.minDecibels           = -100

      // Connect source → analyser directly.
      // AudioContext automatically down-mixes stereo → mono for single-input nodes.
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(analyser)
      // NOT connected to ctx.destination — completely silent

      const entry: TrackEntry = {
        id,
        buffer,
        source,
        analyser,
        fftBuf:   new Float32Array(analyser.frequencyBinCount) as Float32Array<ArrayBuffer>,
        timeBuf:  new Float32Array(analyser.fftSize)           as Float32Array<ArrayBuffer>,
        duration,
        ended:    false
      }

      // Mark ended when playback finishes or exceeds max duration
      source.onended = () => { entry.ended = true }

      // start(when, offset, duration) — third arg caps playback to MAX_ANALYSIS_SECONDS.
      // This avoids calling stop() before start(), which the Web Audio API forbids.
      source.start(0, 0, duration)
      this.tracks.set(id, entry)
    }

    this.scheduleFrame()
  }

  async stop(): Promise<void> {
    this._running = false

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }

    for (const entry of this.tracks.values()) {
      try { entry.source?.stop() } catch { /* already stopped */ }
      entry.source?.disconnect()
    }

    if (this.audioCtx) {
      await this.audioCtx.close()
      this.audioCtx = null
    }

    this.onFrame = null
  }

  // ── RAF loop ────────────────────────────────────────────────────────────────

  private scheduleFrame(): void {
    this.rafHandle = requestAnimationFrame(() => {
      if (!this._running || this.tracks.size === 0) return

      const currentTime = this.audioCtx?.currentTime ?? 0

      const frameData = Array.from(this.tracks.values()).map(entry => {
        if (!entry.ended) {
          entry.analyser.getFloatFrequencyData(entry.fftBuf)
          entry.analyser.getFloatTimeDomainData(entry.timeBuf)
        }
        return {
          id:         entry.id,
          fftData:    entry.fftBuf,
          timeDomain: entry.timeBuf,
          progress:   Math.min(1, currentTime / entry.duration),
          ended:      entry.ended
        }
      })

      this.onFrame?.(frameData, this.audioCtx?.sampleRate ?? 48000)

      // All tracks done → stop the RAF loop (engine stays open until stop() is called)
      const allEnded = Array.from(this.tracks.values()).every(e => e.ended)
      if (allEnded) {
        this._running = false
        return
      }

      if (this._running) this.scheduleFrame()
    })
  }
}
