import { useRef, useCallback, useEffect }   from 'react'
import { MultiTrackFileEngine }             from '../audio/MultiTrackFileEngine'
import type { ImportFrameCallback }         from '../audio/MultiTrackFileEngine'
import { AnalysisEngine }                   from '../analysis/AnalysisEngine'
import { AnalysisAccumulator }             from '../analysis/AnalysisAccumulator'
import { SuggestionEngine }                from '../suggestions/SuggestionEngine'
import { instructionMapper }               from '../mixer/InstructionMapper'
import { mixerProfileLoader }              from '../mixer/MixerProfileLoader'
import { useAppStore }                     from '../store/appStore'
import type {
  ImportTrackConfig,
  ImportTrackState,
  SuggestionItem,
  SessionState
} from '@shared/types'

/**
 * useMultiTrackImport — drives the file-based multitrack analysis pipeline.
 *
 * Flow per track:
 *   File dropped → loadFile() decodes it     → status: 'loading' → 'idle'
 *   startAll()   → playback begins           → status: 'analyzing'
 *   RAF loop     → analysis + accumulation
 *   source.ended → build suggestions         → status: 'ready'
 *
 * Architecture mirrors useMultiChannelPipeline:
 *   - One MultiTrackFileEngine (manages AudioContext + playback)
 *   - Per-track AnalysisEngine (own IssueSmoothing state)
 *   - Per-track AnalysisAccumulator (window = file duration, max 120s)
 *   - Suggestions built once per track when playback ends
 *
 * File objects live in fileMapRef (not Zustand — not serializable).
 */
