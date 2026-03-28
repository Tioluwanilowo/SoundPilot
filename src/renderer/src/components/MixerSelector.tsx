import React from 'react'
import { useMixerProfile } from '../hooks/useMixerProfile'
import { useAppStore } from '../store/appStore'

export function MixerSelector(): React.ReactElement {
  const { groupedProfiles, selectedProfile } = useMixerProfile()
  const setSelectedMixer = useAppStore(s => s.setSelectedMixer)
  const selectedMixerProfileId = useAppStore(s => s.session.selectedMixerProfileId)

  const brands = Object.keys(groupedProfiles).sort()

  return (
    <div className="form-group">
      <label className="form-label">Mixer / Console</label>

      <select
        className="form-select"
        value={selectedMixerProfileId ?? ''}
        onChange={e => setSelectedMixer(e.target.value)}
      >
        <option value="">— Select your mixer —</option>
        {brands.map(brand => (
          <optgroup key={brand} label={brand}>
            {groupedProfiles[brand].map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.brand} {profile.model} ({profile.type})
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {selectedProfile && (
        <div className="mixer-detail">
          <div className="mixer-detail__row">
            <span className="mixer-detail__label">Type</span>
            <span className="mixer-detail__value mixer-type-badge">
              {selectedProfile.type}
            </span>
          </div>
          <div className="mixer-detail__row">
            <span className="mixer-detail__label">EQ Bands</span>
            <span className="mixer-detail__value">{selectedProfile.eqBands.length} bands</span>
          </div>
          <div className="mixer-detail__row">
            <span className="mixer-detail__label">HPF</span>
            <span className="mixer-detail__value">
              {selectedProfile.hpf.available
                ? selectedProfile.hpf.sweepable
                  ? `Sweepable (${selectedProfile.hpf.frequencyRange?.[0]}–${selectedProfile.hpf.frequencyRange?.[1]} Hz)`
                  : `Fixed at ${selectedProfile.hpf.frequency} Hz`
                : 'Not available'}
            </span>
          </div>
          {selectedProfile.controlNotes && (
            <p className="mixer-detail__notes">{selectedProfile.controlNotes}</p>
          )}
        </div>
      )}
    </div>
  )
}
