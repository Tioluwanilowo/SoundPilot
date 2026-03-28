import { create } from 'zustand'
import type {
  AnalysisSnapshot,
  SuggestionItem,
  SuggestionMode,
  SessionState,
  AppPreferences,
  AppPreset,
  AudioDeviceInfo,
  ChannelSlotConfig,
  ChannelSlotState,
  MultiChannelDeviceInfo,
  ImportTrackConfig,
  ImportTrackState
} from '@shared/types'
import { DEFAULT_PREFERENCES } from '@shared/types'
import { getPresetById } from '@shared/constants/multichannel-presets'

export type AppScreen = 'setup' | 'live' | 'multichannel' | 'import' | 'settings'

function generateSlotId(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Build a blank ChannelSlotState for a given slot id */
function blankSlotState(id: string): ChannelSlotState {
  return {
    id,
    status:            'idle',
    listeningProgress: 0,
    secondsRemaining:  0,
    rmsDb:             -100,
    peakDb:            -100,
    signalPresent:     false,
    issues:            [],
    suggestions:       []
  }
}

interface AppState {
  // ── Navigation ─────────────────────────────────────────────────────────────
  currentScreen: AppScreen

  // ── Available devices ──────────────────────────────────────────────────────
  audioDevices: AudioDeviceInfo[]

  // ── Session configuration ──────────────────────────────────────────────────
  session: SessionState

  // ── Audio capture state ────────────────────────────────────────────────────
  isCapturing: boolean
  analysisSnapshot: AnalysisSnapshot | null

  // ── Suggestion lifecycle ───────────────────────────────────────────────────
  // idle       → not started
  // listening  → accumulating audio (0→100% progress bar)
  // ready      → suggestions computed, waiting for user confirmation
  suggestionMode:     SuggestionMode
  listeningProgress:  number   // 0–100 (drives the progress bar)

  // Ordered suggestion list — each item has a status ('pending'|'done'|'skipped')
  // New suggestions are generated from scratch after each re-analyze.
  // Users confirm one at a time; suggestions do NOT auto-refresh.
  suggestions: SuggestionItem[]

  // ── App settings ───────────────────────────────────────────────────────────
  preferences: AppPreferences

  // ── Saved presets ──────────────────────────────────────────────────────────
  presets: AppPreset[]

  // ── Actions ────────────────────────────────────────────────────────────────
  navigateTo:           (screen: AppScreen) => void
  setAudioDevices:      (devices: AudioDeviceInfo[]) => void
  setSelectedDevice:    (deviceId: string) => void
  setSelectedMixer:     (profileId: string) => void
  setSourceType:        (sourceType: SessionState['selectedSourceType']) => void
  setChannelNumber:     (num: number) => void
  setCapturing:         (capturing: boolean) => void
  updateAnalysis:       (snapshot: AnalysisSnapshot) => void

  // Suggestion flow control
  setSuggestionMode:    (mode: SuggestionMode) => void
  setListeningProgress: (pct: number) => void
  setSuggestions:       (items: SuggestionItem[]) => void
  markSuggestionDone:   (id: string) => void
  markSuggestionSkipped:(id: string) => void
  triggerReanalyze:     () => void   // resets to 'listening', suggestions cleared

  // Settings
  updatePreferences:    (partial: Partial<AppPreferences>) => void
  addPreset:            (preset: AppPreset) => void
  removePreset:         (id: string) => void
  loadPreset:           (preset: AppPreset) => void

  // ── Multi-channel mode ────────────────────────────────────────────────────
  multiChannelActive:    boolean
  mcDeviceInfo:          MultiChannelDeviceInfo | null
  channelSlots:          ChannelSlotConfig[]
  channelSlotStates:     ChannelSlotState[]

  setMultiChannelActive: (active: boolean) => void
  setMcDeviceInfo:       (info: MultiChannelDeviceInfo | null) => void

  // Channel slot config (serializable — saved to preferences)
  addChannelSlot:        (partial?: Partial<ChannelSlotConfig>) => void
  removeChannelSlot:     (id: string) => void
  updateChannelSlot:     (id: string, updates: Partial<ChannelSlotConfig>) => void
  clearChannelSlots:     () => void
  loadChannelPreset:     (presetId: string, customCount?: number) => void

  // Channel slot runtime state (set by useMultiChannelPipeline)
  updateChannelSlotState:       (state: ChannelSlotState) => void
  markChannelSuggestionDone:    (slotId: string, recId: string) => void
  markChannelSuggestionSkipped: (slotId: string, recId: string) => void

  // ── Multi-track file import ───────────────────────────────────────────────
  importActive:        boolean
  importTracks:        ImportTrackConfig[]
  importTrackStates:   ImportTrackState[]

  setImportActive:           (active: boolean) => void
  addImportTrack:            (config: ImportTrackConfig) => void
  removeImportTrack:         (id: string) => void
  updateImportTrack:         (id: string, updates: Partial<ImportTrackConfig>) => void
  clearImportTracks:         () => void
  updateImportTrackState:    (state: Partial<ImportTrackState> & { id: string }) => void
  markImportSuggestionDone:  (trackId: string, recId: string) => void
  markImportSuggestionSkip:  (trackId: string, recId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  currentScreen:      'setup',
  audioDevices:       [],

  session: {
    selectedDeviceId:       null,
    selectedMixerProfileId: null,
    selectedSourceType:     'general',
    channelNumber:           1,
    sessionStartTime:        null,
    presetName:              null
  },

  isCapturing:        false,
  analysisSnapshot:   null,

  suggestionMode:     'idle',
  listeningProgress:  0,
  suggestions:        [],

  preferences:        DEFAULT_PREFERENCES,
  presets:            [],

  // ── Import initial state ──────────────────────────────────────────────────
  importActive:        false,
  importTracks:        [],
  importTrackStates:   [],

  // ── Multi-channel initial state ───────────────────────────────────────────
  multiChannelActive:  false,
  mcDeviceInfo:        null,
  channelSlots:        [],
  channelSlotStates:   [],

  // ── Actions ────────────────────────────────────────────────────────────────
  navigateTo:    (screen) => set({ currentScreen: screen }),

  setAudioDevices:   (devices) => set({ audioDevices: devices }),

  setSelectedDevice: (deviceId) =>
    set(s => ({ session: { ...s.session, selectedDeviceId: deviceId } })),

  setSelectedMixer: (profileId) =>
    set(s => ({ session: { ...s.session, selectedMixerProfileId: profileId } })),

  setSourceType: (sourceType) =>
    set(s => ({ session: { ...s.session, selectedSourceType: sourceType } })),

  setChannelNumber: (num) =>
    set(s => ({ session: { ...s.session, channelNumber: num } })),

  setCapturing: (capturing) =>
    set(s => ({
      isCapturing: capturing,
      // Reset suggestion flow when stopping
      ...(capturing ? {} : {
        suggestionMode:    'idle',
        listeningProgress: 0,
        suggestions:       []
      }),
      session: {
        ...s.session,
        sessionStartTime: capturing ? Date.now() : null
      }
    })),

  updateAnalysis: (snapshot) => set({ analysisSnapshot: snapshot }),

  setSuggestionMode: (mode) => set({ suggestionMode: mode }),

  setListeningProgress: (pct) => set({ listeningProgress: pct }),

  setSuggestions: (items) => set({ suggestions: items, suggestionMode: 'ready' }),

  markSuggestionDone: (id) =>
    set(s => ({
      suggestions: s.suggestions.map(item =>
        item.recommendation.id === id
          ? { ...item, status: 'done' }
          : item
      )
    })),

  markSuggestionSkipped: (id) =>
    set(s => ({
      suggestions: s.suggestions.map(item =>
        item.recommendation.id === id
          ? { ...item, status: 'skipped' }
          : item
      )
    })),

  triggerReanalyze: () =>
    set({
      suggestionMode:    'listening',
      listeningProgress: 0,
      suggestions:       []
    }),

  updatePreferences: (partial) =>
    set(s => ({ preferences: { ...s.preferences, ...partial } })),

  addPreset: (preset) =>
    set(s => ({ presets: [...s.presets.filter(p => p.id !== preset.id), preset] })),

  removePreset: (id) =>
    set(s => ({ presets: s.presets.filter(p => p.id !== id) })),

  loadPreset: (preset) =>
    set({ session: { ...preset.session } }),

  // ── Multi-channel actions ─────────────────────────────────────────────────

  setMultiChannelActive: (active) => set({ multiChannelActive: active }),

  setMcDeviceInfo: (info) => set({ mcDeviceInfo: info }),

  addChannelSlot: (partial = {}) =>
    set(s => {
      const nextUsb = s.channelSlots.length === 0
        ? 0
        : Math.max(...s.channelSlots.map(sl => sl.usbChannelIndex)) + 1
      const nextMixer = nextUsb + 1   // sensible default for Ui24R (USB 0 → CH 1)

      const slot: ChannelSlotConfig = {
        id:                generateSlotId(),
        usbChannelIndex:   nextUsb,
        mixerChannelNumber: nextMixer,
        label:             `Channel ${s.channelSlots.length + 1}`,
        sourceType:        'general',
        enabled:           true,
        ...partial
      }
      return {
        channelSlots:      [...s.channelSlots, slot],
        channelSlotStates: [...s.channelSlotStates, blankSlotState(slot.id)]
      }
    }),

  removeChannelSlot: (id) =>
    set(s => ({
      channelSlots:      s.channelSlots.filter(sl => sl.id !== id),
      channelSlotStates: s.channelSlotStates.filter(st => st.id !== id)
    })),

  updateChannelSlot: (id, updates) =>
    set(s => ({
      channelSlots: s.channelSlots.map(sl =>
        sl.id === id ? { ...sl, ...updates } : sl
      )
    })),

  clearChannelSlots: () => set({ channelSlots: [], channelSlotStates: [] }),

  /**
   * Load a channel preset by ID. Generates one slot per input channel
   * using the preset's usbOffset and inputCount.
   *
   * @param presetId    ID from MULTI_CHANNEL_PRESETS (e.g. 'behringer-x32')
   * @param customCount Override inputCount for the 'custom' preset
   */
  loadChannelPreset: (presetId, customCount) => {
    const preset = getPresetById(presetId)
    if (!preset) return

    const count = presetId === 'custom'
      ? (customCount ?? 16)
      : preset.inputCount

    if (count === 0) return   // custom with no count specified

    const slots: ChannelSlotConfig[] = Array.from({ length: count }, (_, i) => ({
      id:                 generateSlotId(),
      usbChannelIndex:    i + preset.usbOffset,
      mixerChannelNumber: i + 1,
      label:              `CH ${i + 1}`,
      sourceType:         'general' as const,
      enabled:            true
    }))
    const states = slots.map(s => blankSlotState(s.id))
    set({ channelSlots: slots, channelSlotStates: states })
  },

  updateChannelSlotState: (incoming) =>
    set(s => {
      const idx = s.channelSlotStates.findIndex(st => st.id === incoming.id)
      if (idx === -1) return {}

      // Preserve suggestions if the incoming update has an empty suggestions array
      // (meter-only updates should not wipe suggestions that are already set)
      const existing = s.channelSlotStates[idx]
      const merged: ChannelSlotState = {
        ...existing,
        ...incoming,
        suggestions: incoming.suggestions.length > 0
          ? incoming.suggestions
          : existing.suggestions
      }
      const next = [...s.channelSlotStates]
      next[idx] = merged
      return { channelSlotStates: next }
    }),

  markChannelSuggestionDone: (slotId, recId) =>
    set(s => ({
      channelSlotStates: s.channelSlotStates.map(st =>
        st.id !== slotId ? st : {
          ...st,
          suggestions: st.suggestions.map(item =>
            item.recommendation.id === recId ? { ...item, status: 'done' } : item
          )
        }
      )
    })),

  markChannelSuggestionSkipped: (slotId, recId) =>
    set(s => ({
      channelSlotStates: s.channelSlotStates.map(st =>
        st.id !== slotId ? st : {
          ...st,
          suggestions: st.suggestions.map(item =>
            item.recommendation.id === recId ? { ...item, status: 'skipped' } : item
          )
        }
      )
    })),

  // ── Import track actions ──────────────────────────────────────────────────

  setImportActive: (active) => set({ importActive: active }),

  addImportTrack: (config) =>
    set(s => ({
      importTracks:      [...s.importTracks, config],
      importTrackStates: [
        ...s.importTrackStates,
        { id: config.id, status: 'idle', analyzeProgress: 0, suggestions: [] }
      ]
    })),

  removeImportTrack: (id) =>
    set(s => ({
      importTracks:      s.importTracks.filter(t => t.id !== id),
      importTrackStates: s.importTrackStates.filter(t => t.id !== id)
    })),

  updateImportTrack: (id, updates) =>
    set(s => ({
      importTracks: s.importTracks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),

  clearImportTracks: () => set({ importTracks: [], importTrackStates: [] }),

  updateImportTrackState: (incoming) =>
    set(s => {
      const idx = s.importTrackStates.findIndex(st => st.id === incoming.id)
      if (idx === -1) return {}
      const existing = s.importTrackStates[idx]
      const merged: ImportTrackState = {
        ...existing,
        ...incoming,
        suggestions: (incoming.suggestions && incoming.suggestions.length > 0)
          ? incoming.suggestions
          : existing.suggestions
      }
      const next = [...s.importTrackStates]
      next[idx] = merged
      return { importTrackStates: next }
    }),

  markImportSuggestionDone: (trackId, recId) =>
    set(s => ({
      importTrackStates: s.importTrackStates.map(st =>
        st.id !== trackId ? st : {
          ...st,
          suggestions: st.suggestions.map(item =>
            item.recommendation.id === recId ? { ...item, status: 'done' } : item
          )
        }
      )
    })),

  markImportSuggestionSkip: (trackId, recId) =>
    set(s => ({
      importTrackStates: s.importTrackStates.map(st =>
        st.id !== trackId ? st : {
          ...st,
          suggestions: st.suggestions.map(item =>
            item.recommendation.id === recId ? { ...item, status: 'skipped' } : item
          )
        }
      )
    }))
}))
