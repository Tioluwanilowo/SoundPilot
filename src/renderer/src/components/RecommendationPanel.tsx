import React from 'react'
import { useAppStore } from '../store/appStore'
import type { SuggestionItem, EQAction } from '@shared/types'

// ── Action display config ─────────────────────────────────────────────────────

const ACTION_LABEL: Record<EQAction, string> = {
  hpf:                 'Enable HPF',
  lpf:                 'Enable LPF',
  cut:                 'Cut EQ',
  boost:               'Boost EQ',
  notch:               'Notch EQ',
  gain_reduce:         'Reduce Gain',
  gain_increase:       'Increase Gain',
  pad:                 'Engage PAD',
  phantom_power:       'Enable +48V',
  check_cable:         'Check Cable',
  check_gain_structure:'Check Gain',
  mic_position:        'Reposition Mic',
  compression:         'Add Compression'
}

const ACTION_CLASS: Record<EQAction, string> = {
  hpf:                 'tag--blue',
  lpf:                 'tag--blue',
  cut:                 'tag--red',
  boost:               'tag--green',
  notch:               'tag--red',
  gain_reduce:         'tag--red',
  gain_increase:       'tag--green',
  pad:                 'tag--orange',
  phantom_power:       'tag--blue',
  check_cable:         'tag--orange',
  check_gain_structure:'tag--orange',
  mic_position:        'tag--purple',
  compression:         'tag--purple'
}

// ── Individual suggestion card ────────────────────────────────────────────────

