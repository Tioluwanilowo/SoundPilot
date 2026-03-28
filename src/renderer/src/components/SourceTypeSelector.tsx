import React from 'react'
import { useAppStore } from '../store/appStore'
import { SOURCE_TYPE_LABELS } from '@shared/types'
import type { SourceType } from '@shared/types'

// Groups for display purposes
const SOURCE_GROUPS: { label: string; types: SourceType[] }[] = [
  {
    label: 'Vocals & Speech',
    types: ['male_vocal', 'female_vocal', 'speech']
  },
  {
    label: 'Instruments',
    types: ['acoustic_guitar', 'electric_guitar', 'bass_guitar', 'keyboard']
  },
  {
    label: 'Drums',
    types: ['kick', 'snare', 'drum_overhead']
  },
  {
    label: 'Other',
    types: ['general']
  }
]

export function SourceTypeSelector(): React.ReactElement {
  const selectedSourceType = useAppStore(s => s.session.selectedSourceType)
  const setSourceType      = useAppStore(s => s.setSourceType)

  return (
    <div className="form-group">
      <label className="form-label">Source Type</label>
      <p className="form-hint">
        The analysis engine uses this to tune detection thresholds and suggestion rules.
      </p>

      <select
        className="form-select"
        value={selectedSourceType}
        onChange={e => setSourceType(e.target.value as SourceType)}
      >
        {SOURCE_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.types.map(type => (
              <option key={type} value={type}>
                {SOURCE_TYPE_LABELS[type]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
