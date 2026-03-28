import React, { useState, useCallback }           from 'react'
import { useAppStore }                            from '../store/appStore'
import { useMultiChannelPipeline }               from '../hooks/useMultiChannelPipeline'
import { ChannelCard }                           from '../components/ChannelCard'
import type { ChannelSlotConfig }                from '@shared/types'
import { SOURCE_TYPE_LABELS }                    from '@shared/types'
import type { SourceType }                       from '@shared/types'
import {
  MULTI_CHANNEL_PRESETS,
  getPresetsByBrand
} from '@shared/constants/multichannel-presets'
import type { MultiChannelPreset }               from '@shared/constants/multichannel-presets'

const SOURCE_TYPE_OPTIONS: SourceType[] = [
  'male_vocal', 'female_vocal', 'speech',
  'acoustic_guitar', 'electric_guitar', 'bass_guitar',
  'keyboard', 'drum_overhead', 'snare', 'kick', 'general'
]

// ── Preset picker ─────────────────────────────────────────────────────────────
function PresetPicker({
  onSelect
}: {
  onSelect: (preset: MultiChannelPreset, customCount?: number) => void
}) {
  const byBrand       = getPresetsByBrand()
  const [open, setOpen] = useState<string | null>(null)
  const [customCount, setCustomCount] = useState(16)

  // Separate 'Custom' from real brands
  const brands = Array.from(byBrand.keys()).filter(b => b !== 'Custom')

  return (
    <div className="mc-preset-picker">
      <p className="mc-preset-picker__label">Select your mixer to auto-fill channel routing:</p>

      <div className="mc-preset-brands">
        {brands.map(brand => {
          const presets = byBrand.get(brand)!
          const isOpen  = open === brand

          return (
            <div key={brand} className="mc-brand-group">
              <button
                className={`mc-brand-btn ${isOpen ? 'mc-brand-btn--open' : ''}`}
                onClick={() => setOpen(isOpen ? null : brand)}
              >
                <span className="mc-brand-btn__name">{brand}</span>
                <span className="mc-brand-btn__count">
                  {presets.length} model{presets.length !== 1 ? 's' : ''}
                </span>
                <span className="mc-brand-btn__arrow">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="mc-preset-list">
                  {presets.map(preset => (
                    <div key={preset.id} className="mc-preset-item">
                      <div className="mc-preset-item__info">
                        <span className="mc-preset-item__model">{preset.model}</span>
                        <span className="mc-preset-item__detail">
                          {preset.inputCount} input ch · {preset.totalUsbChannels} USB ch total
                        </span>
                        <span className="mc-preset-item__note">{preset.routingNote}</span>

                        {/* Driver info */}
                        <div className="mc-preset-item__driver">
                          <span className={`mc-driver-badge ${preset.macNoDriver ? 'mc-driver-badge--ok' : 'mc-driver-badge--req'}`}>
                            Mac: {preset.macNoDriver ? 'No driver needed' : 'Driver required'}
                          </span>
                          <span className={`mc-driver-badge ${preset.winDriver === null ? 'mc-driver-badge--ok' : 'mc-driver-badge--req'}`}>
                            Win: {preset.winDriver === null ? 'No driver needed' : preset.winDriver}
                          </span>
                          {preset.winDriverUrl && (
                            <a
                              className="mc-driver-link"
                              href={preset.winDriverUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download ↗
                            </a>
                          )}
                        </div>

                        {preset.routingWarning && (
                          <p className="mc-preset-item__warning">⚠ {preset.routingWarning}</p>
                        )}
                      </div>

                      <button
                        className="btn btn--primary btn--sm"
                        onClick={() => onSelect(preset)}
                      >
                        Use this
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Custom / Manual */}
        <div className="mc-brand-group">
          <button
            className={`mc-brand-btn ${open === 'Custom' ? 'mc-brand-btn--open' : ''}`}
            onClick={() => setOpen(open === 'Custom' ? null : 'Custom')}
          >
            <span className="mc-brand-btn__name">Custom / Other</span>
            <span className="mc-brand-btn__count">Manual setup</span>
            <span className="mc-brand-btn__arrow">{open === 'Custom' ? '▲' : '▼'}</span>
          </button>

          {open === 'Custom' && (
            <div className="mc-preset-list">
              <div className="mc-preset-item mc-preset-item--custom">
                <p className="mc-preset-item__note">
                  Manually enter USB channel indices for any device not listed above.
                  Channels will be created with generic labels — edit them after loading.
                </p>
                <div className="mc-custom-count">
                  <label>Number of channels to create:</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={customCount}
                    onChange={e => setCustomCount(Math.max(1, Math.min(64, Number(e.target.value))))}
                  />
                </div>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    const customPreset = MULTI_CHANNEL_PRESETS.find(p => p.id === 'custom')!
                    onSelect(customPreset, customCount)
                  }}
                >
                  Generate {customCount} channels
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Channel slot row ──────────────────────────────────────────────────────────
function SlotRow({
  slot, onUpdate, onRemove
}: {
  slot:     ChannelSlotConfig
  onUpdate: (id: string, updates: Partial<ChannelSlotConfig>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className={`slot-row ${slot.enabled ? '' : 'slot-row--disabled'}`}>
      <input
        type="checkbox"
        className="slot-row__enable"
        checked={slot.enabled}
        onChange={e => onUpdate(slot.id, { enabled: e.target.checked })}
        title="Enable this channel"
      />

      <div className="slot-row__field slot-row__field--narrow">
        <label>USB Ch</label>
        <input
          type="number"
          min={0}
          max={127}
          value={slot.usbChannelIndex}
          onChange={e => onUpdate(slot.id, { usbChannelIndex: Number(e.target.value) })}
        />
      </div>

      <div className="slot-row__field slot-row__field--narrow">
        <label>Mixer Ch</label>
        <input
          type="number"
          min={1}
          max={128}
          value={slot.mixerChannelNumber}
          onChange={e => onUpdate(slot.id, { mixerChannelNumber: Number(e.target.value) })}
        />
      </div>

      <div className="slot-row__field slot-row__field--wide">
        <label>Label</label>
        <input
          type="text"
          maxLength={32}
          value={slot.label}
          placeholder="e.g. Lead Vocal"
          onChange={e => onUpdate(slot.id, { label: e.target.value })}
        />
      </div>

      <div className="slot-row__field slot-row__field--medium">
        <label>Source</label>
        <select
          value={slot.sourceType}
          onChange={e => onUpdate(slot.id, { sourceType: e.target.value as SourceType })}
        >
          {SOURCE_TYPE_OPTIONS.map(st => (
            <option key={st} value={st}>{SOURCE_TYPE_LABELS[st] ?? st}</option>
          ))}
        </select>
      </div>

      <button
        className="slot-row__remove"
        onClick={() => onRemove(slot.id)}
        title="Remove channel"
      >
        ✕
      </button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function MultiChannelScreen(): React.ReactElement {
  const {
    session,
    audioDevices,
    channelSlots,
    channelSlotStates,
    multiChannelActive,
    mcDeviceInfo,
    addChannelSlot,
    removeChannelSlot,
    updateChannelSlot,
    clearChannelSlots,
    loadChannelPreset,
    markChannelSuggestionDone,
    markChannelSuggestionSkipped
  } = useAppStore(s => ({
    session:                      s.session,
    audioDevices:                 s.audioDevices,
    channelSlots:                 s.channelSlots,
    channelSlotStates:            s.channelSlotStates,
    multiChannelActive:           s.multiChannelActive,
    mcDeviceInfo:                 s.mcDeviceInfo,
    addChannelSlot:               s.addChannelSlot,
    removeChannelSlot:            s.removeChannelSlot,
    updateChannelSlot:            s.updateChannelSlot,
    clearChannelSlots:            s.clearChannelSlots,
    loadChannelPreset:            s.loadChannelPreset,
    markChannelSuggestionDone:    s.markChannelSuggestionDone,
    markChannelSuggestionSkipped: s.markChannelSuggestionSkipped
  }))

  const { startAll, stopAll, reanalyzeSlot } = useMultiChannelPipeline()

  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [view, setView]                 = useState<'preset' | 'setup' | 'matrix'>('preset')
  const [error, setError]               = useState<string | null>(null)
  const [isStarting, setIsStarting]     = useState(false)
  const [appliedPreset, setAppliedPreset] = useState<MultiChannelPreset | null>(null)

  const enabledSlots  = channelSlots.filter(s => s.enabled)
  const deviceId      = session.selectedDeviceId ?? 'default'
  const deviceLabel   = audioDevices.find(d => d.deviceId === deviceId)?.label ?? 'Default device'

  const listeningCount = channelSlotStates.filter(s => s.status === 'listening').length
  const readyCount     = channelSlotStates.filter(s => s.status === 'ready').length
  const totalPending   = channelSlotStates.reduce(
    (sum, s) => sum + s.suggestions.filter(sg => sg.status === 'pending').length, 0
  )

  const handlePresetSelect = useCallback((preset: MultiChannelPreset, customCount?: number) => {
    loadChannelPreset(preset.id, customCount)
    setAppliedPreset(preset)
    setView('setup')
  }, [loadChannelPreset])

  const handleStart = useCallback(async () => {
    setError(null)
    setIsStarting(true)
    try {
      const actual = await startAll(deviceId)
      if (actual === 0) {
        setError('Could not open the audio device. Check connection and permissions.')
        return
      }
      setView('matrix')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to open audio device. Ensure no other app is using it exclusively.'
      )
    } finally {
      setIsStarting(false)
    }
  }, [startAll, deviceId])

  const handleStop = useCallback(async () => {
    await stopAll()
    setActiveSlotId(null)
  }, [stopAll])

  // ── Preset picker view ───────────────────────────────────────────────────────
  if (view === 'preset') {
    return (
      <div className="mc-screen">
        <div className="mc-screen__header">
          <div>
            <h2 className="mc-screen__title">Multi-Channel Mode</h2>
            <p className="mc-screen__subtitle">
              Analyze all mixer inputs simultaneously via USB audio interface.
              Each channel gets its own independent analysis and EQ suggestions.
            </p>
          </div>
        </div>

        <div className="mc-device-strip">
          <span className="mc-device-strip__label">Audio device:</span>
          <span className="mc-device-strip__name">{deviceLabel}</span>
          <span className="mc-device-strip__hint">(change in Setup screen)</span>
        </div>

        <PresetPicker onSelect={handlePresetSelect} />

        {channelSlots.length > 0 && (
          <div className="mc-existing-notice">
            <span>You already have {channelSlots.length} channel{channelSlots.length !== 1 ? 's' : ''} configured.</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setView('setup')}>
              Continue with existing setup →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Channel setup view ───────────────────────────────────────────────────────
  if (view === 'setup' || !multiChannelActive) {
    return (
      <div className="mc-screen">
        <div className="mc-screen__header">
          <div>
            <h2 className="mc-screen__title">
              {appliedPreset && appliedPreset.id !== 'custom'
                ? `${appliedPreset.brand} ${appliedPreset.model}`
                : 'Channel Setup'}
            </h2>
            {appliedPreset && (
              <p className="mc-screen__subtitle">{appliedPreset.routingNote}</p>
            )}
            {appliedPreset?.routingWarning && (
              <p className="mc-preset-warning">⚠ {appliedPreset.routingWarning}</p>
            )}
          </div>

          <button className="btn btn--ghost btn--sm" onClick={() => setView('preset')}>
            ← Change mixer
          </button>
        </div>

        <div className="mc-device-strip">
          <span className="mc-device-strip__label">Audio device:</span>
          <span className="mc-device-strip__name">{deviceLabel}</span>
          {mcDeviceInfo && (
            <span className="mc-device-strip__name">
              · {mcDeviceInfo.detectedChannelCount} ch detected
            </span>
          )}
        </div>

        {/* Slot actions */}
        <div className="mc-presets">
          <button className="btn btn--ghost btn--sm" onClick={() => addChannelSlot()}>
            + Add channel
          </button>
          {channelSlots.length > 0 && (
            <button className="btn btn--ghost btn--sm btn--danger" onClick={clearChannelSlots}>
              Clear all
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => setView('preset')}>
            ↺ Change preset
          </button>
        </div>

        {/* Channel list */}
        {channelSlots.length === 0 ? (
          <div className="mc-empty">
            <p>No channels configured.</p>
            <p>Select a mixer preset above or add channels manually.</p>
          </div>
        ) : (
          <div className="mc-slot-list">
            <div className="mc-slot-list__heading">
              <span>En</span>
              <span>USB Ch</span>
              <span>Mixer Ch</span>
              <span>Label</span>
              <span>Source type</span>
              <span />
            </div>
            {channelSlots.map(slot => (
              <SlotRow
                key={slot.id}
                slot={slot}
                onUpdate={updateChannelSlot}
                onRemove={removeChannelSlot}
              />
            ))}
          </div>
        )}

        {/* Driver reminder */}
        {appliedPreset && (appliedPreset.winDriver || appliedPreset.winDriverUrl) && (
          <div className="mc-driver-reminder">
            <span className="mc-driver-reminder__icon">💿</span>
            <div>
              <strong>Windows users:</strong>{' '}
              {appliedPreset.winDriver ?? 'A driver is required.'}{' '}
              {appliedPreset.winDriverUrl && (
                <a href={appliedPreset.winDriverUrl} target="_blank" rel="noreferrer">
                  Download driver ↗
                </a>
              )}
              <br />
              <strong>Mac users:</strong>{' '}
              {appliedPreset.macNoDriver
                ? 'No driver needed — plug in and go.'
                : 'Driver also required on Mac — see the download link above.'}
            </div>
          </div>
        )}

        {error && <div className="mc-error">⚠ {error}</div>}

        <div className="mc-screen__footer">
          <button
            className="btn btn--primary btn--lg"
            onClick={handleStart}
            disabled={enabledSlots.length === 0 || isStarting}
          >
            {isStarting
              ? 'Opening device…'
              : `Start Analysis — ${enabledSlots.length} channel${enabledSlots.length !== 1 ? 's' : ''}`}
          </button>
          {enabledSlots.length === 0 && channelSlots.length > 0 && (
            <p className="mc-screen__footer-hint">Enable at least one channel to start.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Matrix view (live) ───────────────────────────────────────────────────────
  const activeState  = channelSlotStates.find(s => s.id === activeSlotId)
  const activeConfig = channelSlots.find(s => s.id === activeSlotId)

  return (
    <div className="mc-screen mc-screen--matrix">
      {/* Matrix header */}
      <div className="mc-matrix-header">
        <div className="mc-matrix-header__left">
          <span className="capture-badge">● LIVE</span>
          {mcDeviceInfo && (
            <span className="mc-matrix-header__device">
              {mcDeviceInfo.detectedChannelCount} ch · {deviceLabel}
              {!mcDeviceInfo.channelCountMatch && (
                <span className="mc-matrix-header__warn" title="Fewer channels than expected were opened">
                  ⚠
                </span>
              )}
            </span>
          )}
        </div>

        <div className="mc-matrix-header__stats">
          {listeningCount > 0 && (
            <span className="mc-stat mc-stat--listening">{listeningCount} listening</span>
          )}
          {readyCount > 0 && (
            <span className="mc-stat mc-stat--ready">{readyCount} ready</span>
          )}
          {totalPending > 0 && (
            <span className="mc-stat mc-stat--pending">{totalPending} pending suggestions</span>
          )}
        </div>

        <div className="mc-matrix-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setView('setup')}>
            ← Setup
          </button>
          <button className="btn btn--outline btn--sm btn--danger" onClick={handleStop}>
            ■ Stop
          </button>
        </div>
      </div>

      {/* Grid + side panel */}
      <div className={`mc-layout ${activeSlotId ? 'mc-layout--split' : ''}`}>
        <div className="mc-grid">
          {channelSlots.filter(s => s.enabled).map(slot => {
            const slotState = channelSlotStates.find(st => st.id === slot.id)
            if (!slotState) return null
            return (
              <ChannelCard
                key={slot.id}
                config={slot}
                state={slotState}
                isActive={slot.id === activeSlotId}
                onClick={() => setActiveSlotId(prev => prev === slot.id ? null : slot.id)}
                onDone={recId => markChannelSuggestionDone(slot.id, recId)}
                onSkipped={recId => markChannelSuggestionSkipped(slot.id, recId)}
                onReanalyze={() => {
                  reanalyzeSlot(slot.id)
                  setActiveSlotId(null)
                }}
              />
            )
          })}
        </div>

        {activeSlotId && activeConfig && activeState && (
          <div className="mc-detail-panel">
            <div className="mc-detail-panel__header">
              <span className="mc-detail-panel__title">
                CH {activeConfig.mixerChannelNumber} — {activeConfig.label}
              </span>
              <button className="btn btn--ghost btn--sm" onClick={() => setActiveSlotId(null)}>
                ✕
              </button>
            </div>

            {activeState.status === 'ready' && activeState.suggestions.length === 0 && (
              <div className="mc-detail-panel__clean">
                <span className="mc-detail-panel__clean-icon">✓</span>
                <p>No issues detected on this channel.</p>
                <button
                  className="btn btn--outline"
                  onClick={() => { reanalyzeSlot(activeSlotId); setActiveSlotId(null) }}
                >
                  Re-analyze
                </button>
              </div>
            )}

            {activeState.status === 'listening' && (
              <div className="mc-detail-panel__listening">
                <div className="mc-detail-panel__progress-wrap">
                  <div
                    className="mc-detail-panel__progress-fill"
                    style={{ width: `${activeState.listeningProgress}%` }}
                  />
                </div>
                <p>{activeState.secondsRemaining}s remaining in listening window</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