function SuggestionCard({ item, index }: { item: SuggestionItem; index: number }): React.ReactElement {
  const markDone    = useAppStore(s => s.markSuggestionDone)
  const markSkipped = useAppStore(s => s.markSuggestionSkipped)
  const rec = item.recommendation

  const freqLabel = rec.frequency
    ? rec.frequency >= 1000
      ? `${(rec.frequency / 1000).toFixed(1)}k Hz`
      : `${Math.round(rec.frequency)} Hz`
    : null

  const isDone    = item.status === 'done'
  const isSkipped = item.status === 'skipped'
  const isPending = item.status === 'pending'

  return (
    <div className={`suggestion-card ${isDone ? 'suggestion-card--done' : ''} ${isSkipped ? 'suggestion-card--skipped' : ''}`}>
      <div className="suggestion-card__header">
        <span className="suggestion-card__index">
          {isDone ? '✓' : isSkipped ? '→' : index + 1}
        </span>
        <span className={`tag ${ACTION_CLASS[rec.action]}`}>
          {ACTION_LABEL[rec.action]}
        </span>
        {freqLabel && <span className="suggestion-card__freq">{freqLabel}</span>}
        {rec.amount !== undefined && (
          <span className={`suggestion-card__amount ${rec.amount >= 0 ? 'suggestion-card__amount--boost' : 'suggestion-card__amount--cut'}`}>
            {rec.amount > 0 ? '+' : ''}{rec.amount.toFixed(1)} dB
          </span>
        )}
      </div>

      <p className="suggestion-card__reason">{rec.reason}</p>

      {isPending && (
        <div className="suggestion-card__actions">
          <button
            className="btn btn--confirm"
            onClick={() => markDone(rec.id)}
          >
            ✓ Done
          </button>
          <button
            className="btn btn--skip"
            onClick={() => markSkipped(rec.id)}
          >
            Skip →
          </button>
        </div>
      )}

      {isDone && <p className="suggestion-card__status-label suggestion-card__status-label--done">Marked as done</p>}
      {isSkipped && <p className="suggestion-card__status-label suggestion-card__status-label--skip">Skipped</p>}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function RecommendationPanel(): React.ReactElement {
  const suggestionMode     = useAppStore(s => s.suggestionMode)
  const listeningProgress  = useAppStore(s => s.listeningProgress)
  const suggestions        = useAppStore(s => s.suggestions)
  const isCapturing        = useAppStore(s => s.isCapturing)
  const listeningWindowSec = useAppStore(s => s.preferences.listeningWindowSec)
  const triggerReanalyze   = useAppStore(s => s.triggerReanalyze)
  const snapshot           = useAppStore(s => s.analysisSnapshot)
  const setSuggestionMode  = useAppStore(s => s.setSuggestionMode)

  // ── Idle: not started ──────────────────────────────────────────────────────
  if (!isCapturing || suggestionMode === 'idle') {
    return (
      <div className="panel reco-panel">
        <h3 className="panel-title">Suggestions</h3>
        <div className="reco-idle">
          <p className="reco-idle__text">
            Press <strong>Start Analysis</strong> — SoundPilot will listen for {listeningWindowSec} seconds then generate a full set of suggestions.
          </p>
        </div>
      </div>
    )
  }

  // ── Listening: accumulating ────────────────────────────────────────────────
  if (suggestionMode === 'listening') {
    const secRemaining = Math.ceil((listeningWindowSec * (100 - listeningProgress)) / 100)
    const hasSignal    = snapshot?.signalPresent ?? false

    return (
      <div className="panel reco-panel">
        <h3 className="panel-title">Listening…</h3>
        <div className="reco-listening">
          <div className="listen-progress">
            <div className="listen-progress__bar" style={{ width: `${listeningProgress}%` }} />
          </div>
          <div className="listen-progress__info">
            <span className={`listen-signal-dot ${hasSignal ? 'listen-signal-dot--active' : ''}`} />
            <span className="listen-progress__label">
              {hasSignal
                ? `${secRemaining}s remaining — keep the source playing`
                : 'No signal — check your input device'}
            </span>
          </div>
          <p className="reco-listening__hint">
            SoundPilot is accumulating a {listeningWindowSec}s sample to identify persistent tonal issues.
            Play or speak naturally.
          </p>
        </div>
      </div>
    )
  }

  // ── Ready: show suggestions ────────────────────────────────────────────────
  const pending   = suggestions.filter(s => s.status === 'pending')
  const completed = suggestions.filter(s => s.status !== 'pending')
  const allDone   = pending.length === 0

  return (
    <div className="panel reco-panel">
      <h3 className="panel-title">
        Suggestions
        {pending.length > 0 && (
          <span className="panel-badge panel-badge--warning">{pending.length} pending</span>
        )}
        {allDone && suggestions.length > 0 && (
          <span className="panel-badge panel-badge--ok">All addressed</span>
        )}
        {suggestions.length === 0 && (
          <span className="panel-badge panel-badge--ok">No issues</span>
        )}
      </h3>

      {suggestions.length === 0 && (
        <div className="reco-clean">
          <span className="reco-clean__icon">✓</span>
          <div>
            <strong>Signal looks good</strong>
            <p>No significant issues were detected in the listening window.</p>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <p className="reco-workflow-hint">
            Work through each suggestion one at a time. Mark it done when you've applied it, or skip to move on.
          </p>

          {/* Pending suggestions first */}
          {pending.map((item, i) => (
            <SuggestionCard key={item.recommendation.id} item={item} index={i} />
          ))}

          {/* Completed / skipped (collapsed visual) */}
          {completed.length > 0 && pending.length > 0 && (
            <div className="reco-completed-divider">
              <span>{completed.length} addressed</span>
            </div>
          )}
          {completed.map((item, i) => (
            <SuggestionCard key={item.recommendation.id} item={item} index={pending.length + i} />
          ))}
        </>
      )}

      {/* Re-analyze — always visible when ready */}
      <div className="reco-footer">
        {allDone && suggestions.length > 0 && (
          <p className="reco-footer__confirm-text">
            Re-analyze to verify the changes you made.
          </p>
        )}
        <button className="btn btn--reanalyze" onClick={triggerReanalyze}>
          ↻ Re-analyze ({listeningWindowSec}s)
        </button>
      </div>
    </div>
  )
}
