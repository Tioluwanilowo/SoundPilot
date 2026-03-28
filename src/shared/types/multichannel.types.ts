// Multi-channel mode types — for DAW-style simultaneous channel analysis

import type { SourceType } from './session.types'
import type { SuggestionItem } from './recommendation.types'
import type { DetectedIssue } from './analysis.types'

/**
 * Serializable config for one channel slot in multi-channel mode.
 * Safe to store in Zustand state and app preferences.
 */
export interface ChannelSlotConfig {
  /** Unique stable id */
  id: string
  /** 0-based USB audio device channel index (e.g. 10 = USB input 11 on Ui24R CH 1) */
  usbChannelIndex: number
  /** Channel number shown on the physical mixer — used to generate mixer instructions */
  mixerChannelNumber: number
  /** Human-readable label, e.g. "Lead Vocal", "Kick Drum" */
  label: string
  sourceType: SourceType
  enabled: boolean
}

/**
 * Runtime state for one channel slot.
 * Managed by useMultiChannelPipeline, exposed via Zustand for the UI.
 * Reset on each session start — not persisted.
 */
export interface ChannelSlotState {
  id: string
  status: 'idle' | 'listening' | 'ready' | 'no-signal'
  /** 0–100 listening progress for the current accumulation window */
  listeningProgress: number
  /** Seconds remaining in the listening window */
  secondsRemaining: number
  /** Live RMS level for the mini meter */
  rmsDb: number
  peakDb: number
  signalPresent: boolean
  issues: DetectedIssue[]
  suggestions: SuggestionItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-track file import types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializable config for one imported audio track.
 * The File object itself is kept outside Zustand (not serializable).
 */
export interface ImportTrackConfig {
  id:                 string
  fileName:           string
  fileSize:           number    // bytes
  /** Decoded audio duration in seconds — 0 until decoded */
  duration:           number
  /** Native sample rate of the file — 0 until decoded */
  fileSampleRate:     number
  /** Number of audio channels in the file (1=mono, 2=stereo) */
  fileChannels:       number
  mixerChannelNumber: number
  label:              string
  sourceType:         SourceType
  enabled:            boolean
}

/**
 * Runtime state for one imported track.
 * Reset when a new import session starts.
 */
export interface ImportTrackState {
  id: string
  /** idle → loading (decoding) → analyzing → ready | error */
  status:          'idle' | 'loading' | 'analyzing' | 'ready' | 'error'
  /** 0–100 — fraction of the audio file that has been analyzed */
  analyzeProgress: number
  suggestions:     SuggestionItem[]
  errorMessage?:   string
}

/**
 * Information about the physical USB audio device after the stream opens.
 * The detected channel count may differ from what was requested.
 */
export interface MultiChannelDeviceInfo {
  deviceId: string
  deviceLabel: string
  /** Actual number of channels the OS/driver exposed */
  detectedChannelCount: number
  /** Whether the count matches what the profile advertises */
  channelCountMatch: boolean
}
