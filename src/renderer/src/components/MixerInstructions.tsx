import React from 'react'
import { useAppStore } from '../store/appStore'
import { useMixerProfile } from '../hooks/useMixerProfile'

// ── Main panel ────────────────────────────────────────────────────────────────

export function MixerInstructions(): React.ReactElement {
  const suggestions      = useAppStore(s => s.suggestions)
  const suggestionMode   = useAppStore(s => s.suggestionMode)
  const isCapturing      = useAppStore(s => s.isCapturing)
  const selectedMixerId  = useAppStore(s => s.session.selectedMixerProfileId)
  const channelNumber    = useAppStore(s => s.session.channelNumber)
  const { selectedProfile } = useMixerProfile()

  if (!selectedMixerId) {
    return (
      <div className="panel">
        <h3 className="panel-title">Mixer Instructions</h3>
        <p className="panel-empty">Select a mixer on the Setup screen to see step-by-step instructions.</p>
      </div>
    )
  }

  if (!isCapturing || suggestionMode === 'idle') {
    return (
      <div className="panel">
        <h3 className="panel-title">Mixer Instructions</h3>
        <p className="panel-empty">Start analysis to generate mixer-specific instructions.</p>
      </div>
    )
  }

  if (suggestionMode === 'listening') {
    return (
      <div className="panel">
        <h3 className="panel-title">Mixer Instructions</h3>
        <p className="panel-empty">Listening… instructions will appear once suggestions are ready.</p>
      </div>
    )
  }

  // ── Ready: show instructions for the first pending suggestion only ──────────
  const firstPending = suggestions.find(s => s.status === 'pending')

  const panelSubtitle = selectedProfile
    ? `${selectedProfile.brand} ${selectedProfile.model} · CH ${channelNumber}`
    : null

  return (
    <div className="panel">
      <h3 className="panel-title">
        Mixer Instructions
        {panelSubtitle && (
          <span className="panel-mixer-name">{panelSubtitle}</span>
        )}
      </h3>

      {!firstPending && suggestions.length > 0 && (
        <div className="mixer-instructions-all-done">
          <span className="mixer-instructions-all-done__icon">✓</span>
          <div>
            <strong>All suggestions addressed</strong>
            <p>Click Re-analyze to verify the changes you made.</p>
          </div>
        </div>
      )}

      {!firstPending && suggestions.length === 0 && (
        <div className="issue-ok">
          <span className="issue-ok__icon">✓</span>
          <span>No adjustments needed for this mixer.</span>
        </div>
      )}

      {firstPending && !firstPending.mixerSteps && (
        <div className="mixer-instructions-no-steps">
          <p className="panel-empty">
            No mixer-specific steps available for this suggestion.
          </p>
          <p className="mixer-instructions-no-steps__hint">
            {firstPending.recommendation.reason}
          </p>
        </div>
      )}

      {firstPending && firstPending.mixerSteps && (
        <div className="mixer-instructions-active">
          <div className="mixer-instructions-active__label">
            Current suggestion
          </div>
          <div className="mixer-instructions-active__reason">
            {firstPending.recommendation.reason}
          </div>
          <ol className="instruction-list">
            {firstPending.mixerSteps.map(inst => (
              <li key={inst.step} className="instruction-item">
                <span className="instruction-item__text">{inst.text}</span>
                {inst.detail && (
                  <span className="instruction-item__detail">{inst.detail}</span>
                )}
              </li>
            ))}
          </ol>
          <p className="mixer-instructions-active__hint">
            Mark the suggestion as <strong>Done</strong> in the Suggestions panel when you've applied it.
          </p>
        </div>
      )}
    </div>
  )
}
