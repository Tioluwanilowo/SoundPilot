import { useRef, useCallback, useEffect } from 'react'
import { MultiChannelCaptureEngine }    from '../audio/MultiChannelCaptureEngine'
import type { MultiChannelFrameCallback } from '../audio/MultiChannelCaptureEngine'
import { AnalysisEngine }               from '../analysis/AnalysisEngine'
import { AnalysisAccumulator }          from '../analysis/AnalysisAccumulator'
import { SuggestionEngine }             from '../suggestions/SuggestionEngine'
import { instructionMapper }            from '../mixer/InstructionMapper'
import { mixerProfileLoader }           from '../mixer/MixerProfileLoader'
import { useAppStore }                  from '../store/appStore'
import type {
  ChannelSlotConfig,
  ChannelSlotState,
  SuggestionItem,
  SessionState,
  MultiChannelDeviceInfo
} from '@shared/types'

/**
 * useMultiChannelPipeline — drives simultaneous per-channel audio analysis.
 *
 * Architecture:
 *   One MultiChannelCaptureEngine streams all USB channels via a single
 *   MediaStream + ChannelSplitterNode. Each active slot gets its own
 *   AnalysisEngine (for per-slot issue smoothing) and AnalysisAccumulator
 *   (for 25-second rolling averages). All engines are ticked on every
 *   animation frame from the same RAF callback.
 *
 * State management:
 *   Per-slot status is tracked locally in `slotStatusRef` (avoids store
 *   reads inside the RAF callback). Store is updated at ~5fps for live
 *   meters and immediately on status transitions (listening → ready).
 *
 * Suggestion flow per slot:
 *   idle → (startAll) → listening → (accumulator.isReady) → ready
 *   ready → (reanalyzeSlot) → listening → ready → ...
 */
