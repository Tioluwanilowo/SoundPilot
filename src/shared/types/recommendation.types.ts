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

export type BandwidthType = 'narrow' | 'medium' | 'wide' | 'shelf'

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
