import type { FrequencyBands, DetectedIssue, IssueType } from '@shared/types'
import type { SourceType } from '@shared/types'
import { LEVEL_THRESHOLDS } from '@shared/constants/frequencies'

/**
 * A detection rule function.
 * Returns a DetectedIssue if the condition is met, or null otherwise.
 */
export type DetectionRule = (
  bands: FrequencyBands,
  levelDb: number,
  peakDb: number,
  sourceType: SourceType
) => DetectedIssue | null

/**
 * Relative threshold: how much louder one band must be vs another to trigger.
 * All thresholds tuned for the -60 to -10 dBFS range of a typical active signal.
 */

// ── Rumble ────────────────────────────────────────────────────────────────────
// Sub-bass (20–80 Hz) is elevated and significantly louder than the bass band.
// Classic causes: mic handling noise, HVAC, stage vibration.
export const rumbleRule: DetectionRule = (bands, levelDb, _peakDb, _source) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  const subRelativeToBass = bands.subBass - bands.bass
  if (bands.subBass > -55 && subRelativeToBass > 8) {
    const severity = subRelativeToBass > 15 ? 'high' : subRelativeToBass > 10 ? 'medium' : 'low'
    return {
      type: 'rumble' as IssueType,
      severity,
      description: 'Excessive sub-bass rumble detected (20–80 Hz). Likely handling noise, HVAC, or stage vibration.',
      triggerBands: { subBass: bands.subBass, bass: bands.bass }
    }
  }
  return null
}

// ── Muddiness ─────────────────────────────────────────────────────────────────
// Bass and/or low-mid are significantly louder than the mid band.
// Classic cause: too much 100–400 Hz energy, proximity effect, room buildup.
export const muddinessRule: DetectionRule = (bands, levelDb, _peakDb, _source) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  const lowMidRelativeToMid = bands.lowMid - bands.mid
  const bassRelativeToMid   = bands.bass   - bands.mid
  const worst = Math.max(lowMidRelativeToMid, bassRelativeToMid)
  if (worst > 6) {
    const severity = worst > 12 ? 'high' : worst > 8 ? 'medium' : 'low'
    return {
      type: 'muddiness' as IssueType,
      severity,
      description: 'Excess low-mid energy (100–400 Hz) is masking clarity. Common on vocals and acoustic instruments near room boundaries.',
      triggerBands: { bass: bands.bass, lowMid: bands.lowMid, mid: bands.mid }
    }
  }
  return null
}

// ── Boominess ─────────────────────────────────────────────────────────────────
// Strong bass bump specifically in 80–120 Hz; narrower than muddiness.
export const boominessRule: DetectionRule = (bands, levelDb, _peakDb, sourceType) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  // Kick and bass guitar naturally have bass; don't flag them for boominess
  if (sourceType === 'kick' || sourceType === 'bass_guitar') return null
  const excessBass = bands.bass - bands.mid
  if (excessBass > 10 && bands.bass > -45) {
    const severity = excessBass > 16 ? 'high' : excessBass > 12 ? 'medium' : 'low'
    return {
      type: 'boominess' as IssueType,
      severity,
      description: 'Boomy bass resonance in the 80–150 Hz range. Often caused by proximity effect or room resonance.',
      triggerBands: { bass: bands.bass, mid: bands.mid }
    }
  }
  return null
}

// ── Harshness ─────────────────────────────────────────────────────────────────
// Upper-mid band (2–5 kHz) is elevated and louder than mid and presence.
// Classic cause: excessive 2–4 kHz on vocals or guitar, overdriven preamp.
export const harshnessRule: DetectionRule = (bands, levelDb, _peakDb, sourceType) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  // Snare naturally has bite in this region
  if (sourceType === 'snare') return null
  const upperRelativeToMid = bands.upperMid - bands.mid
  if (upperRelativeToMid > 8 && bands.upperMid > -40) {
    const severity = upperRelativeToMid > 14 ? 'high' : upperRelativeToMid > 10 ? 'medium' : 'low'
    return {
      type: 'harshness' as IssueType,
      severity,
      description: 'Harsh upper-mid spike (2–5 kHz). This frequency range causes listener fatigue quickly.',
      triggerBands: { upperMid: bands.upperMid, mid: bands.mid }
    }
  }
  return null
}

// ── Thinness ──────────────────────────────────────────────────────────────────
// Bass and low-mid are significantly lower than mid.
// Classic cause: over-EQ'd low end, thin source, HPF set too high.
export const thinnessRule: DetectionRule = (bands, levelDb, _peakDb, sourceType) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  // Instruments with naturally thin profiles
  if (sourceType === 'snare' || sourceType === 'drum_overhead') return null
  const midOverBass   = bands.mid - bands.bass
  const midOverLowMid = bands.mid - bands.lowMid
  if (midOverBass > 15 && midOverLowMid > 10) {
    const severity = midOverBass > 22 ? 'high' : midOverBass > 18 ? 'medium' : 'low'
    return {
      type: 'thinness' as IssueType,
      severity,
      description: 'Thin, weak low end — the bass/low-mid region is too low relative to the mids.',
      triggerBands: { bass: bands.bass, lowMid: bands.lowMid, mid: bands.mid }
    }
  }
  return null
}

// ── Low Clarity ───────────────────────────────────────────────────────────────
// Presence region (4–8 kHz) is well below the mid band.
// Classic cause: insufficient presence, high-shelf cut, dull recording.
export const lowClarityRule: DetectionRule = (bands, levelDb, _peakDb, sourceType) => {
  if (levelDb < LEVEL_THRESHOLDS.SILENCE) return null
  // Kick and bass don't need presence
  if (sourceType === 'kick' || sourceType === 'bass_guitar') return null
  const midOverPresence = bands.mid - bands.presence
  if (midOverPresence > 14 && bands.mid > -45) {
    const severity = midOverPresence > 22 ? 'high' : midOverPresence > 17 ? 'medium' : 'low'
    return {
      type: 'low_clarity' as IssueType,
      severity,
      description: 'Dull presence region (4–8 kHz). Vocals or instruments may sound muffled or lack intelligibility.',
      triggerBands: { mid: bands.mid, presence: bands.presence }
    }
  }
  return null
}

// ── Clipping Risk ─────────────────────────────────────────────────────────────
export const clippingRiskRule: DetectionRule = (_bands, _levelDb, peakDb, _source) => {
  if (peakDb > LEVEL_THRESHOLDS.CLIP) {
    return {
      type: 'clipping_risk' as IssueType,
      severity: 'high',
      description: `Peak level is at ${peakDb.toFixed(1)} dBFS — reduce the channel gain or input level immediately.`
    }
  }
  if (peakDb > LEVEL_THRESHOLDS.WARNING) {
    return {
      type: 'clipping_risk' as IssueType,
      severity: 'medium',
      description: `Peak level is at ${peakDb.toFixed(1)} dBFS — approaching clipping. Consider reducing gain slightly.`
    }
  }
  return null
}

// ── All rules in priority order ───────────────────────────────────────────────
export const ALL_DETECTION_RULES: DetectionRule[] = [
  clippingRiskRule,
  rumbleRule,
  muddinessRule,
  boominessRule,
  harshnessRule,
  thinnessRule,
  lowClarityRule
]
