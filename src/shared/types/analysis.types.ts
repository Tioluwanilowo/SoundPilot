// Analysis engine output types

/**
 * Energy (dBFS) for standard frequency bands.
 * All values are in dBFS (negative numbers; 0 = full scale).
 * Typical active signal values: -60 (quiet) to -20 (loud).
 */
export interface FrequencyBands {
  subBass: number    // 20–80 Hz   — rumble, kick low end
  bass: number       // 80–250 Hz  — warmth, muddiness zone
  lowMid: number     // 250–500 Hz — boxiness, low-mid mud
  mid: number        // 500–2000 Hz — body, fundamental presence
  upperMid: number   // 2000–5000 Hz — harshness, definition
  presence: number   // 4000–8000 Hz — vocal intelligibility
  high: number       // 8000–20000 Hz — air, brilliance
}

export type IssueSeverity = 'low' | 'medium' | 'high'

export type IssueType =
  | 'rumble'        // Excess sub-bass energy (e.g., from handling noise, HVAC)
  | 'muddiness'     // Excess bass/low-mid buildup obscuring clarity
  | 'boominess'     // Excess 80–120 Hz, often from proximity effect
  | 'harshness'     // Excess 2–5 kHz causing listener fatigue
  | 'thinness'      // Deficient low-mid, weak body
  | 'low_clarity'   // Dull presence region, poor intelligibility
  | 'clipping_risk' // Signal approaching or exceeding 0 dBFS
  | 'low_signal'    // Input level too low to analyze reliably

export interface DetectedIssue {
  type: IssueType
  severity: IssueSeverity
  description: string
  // The band values that triggered this detection (for UI context)
  triggerBands?: Partial<FrequencyBands>
}

export interface AnalysisResult {
  timestamp: number
  // Level
  levelDb: number         // RMS level in dBFS
  peakDb: number          // Peak level in dBFS
  clippingRisk: boolean   // true if peak > -3 dBFS
  signalPresent: boolean  // true if RMS > threshold (e.g. -50 dBFS)
  // Spectral bands
  bands: FrequencyBands
  // Raw FFT data for spectrum display (from AnalyserNode.getFloatFrequencyData)
  // Length = fftSize / 2; value at index i is dBFS for frequency i * sampleRate / fftSize
  // Uses explicit ArrayBuffer generic (TypeScript 5.5+ requirement for Web Audio API compat)
  fftData: Float32Array<ArrayBuffer>
  fftSize: number
  sampleRate: number
  // Detected issues
  issues: DetectedIssue[]
}

/** Serializable version of AnalysisResult for storing in state (no typed array) */
export interface AnalysisSnapshot {
  timestamp: number
  levelDb: number
  peakDb: number
  clippingRisk: boolean
  signalPresent: boolean
  bands: FrequencyBands
  issues: DetectedIssue[]
}
