// Session and app preference types

/**
 * Source type describes the kind of audio being analyzed.
 * The suggestion engine uses this to adjust detection thresholds and rules.
 */
export type SourceType =
  | 'male_vocal'
  | 'female_vocal'
  | 'speech'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'bass_guitar'
  | 'keyboard'
  | 'drum_overhead'
  | 'snare'
  | 'kick'
  | 'general'

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  male_vocal:     'Male Vocal',
  female_vocal:   'Female Vocal',
  speech:         'Speech / Presenter',
  acoustic_guitar:'Acoustic Guitar',
  electric_guitar:'Electric Guitar',
  bass_guitar:    'Bass Guitar',
  keyboard:       'Keyboard / Keys',
  drum_overhead:  'Drum Overhead',
  snare:          'Snare',
  kick:           'Kick Drum',
  general:        'General / Unknown'
}

export interface SessionState {
  selectedDeviceId:       string | null
  selectedMixerProfileId: string | null
  selectedSourceType:     SourceType
  channelNumber:          number
  sessionStartTime:       number | null
  presetName:             string | null
}

export interface AppPreferences {
  // How often (ms) to push analysis results to the store (meter smoothness)
  analysisRefreshMs: number
  // How long (seconds) to listen before generating suggestions
  listeningWindowSec: number
  // Signal level below which frames are not counted toward the listening window
  minimumSignalThresholdDb: number
  // Default channel for new sessions
  defaultChannelNumber: number
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  analysisRefreshMs:          80,    // ~12fps meter updates
  listeningWindowSec:         25,    // Listen 25 seconds before suggesting
  minimumSignalThresholdDb:   -60,
  defaultChannelNumber:        1
}

export interface AppPreset {
  id:        string
  name:      string
  createdAt: number
  session:   SessionState
}
