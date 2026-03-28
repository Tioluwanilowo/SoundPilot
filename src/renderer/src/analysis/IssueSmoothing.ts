import type { DetectedIssue, IssueType } from '@shared/types'

interface IssueEntry {
  confirmCount: number  // Frames the issue has been continuously present
  clearCount:   number  // Frames the issue has been absent
  lastIssue:    DetectedIssue
  confirmed:    boolean // Has it passed the confirmation threshold?
}

/**
 * IssueSmoothing — prevents transient noise in the issue detector from
 * causing rapid flickering in the UI.
 *
 * Algorithm:
 *   CONFIRM: An issue must appear in CONFIRM_FRAMES consecutive frames
 *            before it is shown to the user.
 *   CLEAR:   A confirmed issue must be absent for CLEAR_FRAMES consecutive
 *            frames before it is removed from the display.
 *
 * Effect: issues "snap in" quickly but fade out slowly, which matches
 * how engineers perceive tonal problems — a problem that appears once
 * is probably noise; a problem that persists is real.
 *
 * At ~60 fps RAF: CONFIRM_FRAMES=4 → ~65ms to appear, CLEAR_FRAMES=90 → ~1.5s to disappear.
 */
export class IssueSmoothing {
  private state = new Map<IssueType, IssueEntry>()

  // Tuneable thresholds — expressed in animation frames
  readonly CONFIRM_FRAMES = 4   // ~65ms at 60fps: fast enough to feel responsive
  readonly CLEAR_FRAMES   = 90  // ~1.5s at 60fps: stable enough to read and act on

  process(rawIssues: DetectedIssue[]): DetectedIssue[] {
    const rawTypes = new Set(rawIssues.map(i => i.type))

    // Update existing state entries
    for (const [type, entry] of this.state) {
      if (rawTypes.has(type)) {
        // Issue is still present — increment confirm, reset clear
        entry.clearCount   = 0
        entry.confirmCount = Math.min(entry.confirmCount + 1, this.CONFIRM_FRAMES + 10)
        if (entry.confirmCount >= this.CONFIRM_FRAMES) {
          entry.confirmed = true
        }
        // Always update with freshest issue data (severity may change)
        entry.lastIssue = rawIssues.find(i => i.type === type)!
      } else {
        // Issue is absent — increment clear counter
        entry.clearCount++
        if (entry.clearCount >= this.CLEAR_FRAMES) {
          this.state.delete(type)
        }
      }
    }

    // Register new issue types not yet tracked
    for (const issue of rawIssues) {
      if (!this.state.has(issue.type)) {
        this.state.set(issue.type, {
          confirmCount: 1,
          clearCount:   0,
          lastIssue:    issue,
          confirmed:    false
        })
      }
    }

    // Return only confirmed (stable) issues
    return Array.from(this.state.values())
      .filter(e => e.confirmed)
      .map(e => e.lastIssue)
  }

  reset(): void {
    this.state.clear()
  }

  /** Returns all issues currently being tracked (including unconfirmed) — for debug */
  debugState(): Map<IssueType, IssueEntry> {
    return this.state
  }
}
