import type { AnalysisSnapshot, GenericRecommendation } from '@shared/types'
import type { SourceType } from '@shared/types'

/**
 * Vocal-specific suggestion rules.
 * These fire when the source type is a vocal/speech type.
 */
export type SuggestionRule = {
  id: string
  appliesTo: SourceType[]
  condition: (snapshot: AnalysisSnapshot) => boolean
  recommend: (snapshot: AnalysisSnapshot) => GenericRecommendation
}

export const vocalSuggestionRules: SuggestionRule[] = [
  // ── HPF for rumble ──────────────────────────────────────────────────────────
  {
    id: 'vocal-hpf-rumble',
    appliesTo: ['male_vocal', 'female_vocal', 'speech'],
    condition: (s) =>
      s.issues.some(i => i.type === 'rumble' && (i.severity === 'medium' || i.severity === 'high')),
    recommend: (_s) => ({
      id:          'vocal-hpf-rumble',
      action:      'hpf',
      frequency:   100,
      eqBand:      1,
      reason:      'Rumble detected below 80 Hz. A high-pass filter at 100 Hz will eliminate handling noise and HVAC without affecting the vocal.',
      confidence:  0.9,
      priority:    1,
      relatedIssue:'rumble'
    })
  },

  // ── Low-mid mud cut for vocals ──────────────────────────────────────────────
  {
    id: 'vocal-lowmid-mud',
    appliesTo: ['male_vocal', 'female_vocal', 'speech'],
    condition: (s) =>
      s.issues.some(i => i.type === 'muddiness') &&
      s.bands.lowMid > s.bands.mid + 5,
    recommend: (s) => {
      const excess = s.bands.lowMid - s.bands.mid
      const amount = Math.max(-8, -(excess * 0.4))
      return {
        id:          'vocal-lowmid-mud',
        action:      'cut',
        frequency:   280,
        eqBand:      3,
        amount:      Math.round(amount * 2) / 2,
        bandwidth:   'medium',
        reason:      'Low-mid buildup (250–350 Hz) is reducing clarity. A gentle cut will clean up the boxy quality.',
        confidence:  0.8,
        priority:    2,
        relatedIssue:'muddiness'
      }
    }
  },

  // ── Proximity boominess cut ─────────────────────────────────────────────────
  {
    id: 'vocal-boom-cut',
    appliesTo: ['male_vocal', 'female_vocal', 'speech'],
    condition: (s) =>
      s.issues.some(i => i.type === 'boominess'),
    recommend: (_s) => ({
      id:          'vocal-boom-cut',
      action:      'cut',
      frequency:   120,
      eqBand:      2,
      amount:      -4,
      bandwidth:   'medium',
      reason:      'Boomy bass resonance detected around 100–150 Hz. Common with close-mic vocals (proximity effect). A moderate cut will tighten the low end.',
      confidence:  0.75,
      priority:    3,
      relatedIssue:'boominess'
    })
  },

  // ── Harsh upper-mid cut ─────────────────────────────────────────────────────
  {
    id: 'vocal-harsh-cut',
    appliesTo: ['male_vocal', 'female_vocal', 'speech'],
    condition: (s) =>
      s.issues.some(i => i.type === 'harshness'),
    recommend: (s) => {
      const excess = s.bands.upperMid - s.bands.mid
      const amount = Math.max(-6, -(excess * 0.35))
      return {
        id:          'vocal-harsh-cut',
        action:      'cut',
        frequency:   3500,
        eqBand:      5,
        amount:      Math.round(amount * 2) / 2,
        bandwidth:   'medium',
        reason:      'Harsh upper-mid spike detected around 2–5 kHz. This region causes listener fatigue. A small cut will smooth the tone without losing presence.',
        confidence:  0.8,
        priority:    2,
        relatedIssue:'harshness'
      }
    }
  },

  // ── Presence boost for clarity ──────────────────────────────────────────────
  {
    id: 'vocal-presence-boost',
    appliesTo: ['male_vocal', 'female_vocal', 'speech'],
    condition: (s) =>
      s.issues.some(i => i.type === 'low_clarity') &&
      !s.issues.some(i => i.type === 'harshness'),
    recommend: (_s) => ({
      id:          'vocal-presence-boost',
      action:      'boost',
      frequency:   5000,
      eqBand:      5,
      amount:      2.5,
      bandwidth:   'wide',
      reason:      'Dull presence region detected. A gentle boost around 5 kHz will improve vocal intelligibility and help the voice cut through the mix.',
      confidence:  0.7,
      priority:    4,
      relatedIssue:'low_clarity'
    })
  },

  // ── Air boost for female vocal ──────────────────────────────────────────────
  {
    id: 'female-vocal-air',
    appliesTo: ['female_vocal'],
    condition: (s) =>
      s.signalPresent &&
      s.bands.high < s.bands.mid - 20 &&
      !s.issues.some(i => i.type === 'harshness'),
    recommend: (_s) => ({
      id:          'female-vocal-air',
      action:      'boost',
      frequency:   12000,
      eqBand:      6,
      amount:      2,
      bandwidth:   'shelf',
      reason:      'High shelf boost (12 kHz+) will add air and openness to the female vocal without affecting the core tone.',
      confidence:  0.6,
      priority:    5,
      relatedIssue:'low_clarity'
    })
  }
]