export function useMultiChannelPipeline() {
  // ── Stable engine instances ────────────────────────────────────────────────
  const captureEngineRef    = useRef<MultiChannelCaptureEngine>(new MultiChannelCaptureEngine())
  const analysisEnginesRef  = useRef<Map<string, AnalysisEngine>>(new Map())
  const accumulatorsRef     = useRef<Map<string, AnalysisAccumulator>>(new Map())
  const suggestionEngineRef = useRef<SuggestionEngine>(new SuggestionEngine())

  // ── Local slot status (source of truth for the RAF callback) ──────────────
  // 'idle' | 'listening' | 'ready' | 'no-signal'
  const slotStatusRef = useRef<Map<string, ChannelSlotState['status']>>(new Map())

  // ── Throttle tracking ─────────────────────────────────────────────────────
  const lastMeterUpdateRef = useRef<number>(0)

  // ── Pending re-analyze requests (set by reanalyzeSlot, consumed in RAF) ───
  const pendingReanalyzeRef = useRef<Set<string>>(new Set())

  // ── Stable refs for store values ──────────────────────────────────────────
  const channelSlotsRef = useRef<ChannelSlotConfig[]>([])
  const sessionRef      = useRef<SessionState | null>(null)

  // Pull store
  const channelSlots           = useAppStore(s => s.channelSlots)
  const session                = useAppStore(s => s.session)
  const preferences            = useAppStore(s => s.preferences)
  const updateChannelSlotState = useAppStore(s => s.updateChannelSlotState)
  const setMcDeviceInfo        = useAppStore(s => s.setMcDeviceInfo)
  const setMultiChannelActive  = useAppStore(s => s.setMultiChannelActive)

  // Sync refs on every render
  useEffect(() => { channelSlotsRef.current = channelSlots }, [channelSlots])
  useEffect(() => { sessionRef.current      = session      }, [session])

  // Keep analysis engine source types in sync when slots change
  useEffect(() => {
    for (const slot of channelSlots) {
      analysisEnginesRef.current.get(slot.id)?.setSourceType(slot.sourceType)
    }
  }, [channelSlots])

  // ── Per-frame callback (stable — empty dep array) ─────────────────────────
  const onFrame: MultiChannelFrameCallback = useCallback((channels, sampleRate) => {
    const now   = Date.now()
    const slots = channelSlotsRef.current

    // Batch meter updates for store (throttled to ~5fps)
    const meterBatch: ChannelSlotState[] = []

    for (const slot of slots) {
      if (!slot.enabled) continue

      const chIdx = slot.usbChannelIndex
      if (chIdx < 0 || chIdx >= channels.length) continue

      const { fftData, timeDomain } = channels[chIdx]

      // ── Handle pending re-analyze ─────────────────────────────────────────
      if (pendingReanalyzeRef.current.has(slot.id)) {
        accumulatorsRef.current.get(slot.id)?.reset()
        slotStatusRef.current.set(slot.id, 'listening')
        pendingReanalyzeRef.current.delete(slot.id)
        // Immediate store update for status
        updateChannelSlotState({
          id:                slot.id,
          status:            'listening',
          listeningProgress: 0,
          secondsRemaining:  25,
          rmsDb:             -100,
          peakDb:            -100,
          signalPresent:     false,
          issues:            [],
          suggestions:       []
        })
      }

      const engine = analysisEnginesRef.current.get(slot.id)
      const acc    = accumulatorsRef.current.get(slot.id)
      const status = slotStatusRef.current.get(slot.id) ?? 'idle'
      if (!engine || !acc || status === 'idle' || status === 'ready') continue

      // ── Analyze this channel frame ─────────────────────────────────────────
      const result = engine.analyze(fftData, timeDomain, sampleRate)

      // ── Accumulate if listening ────────────────────────────────────────────
      if (status === 'listening') {
        acc.add(AnalysisEngine.toSnapshot(result))

        // When window completes, build suggestions
        if (acc.isReady) {
          if (acc.hasEnoughSignal) {
            const items = buildSlotSuggestions(acc, slot, session)
            slotStatusRef.current.set(slot.id, 'ready')

            // Immediate store update with suggestions
            updateChannelSlotState({
              id:                slot.id,
              status:            'ready',
              listeningProgress: 100,
              secondsRemaining:  0,
              rmsDb:             result.levelDb,
              peakDb:            result.peakDb,
              signalPresent:     result.signalPresent,
              issues:            result.issues,
              suggestions:       items
            })
            continue  // skip the throttled meter update for this slot
          } else {
            // Not enough signal — restart the window
            acc.reset()
            slotStatusRef.current.set(slot.id, 'no-signal')
          }
        }
      }

      // ── Throttled meter update ─────────────────────────────────────────────
      if (now - lastMeterUpdateRef.current >= 200) {
        const currentStatus = slotStatusRef.current.get(slot.id) ?? 'idle'
        meterBatch.push({
          id:                slot.id,
          status:            currentStatus,
          listeningProgress: Math.round(acc.progress * 100),
          secondsRemaining:  Math.round(acc.secondsRemaining),
          rmsDb:             result.levelDb,
          peakDb:            result.peakDb,
          signalPresent:     result.signalPresent,
          issues:            result.issues,
          suggestions:       []    // don't overwrite suggestions during meter update
        })
      }
    }

    // Flush meter batch
    if (now - lastMeterUpdateRef.current >= 200 && meterBatch.length > 0) {
      lastMeterUpdateRef.current = now
      for (const state of meterBatch) updateChannelSlotState(state)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateChannelSlotState])

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open the device and start simultaneous analysis on all enabled slots.
   * Returns the actual channel count provided by the OS.
   */
  const startAll = useCallback(async (deviceId: string): Promise<number> => {
    const slots = channelSlotsRef.current.filter(s => s.enabled)
    if (slots.length === 0) return 0

    // Tear down any previous session
    await captureEngineRef.current.stop()
    analysisEnginesRef.current.clear()
    accumulatorsRef.current.clear()
    slotStatusRef.current.clear()
    pendingReanalyzeRef.current.clear()

    // Provision per-slot engines
    const windowSec = sessionRef.current
      ? (preferences?.listeningWindowSec ?? 25)
      : 25

    const maxUsbChannel = Math.max(...slots.map(s => s.usbChannelIndex)) + 1

    for (const slot of slots) {
      const eng = new AnalysisEngine()
      eng.setSourceType(slot.sourceType)
      analysisEnginesRef.current.set(slot.id, eng)
      accumulatorsRef.current.set(slot.id, new AnalysisAccumulator(windowSec))
      slotStatusRef.current.set(slot.id, 'listening')
    }

    const actual = await captureEngineRef.current.start(
      deviceId,
      maxUsbChannel,
      onFrame,
      4096
    )

    // Build device info
    const sess = sessionRef.current
    const deviceLabel = sess?.selectedDeviceId === deviceId
      ? (deviceId.slice(0, 40) + '…')
      : deviceId

    const info: MultiChannelDeviceInfo = {
      deviceId,
      deviceLabel,
      detectedChannelCount: actual,
      channelCountMatch:    actual >= maxUsbChannel
    }
    setMcDeviceInfo(info)
    setMultiChannelActive(true)

    // Initialize all slot states to 'listening'
    const windowSecFinal = windowSec
    for (const slot of slots) {
      updateChannelSlotState({
        id:                slot.id,
        status:            actual > slot.usbChannelIndex ? 'listening' : 'no-signal',
        listeningProgress: 0,
        secondsRemaining:  windowSecFinal,
        rmsDb:             -100,
        peakDb:            -100,
        signalPresent:     false,
        issues:            [],
        suggestions:       []
      })
    }

    return actual
  }, [onFrame, updateChannelSlotState, setMcDeviceInfo, setMultiChannelActive, preferences])

  /**
   * Stop all capture and reset to idle.
   */
  const stopAll = useCallback(async (): Promise<void> => {
    await captureEngineRef.current.stop()
    setMultiChannelActive(false)

    const slots = channelSlotsRef.current
    for (const slot of slots) {
      slotStatusRef.current.set(slot.id, 'idle')
      updateChannelSlotState({
        id:                slot.id,
        status:            'idle',
        listeningProgress: 0,
        secondsRemaining:  0,
        rmsDb:             -100,
        peakDb:            -100,
        signalPresent:     false,
        issues:            [],
        suggestions:       []
      })
    }
  }, [updateChannelSlotState, setMultiChannelActive])

  /**
   * Reset a specific slot's accumulator and restart its listening window.
   * Does not restart the audio capture (capture keeps running).
   */
  const reanalyzeSlot = useCallback((slotId: string): void => {
    pendingReanalyzeRef.current.add(slotId)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      captureEngineRef.current.stop()
    }
  }, [])

  return { startAll, stopAll, reanalyzeSlot }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildSlotSuggestions(
  acc:     AnalysisAccumulator,
  slot:    ChannelSlotConfig,
  session: SessionState | null
): SuggestionItem[] {
  const engine  = new SuggestionEngine()
  const recs    = engine.generate(acc, slot.sourceType)

  const profileId = session?.selectedMixerProfileId ?? null
  const profile   = profileId ? mixerProfileLoader.getById(profileId) : null

  return recs.map(rec => {
    const actionSet = profile
      ? instructionMapper.map(rec, profile, slot.mixerChannelNumber)
      : null

    return {
      recommendation: rec,
      mixerSteps:     actionSet?.instructions ?? null,
      mixerName:      actionSet?.mixerName    ?? null,
      status:         'pending'
    } satisfies SuggestionItem
  })
}
