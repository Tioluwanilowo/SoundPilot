import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'

export function SettingsScreen(): React.ReactElement {
  const preferences     = useAppStore(s => s.preferences)
  const updatePrefs     = useAppStore(s => s.updatePreferences)
  const presets         = useAppStore(s => s.presets)
  const session         = useAppStore(s => s.session)
  const addPreset       = useAppStore(s => s.addPreset)
  const removePreset    = useAppStore(s => s.removePreset)
  const loadPreset      = useAppStore(s => s.loadPreset)
  const [presetName, setPresetName] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSavePreset = (): void => {
    if (!presetName.trim()) return
    const preset = {
      id:        `preset-${Date.now()}`,
      name:      presetName.trim(),
      createdAt: Date.now(),
      session:   { ...session }
    }
    addPreset(preset)
    setPresetName('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="screen settings-screen">
      <div className="screen-header">
        <h1 className="screen-title">Settings</h1>
      </div>

      <div className="settings-grid">
        {/* ── Analysis settings ─────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section__title">Analysis</h2>

          <div className="form-group">
            <label className="form-label">
              Meter refresh rate (ms)
              <span className="form-label__value">{preferences.analysisRefreshMs}</span>
            </label>
            <input
              type="range" min={40} max={200} step={10}
              value={preferences.analysisRefreshMs}
              onChange={e => updatePrefs({ analysisRefreshMs: Number(e.target.value) })}
              className="form-range"
            />
            <p className="form-hint">Lower = smoother meters, higher CPU usage</p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Listening window (s)
              <span className="form-label__value">{preferences.listeningWindowSec}s</span>
            </label>
            <input
              type="range" min={10} max={60} step={5}
              value={preferences.listeningWindowSec}
              onChange={e => updatePrefs({ listeningWindowSec: Number(e.target.value) })}
              className="form-range"
            />
            <p className="form-hint">How long SoundPilot listens before generating suggestions</p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Minimum signal threshold (dBFS)
              <span className="form-label__value">{preferences.minimumSignalThresholdDb}</span>
            </label>
            <input
              type="range" min={-70} max={-30} step={5}
              value={preferences.minimumSignalThresholdDb}
              onChange={e => updatePrefs({ minimumSignalThresholdDb: Number(e.target.value) })}
              className="form-range"
            />
            <p className="form-hint">Signals below this level are ignored</p>
          </div>
        </section>

        {/* ── Presets ───────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section__title">Presets</h2>

          <div className="form-group">
            <label className="form-label">Save current session as preset</label>
            <div className="select-row">
              <input
                type="text"
                className="form-input"
                placeholder="Preset name…"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              />
              <button
                className="btn btn--primary btn--sm"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                {saved ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>

          {presets.length > 0 && (
            <div className="preset-list">
              {presets.map(preset => (
                <div key={preset.id} className="preset-item">
                  <div className="preset-item__info">
                    <span className="preset-item__name">{preset.name}</span>
                    <span className="preset-item__meta">
                      {preset.session.selectedSourceType.replace('_', ' ')}
                      {preset.session.selectedMixerProfileId && ` · ${preset.session.selectedMixerProfileId}`}
                    </span>
                  </div>
                  <div className="preset-item__actions">
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => loadPreset(preset)}
                    >
                      Load
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => removePreset(preset.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {presets.length === 0 && (
            <p className="panel-empty">No saved presets yet.</p>
          )}
        </section>

        {/* ── About ─────────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section__title">About</h2>
          <div className="about-box">
            <p><strong>SoundPilot</strong> v0.1.0</p>
            <p>Local audio analysis and mixer EQ suggestion tool.</p>
            <p>Designed for musicians, churches, rehearsals, and small live sound setups.</p>
            <hr className="about-divider" />
            <p className="about-note">
              All analysis runs locally on your device. No audio data is transmitted anywhere.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
