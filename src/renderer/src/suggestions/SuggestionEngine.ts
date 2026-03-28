import type { GenericRecommendation } from '@shared/types'
import type { SourceType } from '@shared/types'
import type { AccumulatedAnalysis } from '../analysis/AnalysisAccumulator'
import { vocalSuggestionRules } from './rules/vocalRules'
import { instrumentSuggestionRules } from './rules/instrumentRules'
import { hardwareRules } from './rules/hardwareRules'
import type { SuggestionRule } from './rules/vocalRules'
import type { AnalysisAccumulator } from '../analysis/AnalysisAccumulator'

/**
 * SuggestionEngine — converts accumulated audio data into a complete,
 * prioritized list of GenericRecommendations.
 *
 * Two rule classes are evaluated:
 *
 *   1. EQ rules (vocalRules, instrumentRules)
 *      These receive a "representative snapshot" derived from the accumulated
 *      data — median band levels, persistent issues only. Same rule signature
 *      as before; no rule-level changes needed.
 *
 *   2. Hardware rules (hardwareRules)
 *      These receive the raw AccumulatedAnalysis to reason about level stats,
 *      dynamic range, signal presence, and clipping frequency.
 *
 * Issue persistence threshold:
 *   An issue must appear in ≥40% of captured frames to be included in the
 *   representative snapshot. This prevents transient noise from generating
 *   suggestions. At 25s × ~12 snapshots/s = ~300 samples, 40% = 120 frames.
 *
 * De-duplication:
 *   If two rules fire for the same issue, the higher-confidence one wins.
 *
 * Ordering:
 *   Results are sorted by priority (ascending) then confidence (descending).
 *   Hardware/gain issues always come first (priority 0–1) since they must
 *   be fixed before EQ is meaningful.
 */
export class SuggestionEngine {
  private eqRules: SuggestionRule[]
  private readonly PERSISTENCE_THRESHOLD = 0.4

  constructor() {
    this.eqRules = [...vocalSuggestionRules, ...instrumentSuggestionRules]
  }

  generate(accumulator: AnalysisAccumulator, sourceType: SourceType): GenericRecommendation[] {
    const accumulated = accumulator.getResult()
    if (!accumulated) return []

    const recs: GenericRecommendation[] = []

    // ── 1. Hardware rules (raw accumulated data) ────────────────────────────
    for (const rule of hardwareRules) {
      const appliesToAll   = rule.appliesTo === 'all'
      const appliesToSource = Array.isArray(rule.appliesTo) && rule.appliesTo.includes(sourceType)
      if (!appliesToAll && !appliesToSource) continue

      if (rule.condition(accumulated, sourceType)) {
        recs.push(rule.recommend(accumulated, sourceType))
      }
    }

    // ── 2. EQ rules (representative snapshot) ──────────────────────────────
    // Skip EQ rules if there's a clipping or very-low-signal issue —
    // gain structure must be fixed before EQ is meaningful.
    const hasGainIssue = recs.some(r => r.action === 'gain_reduce' || r.action === 'gain_increase' || r.action === 'phantom_power')

    if (!hasGainIssue) {
      const snapshot = accumulator.toRepresentativeSnapshot(this.PERSISTENCE_THRESHOLD)

      const applicable = this.eqRules.filter(rule =>
        rule.appliesTo.includes(sourceType) || rule.appliesTo.includes('general' as SourceType)
      )

      for (const rule of applicable) {
        if (rule.condition(snapshot)) {
          recs.push(rule.recommend(snapshot))
        }
      }
    }

    // ── 3. De-duplicate by issue — keep highest confidence per issue ─────────
    const seen = new Map<string, GenericRecommendation>()
    for (const rec of recs) {
      const key = rec.relatedIssue + ':' + rec.action
      const existing = seen.get(key)
      if (!existing || rec.confidence > existing.confidence) {
        seen.set(key, rec)
      }
    }

    // ── 4. Sort: by priority asc, then confidence desc ───────────────────────
    return Array.from(seen.values())
      .sort((a, b) => a.priority !== b.priority
        ? a.priority - b.priority
        : b.confidence - a.confidence
      )
  }
}
