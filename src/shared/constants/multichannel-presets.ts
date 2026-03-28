/**
 * Multi-channel quick-setup presets.
 *
 * Each preset describes how a specific mixer exposes its input channels
 * over USB audio to the host computer. The key fields are:
 *
 *   usbOffset   — 0-based index of the FIRST input channel in the USB stream.
 *                 e.g. Ui24R = 10 (USB inputs 1–10 are master/aux buses)
 *                      X32   = 0  (USB input 1 = CH 1 directly)
 *
 *   inputCount  — number of individual input channels to create slots for.
 *
 * USB routing on digital mixers is often configurable by the user. The notes
 * field describes the DEFAULT routing shipped from the factory. If a user has
 * changed their USB routing, they should use the Manual / Custom option instead.
 */

export interface MultiChannelPreset {
  id:           string
  brand:        string
  model:        string
  /** Total USB channels the device exposes (for reference / display) */
  totalUsbChannels: number
  /** Number of individual input channel slots to generate */
  inputCount:   number
  /** 0-based index of the first input channel in the USB audio stream */
  usbOffset:    number
  /** True = class-compliant, no driver install needed on Mac */
  macNoDriver:  boolean
  /** True = class-compliant or has a standard driver on Windows */
  winDriver:    string | null   // null = class-compliant (no install)
  winDriverUrl: string | null
  /** One-line note about USB channel routing shown in the UI */
  routingNote:  string
  /** Extra warning shown if USB routing is user-configurable */
  routingWarning?: string
}

