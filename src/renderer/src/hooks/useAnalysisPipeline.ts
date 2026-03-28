import { useRef, useCallback, useEffect } from 'react'
import { AnalysisEngine } from '../analysis/AnalysisEngine'
import { AnalysisAccumulator } from '../analysis/AnalysisAccumulator'
import { SuggestionEngine } from '../suggestions/SuggestionEngine'
import { instructionMapper } from '../mixer/InstructionMapper'
import { mixerProfileLoader } from '../mixer/MixerProfileLoader'
import { useAppStore } from '../store/appStore'
import type { AnalysisResult, SessionState, AppPreferences, SuggestionItem } from '@shared/types'
import type { AudioFrameCallback } from '../audio/AudioCaptureEngine'

/**
 * useAnalysisPipeline — drives the full analysis → accumulation → suggestion flow.
 *
 * Suggestion lifecycle:
 *
 *   'idle'      → user hasn't started yet
 *   'listening' → accumulator is running; progress bar fills over listeningWindowSec
 *   'ready'     → accumulation complete; suggestions computed and shown
 *
 * Transitions:
 *   start capture            → mode set to 'listening' by LiveScreen
 *   accumulator.isReady      → compute suggestions, set mode to 'ready'
 *   triggerReanalyze()       → store resets mode to 'listening', accumulator is reset
 *
 * Suggestions are NOT auto-refreshed. Once 'ready', the suggestion list is
 * frozen until the user explicitly clicks "Re-analyze". This lets users work
 * through one suggestion at a time without the list changing under them.
 *
 * The stable `onFrame` callback (empty dep array) avoids restarting the
 * audio engine when preferences or session config change mid-capture.
 * All state is read through refs.
 */
export function useAnalysisPipeline() {
  // ── Engines (stable instances) ────────────────────────────────────────────
  const analysisEngineRef   = useRef<AnalysisEngine>(new AnalysisEngine())
  const accumulatorRef      = useRef<AnalysisAccumulator | null>(null)
  const suggestionEngineRef = useRef<SuggestionEngine>(new SuggestionEngine())

  // ── Latest full result for canvas components (no React re-render) ─────────
  const latestResultRef = useRef<AnalysisResult | null>(null)

  // ── Timing ────────────────────────────────────────────────────────────────
  const lastAnalysisUpdateMs = useRef<number>(0)
  const lastProgressUpdateMs = useRef<number>(0)

  // ── Stable refs for latest store values ───────────────────────────────────
  const sessionRef     = useRef<SessionState | null>(null)
  const preferencesRef = useRef<AppPreferences | null>(null)
  const suggestionModeRef = useRef<string>('idle')

  // Pull stable Zustand actions
  const updateAnalysis      = useAppStore(s => s.updateAnalysis)
  const setListeningProgress = useAppStore(s => s.setListeningProgress)
  const setSuggestions      = useAppStore(s => s.setSuggestions)

  // Sync refs on every render
  const session        = useAppStore(s => s.session)
  const preferences    = useAppStore(s => s.preferences)
  const suggestionMode = useAppStore(s => s.suggestionMode)

  useEffect(() => { sessionRef.current        = session        }, [session])
  useEffect(() => { preferencesRef.current    = preferences    }, [preferences])
  useEffect(() => { suggestionModeRef.current = suggestionMode }, [suggestionMode])

  // Keep analysis engine source type in sync
  useEffect(() => {
    analysisEngineRef.current.setSourceType(session.selectedSourceType)
  }, [session.selectedSourceType])

  // When mode flips back to 'listening' (via triggerReanalyze), reset accumulator
  useEffect(() => {
    if (suggestionMode === 'listening') {
      if (!accumulatorRef.current) {
        accumulatorRef.current = new AnalysisAccumulator(preferences.listeningWindowSec)
      } else {
        accumulatorRef.current.reset()
      }
    }
  }, [suggestionMode, preferences.listeningWindowSec])

  // ── The stable per-frame callback ─────────────────────────────────────────
  const onFrame: AudioFrameCallback = useCallback((fftData, timeDomain, sampleRate) => {
    const now   = Date.now()
    const sess  = sessionRef.current
    const prefs = preferencesRef.current
    const mode  = suggestionModeRef.current
    if (!sess || !prefs) return

    // ── 1. Analyse the current frame ─────────────────────────────────────────
    const result = analysisEngineRef.current.analyze(fftData, timeDomain, sampleRate)
    latestResultRef.current = result

    // Push snapshot to store at the configured meter refresh rate
    if (now - lastAnalysisUpdateMs.current >= prefs.analysisRefreshMs) {
      lastAnalysisUpdateMs.current = now
      updateAnalysis(AnalysisEngine.toSnapshot(result))
    }

    // ── 2. Accumulate if we're in 'listening' mode ────────────────────────────
    if (mode === 'listening') {
      if (!accumulatorRef.current) {
        accumulatorRef.current = new AnalysisAccumulator(prefs.listeningWindowSec)
      }

      accumulatorRef.current.add(AnalysisEngine.toSnapshot(result))

      // Update progress bar at ~5fps to avoid excessive re-renders
      if (now - lastProgressUpdateMs.current >= 200) {
        lastProgressUpdateMs.current = now
        const pct = Math.round(accumulatorRef.current.progress * 100)
        setListeningProgress(pct)
      }

      // When accumulation window is complete, generate suggestions
      if (accumulatorRef.current.isReady) {
        if (accumulatorRef.current.hasEnoughSignal) {
          const items = buildSuggestions(
            accumulatorRef.current,
            sess,
            suggestionEngineRef.current
          )
          setSuggestions(items)  // also sets mode → 'ready'
        } else {
          // Not enough signal — restart the window silently
          accumulatorRef.current.reset()
          setListeningProgress(0)
        }
      }
    }
  }, [updateAnalysis, setListeningProgress, setSuggestions])

  return { onFrame, latestResultRef }
}

// ── Helper: build SuggestionItem[] from accumulator output ────────────────────
function buildSuggestions(
  accumulator: AnalysisAccumulator,
  sess: SessionState,
  engine: SuggestionEngine
): SuggestionItem[] {
  const recs = engine.generate(accumulator, sess.selectedSourceType)

  const profile = sess.selectedMixerProfileId
    ? mixerProfileLoader.getById(sess.selectedMixerProfileId)
    : null

  return recs.map(rec => {
    const actionSet = profile
      ? instructionMapper.map(rec, profile, sess.channelNumber)
      : null

    return {
      recommendation: rec,
      mixerSteps:     actionSet?.instructions ?? null,
      mixerName:      actionSet?.mixerName ?? null,
      status:         'pending'
    } satisfies SuggestionItem
  })
}
