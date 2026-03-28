import type { AnalysisResult, AnalysisSnapshot } from '@shared/types'
import type { SourceType } from '@shared/types'
import { LEVEL_THRESHOLDS } from '@shared/constants/frequencies'
import { FFTProcessor } from './FFTProcessor'
import { IssueDetector } from './IssueDetector'
import { IssueSmoothing } from './IssueSmoothing'

/**
 * AnalysisEngine — the core signal processing orchestrator.
 *
 * Called on every animation frame with fresh FFT and time-domain data
 * from the Web Audio AnalyserNode. Produces a complete AnalysisResult
 * that is consumed by the SuggestionEngine and the UI.
 *
 * Pipeline per frame:
 *   1. Compute RMS and peak level from time-domain buffer
 *   2. Compute FFT band averages from frequency-domain buffer
 *   3. Run issue detection rules
 *   4. Pass raw issues through temporal smoother (eliminates flickering)
 *   5. Return AnalysisResult
 *
 * What is real vs approximated in this implementation:
 *   REAL:    FFT band energy computation, RMS/peak calculation, issue rules,
 *            temporal smoothing
 *   APPROX:  Thresholds are empirical; no psychoacoustic weighting; no
 *            transient detection; band averages (not peak-per-bin)
 *   FUTURE:  Per-source weighting, A-weighting, spectral centroid, ML scoring
 */
export class AnalysisEngine {
  private fftProcessor  = new FFTProcessor()
  private issueDetector = new IssueDetector()
  private smoother      = new IssueSmoothing()
  private sourceType: SourceType = 'general'

  setSourceType(sourceType: SourceType): void {
    if (this.sourceType !== sourceType) {
      this.sourceType = sourceType
      // Reset smoother when source changes — old issue state is irrelevant
      this.smoother.reset()
    }
  }

  /**
   * Process one frame of audio data.
   *
   * @param fftData     Float32Array from AnalyserNode.getFloatFrequencyData()
   *                    NOTE: This is the analyser's internal buffer — it will
   *                    be overwritten on the next frame. We copy it here so
   *                    the result can be safely held across frames (e.g. in
   *                    the latestResultRef used by SpectrumAnalyzer).
   * @param timeDomain  Float32Array from AnalyserNode.getFloatTimeDomainData()
   * @param sampleRate  AudioContext.sampleRate (typically 44100 or 48000)
   */
  analyze(
    fftData: Float32Array<ArrayBuffer>,
    timeDomain: Float32Array<ArrayBuffer>,
    sampleRate: number
  ): AnalysisResult {
    const levelDb = this.fftProcessor.computeRmsDb(timeDomain)
    const peakDb  = this.fftProcessor.computePeakDb(timeDomain)
    const signalPresent = levelDb > LEVEL_THRESHOLDS.SILENCE

    const bands = signalPresent
      ? this.fftProcessor.computeBands(fftData, sampleRate)
      : { subBass: -100, bass: -100, lowMid: -100, mid: -100, upperMid: -100, presence: -100, high: -100 }

    // Detect raw issues
    const rawIssues = signalPresent
      ? this.issueDetector.detect(bands, levelDb, peakDb, this.sourceType)
      : []

    // Apply temporal smoothing to eliminate single-frame false positives
    const smoothedIssues = this.smoother.process(rawIssues)

    return {
      timestamp:    Date.now(),
      levelDb,
      peakDb,
      clippingRisk: peakDb > LEVEL_THRESHOLDS.CLIP,
      signalPresent,
      bands,
      // Defensive copy — caller must not write to this array, but we want
      // latestResultRef to stay valid across multiple RAF cycles without
      // the underlying analyser buffer being mutated underneath it.
      fftData:      new Float32Array(fftData),
      fftSize:      fftData.length * 2,
      sampleRate,
      issues:       smoothedIssues
    }
  }

  /**
   * Creates a serializable snapshot from a full AnalysisResult.
   * Strips the Float32Array for safe Zustand storage and IPC transport.
   */
  static toSnapshot(result: AnalysisResult): AnalysisSnapshot {
    return {
      timestamp:    result.timestamp,
      levelDb:      result.levelDb,
      peakDb:       result.peakDb,
      clippingRisk: result.clippingRisk,
      signalPresent: result.signalPresent,
      bands:        result.bands,
      issues:       result.issues
    }
  }

  reset(): void {
    this.smoother.reset()
  }
}