export const MULTI_CHANNEL_PRESETS: MultiChannelPreset[] = [

  // ── Soundcraft UI series ─────────────────────────────────────────────────

  {
    id:               'soundcraft-ui24r',
    brand:            'Soundcraft',
    model:            'Ui24R',
    totalUsbChannels: 32,
    inputCount:       22,
    usbOffset:        10,
    macNoDriver:      true,
    winDriver:        'Soundcraft Multi-Channel USB Audio Driver',
    winDriverUrl:     'https://www.soundcraft.com/en-US/softwares/multi-channelusbaudio_driversetup_v3-23-0',
    routingNote:      'USB 1–10 = Main L/R + Aux 1–8 (skipped). USB 11–32 = Input CH 1–22.'
  },

  // ── Behringer X32 / Midas M32 family ─────────────────────────────────────

  {
    id:               'behringer-x32',
    brand:            'Behringer',
    model:            'X32 / X32 Compact / X32 Producer',
    totalUsbChannels: 32,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Behringer X-USB Driver',
    winDriverUrl:     'https://www.behringer.com/product.html?modelCode=P0ASF',
    routingNote:      'USB 1–32 = CH 1–32 by default. Configurable in Setup > Config > USB Routing.',
    routingWarning:   'X32 USB routing is user-configurable. Adjust USB channel indices below if you have changed the default routing.'
  },

  {
    id:               'behringer-x32-rack',
    brand:            'Behringer',
    model:            'X32 Rack / X32 Core',
    totalUsbChannels: 32,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Behringer X-USB Driver',
    winDriverUrl:     'https://www.behringer.com/product.html?modelCode=P0ASF',
    routingNote:      'USB 1–32 = CH 1–32 by default. Configurable in Setup > Config > USB Routing.',
    routingWarning:   'USB routing is configurable. Verify USB Routing in Setup if channels are misaligned.'
  },

  {
    id:               'midas-m32',
    brand:            'Midas',
    model:            'M32 / M32R / M32C / M32 Live',
    totalUsbChannels: 32,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Midas M32 USB Driver (same as Behringer X-USB)',
    winDriverUrl:     'https://www.midasconsoles.com/product.html?modelCode=P0B6J',
    routingNote:      'USB 1–32 = CH 1–32 by default. Same USB routing architecture as the Behringer X32.',
    routingWarning:   'USB routing is configurable in Setup > Config > USB Routing. Verify if channels are misaligned.'
  },

  // ── Behringer XR series (class-compliant) ─────────────────────────────────

  {
    id:               'behringer-xr18',
    brand:            'Behringer',
    model:            'XR18',
    totalUsbChannels: 18,
    inputCount:       16,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Class-compliant — no driver needed on Mac or Windows. USB 1–16 = CH 1–16. USB 17–18 = Main L/R (excluded).'
  },

  {
    id:               'behringer-xr16',
    brand:            'Behringer',
    model:            'XR16',
    totalUsbChannels: 16,
    inputCount:       12,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Class-compliant. USB 1–12 = CH 1–12. USB 13–16 = Stereo return channels (excluded).'
  },

  {
    id:               'behringer-xr12',
    brand:            'Behringer',
    model:            'XR12',
    totalUsbChannels: 12,
    inputCount:       8,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Class-compliant. USB 1–8 = CH 1–8. USB 9–12 = Stereo returns (excluded).'
  },

  // ── Allen & Heath SQ series ───────────────────────────────────────────────

  {
    id:               'allen-heath-sq5',
    brand:            'Allen & Heath',
    model:            'SQ-5',
    totalUsbChannels: 48,
    inputCount:       24,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Allen & Heath USB Audio Driver',
    winDriverUrl:     'https://www.allen-heath.com/hardware/sq/sq-5/',
    routingNote:      'USB 1–24 = Input CH 1–24 (default). Routing configurable in I/O Patch > USB.',
    routingWarning:   'SQ USB routing is fully configurable. Verify routing in I/O Patch > USB if channels do not match.'
  },

  {
    id:               'allen-heath-sq6',
    brand:            'Allen & Heath',
    model:            'SQ-6',
    totalUsbChannels: 48,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Allen & Heath USB Audio Driver',
    winDriverUrl:     'https://www.allen-heath.com/hardware/sq/sq-6/',
    routingNote:      'USB 1–32 = Input CH 1–32 (default). Routing configurable in I/O Patch > USB.',
    routingWarning:   'SQ USB routing is fully configurable. Verify routing if channels do not match.'
  },

  {
    id:               'allen-heath-sq7',
    brand:            'Allen & Heath',
    model:            'SQ-7',
    totalUsbChannels: 64,
    inputCount:       48,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Allen & Heath USB Audio Driver',
    winDriverUrl:     'https://www.allen-heath.com/hardware/sq/sq-7/',
    routingNote:      'USB 1–48 = Input CH 1–48 (default). Routing configurable in I/O Patch > USB.',
    routingWarning:   'SQ USB routing is fully configurable. Verify routing if channels do not match.'
  },

  {
    id:               'allen-heath-avantis',
    brand:            'Allen & Heath',
    model:            'Avantis',
    totalUsbChannels: 64,
    inputCount:       64,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Allen & Heath USB Audio Driver',
    winDriverUrl:     'https://www.allen-heath.com/hardware/avantis/',
    routingNote:      'USB 1–64 = Input CH 1–64 (default). Routing configurable via I/O Patch.',
    routingWarning:   'USB routing is configurable. Verify patch if channels do not align.'
  },

  // ── PreSonus StudioLive series ────────────────────────────────────────────

  {
    id:               'presonus-studiolive-32s',
    brand:            'PreSonus',
    model:            'StudioLive 32S / 32SX',
    totalUsbChannels: 34,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        'PreSonus Universal Control (includes USB driver)',
    winDriverUrl:     'https://legacy.presonus.com/products/universal-control',
    routingNote:      'USB 1–32 = CH 1–32. USB 33–34 = Main L/R. Mac: class-compliant via USB-C. Windows: install Universal Control.'
  },

  {
    id:               'presonus-studiolive-32r',
    brand:            'PreSonus',
    model:            'StudioLive 32R',
    totalUsbChannels: 34,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        'PreSonus Universal Control',
    winDriverUrl:     'https://legacy.presonus.com/products/universal-control',
    routingNote:      'USB 1–32 = CH 1–32. USB 33–34 = Main L/R.'
  },

  {
    id:               'presonus-studiolive-24r',
    brand:            'PreSonus',
    model:            'StudioLive 24R',
    totalUsbChannels: 26,
    inputCount:       24,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        'PreSonus Universal Control',
    winDriverUrl:     'https://legacy.presonus.com/products/universal-control',
    routingNote:      'USB 1–24 = CH 1–24. USB 25–26 = Main L/R.'
  },

  {
    id:               'presonus-studiolive-16r',
    brand:            'PreSonus',
    model:            'StudioLive 16R',
    totalUsbChannels: 18,
    inputCount:       16,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        'PreSonus Universal Control',
    winDriverUrl:     'https://legacy.presonus.com/products/universal-control',
    routingNote:      'USB 1–16 = CH 1–16. USB 17–18 = Main L/R.'
  },

  // ── Yamaha TF series ──────────────────────────────────────────────────────

  {
    id:               'yamaha-tf5',
    brand:            'Yamaha',
    model:            'TF5',
    totalUsbChannels: 33,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Yamaha Steinberg USB Driver',
    winDriverUrl:     'https://usa.yamaha.com/support/updates/tf_win_driver.html',
    routingNote:      'USB 1–32 = CH 1–32. USB 33 = Stereo Main (mono-summed). Requires Yamaha Steinberg USB driver on both Mac and Windows.',
    routingWarning:   'TF USB routing must be enabled in Setup > USB Setup > USB OUT.'
  },

  {
    id:               'yamaha-tf3',
    brand:            'Yamaha',
    model:            'TF3',
    totalUsbChannels: 25,
    inputCount:       24,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Yamaha Steinberg USB Driver',
    winDriverUrl:     'https://usa.yamaha.com/support/updates/tf_win_driver.html',
    routingNote:      'USB 1–24 = CH 1–24. USB 25 = Stereo Main. Requires Yamaha Steinberg USB driver.',
    routingWarning:   'Enable USB routing in Setup > USB Setup > USB OUT on the TF3.'
  },

  {
    id:               'yamaha-tf1',
    brand:            'Yamaha',
    model:            'TF1',
    totalUsbChannels: 17,
    inputCount:       16,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Yamaha Steinberg USB Driver',
    winDriverUrl:     'https://usa.yamaha.com/support/updates/tf_win_driver.html',
    routingNote:      'USB 1–16 = CH 1–16. USB 17 = Stereo Main. Requires Yamaha Steinberg USB driver.',
    routingWarning:   'Enable USB routing in Setup > USB Setup > USB OUT on the TF1.'
  },

  // ── QSC TouchMix series ───────────────────────────────────────────────────

  {
    id:               'qsc-touchmix-30-pro',
    brand:            'QSC',
    model:            'TouchMix-30 Pro',
    totalUsbChannels: 32,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'QSC TouchMix USB Driver',
    winDriverUrl:     'https://www.qsc.com/resource-files/software/touchmix_pc_driver.exe',
    routingNote:      'USB 1–32 = CH 1–32 input channels. Requires QSC USB driver on Windows.'
  },

  {
    id:               'qsc-touchmix-16',
    brand:            'QSC',
    model:            'TouchMix-16',
    totalUsbChannels: 16,
    inputCount:       16,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'QSC TouchMix USB Driver',
    winDriverUrl:     'https://www.qsc.com/resource-files/software/touchmix_pc_driver.exe',
    routingNote:      'USB 1–16 = CH 1–16 input channels.'
  },

  // ── Mackie DL series ──────────────────────────────────────────────────────

  {
    id:               'mackie-dl32r',
    brand:            'Mackie',
    model:            'DL32R / DL32S',
    totalUsbChannels: 32,
    inputCount:       32,
    usbOffset:        0,
    macNoDriver:      false,
    winDriver:        'Mackie DL USB Driver',
    winDriverUrl:     'https://mackie.com/en/support-login/drivers',
    routingNote:      'USB 1–32 = CH 1–32 input channels. Requires Mackie USB driver on Windows.'
  },

  // ── TASCAM Model series ───────────────────────────────────────────────────

  {
    id:               'tascam-model-24',
    brand:            'TASCAM',
    model:            'Model 24',
    totalUsbChannels: 22,
    inputCount:       20,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Class-compliant. USB 1–20 = CH 1–20 input channels. USB 21–22 = Stereo return bus (excluded).'
  },

  {
    id:               'tascam-model-16',
    brand:            'TASCAM',
    model:            'Model 16',
    totalUsbChannels: 16,
    inputCount:       14,
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Class-compliant. USB 1–14 = CH 1–14 input channels. USB 15–16 = Stereo return (excluded).'
  },

  // ── Generic / Custom ─────────────────────────────────────────────────────

  {
    id:               'custom',
    brand:            'Custom',
    model:            'Manual Setup',
    totalUsbChannels: 32,
    inputCount:       0,     // 0 = user sets their own count
    usbOffset:        0,
    macNoDriver:      true,
    winDriver:        null,
    winDriverUrl:     null,
    routingNote:      'Manually configure USB channel indices and mixer channel numbers for your specific device and routing setup.'
  }
]

/** Group presets by brand for the UI picker */
export function getPresetsByBrand(): Map<string, MultiChannelPreset[]> {
  const map = new Map<string, MultiChannelPreset[]>()
  for (const p of MULTI_CHANNEL_PRESETS) {
    const list = map.get(p.brand) ?? []
    list.push(p)
    map.set(p.brand, list)
  }
  return map
}

export function getPresetById(id: string): MultiChannelPreset | undefined {
  return MULTI_CHANNEL_PRESETS.find(p => p.id === id)
}
