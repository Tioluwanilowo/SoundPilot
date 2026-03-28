import React, { useEffect, useState } from 'react'
import { audioDeviceManager } from '../audio/AudioDeviceManager'
import { useAppStore } from '../store/appStore'

export function AudioDeviceSelector(): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const audioDevices       = useAppStore(s => s.audioDevices)
  const selectedDeviceId   = useAppStore(s => s.session.selectedDeviceId)
  const setAudioDevices    = useAppStore(s => s.setAudioDevices)
  const setSelectedDevice  = useAppStore(s => s.setSelectedDevice)

  const loadDevices = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const devices = await audioDeviceManager.getInputDevices()
      setAudioDevices(devices)
      // Auto-select first device if none selected
      if (!selectedDeviceId && devices.length > 0) {
        setSelectedDevice(devices[0].deviceId)
      }
    } catch (err) {
      setError('Could not access audio devices. Check microphone permissions.')
      console.error('[AudioDeviceSelector]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
    // Re-enumerate when devices change (USB audio in/out)
    const cleanup = audioDeviceManager.onDeviceChange(loadDevices)
    return cleanup
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="form-group">
      <label className="form-label">Audio Input Device</label>

      {error && <p className="form-error">{error}</p>}

      <div className="select-row">
        <select
          className="form-select"
          value={selectedDeviceId ?? ''}
          onChange={e => setSelectedDevice(e.target.value)}
          disabled={loading || audioDevices.length === 0}
        >
          {audioDevices.length === 0 && (
            <option value="">
              {loading ? 'Loading devices…' : 'No input devices found'}
            </option>
          )}
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        <button
          className="btn btn--secondary btn--sm"
          onClick={loadDevices}
          disabled={loading}
          title="Refresh device list"
        >
          {loading ? '…' : '↺'}
        </button>
      </div>

      {selectedDeviceId && (
        <p className="form-hint">
          Selected: {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label ?? selectedDeviceId}
        </p>
      )}
    </div>
  )
}
