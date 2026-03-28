import React from 'react'
import { AudioDeviceSelector } from '../components/AudioDeviceSelector'
import { MixerSelector } from '../components/MixerSelector'
import { SourceTypeSelector } from '../components/SourceTypeSelector'
import { useAppStore } from '../store/appStore'

export function SetupScreen(): React.ReactElement {
  const session        = useAppStore(s => s.session)
  const channelNumber  = session.channelNumber
  const setChannel     = useAppStore(s => s.setChannelNumber)
  const navigateTo     = useAppStore(s => s.navigateTo)

  const canProceed = Boolean(session.selectedDeviceId)

  return (
    <div className="screen setup-screen">
      <div className="screen-header">
        <h1 className="screen-title">Setup</h1>
        <p className="screen-subtitle">
          Configure your audio input, mixer, and source type before starting analysis.
        </p>
      </div>

      <div className="setup-grid">
        {/* ── Column 1: Audio Input ─────────────────────────────────── */}
        <section className="setup-section">
          <h2 className="setup-section__title">
            <span className="setup-section__step">1</span>
            Audio Input
          </h2>
          <AudioDeviceSelector />
        </section>

        {/* ── Column 2: Source Type ─────────────────────────────────── */}
        <section className="setup-section">
          <h2 className="setup-section__title">
            <span className="setup-section__step">2</span>
            Source Type
          </h2>
          <SourceTypeSelector />
        </section>

        {/* ── Column 3: Mixer ───────────────────────────────────────── */}
        <section className="setup-section">
          <h2 className="setup-section__title">
            <span className="setup-section__step">3</span>
            Mixer
          </h2>
          <MixerSelector />

          {session.selectedMixerProfileId && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Channel Number</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={64}
                value={channelNumber}
                onChange={e => setChannel(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="form-hint">Which mixer channel is this source on?</p>
            </div>
          )}
        </section>
      </div>

      <div className="setup-footer">
        <button
          className="btn btn--primary btn--lg"
          disabled={!canProceed}
          onClick={() => navigateTo('live')}
        >
          {canProceed ? 'Start Live Analysis →' : 'Select an audio input to continue'}
        </button>

        {!session.selectedMixerProfileId && (
          <p className="setup-footer__hint">
            Tip: Selecting a mixer is optional — SoundPilot will still show generic EQ recommendations.
          </p>
        )}
      </div>
    </div>
  )
}
