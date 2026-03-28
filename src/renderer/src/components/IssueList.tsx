import React from 'react'
import { useAppStore } from '../store/appStore'
import type { DetectedIssue, IssueSeverity, IssueType } from '@shared/types'

const ISSUE_ICONS: Record<IssueType, string> = {
  rumble:       '〰',
  muddiness:    '☁',
  boominess:    '◉',
  harshness:    '⚡',
  thinness:     '↓',
  low_clarity:  '◎',
  clipping_risk:'⚠',
  low_signal:   '▽'
}

const ISSUE_TITLES: Record<IssueType, string> = {
  rumble:       'Sub-bass Rumble',
  muddiness:    'Low-mid Muddiness',
  boominess:    'Bass Boominess',
  harshness:    'Upper-mid Harshness',
  thinness:     'Thin Low End',
  low_clarity:  'Low Presence / Clarity',
  clipping_risk:'Clipping Risk',
  low_signal:   'Weak Signal'
}

const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  low:    'issue--low',
  medium: 'issue--medium',
  high:   'issue--high'
}

function IssueCard({ issue }: { issue: DetectedIssue }): React.ReactElement {
  return (
    <div className={`issue-card ${SEVERITY_CLASS[issue.severity]}`}>
      <div className="issue-card__header">
        <span className="issue-card__icon">{ISSUE_ICONS[issue.type]}</span>
        <span className="issue-card__title">{ISSUE_TITLES[issue.type]}</span>
        <span className="issue-card__severity">{issue.severity}</span>
      </div>
      <p className="issue-card__desc">{issue.description}</p>
    </div>
  )
}

export function IssueList(): React.ReactElement {
  const snapshot    = useAppStore(s => s.analysisSnapshot)
  const isCapturing = useAppStore(s => s.isCapturing)

  if (!isCapturing) {
    return (
      <div className="panel">
        <h3 className="panel-title">Detected Issues</h3>
        <p className="panel-empty">Start analysis to detect issues.</p>
      </div>
    )
  }

  if (!snapshot?.signalPresent) {
    return (
      <div className="panel">
        <h3 className="panel-title">Detected Issues</h3>
        <p className="panel-empty">No signal detected — check your input device and level.</p>
      </div>
    )
  }

  const issues = snapshot.issues

  return (
    <div className="panel">
      <h3 className="panel-title">
        Detected Issues
        {issues.length > 0 && (
          <span className="panel-badge panel-badge--warning">{issues.length}</span>
        )}
        {issues.length === 0 && (
          <span className="panel-badge panel-badge--ok">OK</span>
        )}
      </h3>

      {issues.length === 0 ? (
        <div className="issue-ok">
          <span className="issue-ok__icon">✓</span>
          <span>No issues detected — signal looks healthy</span>
        </div>
      ) : (
        <div className="issue-list">
          {issues.map(issue => (
            <IssueCard key={issue.type} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}
