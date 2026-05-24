import type { GenericRecommendation } from '@shared/types'
import type { AccumulatedAnalysis } from '../../analysis/AnalysisAccumulator'
import type { SourceType } from '@shared/types'

/**
 * Hardware and gain-staging rules.
 *
 * These rules examine the accumulated signal over the full listening window —
 * things like average level, clipping frequency, and dynamic range — and suggest
 * actions that aren't EQ adjustments: gain changes, phantom power, mic technique,
 * compression, and cable checks.
 *
 * Unlike EQ rules (which use a representative snapshot), hardware rules receive
 * the raw AccumulatedAnalysis so they can reason about signal statistics.
 */

export type HardwareRule = {
  id:         string
  appliesTo:  SourceType[] | 'all'
  condition:  (acc: AccumulatedAnalysis, source: SourceType) => boolean
  recommend:  (acc: AccumulatedAnalysis, source: SourceType) => GenericRecommendation
}

export const hardwareRules: HardwareRule[] = [

  // ── Clipping — highest priority always ──────────────────────────────────────
  {
    id: 'hw-clipping',
    appliesTo: 'all',
    condition: (acc) => acc.clippingRisk,
    recommend: (acc) => ({
      id:           'hw-clipping',
      action:       'gain_reduce',
      reason:       `Signal is clipping — it exceeded 0 dBFS in ${Math.round(acc.clippingPct * 100)}% of the listening window. Reduce the channel trim/gain until the clip indicator stays off.`,
      confidence:   1.0,
      priority:     0,
      relatedIssue: 'level'
    })
  },

  // ── Pad switch ───────────────────────────────────────────────────────────────
  // Recommend pad if clipping is very frequent — gain alone may not be enough
  {
    id: 'hw-pad',
    appliesTo: 'all',
    condition: (acc) => acc.clippingPct > 0.3,
    recommend: (_acc) => ({
      id:           'hw-pad',
      action:       'pad',
      reason:       'Clipping is very frequent — the source may be too hot for the preamp even at minimum gain. Engage the PAD switch (usually -20 dB) on the channel, then re-set the gain.',
      confidence:   0.85,
      priority:     1,
      relatedIssue: 'level'
    })
  },

  // ── Signal too low ───────────────────────────────────────────────────────────
  {
    id: 'hw-gain-low',
    appliesTo: 'all',
    condition: (acc) => acc.averageLevelDb < -42 && !acc.clippingRisk && acc.signalPct > 0.3,
    recommend: (acc) => ({
      id:           'hw-gain-low',
      action:       'gain_increase',
      reason:       `Average signal level is ${Math.round(acc.averageLevelDb)} dBFS — too low for a healthy mix. Increase the channel trim/gain to bring the average up to around -18 to -12 dBFS.`,
      confidence:   0.9,
      priority:     1,
      relatedIssue: 'level'
    })
  },

  // ── Very weak signal — phantom power check ────────────────────────────────────
  // A condenser mic without phantom power sends almost nothing
  {
    id: 'hw-phantom',
    appliesTo: 'all',
    condition: (acc) => acc.averageLevelDb < -60 && acc.signalPct < 0.2,
    recommend: (_acc) => ({
      id:           'hw-phantom',
      action:       'phantom_power',
      reason:       'Almost no signal detected across the full listening window. If you are using a condenser microphone, enable +48V phantom power on the channel. Dynamic mics do not require phantom power.',
      confidence:   0.8,
      priority:     0,
      relatedIssue: 'hardware'
    })
  },

  // ── Intermittent / cutting out signal ─────────────────────────────────────────
  // High frame count but low signal percentage → cable or connection issue
  {
    id: 'hw-cable',
    appliesTo: 'all',
    condition: (acc) => acc.sampleCount > 30 && acc.signalPct < 0.3 && acc.averageLevelDb > -80,
    recommend: (_acc) => ({
      id:           'hw-cable',
      action:       'check_cable',
      reason:       'The signal appears intermittent — it dropped in and out during the listening window. Check the XLR/jack cable, connectors, and the channel insert points for a loose or faulty connection.',
      confidence:   0.75,
      priority:     1,
      relatedIssue: 'hardware'
    })
  },

  // ── Proximity effect / boominess on vocals → mic technique ───────────────────
  {
    id: 'hw-mic-distance',
    appliesTo: ['male_vocal', 'female_vocal', 'speech', 'acoustic_guitar'],
    condition: (acc, source) => {
      const boom = acc.issuePersistence['boominess'] ?? 0
      const mud  = acc.issuePersistence['muddiness'] ?? 0
      const isVocal = ['male_vocal', 'female_vocal', 'speech'].includes(source)
      return isVocal ? boom > 0.4 : (boom > 0.6 && mud > 0.5)
    },
    recommend: (_acc, source) => ({
      id:           'hw-mic-distance',
      action:       'mic_position',
      reason:       source === 'acoustic_guitar'
        ? 'Boomy low-end buildup detected. Try moving the microphone away from the soundhole and angling it toward the 12th fret to reduce bass resonance.'
        : 'Strong proximity effect detected — the microphone is likely very close to the mouth. Ask the singer to pull back 2–4 inches. This will naturally reduce the bass buildup before any EQ is needed.',
      confidence:   0.8,
      priority:     2,
      relatedIssue: 'hardware'
    })
  },

  // ── High dynamic range — suggest compression ──────────────────────────────────
  // Crest factor (peak - average) > 20 dB means very peaky, inconsistent signal
  {
    id: 'hw-compression',
    appliesTo: ['male_vocal', 'female_vocal', 'speech', 'acoustic_guitar', 'bass_guitar'],
    condition: (acc) => {
      const crestFactor = acc.peakLevelDb - acc.averageLevelDb
      return crestFactor > 20 && acc.averageLevelDb > -55 && !acc.clippingRisk
    },
    recommend: (acc) => {
      const crest     = Math.round(acc.peakLevelDb - acc.averageLevelDb)
      const threshold = Math.round(acc.averageLevelDb + 6)
      return {
        id:     'hw-compression',
        action: 'compression',
        reason: `Dynamic range is very wide (${crest} dB crest factor). Apply compression to level the signal and make it sit consistently in the mix.`,
        compressorParams: {
          threshold,
          ratio:   4.0,
          knee:    4.0,
          mix:     100,
          attack:  10,
          hold:    0,
          release: 200
        },
        confidence:   0.7,
        priority:     4,
        relatedIssue: 'dynamics'
      }
    }
  },

  // ── Noise gate — signal drops out frequently ──────────────────────────────────
  // Low signal percentage with a reasonable average level indicates noisy silences
  {
    id: 'hw-gate',
    appliesTo: ['male_vocal', 'female_vocal', 'speech', 'acoustic_guitar',
                'electric_guitar', 'snare', 'kick', 'drum_overhead'],
    condition: (acc) =>
      acc.signalPct < 0.65 && acc.signalPct > 0.1 &&
      acc.averageLevelDb > -50 && !acc.clippingRisk,
    recommend: (acc) => {
      const threshold = Math.round(acc.averageLevelDb - 28)
      return {
        id:     'hw-gate',
        action: 'gate',
        reason: `Signal was absent ${Math.round((1 - acc.signalPct) * 100)}% of the listening window. A noise gate will mute the channel during silences and keep background noise out of the mix.`,
        gateParams: {
          threshold,
          ratio:   10.0,
          knee:    2.0,
          mix:     100,
          attack:  5,
          hold:    100,
          release: 300
        },
        confidence:   0.65,
        priority:     4,
        relatedIssue: 'dynamics'
      }
    }
  },

  // ── Occasional peaks — suggest limiter ────────────────────────────────────────
  // Low-level clipping (2–10% of frames) that gain reduction alone won't fully fix
  {
    id: 'hw-limiter',
    appliesTo: 'all',
    condition: (acc) => acc.clippingPct > 0.02 && acc.clippingPct <= 0.1,
    recommend: (_acc) => ({
      id:     'hw-limiter',
      action: 'limit',
      reason: `Occasional peaks are clipping the signal. A limiter set just below 0 dBFS will catch these transients without affecting the overall level.`,
      limiterParams: {
        threshold: -3,
        attack:    1,
        hold:      10
      },
      confidence:   0.75,
      priority:     2,
      relatedIssue: 'level'
    })
  }

]
