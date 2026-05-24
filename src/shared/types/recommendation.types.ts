// Recommendation and mixer instruction types

import type { IssueType } from './analysis.types'

export type EQAction =
  // ── EQ operations ──────────────────────────────────────────────────────────
  | 'hpf'                    // Enable high-pass filter (low-cut)
  | 'lpf'                    // Enable low-pass filter (high-cut)
  | 'cut'                    // Reduce gain at a frequency
  | 'boost'                  // Increase gain at a frequency
  | 'notch'                  // Narrow cut
  // ── Gain / level ───────────────────────────────────────────────────────────
  | 'gain_reduce'            // Reduce channel trim / gain
  | 'gain_increase'          // Increase channel trim / gain
  | 'pad'                    // Engage the pad switch (e.g. -20 dB)
  // ── Signal chain checks ────────────────────────────────────────────────────
  | 'phantom_power'          // Enable +48V phantom power (condensers)
  | 'check_cable'            // Inspect / replace cable or connection
  | 'check_gain_structure'   // General gain staging advice
  // ── Performance / technique ────────────────────────────────────────────────
  | 'mic_position'           // Adjust microphone distance / angle
  // ── Dynamics ───────────────────────────────────────────────────────────────
  | 'compression'            // Apply compression to control dynamics
  | 'gate'                   // Apply noise gate to reduce background noise
  | 'limit'                  // Apply limiter to control peak transients

export type BandwidthType = 'narrow' | 'medium' | 'wide' | 'shelf'

// ── DSP Parameter Interfaces ─────────────────────────────────────────────────

export interface CompressorParams {
  threshold: number   // dBFS (e.g. -18)
  ratio:     number   // e.g. 4 means 4:1
  knee:      number   // dB soft-knee width; 0 = hard knee
  mix:       number   // 0–100% wet/dry
  attack:    number   // ms
  hold:      number   // ms
  release:   number   // ms
}

export interface GateParams {
  threshold: number   // dBFS — gate closes below this level
  ratio:     number   // e.g. 10 means 10:1
  knee:      number   // dB
  mix:       number   // 0–100%
  attack:    number   // ms
  hold:      number   // ms
  release:   number   // ms
}

export interface LimiterParams {
  threshold: number   // dBFS ceiling (e.g. -3)
  attack:    number   // ms (usually very fast)
  hold:      number   // ms
}

/**
 * A generic, mixer-agnostic recommendation.
 * Produced by the SuggestionEngine from accumulated audio data.
 * Mixer-specific steps are generated separately by the InstructionMapper.
 */
export interface GenericRecommendation {
  id: string
  action: EQAction
  // For EQ actions: target frequency in Hz. Omitted for non-EQ actions.
  frequency?: number
  // Gain change in dB (positive = boost, negative = cut). EQ only.
  amount?: number
  bandwidth?: BandwidthType
  // EQ band number (1–6) for mixers with numbered parametric EQ bands.
  // Band 1 = HPF, Band 2 = Low, Band 3 = Low-Mid, Band 4 = Mid,
  // Band 5 = High-Mid/Presence, Band 6 = High/Air.
  eqBand?: number
  // Specific parameters for dynamics processors
  compressorParams?: CompressorParams
  gateParams?: GateParams
  limiterParams?: LimiterParams
  // Human-readable explanation, written for a live sound beginner
  reason: string
  // 0–1: how strongly the accumulated data supports this recommendation
  confidence: number
  // Lower number = shown / acted on first
  priority: number
  // Which detected issue prompted this recommendation
  relatedIssue: IssueType | 'level' | 'dynamics' | 'hardware'
}

/**
 * A recommendation bundled with its mixer-specific steps and confirmation status.
 * This is what the store holds and the UI renders.
 */
export interface SuggestionItem {
  recommendation: GenericRecommendation
  // Null when no mixer is selected — still shows the generic advice
  mixerSteps: MixerInstruction[] | null
  mixerName: string | null
  status: 'pending' | 'done' | 'skipped'
}

/**
 * The listening/suggestion lifecycle state:
 *   idle       — audio capture off or not yet started
 *   listening  — accumulating audio (0→25s progress bar)
 *   ready      — suggestions computed, waiting for user to act
 */
export type SuggestionMode = 'idle' | 'listening' | 'ready'

/**
 * A single step in the mixer-specific instruction sequence.
 */
export interface MixerInstruction {
  step: number
  text: string
  detail?: string
}

/**
 * Full set of mixer-specific instructions derived from one GenericRecommendation.
 * Kept separate from SuggestionItem so the mapper can be called independently.
 */
export interface MixerActionSet {
  recommendationId: string
  mixerProfileId:   string
  mixerName:        string
  channel:          number
  action:           EQAction
  frequency?:       number
  amount?:          number
  reason:           string
  instructions:     MixerInstruction[]
}
