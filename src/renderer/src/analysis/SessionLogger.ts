import type { AnalysisSnapshot, IssueType } from '@shared/types'

export interface SessionLogEntry {
  timestamp: number
  issues:    IssueType[]
  levelDb:   number
  peakDb:    number
}

export interface SessionSummary {
  totalEntries:    number
  durationMs:      number
  issueFrequency:  Partial<Record<IssueType, number>>  // times each issue was logged
  issuePercent:    Partial<Record<IssueType, number>>  // percentage of entries with issue
  averageLevelDb:  number
  peakLevelDb:     number
}

/**
 * SessionLogger — records analysis snapshots at the suggestion refresh cadence
 * (typically every 2s) to build a per-session history.
 *
 * Useful for:
 *   - Post-rehearsal review: "What issues appeared most often?"
 *   - Trend display: "Harshness has been consistently present for 30 seconds"
 *   - Future: export as JSON for analysis or sharing
 *
 * Capped at MAX_ENTRIES to avoid unbounded memory growth.
 * At 2s intervals, MAX_ENTRIES = 600 → 20 minutes of history.
 */
export class SessionLogger {
  private entries: SessionLogEntry[] = []
  private startTime: number | null   = null
  private readonly MAX_ENTRIES = 600

  log(snapshot: AnalysisSnapshot): void {
    if (!snapshot.signalPresent) return

    if (this.startTime === null) {
      this.startTime = snapshot.timestamp
    }

    this.entries.push({
      timestamp: snapshot.timestamp,
      issues:    snapshot.issues.map(i => i.type),
      levelDb:   snapshot.levelDb,
      peakDb:    snapshot.peakDb
    })

    // Ring buffer — drop oldest when over capacity
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries.shift()
    }
  }

  getSummary(): SessionSummary | null {
    if (this.entries.length === 0) return null

    const issueCounts: Partial<Record<IssueType, number>> = {}
    let levelSum = 0
    let peakMax  = -100

    for (const entry of this.entries) {
      for (const type of entry.issues) {
        issueCounts[type] = (issueCounts[type] ?? 0) + 1
      }
      levelSum += entry.levelDb
      if (entry.peakDb > peakMax) peakMax = entry.peakDb
    }

    const total = this.entries.length
    const issuePercent: Partial<Record<IssueType, number>> = {}
    for (const [type, count] of Object.entries(issueCounts) as [IssueType, number][]) {
      issuePercent[type] = Math.round((count / total) * 100)
    }

    const first = this.entries[0].timestamp
    const last  = this.entries[this.entries.length - 1].timestamp

    return {
      totalEntries:   total,
      durationMs:     last - first,
      issueFrequency: issueCounts,
      issuePercent,
      averageLevelDb: Math.round(levelSum / total),
      peakLevelDb:    Math.round(peakMax)
    }
  }

  /** Returns the most recent N log entries */
  getRecent(n: number): SessionLogEntry[] {
    return this.entries.slice(-Math.min(n, this.entries.length))
  }

  /** Returns all entries from the last N milliseconds */
  getLastMs(ms: number): SessionLogEntry[] {
    const cutoff = Date.now() - ms
    return this.entries.filter(e => e.timestamp >= cutoff)
  }

  /** Returns all log entries as a copy (for export) */
  export(): SessionLogEntry[] {
    return [...this.entries]
  }

  get entryCount(): number {
    return this.entries.length
  }

  get sessionDurationMs(): number {
    if (this.entries.length === 0 || this.startTime === null) return 0
    return Date.now() - this.startTime
  }

  clear(): void {
    this.entries   = []
    this.startTime = null
  }
}
