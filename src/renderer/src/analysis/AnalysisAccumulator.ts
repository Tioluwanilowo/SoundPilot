import type { AnalysisSnapshot, FrequencyBands, IssueType, DetectedIssue } from '@shared/types'

/**
 * The output of a completed accumulation window.
 * Band values are medians across all captured samples (robust to outliers).
 * issuePersistence maps each issue type to [0,1] — fraction of samples it appeared in.
 */
export interface AccumulatedAnalysis {
  bands:             FrequencyBands
  averageLevelDb:    number
  peakLevelDb:       number
  clippingRisk:      boolean   // true if clipping appeared in >10% of samples
  clippingPct:       number    // 0–1
  issuePersistence:  Partial<Record<IssueType, number>>  // 0–1 per issue
  sampleCount:       number
  signalPct:         number    // fraction of frames that had signal
  durationMs:        number
}

/**
 * AnalysisAccumulator — collects AnalysisSnapshots over a fixed time window
 * and produces a time-averaged, noise-resistant AccumulatedAnalysis.
 *
 * Why time averaging matters for live sound:
 *   A single 100ms frame can detect an issue that's just a transient (cough,
 *   pop). By requiring an issue to appear in >40% of frames over 25 seconds,
 *   we only surface real, persistent tonal problems.
 *
 * Usage:
 *   accumulator.add(snapshot)   // call on every analysis tick
 *   accumulator.progress        // 0–1 (UI progress bar)
 *   accumulator.isReady         // true when window is complete
 *   accumulator.getResult()     // returns AccumulatedAnalysis
 *   accumulator.reset()         // start a new window
 */
export class AnalysisAccumulator {
  private snapshots:   AnalysisSnapshot[] = []
  private frameCount:  number = 0   // total frames seen (including silent ones)
  private startTime:   number | null = null
  private readonly windowMs: number

  constructor(windowSec: number = 25) {
    this.windowMs = windowSec * 1000
  }

  add(snapshot: AnalysisSnapshot): void {
    this.frameCount++
    if (this.startTime === null) {
      this.startTime = snapshot.timestamp
    }
    // Only accumulate frames where there's actual signal
    if (snapshot.signalPresent) {
      this.snapshots.push(snapshot)
    }
  }

  /** 0–1 wall-clock progress through the window */
  get progress(): number {
    if (this.startTime === null) return 0
    return Math.min(1, (Date.now() - this.startTime) / this.windowMs)
  }

  get secondsRemaining(): number {
    return Math.max(0, (this.windowMs - (Date.now() - (this.startTime ?? Date.now()))) / 1000)
  }

  get isReady(): boolean {
    return this.progress >= 1
  }

  get sampleCount(): number {
    return this.snapshots.length
  }

  /** Minimum number of signal samples needed to produce a valid result */
  get hasEnoughSignal(): boolean {
    return this.snapshots.length >= 15
  }

  getResult(): AccumulatedAnalysis | null {
    if (this.snapshots.length === 0) return null

    const n = this.snapshots.length
    const bandKeys: (keyof FrequencyBands)[] = [
      'subBass', 'bass', 'lowMid', 'mid', 'upperMid', 'presence', 'high'
    ]

    // Median per band — robust to outliers from transients
    const bands = {} as FrequencyBands
    for (const key of bandKeys) {
      const vals = this.snapshots.map(s => s.bands[key]).sort((a, b) => a - b)
      bands[key] = vals[Math.floor(vals.length / 2)]
    }

    // Level stats
    const levels     = this.snapshots.map(s => s.levelDb)
    const avgLevel   = levels.reduce((a, b) => a + b, 0) / n
    const peakLevel  = Math.max(...this.snapshots.map(s => s.peakDb))
    const clipFrames = this.snapshots.filter(s => s.clippingRisk).length
    const clippingPct = clipFrames / n

    // Issue persistence: fraction of signal-present frames that detected each issue
    const issueCounts: Partial<Record<IssueType, number>> = {}
    for (const snap of this.snapshots) {
      for (const issue of snap.issues) {
        issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1
      }
    }
    const issuePersistence: Partial<Record<IssueType, number>> = {}
    for (const [type, count] of Object.entries(issueCounts) as [IssueType, number][]) {
      issuePersistence[type] = count / n
    }

    const signalPct = this.frameCount > 0 ? n / this.frameCount : 0
    const durationMs = this.startTime ? Date.now() - this.startTime : 0

    return {
      bands,
      averageLevelDb: avgLevel,
      peakLevelDb:    peakLevel,
      clippingRisk:   clippingPct > 0.1,
      clippingPct,
      issuePersistence,
      sampleCount:    n,
      signalPct,
      durationMs
    }
  }

  /**
   * Build a representative AnalysisSnapshot from the accumulated data.
   * This lets existing snapshot-based EQ rules work unchanged.
   * Only issues with persistence >= threshold are included.
   */
  toRepresentativeSnapshot(persistenceThreshold: number = 0.4): AnalysisSnapshot {
    const result = this.getResult()
    if (!result) {
      return {
        timestamp:    Date.now(),
        levelDb:      -100,
        peakDb:       -100,
        clippingRisk: false,
        signalPresent: false,
        bands:         { subBass: -100, bass: -100, lowMid: -100, mid: -100, upperMid: -100, presence: -100, high: -100 },
        issues:        []
      }
    }

    // Build DetectedIssue list from persistent issues
    const issues: DetectedIssue[] = []
    for (const [type, persistence] of Object.entries(result.issuePersistence) as [IssueType, number][]) {
      if (persistence >= persistenceThreshold) {
        issues.push({
          type,
          severity: persistence >= 0.7 ? 'high' : persistence >= 0.5 ? 'medium' : 'low',
          description: `Detected in ${Math.round(persistence * 100)}% of the listening window`
        })
      }
    }

    return {
      timestamp:    Date.now(),
      levelDb:      result.averageLevelDb,
      peakDb:       result.peakLevelDb,
      clippingRisk: result.clippingRisk,
      signalPresent: true,
      bands:         result.bands,
      issues
    }
  }

  reset(): void {
    this.snapshots  = []
    this.frameCount = 0
    this.startTime  = null
  }
}