export function useMultiTrackImport() {
  const engineRef           = useRef(new MultiTrackFileEngine())
  const analysisEnginesRef  = useRef<Map<string, AnalysisEngine>>(new Map())
  const accumulatorsRef     = useRef<Map<string, AnalysisAccumulator>>(new Map())
  const suggestionEngineRef = useRef(new SuggestionEngine())
  const fileMapRef          = useRef<Map<string, File>>(new Map())

  // Track which IDs have already had suggestions generated (prevent double-fire)
  const completedRef = useRef<Set<string>>(new Set())

  // Throttle meter updates
  const lastMeterUpdateRef = useRef<number>(0)

  // Stable refs for store values
  const importTracksRef = useRef<ImportTrackConfig[]>([])
  const sessionRef      = useRef<SessionState | null>(null)

  const importTracks           = useAppStore(s => s.importTracks)
  const session                = useAppStore(s => s.session)
  const addImportTrack         = useAppStore(s => s.addImportTrack)
  const removeImportTrack      = useAppStore(s => s.removeImportTrack)
  const updateImportTrack      = useAppStore(s => s.updateImportTrack)
  const updateImportTrackState = useAppStore(s => s.updateImportTrackState)
  const setImportActive        = useAppStore(s => s.setImportActive)

  useEffect(() => { importTracksRef.current = importTracks }, [importTracks])
  useEffect(() => { sessionRef.current      = session      }, [session])

  // Keep analysis engine source types in sync when track configs change
  useEffect(() => {
    for (const track of importTracks) {
      analysisEnginesRef.current.get(track.id)?.setSourceType(track.sourceType)
    }
  }, [importTracks])

  // ── Stable RAF callback ────────────────────────────────────────────────────
  const onFrame: ImportFrameCallback = useCallback((tracks, sampleRate) => {
    const now      = Date.now()
    const configs  = importTracksRef.current
    const isBatch  = now - lastMeterUpdateRef.current >= 200

    for (const td of tracks) {
      if (completedRef.current.has(td.id)) continue

      const config = configs.find(c => c.id === td.id)
      if (!config || !config.enabled) continue

      const engine = analysisEnginesRef.current.get(td.id)
      const acc    = accumulatorsRef.current.get(td.id)
      if (!engine || !acc) continue

      // Analyze this frame
      const result = engine.analyze(td.fftData, td.timeDomain, sampleRate)

      // Accumulate
      acc.add(AnalysisEngine.toSnapshot(result))

      // Track ended → build suggestions immediately
      if (td.ended) {
        completedRef.current.add(td.id)

        if (acc.hasEnoughSignal) {
          const items = buildTrackSuggestions(acc, config, sessionRef.current)
          updateImportTrackState({
            id:              td.id,
            status:          'ready',
            analyzeProgress: 100,
            suggestions:     items
          })
        } else {
          updateImportTrackState({
            id:              td.id,
            status:          'ready',
            analyzeProgress: 100,
            suggestions:     [],
            errorMessage:    'Not enough signal detected in this file.'
          })
        }
        continue
      }

      // Throttled meter update while analyzing
      if (isBatch) {
        updateImportTrackState({
          id:              td.id,
          status:          'analyzing',
          analyzeProgress: Math.round(td.progress * 100),
          suggestions:     []
        })
      }
    }

    if (isBatch) lastMeterUpdateRef.current = now
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateImportTrackState])

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add one or more audio files to the import list.
   * Files are decoded immediately so we know their duration.
   */
  const addFiles = useCallback(async (files: File[]): Promise<void> => {
    const existing = importTracksRef.current
    const nextMixerNum = existing.length === 0
      ? 1
      : Math.max(...existing.map(t => t.mixerChannelNumber)) + 1

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Deduplicate by name+size
      const isDupe = importTracksRef.current.some(
        t => t.fileName === file.name && t.fileSize === file.size
      )
      if (isDupe) continue

      const id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      fileMapRef.current.set(id, file)

      // Add with placeholder metadata (will update after decode)
      addImportTrack({
        id,
        fileName:           file.name,
        fileSize:           file.size,
        duration:           0,
        fileSampleRate:     0,
        fileChannels:       0,
        mixerChannelNumber: nextMixerNum + i,
        label:              stripExtension(file.name),
        sourceType:         'general',
        enabled:            true
      })

      // Show loading state
      updateImportTrackState({ id, status: 'loading', analyzeProgress: 0, suggestions: [] })

      // Decode in background
      engineRef.current.loadFile(id, file)
        .then(({ duration, sampleRate, channels }) => {
          updateImportTrack(id, {
            duration,
            fileSampleRate: sampleRate,
            fileChannels:   channels
          })
          updateImportTrackState({ id, status: 'idle', analyzeProgress: 0, suggestions: [] })
        })
        .catch(err => {
          updateImportTrackState({
            id,
            status:       'error',
            analyzeProgress: 0,
            suggestions:  [],
            errorMessage: err instanceof Error ? err.message : 'Failed to decode audio file.'
          })
        })
    }
  }, [addImportTrack, updateImportTrack, updateImportTrackState])

  /**
   * Remove a single track.
   */
  const removeFile = useCallback((id: string): void => {
    fileMapRef.current.delete(id)
    engineRef.current.removeTrack(id)
    analysisEnginesRef.current.delete(id)
    accumulatorsRef.current.delete(id)
    completedRef.current.delete(id)
    removeImportTrack(id)
  }, [removeImportTrack])

  /**
   * Start analysis of all enabled, decoded tracks simultaneously.
   */
  const startAll = useCallback(async (): Promise<void> => {
    const configs  = importTracksRef.current.filter(t => t.enabled && t.duration > 0)
    if (configs.length === 0) return

    // Reset state
    completedRef.current.clear()
    analysisEnginesRef.current.clear()
    accumulatorsRef.current.clear()

    for (const config of configs) {
      const eng = new AnalysisEngine()
      eng.setSourceType(config.sourceType)
      analysisEnginesRef.current.set(config.id, eng)

      // Use the file's actual duration as the window (capped at 120s)
      const windowSec = Math.min(config.duration, 120)
      accumulatorsRef.current.set(config.id, new AnalysisAccumulator(windowSec))

      updateImportTrackState({
        id:              config.id,
        status:          'analyzing',
        analyzeProgress: 0,
        suggestions:     []
      })
    }

    await engineRef.current.startAnalysis(
      configs.map(c => c.id),
      onFrame
    )

    setImportActive(true)
  }, [onFrame, updateImportTrackState, setImportActive])

  /**
   * Stop all playback and reset to idle.
   */
  const stopAll = useCallback(async (): Promise<void> => {
    await engineRef.current.stop()
    setImportActive(false)

    const configs = importTracksRef.current
    for (const config of configs) {
      updateImportTrackState({
        id:              config.id,
        status:          'idle',
        analyzeProgress: 0,
        suggestions:     []
      })
    }
    completedRef.current.clear()
  }, [updateImportTrackState, setImportActive])

  /**
   * Re-analyze a single track (re-decode + re-play just that one file).
   */
  const reanalyzeTrack = useCallback(async (id: string): Promise<void> => {
    const config = importTracksRef.current.find(t => t.id === id)
    const file   = fileMapRef.current.get(id)
    if (!config || !file) return

    completedRef.current.delete(id)

    // Reset this track's engine + accumulator
    const eng = new AnalysisEngine()
    eng.setSourceType(config.sourceType)
    analysisEnginesRef.current.set(id, eng)

    const windowSec = Math.min(config.duration, 120)
    accumulatorsRef.current.set(id, new AnalysisAccumulator(windowSec))

    updateImportTrackState({
      id,
      status:          'analyzing',
      analyzeProgress: 0,
      suggestions:     []
    })

    // Re-load and re-analyze (single track, reuses existing AudioContext if possible)
    await engineRef.current.loadFile(id, file)
    await engineRef.current.startAnalysis([id], onFrame)
  }, [onFrame, updateImportTrackState])

  // Cleanup on unmount
  useEffect(() => {
    return () => { engineRef.current.stop() }
  }, [])

  return { addFiles, removeFile, startAll, stopAll, reanalyzeTrack }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTrackSuggestions(
  acc:     AnalysisAccumulator,
  config:  ImportTrackConfig,
  session: SessionState | null
): SuggestionItem[] {
  const engine  = new SuggestionEngine()
  const recs    = engine.generate(acc, config.sourceType)

  const profile = session?.selectedMixerProfileId
    ? mixerProfileLoader.getById(session.selectedMixerProfileId)
    : null

  return recs.map(rec => {
    const actionSet = profile
      ? instructionMapper.map(rec, profile, config.mixerChannelNumber)
      : null

    return {
      recommendation: rec,
      mixerSteps:     actionSet?.instructions ?? null,
      mixerName:      actionSet?.mixerName    ?? null,
      status:         'pending'
    } satisfies SuggestionItem
  })
}

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}
