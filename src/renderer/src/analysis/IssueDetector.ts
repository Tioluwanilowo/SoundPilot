import type { FrequencyBands, DetectedIssue } from '@shared/types'
import type { SourceType } from '@shared/types'
import { ALL_DETECTION_RULES } from './rules'

/**
 * IssueDetector runs all registered detection rules against the current
 * analysis data and returns the list of confirmed issues.
 *
 * Rules are stateless — the same input always produces the same output.
 * Debouncing and cooldown logic lives in the AnalysisEngine.
 */
export class IssueDetector {
  detect(
    bands: FrequencyBands,
    levelDb: number,
    peakDb: number,
    sourceType: SourceType
  ): DetectedIssue[] {
    const results: DetectedIssue[] = []

    for (const rule of ALL_DETECTION_RULES) {
      const issue = rule(bands, levelDb, peakDb, sourceType)
      if (issue !== null) {
        results.push(issue)
      }
    }

    return results
  }
}
