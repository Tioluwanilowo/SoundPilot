import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore }           from '../store/appStore'
import { useMultiTrackImport }  from '../hooks/useMultiTrackImport'
import { ChannelCard }          from '../components/ChannelCard'
import { SOURCE_TYPE_LABELS }   from '@shared/types'
import type { SourceType, ImportTrackConfig, ImportTrackState } from '@shared/types'
import { MAX_ANALYSIS_SECONDS } from '../audio/MultiTrackFileEngine'

const SOURCE_TYPE_OPTIONS: SourceType[] = [
  'male_vocal', 'female_vocal', 'speech',
  'acoustic_guitar', 'electric_guitar', 'bass_guitar',
  'keyboard', 'drum_overhead', 'snare', 'kick', 'general'
]

const ACCEPTED_FORMATS = '.wav,.aiff,.aif,.flac,.mp3,.ogg,.m4a,audio/*'

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Track row in the import table ─────────────────────────────────────────────
function ImportTrackRow({
  config,
  state,
  onUpdate,
  onRemove,
  onReanalyze
}: {
  config:      ImportTrackConfig
  state:       ImportTrackState
  onUpdate:    (id: string, updates: Partial<ImportTrackConfig>) => void
  onRemove:    (id: string) => void
  onReanalyze: (id: string) => void
}) {
  const isAnalyzing = state.status === 'analyzing'
  const isReady     = state.status === 'ready'
  const isLoading   = state.status === 'loading'
  const isError     = state.status === 'error'

  return (
    <div className={`import-row import-row--${state.status}`}>
      {/* Enable toggle */}
      <input
        type="checkbox"
        className="slot-row__enable"
        checked={config.enabled}
        disabled={isAnalyzing}
        onChange={e => onUpdate(config.id, { enabled: e.target.checked })}
      />

      {/* File info */}
      <div className="import-row__file">
        <span className="import-row__filename" title={config.fileName}>
          {config.fileName}
        </span>
        <span className="import-row__meta">
          {isLoading ? 'Decoding…' : (
            <>
              {formatDuration(config.duration)}
              {config.duration > MAX_ANALYSIS_SECONDS && (
                <span className="import-row__truncated" title={`Only first ${MAX_ANALYSIS_SECONDS}s will be analyzed`}>
                  ⚠ first {MAX_ANALYSIS_SECONDS}s
                </span>
              )}
              · {formatBytes(config.fileSize)}
              {config.fileChannels > 0 && ` · ${config.fileChannels === 1 ? 'mono' : 'stereo'}`}
              {config.fileSampleRate > 0 && ` · ${(config.fileSampleRate / 1000).toFixed(1)}kHz`}
            </>
          )}
        </span>
      </div>

      {/* Mixer channel */}
      <div className="slot-row__field slot-row__field--narrow">
        <label>Mixer Ch</label>
        <input
          type="number"
          min={1}
          max={128}
          value={config.mixerChannelNumber}
          disabled={isAnalyzing}
          onChange={e => onUpdate(config.id, { mixerChannelNumber: Number(e.target.value) })}
        />
      </div>

      {/* Label */}
      <div className="slot-row__field slot-row__field--wide">
        <label>Label</label>
        <input
          type="text"
          maxLength={32}
          value={config.label}
          placeholder="e.g. Lead Vocal"
          disabled={isAnalyzing}
          onChange={e => onUpdate(config.id, { label: e.target.value })}
        />
      </div>

      {/* Source type */}
      <div className="slot-row__field slot-row__field--medium">
        <label>Source</label>
        <select
          value={config.sourceType}
          disabled={isAnalyzing}
          onChange={e => onUpdate(config.id, { sourceType: e.target.value as SourceType })}
        >
          {SOURCE_TYPE_OPTIONS.map(st => (
            <option key={st} value={st}>{SOURCE_TYPE_LABELS[st] ?? st}</option>
          ))}
        </select>
      </div>

      {/* Status + actions */}
      <div className="import-row__status">
        {isLoading && <span className="import-status import-status--loading">⟳ Decoding</span>}
        {isAnalyzing && (
          <div className="import-progress-wrap">
            <div className="import-progress-bar">
              <div
                className="import-progress-bar__fill"
                style={{ width: `${state.analyzeProgress}%` }}
              />
            </div>
            <span className="import-progress-label">{state.analyzeProgress}%</span>
          </div>
        )}
        {isReady && state.suggestions.length === 0 && (
          <span className="import-status import-status--clean">✓ Clean</span>
        )}
        {isReady && state.suggestions.length > 0 && (
          <span className="import-status import-status--ready">
            {state.suggestions.filter(s => s.status === 'pending').length} suggestions
          </span>
        )}
        {isError && (
          <span className="import-status import-status--error" title={state.errorMessage}>
            ✕ Error
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="import-row__actions">
        {isReady && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onReanalyze(config.id)}
            title="Re-analyze this track"
          >
            ↺
          </button>
        )}
        <button
          className="slot-row__remove"
          onClick={() => onRemove(config.id)}
          disabled={isAnalyzing}
          title="Remove track"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/') || /\.(wav|aiff?|flac|mp3|ogg|m4a)$/i.test(f.name))
    if (files.length > 0) onFiles(files)
  }, [onFiles])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    if (inputRef.current) inputRef.current.value = ''
  }, [onFiles])

  return (
    <div
      className={`import-dropzone ${dragOver ? 'import-dropzone--over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.click() }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FORMATS}
        onChange={handleInput}
        style={{ display: 'none' }}
      />
      <div className="import-dropzone__icon">⬆</div>
      <div className="import-dropzone__primary">
        {dragOver ? 'Drop audio files here' : 'Drop audio files or click to browse'}
      </div>
      <div className="import-dropzone__secondary">
        WAV · AIFF · FLAC · MP3 · OGG · M4A
        &nbsp;·&nbsp; Max {MAX_ANALYSIS_SECONDS}s analyzed per track
      </div>
    </div>
  )
}

// ── Results view: channel cards ───────────────────────────────────────────────
function ResultsGrid({
  tracks,
  states,
  onDone,
  onSkip,
  onReanalyze
}: {
  tracks:       ImportTrackConfig[]
  states:       ImportTrackState[]
  onDone:       (trackId: string, recId: string) => void
  onSkip:       (trackId: string, recId: string) => void
  onReanalyze:  (trackId: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <div className="mc-grid">
      {tracks.filter(t => t.enabled).map(track => {
        const state = states.find(s => s.id === track.id)
        if (!state || state.status !== 'ready') return null

        // Map ImportTrackConfig → ChannelSlotConfig shape for ChannelCard reuse
        const slotConfig = {
          id:                 track.id,
          usbChannelIndex:    0,
          mixerChannelNumber: track.mixerChannelNumber,
          label:              track.label,
          sourceType:         track.sourceType,
          enabled:            track.enabled
        }

        const slotState = {
          id:                track.id,
          status:            'ready' as const,
          listeningProgress: 100,
          secondsRemaining:  0,
          rmsDb:             -100,
          peakDb:            -100,
          signalPresent:     true,
          issues:            [],
          suggestions:       state.suggestions
        }

        return (
          <ChannelCard
            key={track.id}
            config={slotConfig}
            state={slotState}
            isActive={activeId === track.id}
            onClick={() => setActiveId(prev => prev === track.id ? null : track.id)}
            onDone={recId => onDone(track.id, recId)}
            onSkipped={recId => onSkip(track.id, recId)}
            onReanalyze={() => { onReanalyze(track.id); setActiveId(null) }}
          />
        )
      })}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function MultiTrackImportScreen(): React.ReactElement {
  const {
    session,
    importActive,
    importTracks,
    importTrackStates,
    updateImportTrack,
    clearImportTracks,
    markImportSuggestionDone,
    markImportSuggestionSkip
  } = useAppStore(s => ({
    session:                  s.session,
    importActive:             s.importActive,
    importTracks:             s.importTracks,
    importTrackStates:        s.importTrackStates,
    updateImportTrack:        s.updateImportTrack,
    clearImportTracks:        s.clearImportTracks,
    markImportSuggestionDone: s.markImportSuggestionDone,
    markImportSuggestionSkip: s.markImportSuggestionSkip
  }))

  const { addFiles, removeFile, startAll, stopAll, reanalyzeTrack } = useMultiTrackImport()
  const [view, setView]     = useState<'setup' | 'results'>('setup')
  const [error, setError]   = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const enabledReady   = importTracks.filter(t => t.enabled && t.duration > 0)
  const analyzingCount = importTrackStates.filter(s => s.status === 'analyzing').length
  const readyCount     = importTrackStates.filter(s => s.status === 'ready').length
  const totalSuggestions = importTrackStates.reduce(
    (n, s) => n + s.suggestions.filter(sg => sg.status === 'pending').length, 0
  )

  // Auto-switch to results when all tracks are done
  useEffect(() => {
    if (
      importActive &&
      analyzingCount === 0 &&
      readyCount > 0 &&
      readyCount === enabledReady.length
    ) {
      setView('results')
    }
  }, [importActive, analyzingCount, readyCount, enabledReady.length])

  const handleStart = useCallback(async () => {
    setError(null)
    setStarting(true)
    try {
      await startAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setStarting(false)
    }
  }, [startAll])

  const handleStop = useCallback(async () => {
    await stopAll()
    setView('setup')
  }, [stopAll])

  const handleAddFiles = useCallback(async (files: File[]) => {
    setError(null)
    await addFiles(files)
  }, [addFiles])

  const mixerName = session.selectedMixerProfileId ?? 'No mixer selected'

  // ── Setup / import view ────────────────────────────────────────────────────
  if (view === 'setup' || !importActive || analyzingCount > 0) {
    return (
      <div className="mc-screen">
        <div className="mc-screen__header">
          <div>
            <h2 className="mc-screen__title">Multi-Track File Import</h2>
            <p className="mc-screen__subtitle">
              Import recorded audio files — one per mixer channel — and analyze them offline.
              Each track gets its own independent analysis and EQ suggestions.
              Up to {MAX_ANALYSIS_SECONDS} seconds of audio is analyzed per track.
            </p>
          </div>

          {importActive && analyzingCount > 0 && (
            <button className="btn btn--outline btn--sm btn--danger" onClick={handleStop}>
              ■ Stop
            </button>
          )}
        </div>

        {/* Mixer context strip */}
        <div className="mc-device-strip">
          <span className="mc-device-strip__label">Mixer profile:</span>
          <span className="mc-device-strip__name">{mixerName}</span>
          <span className="mc-device-strip__hint">(set in Setup screen)</span>
        </div>

        {/* Format info */}
        <div className="import-format-strip">
          <span className="import-format-strip__label">Supported formats:</span>
          {['WAV', 'AIFF', 'FLAC', 'MP3', 'OGG', 'M4A'].map(f => (
            <span key={f} className="import-format-tag">{f}</span>
          ))}
        </div>

        {/* Drop zone */}
        <DropZone onFiles={handleAddFiles} />

        {/* Track list */}
        {importTracks.length > 0 && (
          <>
            <div className="import-table-header">
              <span className="import-th-en">En</span>
              <span className="import-th-file">File</span>
              <span className="import-th-mixer">Mixer Ch</span>
              <span className="import-th-label">Label</span>
              <span className="import-th-source">Source</span>
              <span className="import-th-status">Status</span>
              <span />
            </div>

            <div className="import-track-list">
              {importTracks.map(track => {
                const state = importTrackStates.find(s => s.id === track.id) ?? {
                  id: track.id, status: 'idle' as const, analyzeProgress: 0, suggestions: []
                }
                return (
                  <ImportTrackRow
                    key={track.id}
                    config={track}
                    state={state}
                    onUpdate={updateImportTrack}
                    onRemove={removeFile}
                    onReanalyze={reanalyzeTrack}
                  />
                )
              })}
            </div>

            <div className="import-table-footer">
              <div className="import-table-footer__summary">
                {importTracks.length} file{importTracks.length !== 1 ? 's' : ''}
                {' · '}
                {enabledReady.length} ready to analyze
                {analyzingCount > 0 && ` · ${analyzingCount} analyzing…`}
              </div>
              <div className="import-table-footer__actions">
                <button
                  className="btn btn--ghost btn--sm btn--danger"
                  onClick={clearImportTracks}
                  disabled={analyzingCount > 0}
                >
                  Clear all
                </button>
                {readyCount > 0 && (
                  <button
                    className="btn btn--outline btn--sm"
                    onClick={() => setView('results')}
                  >
                    View results →
                  </button>
                )}
              </div>
            </div>

            {error && <div className="mc-error">⚠ {error}</div>}

            <div className="mc-screen__footer">
              <button
                className="btn btn--primary btn--lg"
                onClick={handleStart}
                disabled={enabledReady.length === 0 || starting || analyzingCount > 0}
              >
                {starting || analyzingCount > 0
                  ? `Analyzing ${analyzingCount > 0 ? `${analyzingCount} track${analyzingCount !== 1 ? 's' : ''}` : ''}…`
                  : `Analyze ${enabledReady.length} track${enabledReady.length !== 1 ? 's' : ''}`}
              </button>
              <p className="mc-screen__footer-hint">
                Tracks play simultaneously — analysis takes as long as the longest track (max {MAX_ANALYSIS_SECONDS}s).
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Results view ───────────────────────────────────────────────────────────
  return (
    <div className="mc-screen mc-screen--matrix">
      <div className="mc-matrix-header">
        <div className="mc-matrix-header__left">
          <span className="import-done-badge">✓ ANALYSIS COMPLETE</span>
          <span className="mc-matrix-header__device">
            {readyCount} track{readyCount !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        <div className="mc-matrix-header__stats">
          {totalSuggestions > 0 && (
            <span className="mc-stat mc-stat--pending">
              {totalSuggestions} pending suggestions
            </span>
          )}
          {totalSuggestions === 0 && (
            <span className="mc-stat mc-stat--ready">All channels look clean</span>
          )}
        </div>

        <div className="mc-matrix-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setView('setup')}>
            ← Back to import
          </button>
          <button
            className="btn btn--outline btn--sm"
            onClick={handleStart}
          >
            ↺ Re-analyze all
          </button>
        </div>
      </div>

      <div className="mc-layout">
        <ResultsGrid
          tracks={importTracks}
          states={importTrackStates}
          onDone={markImportSuggestionDone}
          onSkip={markImportSuggestionSkip}
          onReanalyze={reanalyzeTrack}
        />
      </div>
    </div>
  )
}
