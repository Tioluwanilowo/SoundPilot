// Mixer profile types — defines the shape of JSON mixer profiles

export type EQBandType =
  | 'peaking'    // Parametric bell curve (has frequency, gain, Q)
  | 'shelf_low'  // Low shelf (has frequency, gain)
  | 'shelf_high' // High shelf (has frequency, gain)
  | 'hpf'        // Built-in HPF (handled separately via hpf profile field)
  | 'lpf'        // Built-in LPF

/**
 * Defines one EQ band available on the mixer.
 * Analog desks often have fixed or semi-fixed frequencies.
 * Digital desks have fully sweepable parametric bands.
 */
export interface EQBandProfile {
  id: string
  name: string               // Display name, e.g. "High Mid", "Lo", "Band 3"
  type: EQBandType
  // Fixed frequency (shelf, fixed-frequency band)
  frequency?: number
  // Sweepable range [min, max] in Hz
  frequencyRange?: [number, number]
  defaultFrequency?: number
  // Gain range [min, max] in dB
  gainRange?: [number, number]
  // Q range [min, max] — digital desks only
  qRange?: [number, number]
  defaultQ?: number
  // How the gain knob is typically labeled (e.g. "+/-15dB")
  gainLabel?: string
}

/**
 * HPF (high-pass / low-cut) filter profile.
 * Most mixers have a dedicated HPF switch or button.
 */
export interface HPFProfile {
  available: boolean
  // Fixed HPF frequency (analog desks often have one fixed value)
  frequency?: number
  // Selectable HPF frequencies (some analog desks have 2-3 positions)
  frequencies?: number[]
  // Digital desks allow full sweep
  sweepable?: boolean
  frequencyRange?: [number, number]
}

/**
 * Instruction templates are simple strings with {placeholder} tokens.
 * Supported tokens: {channel}, {band}, {frequency}, {amount}, {direction}
 */
export interface InstructionTemplates {
  openEQ?: string
  selectChannel?: string
  enableHPF?: string
  setBandFrequency?: string
  setBandGain?: string
  saveSettings?: string
  generalNote?: string
}

/**
 * USB audio interface capability — present only on mixers that expose
 * a multi-channel USB audio device to the host computer (e.g. Ui24R, X32, SQ5).
 */
export interface UsbAudioInterface {
  supported: boolean
  /** Total USB channels available (e.g. 32 for Ui24R) */
  totalChannels: number
  inputChannels: number
  outputChannels: number
  /** Required sample rate for the USB interface */
  sampleRate?: number
  driverRequired?: {
    windows: boolean
    driverName?: string
    driverUrl?: string
    mac: boolean
    macNote?: string
  }
  /**
   * Human-readable channel map explaining what each USB channel carries.
   * Keys are strings like "usb1", "usb2", "usb11_32"; values are descriptions.
   */
  channelMap?: Record<string, string>
  /** Extra note shown to the user about patching / DAW setup */
  patchingNote?: string
}

/**
 * Full mixer profile — loaded from a JSON file in /profiles/.
 * One file per mixer model.
 */
export interface MixerProfile {
  id: string
  brand: string
  model: string
  // 'analog' = physical knobs; 'digital' = touchscreen/rotary with display
  type: 'analog' | 'digital'
  channelCount?: number
  eqBands: EQBandProfile[]
  hpf: HPFProfile
  // Optional notes shown to the user about this mixer's EQ section
  controlNotes?: string
  instructionTemplates: InstructionTemplates
  // Present only on mixers that support multi-channel USB audio to a DAW
  usbAudioInterface?: UsbAudioInterface
}
