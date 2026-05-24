import type { AnalysisSnapshot, GenericRecommendation } from '@shared/types'
import type { SourceType } from '@shared/types'
import type { SuggestionRule } from './vocalRules'

/**
 * Instrument-specific suggestion rules.
 * Each rule targets specific source types.
 */
export const instrumentSuggestionRules: SuggestionRule[] = [
  // ── Acoustic guitar: rumble HPF ─────────────────────────────────────────────
  {
    id: 'acoustic-hpf',
    appliesTo: ['acoustic_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'rumble' || (i.type === 'muddiness' && i.severity !== 'low')),
    recommend: (_s) => ({
      id:          'acoustic-hpf',
      action:      'hpf',
      frequency:   80,
      eqBand:      1,
      reason:      'HPF at 80 Hz removes low-frequency handling noise and room rumble without affecting the guitar\'s warm low-end.',
      confidence:  0.85,
      priority:    1,
      relatedIssue:'rumble'
    })
  },

  // ── Acoustic guitar: muddiness cut ─────────────────────────────────────────
  {
    id: 'acoustic-mud-cut',
    appliesTo: ['acoustic_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'muddiness'),
    recommend: (_s) => ({
      id:          'acoustic-mud-cut',
      action:      'cut',
      frequency:   200,
      eqBand:      3,
      amount:      -3,
      bandwidth:   'medium',
      reason:      'Cut around 200 Hz to reduce boxy resonance common in close-miked acoustic guitars.',
      confidence:  0.75,
      priority:    2,
      relatedIssue:'muddiness'
    })
  },

  // ── Acoustic guitar: presence boost ────────────────────────────────────────
  {
    id: 'acoustic-presence',
    appliesTo: ['acoustic_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'low_clarity') &&
      s.signalPresent,
    recommend: (_s) => ({
      id:          'acoustic-presence',
      action:      'boost',
      frequency:   4000,
      eqBand:      5,
      amount:      2,
      bandwidth:   'wide',
      reason:      'Boost around 4 kHz to bring out the pick attack and note definition of the acoustic guitar.',
      confidence:  0.7,
      priority:    3,
      relatedIssue:'low_clarity'
    })
  },

  // ── Electric guitar: harshness cut ─────────────────────────────────────────
  {
    id: 'electric-harsh-cut',
    appliesTo: ['electric_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'harshness'),
    recommend: (s) => {
      const excess = s.bands.upperMid - s.bands.mid
      const amount = Math.max(-5, -(excess * 0.3))
      return {
        id:          'electric-harsh-cut',
        action:      'cut',
        frequency:   3000,
        eqBand:      4,
        amount:      Math.round(amount * 2) / 2,
        bandwidth:   'narrow',
        reason:      'Reduce the harsh 2–4 kHz edge common with distorted electric guitar through a mic.',
        confidence:  0.75,
        priority:    2,
        relatedIssue:'harshness'
      }
    }
  },

  // ── Bass guitar: sub-bass tighten ───────────────────────────────────────────
  {
    id: 'bass-sub-tighten',
    appliesTo: ['bass_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'muddiness' || i.type === 'boominess'),
    recommend: (_s) => ({
      id:          'bass-sub-tighten',
      action:      'cut',
      frequency:   100,
      eqBand:      2,
      amount:      -3,
      bandwidth:   'medium',
      reason:      'A slight cut around 100 Hz tightens a boomy bass without losing fundamental weight.',
      confidence:  0.7,
      priority:    2,
      relatedIssue:'muddiness'
    })
  },

  // ── Bass guitar: pick attack clarity ───────────────────────────────────────
  {
    id: 'bass-attack-boost',
    appliesTo: ['bass_guitar'],
    condition: (s) =>
      s.issues.some(i => i.type === 'low_clarity') && s.signalPresent,
    recommend: (_s) => ({
      id:          'bass-attack-boost',
      action:      'boost',
      frequency:   800,
      eqBand:      4,
      amount:      2,
      bandwidth:   'medium',
      reason:      'Boost around 700–900 Hz to improve the note definition and pick attack of the bass.',
      confidence:  0.65,
      priority:    3,
      relatedIssue:'low_clarity'
    })
  },

  // ── Keyboard: low-cut to clean up mix ──────────────────────────────────────
  {
    id: 'keyboard-hpf',
    appliesTo: ['keyboard'],
    condition: (s) =>
      s.issues.some(i => i.type === 'muddiness' || i.type === 'rumble'),
    recommend: (_s) => ({
      id:          'keyboard-hpf',
      action:      'hpf',
      frequency:   120,
      eqBand:      1,
      reason:      'Keyboards often add clutter in the sub-bass. A high-pass filter at 120 Hz keeps the mix clean without affecting the instrument\'s range.',
      confidence:  0.8,
      priority:    1,
      relatedIssue:'muddiness'
    })
  },

  // ── Kick drum: sub control ─────────────────────────────────────────────────
  {
    id: 'kick-sub-control',
    appliesTo: ['kick'],
    condition: (s) =>
      s.issues.some(i => i.type === 'rumble') && s.bands.subBass > -40,
    recommend: (_s) => ({
      id:          'kick-sub-control',
      action:      'cut',
      frequency:   50,
      eqBand:      2,
      amount:      -4,
      bandwidth:   'wide',
      reason:      'Reduce extreme sub-bass (below 60 Hz) on the kick to control low-end in the PA and reduce woofer stress.',
      confidence:  0.75,
      priority:    2,
      relatedIssue:'rumble'
    })
  },

  // ── Kick drum: attack presence ─────────────────────────────────────────────
  {
    id: 'kick-attack',
    appliesTo: ['kick'],
    condition: (s) =>
      s.issues.some(i => i.type === 'low_clarity') && s.signalPresent,
    recommend: (_s) => ({
      id:          'kick-attack',
      action:      'boost',
      frequency:   4000,
      eqBand:      5,
      amount:      3,
      bandwidth:   'narrow',
      reason:      'Boost around 3–5 kHz to add click and attack to the kick drum in the mix.',
      confidence:  0.7,
      priority:    3,
      relatedIssue:'low_clarity'
    })
  },

  // ── General: HPF for rumble (all sources) ──────────────────────────────────
  {
    id: 'general-hpf',
    appliesTo: ['general'],
    condition: (s) =>
      s.issues.some(i => i.type === 'rumble' && i.severity !== 'low'),
    recommend: (_s) => ({
      id:          'general-hpf',
      action:      'hpf',
      frequency:   100,
      eqBand:      1,
      reason:      'Sub-bass rumble detected. A high-pass filter at 100 Hz is safe for most sources and will clean up the low end.',
      confidence:  0.8,
      priority:    1,
      relatedIssue:'rumble'
    })
  },

  // ── General: clipping — reduce gain ────────────────────────────────────────
  {
    id: 'general-clipping',
    appliesTo: ['general', 'male_vocal', 'female_vocal', 'speech', 'acoustic_guitar',
                'electric_guitar', 'bass_guitar', 'keyboard', 'drum_overhead', 'snare', 'kick'],
    condition: (s) =>
      s.issues.some(i => i.type === 'clipping_risk' && i.severity === 'high'),
    recommend: (_s) => ({
      id:          'general-clipping',
      action:      'cut',
      frequency:   1000,
      eqBand:      4,
      amount:      -6,
      reason:      'Signal is clipping. Reduce the channel trim/gain control on the mixer to bring the peak level below -3 dBFS.',
      confidence:  1.0,
      priority:    0,
      relatedIssue:'clipping_risk'
    })
  }
]

// Separate export for use by SuggestionEngine
export type { SuggestionRule }
