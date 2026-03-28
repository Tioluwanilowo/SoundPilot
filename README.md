# SoundPilot

> Real-time audio analysis and mixer EQ suggestion tool for live sound engineers and musicians.

SoundPilot listens to audio coming out of your mixer, detects spectral problems (rumble, muddiness, harshness, clipping, and more), and generates **step-by-step EQ instructions written specifically for the mixer you are using** — no cloud, no subscription, no internet required.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Modes](#modes)
3. [Supported Mixers](#supported-mixers)
4. [Getting Started](#getting-started)
5. [How It Works — Technical Overview](#how-it-works--technical-overview)
6. [Architecture](#architecture)
7. [File Structure](#file-structure)
8. [Analysis Pipeline](#analysis-pipeline)
9. [Issue Smoothing](#issue-smoothing)
10. [Accumulation and Statistics](#accumulation-and-statistics)
11. [Suggestion Engine](#suggestion-engine)
12. [Instruction Mapper](#instruction-mapper)
13. [Multi-Channel Mode](#multi-channel-mode)
14. [Multi-Track File Import](#multi-track-file-import)
15. [Mixer Profiles](#mixer-profiles)
16. [Adding a New Mixer Profile](#adding-a-new-mixer-profile)
17. [Source Types](#source-types)
18. [Preferences](#preferences)
19. [IPC Bridge — Electron Security Model](#ipc-bridge--electron-security-model)
20. [State Management Reference](#state-management-reference)
21. [Development](#development)
22. [Build and Distribution](#build-and-distribution)
23. [Technology Stack](#technology-stack)
24. [Known Limitations](#known-limitations)
25. [Bugs Fixed](#bugs-fixed)

---

## What It Does

1. **Captures audio** from any input device your OS can see — USB mixer, audio interface, virtual cable, or microphone.
2. **Analyzes the frequency spectrum** in real time using the Web Audio API FFT engine.
3. **Detects spectral issues** — sub-bass rumble, muddiness, boxiness, harshness, sibilance, low signal, clipping, missing phantom power, and more.
4. **Generates prioritized EQ recommendations** tuned to the declared source type (male vocal, kick drum, acoustic guitar, etc.).
5. **Maps every recommendation to your specific mixer** — tells you exactly which physical knob or menu to touch, at what frequency, and by how many dB.
6. **Tracks your progress** — mark each suggestion Done or Skip to keep a running list.

Everything runs locally inside the Electron app. No audio data leaves the machine.

---

## Modes

### Live Analysis (single channel)
Connect a mixer's headphone or aux output to your computer's input and listen to one channel at a time. Use the mixer's **Solo / PFL** button to route each channel into the cue bus, then point SoundPilot at that input. The app listens for 25 seconds (configurable), then generates suggestions.

Best for: analog mixers, Soundcraft Ui12 / Ui16, any mixer without multi-channel USB audio.

### Multi-Channel Mode
For mixers that expose a **multi-channel USB audio interface** to the host (X32, SQ-5, Ui24R, StudioLive, etc.), SoundPilot opens the USB device directly and analyzes every channel simultaneously — each with its own independent analysis engine, accumulator, and EQ suggestions. No solo routing required.

Best for: digital mixers with USB audio driver support.

### Multi-Track File Import
Import recorded audio files (WAV, AIFF, FLAC, MP3, OGG, M4A) and analyze them offline. Drop one file per mixer channel, configure the source type for each, then click Analyze. All tracks play simultaneously through silent audio pipelines and produce independent suggestions. Up to 120 seconds of audio is analyzed per track.

Best for: post-session review, soundcheck recordings, pre-show preparation.

---

## Supported Mixers

### Mixer Profiles (EQ instructions)

| Brand         | Model                               | Type    |
|---------------|-------------------------------------|---------|
| Behringer     | X32 / X32 Compact / X32 Producer   | Digital |
| Behringer     | XR18                                | Digital |
| Allen & Heath | SQ-5                                | Digital |
| Soundcraft    | Signature 10                        | Analog  |
| Soundcraft    | Ui12                                | Digital |
| Soundcraft    | Ui16                                | Digital |
| Soundcraft    | Ui24R                               | Digital |
| Mackie        | ProFX10v3                           | Analog  |
| Yamaha        | MG10XUF                             | Analog  |
| Generic       | Analog (any analog mixer)           | Analog  |
| Generic       | Digital (any digital mixer)         | Digital |

### Multi-Channel USB Quick-Setup Presets

| Brand           | Models                                                 | USB Channels |
|-----------------|--------------------------------------------------------|-------------|
| Soundcraft      | Ui24R                                                  | 32          |
| Behringer       | X32 / X32 Rack / X32 Core, XR18, XR16, XR12           | 12–32       |
| Midas           | M32 / M32R / M32C / M32 Live                           | 32          |
| Allen & Heath   | SQ-5, SQ-6, SQ-7, Avantis                             | 48–64       |
| PreSonus        | StudioLive 32S, 32R, 24R, 16R, 16                     | 18–34       |
| Yamaha          | TF1, TF3, TF5                                          | 16–40       |
| QSC             | TouchMix-30 Pro                                        | 32          |
| Mackie          | DL32R                                                  | 32          |
| TASCAM          | Model 24                                               | 24          |
| Custom          | Manual input (any channel count 1–64)                  | User-defined |

---

## Getting Started

### Prerequisites

- **Node.js** 18 or newer
- **npm** 9 or newer
- On **Windows** with a digital USB mixer: install the mixer's USB audio driver before using Multi-Channel mode (the driver download link is shown in the preset picker)
- On **macOS** with a class-compliant mixer: no driver needed

### Install and Run

```bash
# Clone or extract the project
cd SoundPilot

# Install dependencies
npm install

# Start in development mode (hot-reload, DevTools open)
npm run dev
```

### First Use — Live Analysis

1. Open the **Setup** screen.
2. Select your **audio input device** — the output of your mixer plugged into your computer.
3. Select your **mixer profile** — the physical mixer you are operating (optional but recommended).
4. Set the **channel number** you will be analyzing.
5. Select the **source type** (Male Vocal, Kick Drum, Acoustic Guitar, etc.).
6. Click **Start Live Analysis**.
7. Solo the channel on your mixer. The app listens for 25 seconds, then shows suggestions.

### First Use — Multi-Channel Mode

1. Connect your USB mixer and install its Windows driver if needed.
2. Navigate to **Multi-Channel**.
3. Pick your mixer from the brand list — channel slots are auto-generated.
4. Select your USB audio device from the dropdown.
5. Click **Start** — all channels are captured simultaneously.

### First Use — File Import

1. Navigate to **Import**.
2. Drop one audio file per mixer channel onto the drop zone.
3. Set source type and mixer channel number for each file.
4. Click **Analyze** — all files are processed simultaneously.

---

## How It Works — Technical Overview

```
Audio Device (USB / line in)
       │
       ▼
  getUserMedia()
       │
  AudioContext (Web Audio API)
       │
  MediaStreamSourceNode
       │
  AnalyserNode  (fftSize 4096, smoothing 0.8)
  echoCancellation: false
  noiseSuppression: false
  autoGainControl:  false
       │
  ┌────┴──────────────────┐
  │  getFloatFrequencyData │  ← FFT spectrum (dBFS per bin)
  │  getFloatTimeDomainData│  ← waveform samples
  └────┬──────────────────┘
       │  (every animation frame ~60fps)
       ▼
  AnalysisEngine
  ├── FFTProcessor         → RMS, peak, 7 band averages
  ├── IssueDetector        → raw issue list per frame
  └── IssueSmoothing       → temporal filter (4-frame confirm, 90-frame clear)
       │
       ▼
  AnalysisAccumulator      → collects snapshots for 25 seconds
  (only frames with signal present are stored;
   silent frames advance the clock but not the sample count)
       │
       ▼ (when window is complete — isReady == true)
  SuggestionEngine
  ├── hardwareRules        → gain, clipping, phantom power  (runs first)
  └── EQ rules             → vocalRules + instrumentRules   (runs only if no hardware issue)
       │
       ▼
  InstructionMapper        → GenericRecommendation → MixerActionSet
       │
       ▼
  Zustand store            → UI re-renders with suggestions
```

---

## Architecture

### Design Principle

SoundPilot follows a strict **one-way data pipeline**:

```
Capture → Analyze → Accumulate → Suggest → Map → Display
```

Each layer is independently replaceable. The analysis layer does not know about the UI. The suggestion engine does not know about specific mixer models. The instruction mapper does not know about audio.

### Process Separation

| Process  | Responsibility                                                       |
|----------|----------------------------------------------------------------------|
| Main     | Window management, IPC handlers, file-based preferences/presets storage |
| Preload  | Secure bridge — exposes only typed `window.api` methods via `contextBridge` |
| Renderer | Entire audio pipeline, all analysis, React UI (runs in isolated context) |

The renderer never has direct access to Node.js or the filesystem. All persistence goes through the typed IPC bridge.

### State Management

Global app state lives in a **Zustand** store (`appStore.ts`). Two categories of state are kept strictly separate:

| Category | Examples | Persisted? |
|---|---|---|
| Serializable config | Session settings, slot configs, import track configs, preferences | Yes (via IPC) |
| Runtime state | Meter values, suggestion lists, analysis progress, capture status | No — reset each session |

**File objects from drag-and-drop** (`File` instances from the import screen) are **never stored in Zustand** — they are held in a `fileMapRef: Map<string, File>` inside the `useMultiTrackImport` hook. `File` objects are not serializable and would break Zustand's state consistency.

### Suggestion Preservation During Meter Updates

Both `updateChannelSlotState` and `updateImportTrackState` in the store merge incoming state with existing, using this pattern:

```typescript
suggestions: incoming.suggestions.length > 0
  ? incoming.suggestions
  : existing.suggestions
```

Meter-only updates (which fire at ~5fps) pass an empty `suggestions: []` to avoid wiping suggestions that have already been computed for a completed slot.

### RAF Callback Stability

All RAF (animation frame) callbacks in hooks use `useCallback` with minimal dependencies. Store values needed inside the RAF loop are accessed through refs (`sessionRef`, `channelSlotsRef`, etc.) that are synced via `useEffect`. This pattern prevents the audio engine from being torn down and restarted when unrelated store state changes.

---

## File Structure

```
SoundPilot/
├── src/
│   ├── main/                                # Electron main process
│   │   ├── index.ts                         # App entry — creates window
│   │   ├── window.ts                        # BrowserWindow configuration
│   │   ├── ipc/handlers.ts                  # IPC channel definitions + handlers
│   │   └── services/StorageService.ts       # JSON-based preferences & preset storage
│   │
│   ├── preload/
│   │   ├── index.ts                         # contextBridge API — exposes window.api
│   │   └── index.d.ts                       # Type declarations for window.api
│   │
│   ├── shared/                              # Shared between main and renderer
│   │   ├── types/
│   │   │   ├── index.ts                     # Re-exports all types
│   │   │   ├── analysis.types.ts            # AnalysisResult, AnalysisSnapshot, FrequencyBands, IssueType
│   │   │   ├── audio.types.ts               # AudioDeviceInfo
│   │   │   ├── mixer.types.ts               # MixerProfile, EQBandProfile, UsbAudioInterface
│   │   │   ├── multichannel.types.ts        # ChannelSlotConfig/State, ImportTrackConfig/State, MultiChannelDeviceInfo
│   │   │   ├── recommendation.types.ts      # GenericRecommendation, SuggestionItem, EQAction, MixerActionSet
│   │   │   └── session.types.ts             # SessionState, AppPreferences, SourceType, DEFAULT_PREFERENCES
│   │   └── constants/
│   │       ├── frequencies.ts               # Band frequency boundaries, LEVEL_THRESHOLDS
│   │       └── multichannel-presets.ts      # 32 mixer USB presets + getPresetsByBrand() / getPresetById()
│   │
│   └── renderer/src/                        # React app (renderer process)
│       ├── App.tsx                          # Route switcher: setup / live / multichannel / import / settings
│       ├── App.css                          # All styles — dark theme + component classes
│       ├── main.tsx                         # React DOM entry point
│       │
│       ├── audio/
│       │   ├── AudioCaptureEngine.ts        # Single-channel: getUserMedia → AnalyserNode → RAF
│       │   ├── AudioDeviceManager.ts        # enumerateDevices() wrapper
│       │   ├── MultiChannelCaptureEngine.ts # N-channel: getUserMedia → ChannelSplitter → N AnalyserNodes
│       │   └── MultiTrackFileEngine.ts      # File decode → AudioBufferSource → AnalyserNode (silent)
│       │
│       ├── analysis/
│       │   ├── AnalysisEngine.ts            # Per-frame orchestrator: FFT → IssueDetector → IssueSmoothing
│       │   ├── AnalysisAccumulator.ts       # 25s rolling window; median bands, issue persistence counts
│       │   ├── FFTProcessor.ts              # RMS dB, peak dB, 7-band energy averages from Float32Array
│       │   ├── IssueDetector.ts             # Runs all detection rules; returns DetectedIssue[]
│       │   ├── IssueSmoothing.ts            # 4-frame confirm / 90-frame clear temporal filter
│       │   ├── SessionLogger.ts             # In-memory session event log (shown in Session Summary)
│       │   └── rules/index.ts               # ALL_DETECTION_RULES array + IssueType constants
│       │
│       ├── suggestions/
│       │   ├── SuggestionEngine.ts          # Hardware rules first → EQ rules → deduplicate → sort
│       │   └── rules/
│       │       ├── hardwareRules.ts         # Clipping, gain, phantom power, cable check rules
│       │       ├── vocalRules.ts            # EQ rules for male_vocal, female_vocal, speech
│       │       └── instrumentRules.ts       # EQ rules for guitar, bass, keys, drums
│       │
│       ├── mixer/
│       │   ├── MixerProfileLoader.ts        # Loads and indexes all JSON profiles by id
│       │   ├── InstructionMapper.ts         # GenericRecommendation + MixerProfile → MixerActionSet
│       │   └── profiles/
│       │       ├── behringer-x32.json
│       │       ├── behringer-xr18.json
│       │       ├── allen-heath-sq5.json
│       │       ├── soundcraft-ui12.json
│       │       ├── soundcraft-ui16.json
│       │       ├── soundcraft-ui24r.json
│       │       ├── soundcraft-signature-10.json
│       │       ├── mackie-profx10v3.json
│       │       ├── yamaha-mg10xuf.json
│       │       ├── generic-analog.json
│       │       └── generic-digital.json
│       │
│       ├── hooks/
│       │   ├── useAnalysisPipeline.ts       # Single-channel: frames → accumulation → suggestions
│       │   ├── useAudioCapture.ts           # getUserMedia device management for live mode
│       │   ├── useMixerProfile.ts           # Profile selection helper
│       │   ├── useMultiChannelPipeline.ts   # Multi-channel: per-slot engines, RAF, reanalyze
│       │   ├── useMultiTrackImport.ts       # File import: decode, analyze, suggest per track
│       │   └── usePreferences.ts            # IPC preferences load/save
│       │
│       ├── store/
│       │   └── appStore.ts                  # Zustand global state — all actions documented inline
│       │
│       ├── screens/
│       │   ├── SetupScreen.tsx              # Device + mixer + source type configuration
│       │   ├── LiveScreen.tsx               # Single-channel live analysis + session summary
│       │   ├── MultiChannelScreen.tsx       # Preset picker → slot config → live channel matrix
│       │   ├── MultiTrackImportScreen.tsx   # Drop zone → track list → analyze → results grid
│       │   └── SettingsScreen.tsx           # Preferences editor
│       │
│       └── components/
│           ├── Header.tsx                   # Navigation bar
│           ├── ChannelCard.tsx              # Per-channel card: MiniMeter + StatusBadge + SlotSuggestionPanel
│           ├── SpectrumAnalyzer.tsx         # Canvas FFT visualizer (reads latestResultRef — no re-render)
│           ├── SignalMeter.tsx              # RMS / peak level meter
│           ├── RecommendationPanel.tsx      # Suggestion list with Done / Skip buttons
│           ├── MixerInstructions.tsx        # Step-by-step mixer instruction renderer
│           ├── AudioDeviceSelector.tsx
│           ├── MixerSelector.tsx
│           └── SourceTypeSelector.tsx
```

---

## Analysis Pipeline

### 1. Audio Capture

**Single channel** (`AudioCaptureEngine`):

```
getUserMedia({
  audio: { deviceId, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
})
  → MediaStreamSourceNode
    → AnalyserNode (fftSize 4096, smoothing 0.8, range −100 to 0 dBFS)
      → RAF loop → callback(fftData, timeDomain, sampleRate)
```

> Echo cancellation, noise suppression, and auto-gain control are **explicitly disabled** on all capture paths. These browser processing features would corrupt the spectral measurements.

**Multi-channel USB** (`MultiChannelCaptureEngine`):

```
getUserMedia({
  audio: { deviceId, channelCount: { ideal: N, min: 1 }, sampleRate: 48000,
           echoCancellation: false, noiseSuppression: false, autoGainControl: false }
})
  → MediaStreamSourceNode
    → ChannelSplitterNode (actual channels = source.channelCount, may differ from N)
      → AnalyserNode[0]  → fftBuffers[0], timeBuffers[0]
      → AnalyserNode[1]  → fftBuffers[1], timeBuffers[1]
      → ...
      → AnalyserNode[N-1]
        → RAF loop → callback([{ fftData, timeDomain }] × N, sampleRate)
```

The typed buffers (`Float32Array[]`) are **allocated once at start** and reused every frame — no garbage collection pressure during capture.

**File analysis** (`MultiTrackFileEngine`):

```
File.arrayBuffer()
  → tempAudioContext.decodeAudioData()   ← temp context, closed immediately after
    → AudioBuffer stored in _decodedBuffers Map

startAnalysis(trackIds, callback):
  → new AudioContext({ sampleRate: 48000 })  ← one shared context for all tracks
    → AudioBufferSourceNode.start(0, 0, duration)
      ← third arg caps playback to min(file.duration, 120s)
      ← NOT connected to destination — completely silent
      → AnalyserNode
        → RAF loop → callback([{ id, fftData, timeDomain, progress, ended }])
```

### 2. FFT Processing (`FFTProcessor`)

| Metric | Source | Detail |
|--------|--------|--------|
| RMS dB | `getFloatTimeDomainData()` | `√(mean(x²))` across all samples → converted to dB |
| Peak dB | `getFloatTimeDomainData()` | `max(abs(x))` → dB |
| Band averages | `getFloatFrequencyData()` | Mean dBFS of all FFT bins in each frequency range |

**Frequency bands:**

| Band       | Range        | What it captures                          |
|------------|--------------|-------------------------------------------|
| Sub-Bass   | 20–80 Hz     | Rumble, proximity effect, stage noise     |
| Bass       | 80–250 Hz    | Fundamental warmth, muddiness             |
| Low-Mid    | 250–500 Hz   | Boxiness, body resonance                  |
| Mid        | 500–2000 Hz  | Presence, nasality, intelligibility core  |
| Upper-Mid  | 2–4 kHz      | Clarity, attack, harshness               |
| Presence   | 4–8 kHz      | Intelligibility, consonant definition     |
| High       | 8–20 kHz     | Brilliance, sibilance, air               |

### 3. Issue Detection (`IssueDetector`)

The `IssueDetector` runs a registered array of **stateless detection rules** (`ALL_DETECTION_RULES`) on each frame. Every rule receives `(bands, levelDb, peakDb, sourceType)` and returns a `DetectedIssue | null`.

| Issue type     | Detection logic                                                  |
|----------------|------------------------------------------------------------------|
| `rumble`       | Sub-bass > threshold and signal present                         |
| `muddiness`    | Bass and/or low-mid elevated relative to rest of spectrum       |
| `boxiness`     | Low-mid spike relative to neighbouring bands                    |
| `harshness`    | Upper-mid significantly above presence                          |
| `sibilance`    | High band elevated — primarily for vocal source types           |
| `clipping`     | Peak > −1 dBFS                                                  |
| `low_signal`   | RMS below minimum threshold (−60 dBFS default)                  |
| `no_phantom`   | Near-zero signal on a source type that likely needs phantom     |

---

## Issue Smoothing

`IssueSmoothing` prevents transient noise from causing flickering issue badges in the UI.

| Phase | Threshold | Effect |
|-------|-----------|--------|
| **Confirm** | 4 consecutive frames | ~65ms at 60fps — fast enough to feel responsive |
| **Clear** | 90 consecutive absent frames | ~1.5s at 60fps — stable enough to read |

**Algorithm:** Each issue type tracked in a `Map<IssueType, { confirmCount, clearCount, confirmed }>`. An issue "snaps in" after 4 frames of presence and "fades out" after 90 frames of absence. Only `confirmed = true` entries are passed to the accumulator and the UI.

When the source type changes, `IssueSmoothing.reset()` is called — stale issue state from a previous source does not contaminate the new analysis.

---

## Accumulation and Statistics

`AnalysisAccumulator` collects `AnalysisSnapshot` objects during the listening window and produces a time-robust `AccumulatedAnalysis`:

| Field | Computation | Why |
|-------|-------------|-----|
| `bands` | **Median** per band across all signal-present frames | Robust to transients — a single drum hit does not skew the result |
| `averageLevelDb` | Mean RMS across all signal-present frames | Overall gain context |
| `peakLevelDb` | Max peak across all frames | Clipping risk assessment |
| `issuePersistence` | `Map<IssueType, count/n>` (0–1) | Fraction of frames each issue appeared in |
| `clippingPct` | `clipFrames / n` | Frequency of clipping events |
| `signalPct` | `signalFrames / totalFrames` | Detects intermittent / quiet sources |

**Silent frames** advance the wall-clock window but are **not stored** in the snapshot array. The accumulator window is 25 seconds of wall-clock time regardless of how much of that contained signal.

**Minimum signal:** At least 15 signal-present snapshots are required to produce valid suggestions. If fewer are collected (very intermittent source), the window restarts silently.

**`toRepresentativeSnapshot(threshold = 0.4)`** converts the accumulated statistics back into an `AnalysisSnapshot` that existing EQ rules can consume directly. Only issues with persistence ≥ 0.4 (appeared in ≥ 40% of frames) are included.

---

## Suggestion Engine

`SuggestionEngine.generate(accumulator, sourceType)` runs in two sequential phases:

### Phase 1 — Hardware Rules (always run first)

Hardware rules receive the raw `AccumulatedAnalysis` and reason about level statistics, dynamic range, signal presence, and clipping frequency. Examples:

- `clippingPct > 0.1` → `gain_reduce` recommendation
- `averageLevelDb < −50` AND `signalPct < 0.3` → `gain_increase` or `phantom_power`
- Extreme dynamic range → `compression` recommendation

If any hardware rule fires, **EQ rules do not run**. Gain staging must be corrected before EQ is meaningful.

### Phase 2 — EQ Rules (only if no hardware issue)

EQ rules receive the representative snapshot (`persistenceThreshold = 0.4`) and fire based on band relationships. Applicable rules are filtered by `sourceType`:

- **Vocal rules** (`vocalRules.ts`): mud cuts, presence boosts, sibilance control, HPF engagement
- **Instrument rules** (`instrumentRules.ts`): bass definition, mid clarity, drum attack, etc.

### De-duplication and Sorting

If two rules produce a recommendation for the same `relatedIssue + action` combination, the higher-confidence one wins. Final output is sorted by `priority asc, confidence desc`:

| Priority | Category | Examples |
|----------|----------|---------|
| 0–1 | Hardware / gain | Clipping, phantom power, gain change |
| 2+ | EQ | HPF, cuts, boosts, notches |

---

## Instruction Mapper

`InstructionMapper.map(recommendation, profile, channel)` translates a `GenericRecommendation` into a `MixerActionSet` with numbered `MixerInstruction[]` steps.

**For EQ actions (hpf, cut, boost, notch):**
1. Finds the best-matching EQ band in the profile by comparing the target frequency against each band's `frequencyRange`
2. Generates steps using the profile's `instructionTemplates` with `{channel}`, `{band}`, `{frequency}`, `{amount}` placeholders
3. Adds a digital-specific meter check step if `profile.type === 'digital'`

**For non-EQ actions (gain, phantom, pad, mic, cable):**
- Generates technique instructions using the profile's naming conventions
- No EQ band lookup needed
- Phantom power instructions include a "wait 2–3 seconds" step

---

## Multi-Channel Mode

### How the OS Delivers Channels

Digital mixers with USB audio drivers expose themselves to the OS as a **multi-channel audio device**. SoundPilot requests all channels at once:

```typescript
navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId:         { exact: deviceId },
    channelCount:     { ideal: N, min: 1 },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl:  false,
    sampleRate:       48000
  }
})
```

The OS/driver decides how many channels are actually delivered — `source.channelCount` gives the true count, which may be lower than `N`. The UI shows a warning if the actual count is less than what the preset requires.

### Per-Channel Independence

Each active channel slot gets:
- Its own `AnalysisEngine` instance (own `IssueSmoothing` state — no cross-channel contamination)
- Its own `AnalysisAccumulator` instance (own 25-second window)
- Its own `ChannelSlotState` in the store

`SuggestionEngine` is **stateless** — a single shared instance is fine.

### USB Channel Mapping

Every mixer exposes USB channels in a different order. The preset system describes this with two fields:

| Field        | Meaning |
|--------------|---------|
| `usbOffset`  | 0-based index of the first **input** channel in the USB stream |
| `inputCount` | How many input channel slots to auto-generate |

**Examples:**

| Mixer     | `usbOffset` | `inputCount` | Reason |
|-----------|-------------|--------------|--------|
| X32       | 0           | 32           | USB 1 = CH 1 directly |
| Ui24R     | 10          | 22           | USB 1–10 = Main L/R + Aux 1–8, skipped |
| XR18      | 0           | 16           | USB 17–18 = Main L/R, excluded at end |

### Re-analyze Without Restarting

`reanalyzeSlot(slotId)` adds the slot ID to a `pendingReanalyzeRef` Set. On the next RAF tick, the callback checks this Set, resets the slot's accumulator, and restarts the 25-second window — **without stopping audio capture**. The device stays open; only the per-slot analysis state resets.

---

## Multi-Track File Import

### Supported Formats

WAV · AIFF / AIF · FLAC · MP3 · OGG · M4A

Codec availability depends on the Electron runtime's built-in decoders. WAV and FLAC always work. MP3 and M4A require the platform's native decoders (available on Windows 10+ and macOS).

### 120-Second Analysis Cap

A maximum of **120 seconds** is analyzed per track. The correct way to enforce this in the Web Audio API is the `duration` parameter of `AudioBufferSourceNode.start()`:

```typescript
// CORRECT — duration arg caps playback; source is already started
source.start(when: 0, offset: 0, duration: Math.min(buffer.duration, 120))

// WRONG — calling stop() before start() throws DOMException
source.stop(ctx.currentTime + 120)  // ← "cannot call stop without calling start first"
source.start(0)
```

This was a real bug that has been fixed. See [Bugs Fixed](#bugs-fixed).

### Silent Analysis

Files are connected to `AnalyserNode` only — **never** to `AudioContext.destination`. The audio graph runs at real-time speed but produces zero sound output.

All tracks share **one `AudioContext`** so they start on the same timeline. Progress bars reflect actual `AudioContext.currentTime / track.duration`.

### File Objects vs. Store

| What | Where |
|------|-------|
| `ImportTrackConfig` (filename, size, duration, source type, etc.) | Zustand store |
| `File` (the actual bytes) | `fileMapRef: Map<string, File>` inside `useMultiTrackImport` — never in Zustand |

`File` objects are not serializable. Storing them in Zustand would break state consistency. When a track needs to be re-analyzed, the hook retrieves the `File` from the ref using the track's `id` as the key.

### Completion Detection

`source.onended` fires when the `AudioBufferSourceNode` finishes (either naturally or at the capped duration). The RAF callback checks `td.ended` per track. When a track ends:
1. The accumulator produces suggestions immediately (does not wait for `isReady`)
2. Track state updates to `'ready'` with suggestions
3. When all tracks end, the RAF loop exits and the view auto-transitions to the results grid

---

## Mixer Profiles

Each mixer is described by a JSON file in `src/renderer/src/mixer/profiles/`. The profile describes:

- What EQ bands are available (name, type, sweepable/fixed frequency, gain range, Q range)
- Whether an HPF is available and whether it is sweepable
- Instruction template strings with `{placeholder}` tokens
- Whether the mixer has multi-channel USB audio (`usbAudioInterface` field)
- Control notes shown in the UI (e.g. "Solo/PFL workflow required — no multi-channel USB")

### Profile JSON Schema

```jsonc
{
  "id": "behringer-x32",
  "brand": "Behringer",
  "model": "X32",
  "type": "digital",          // "analog" | "digital"
  "channelCount": 32,
  "eqBands": [
    {
      "id": "lf",
      "name": "Low",
      "type": "shelf_low",             // "peaking" | "shelf_low" | "shelf_high" | "hpf" | "lpf"
      "frequencyRange": [20, 400],     // sweepable range [min, max] Hz
      "defaultFrequency": 80,
      "gainRange": [-15, 15]           // [min, max] dB
    },
    {
      "id": "lmf",
      "name": "Low Mid",
      "type": "peaking",
      "frequencyRange": [100, 5000],
      "defaultFrequency": 300,
      "gainRange": [-15, 15],
      "qRange": [0.3, 10],             // Q range — digital desks only
      "defaultQ": 1.0
    }
  ],
  "hpf": {
    "available": true,
    "sweepable": true,
    "frequencyRange": [20, 400]
  },
  "instructionTemplates": {
    "selectChannel":    "Press the SELECT button on Channel {channel}.",
    "openEQ":           "Press the EQ button.",
    "enableHPF":        "Enable the HPF and sweep to {frequency} Hz.",
    "setBandFrequency":  "Select the {band} band and set frequency to {frequency} Hz.",
    "setBandGain":      "Adjust gain to {amount} dB.",
    "saveSettings":     "Your changes are saved automatically."
  },
  "controlNotes": "Optional note shown to the user in the UI."
}
```

### Soundcraft Ui Series

| Model | USB Audio to DAW | Multi-Channel | Notes |
|-------|-----------------|---------------|-------|
| Ui12  | 2-channel only  | No            | Solo/PFL workflow required |
| Ui16  | 2-channel only  | No            | Solo/PFL workflow required |
| Ui24R | 32×32 full interface | Yes       | Windows driver required; Mac class-compliant |

**Ui24R USB channel map (factory default):**

| USB Channels | Content |
|---|---|
| USB 1–2 | Main L/R |
| USB 3–10 | Aux Bus 1–8 |
| USB 11–32 | Input Channels 1–22 |

This is why the Ui24R preset has `usbOffset: 10` — the first 10 channels are buses that SoundPilot skips.

---

## Adding a New Mixer Profile

**1. Create the JSON file:**

```bash
src/renderer/src/mixer/profiles/your-mixer-id.json
```

Follow the schema above. The `id` field must be unique and match the filename.

**2. Register it in `MixerProfileLoader.ts`:**

```typescript
import yourMixer from './profiles/your-mixer-id.json'

// In BUNDLED_PROFILES array:
yourMixer as MixerProfile,
// or if the profile has extra fields (e.g. usbAudioInterface):
yourMixer as unknown as MixerProfile,
```

> The `as unknown as MixerProfile` cast is required when the JSON imports have extra fields that cause TypeScript's strict overlap check to reject a direct `as MixerProfile` cast. The most common cause is the `usbAudioInterface` field combined with TypeScript inferring `frequencyRange` as `number[]` instead of `[number, number]`. This is safe — the profile shape is verified at runtime.

**3. (Optional) Add a multi-channel USB preset** in `src/shared/constants/multichannel-presets.ts`:

```typescript
{
  id:               'your-mixer-id',
  brand:            'Brand',
  model:            'Model Name',
  totalUsbChannels: 32,
  inputCount:       32,      // how many input slots to generate
  usbOffset:        0,       // 0-based index of first input channel in USB stream
  macNoDriver:      true,    // true = class-compliant (no driver install)
  winDriver:        null,    // null = no driver, or 'Driver Package Name'
  winDriverUrl:     null,    // null or download URL string
  routingNote:      'USB 1–32 = CH 1–32 by default.',
  routingWarning:   'Routing is configurable — verify if channels are misaligned.'
}
```

**4. Type-check:**

```bash
npm run typecheck
```

---

## Source Types

Source type controls which EQ detection thresholds and suggestion rules apply.

| Value              | Label                   | Key characteristics |
|--------------------|-------------------------|---------------------|
| `male_vocal`       | Male Vocal              | Mud 300–500 Hz; presence 2–5 kHz; HPF at 100–120 Hz |
| `female_vocal`     | Female Vocal            | Sibilance 6–10 kHz; boxiness 400–600 Hz; HPF at 80–100 Hz |
| `speech`           | Speech / Presenter      | Intelligibility-focused; similar to male_vocal |
| `acoustic_guitar`  | Acoustic Guitar         | Body resonance 200–400 Hz; pick attack 3–5 kHz; air 10kHz+ |
| `electric_guitar`  | Electric Guitar         | Mid-range focus; less sub-bass concern |
| `bass_guitar`      | Bass Guitar             | Sub + bass critical; upper-mid definition for cut-through |
| `keyboard`         | Keyboard / Keys         | Full-range; low-mid density common |
| `drum_overhead`    | Drum Overhead           | Cymbal definition; HF air; HPF at 80 Hz |
| `snare`            | Snare                   | Crack at 200 Hz; body at 1–2 kHz; HPF at 100 Hz |
| `kick`             | Kick Drum               | Sub punch 50–80 Hz; low-mid scoop; beater click 3–5 kHz |
| `general`          | General / Unknown       | Conservative thresholds; broadest rule set |

---

## Preferences

Configurable in the **Settings** screen and persisted to disk via IPC.

| Setting | Default | Description |
|---------|---------|-------------|
| Analysis Refresh Rate | 80 ms | How often meter values update in the UI (~12 fps) |
| Listening Window | 25 s | How long the app accumulates audio before generating suggestions |
| Minimum Signal Threshold | −60 dBFS | Frames below this level are excluded from accumulation |
| Default Channel Number | 1 | Pre-filled mixer channel for new sessions |

---

## IPC Bridge — Electron Security Model

The renderer has **no direct access to Node.js or the filesystem**. All persistence goes through a typed IPC bridge defined in the preload script.

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `sp:get-preferences` | renderer → main | Load preferences from disk |
| `sp:set-preferences` | renderer → main | Save preferences to disk |
| `sp:get-presets` | renderer → main | Load saved presets from disk |
| `sp:save-preset` | renderer → main | Upsert a preset (matched by `id`) |
| `sp:delete-preset` | renderer → main | Remove a preset by `id` |
| `sp:get-app-version` | renderer → main | Read `npm_package_version` from env |

### Bridge API (renderer access via `window.api`)

```typescript
// Exposed by preload via contextBridge.exposeInMainWorld('api', ...)
window.api.getPreferences()                → Promise<Record<string, unknown>>
window.api.setPreferences(prefs)           → Promise<{ ok: boolean }>
window.api.getPresets()                    → Promise<unknown[]>
window.api.savePreset(preset)             → Promise<{ ok: boolean }>
window.api.deletePreset(presetId: string)  → Promise<{ ok: boolean }>
window.api.getAppVersion()                 → Promise<string>
```

> The bridge is exposed as **`window.api`**, not `window.electronAPI`. The type declaration in `src/renderer/src/types/electron.d.ts` augments the `Window` interface accordingly.

---

## State Management Reference

### AppStore Slices

| Slice | Key fields | Key actions |
|-------|-----------|-------------|
| Navigation | `currentScreen: AppScreen` | `navigateTo(screen)` |
| Session | `session: SessionState` | `setSelectedDevice`, `setSelectedMixer`, `setSourceType`, `setChannelNumber` |
| Capture | `isCapturing`, `analysisSnapshot` | `setCapturing`, `updateAnalysis` |
| Suggestions | `suggestionMode`, `listeningProgress`, `suggestions[]` | `setSuggestions`, `markSuggestionDone`, `markSuggestionSkipped`, `triggerReanalyze` |
| Preferences | `preferences: AppPreferences` | `updatePreferences` |
| Presets | `presets: AppPreset[]` | `addPreset`, `removePreset`, `loadPreset` |
| Multi-Channel | `multiChannelActive`, `mcDeviceInfo`, `channelSlots[]`, `channelSlotStates[]` | `loadChannelPreset`, `addChannelSlot`, `updateChannelSlot`, `updateChannelSlotState`, `markChannelSuggestionDone`, `markChannelSuggestionSkipped` |
| Import | `importActive`, `importTracks[]`, `importTrackStates[]` | `addImportTrack`, `removeImportTrack`, `updateImportTrack`, `clearImportTracks`, `updateImportTrackState`, `markImportSuggestionDone`, `markImportSuggestionSkip` |

### AppScreen Type

```typescript
type AppScreen = 'setup' | 'live' | 'multichannel' | 'import' | 'settings'
```

---

## Development

```bash
# Start with hot-reload and DevTools
npm run dev

# Type-check renderer
npx tsc --noEmit

# Type-check renderer + main process
npm run typecheck

# Lint (if configured)
npm run lint
```

### Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@shared/*` | `src/shared/*` |
| `@renderer/*` | `src/renderer/src/*` |

Configured in both `tsconfig.json` (for the TypeScript compiler) and `electron.vite.config.ts` (for the Vite bundler). Both must stay in sync.

### Hot Reload Scope

| What changes | Needs restart? |
|---|---|
| Renderer `.tsx` / `.css` / `.ts` | No — Vite HMR updates instantly |
| Main process (`src/main/`) | Yes — `Ctrl+C` then `npm run dev` |
| Preload (`src/preload/`) | Yes — requires full restart |
| Shared types (`src/shared/`) | No for renderer; Yes for main/preload |

### Adding a Feature Checklist

- [ ] Define types in `src/shared/types/` if shared between processes
- [ ] Add store state + actions in `appStore.ts`
- [ ] Build the engine/hook in `src/renderer/src/audio/` or `hooks/`
- [ ] Wire into a screen component in `src/renderer/src/screens/`
- [ ] Add CSS classes in `App.css`
- [ ] Add a nav item in `Header.tsx` if a new screen is added
- [ ] Wire the screen route in `App.tsx`
- [ ] Run `npm run typecheck` — must exit with zero errors

---

## Build and Distribution

```bash
# Production build (outputs compiled assets to /out)
npm run build

# Build + package an installer (outputs to /dist)
npm run dist
```

Installer configuration lives in `package.json` under the `"build"` key (electron-builder):

| Platform | Output |
|---|---|
| Windows | NSIS installer (`.exe`) |
| macOS | DMG |
| Linux | AppImage + `.deb` |

App ID: `com.soundpilot.app`

> Icons must be placed at `assets/icon.icns` (macOS), `assets/icon.ico` (Windows), and `assets/icon.png` (Linux) before running `npm run dist`.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Desktop shell | Electron 31 | Main + renderer + preload processes |
| UI framework | React 18 | Function components, hooks |
| Language | TypeScript 5.5 | Strict mode; path aliases via tsconfig |
| Build tooling | electron-vite 2 + Vite 5 | HMR in dev; separate bundles for main/preload/renderer |
| State management | Zustand 4 | Single store; no Redux boilerplate |
| Audio capture | Web Audio API | `getUserMedia`, `AnalyserNode`, `ChannelSplitterNode` |
| File decoding | `AudioContext.decodeAudioData()` | Supports all browser-native codecs |
| Styling | Plain CSS | CSS custom properties (variables); dark theme; no CSS-in-JS |
| Persistence | Electron IPC → JSON file | `StorageService` wraps filesystem; renderer never touches disk directly |
| Packaging | electron-builder 24 | Cross-platform installer generation |

No third-party audio processing libraries. All FFT analysis, band computation, and issue detection is implemented directly against the raw `Float32Array` data from the Web Audio `AnalyserNode`.

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| **Fixed listening window** | The app listens for 25 s and generates suggestions. Sources that vary dramatically over time (e.g. a singer with very different registers) may get suggestions that only reflect one phase. Workaround: use Re-analyze to collect a new window. |
| **File import capped at 120 s** | Only the first 120 seconds of each file are analyzed. Trim long recordings before import, or use a DAW to export the most representative section. |
| **No psychoacoustic weighting** | Band averages are energy averages, not A-weighted or Fletcher-Munson weighted. Thresholds are empirical; they may not match formal acoustic standards. |
| **Source type must be correct** | If the wrong source type is selected, thresholds are tuned for the wrong instrument and suggestions will be irrelevant. Always set the correct type. |
| **Multi-channel requires OS driver** | The OS must present the mixer as a multi-channel audio device. Windows requires the manufacturer's USB audio driver. Class-compliant devices work on macOS without a driver. |
| **USB routing is mixer-configurable** | Most digital mixers allow the user to reassign USB channels. If you have changed the factory routing, use the Custom preset and adjust channel indices manually. |
| **No transient detection** | Percussive sources (kick, snare) produce widely varying band averages frame-to-frame. The accumulator's median computation mitigates this, but short signals may not produce reliable suggestions. |
| **Mono analysis only** | The analyser receives a mono-summed signal. Stereo sources are analyzed as their mono mix. For live sound this is correct — mixer channel preamps are always mono. |
| **Sample rate fixed at 48 kHz for multi-channel** | `MultiChannelCaptureEngine` and `MultiTrackFileEngine` both hard-code 48000 Hz to match the Soundcraft Ui24R requirement. Mixers that prefer 44.1 kHz are still analyzed correctly; only the capture rate differs. |

---

## Bugs Fixed

### `AudioBufferSourceNode.stop()` before `start()` (file import)

**Symptom:** Importing any audio file longer than 120 seconds showed the error:
> `Failed to execute 'stop' on 'AudioScheduledSourceNode': cannot call stop without calling start first`

**Root cause:** `MultiTrackFileEngine.startAnalysis()` was calling `source.stop(ctx.currentTime + MAX_ANALYSIS_SECONDS)` on line 181, before `source.start(0)` on line 184. The Web Audio API specification forbids calling `stop()` before `start()`.

**Fix:** Replaced the two calls with a single `source.start(0, 0, duration)` — the third argument to `start()` is the playback duration limit, which is the correct Web Audio API mechanism for capping analysis length.

```typescript
// Before (broken):
source.stop(ctx.currentTime + MAX_ANALYSIS_SECONDS)
source.start(0)

// After (correct):
source.start(0, 0, Math.min(buffer.duration, MAX_ANALYSIS_SECONDS))
```
