// Standard frequency band definitions and musical EQ reference points

export const FREQ_BANDS = {
  SUB_BASS:   { low: 20,    high: 80    },
  BASS:       { low: 80,    high: 250   },
  LOW_MID:    { low: 250,   high: 500   },
  MID:        { low: 500,   high: 2000  },
  UPPER_MID:  { low: 2000,  high: 5000  },
  PRESENCE:   { low: 4000,  high: 8000  },
  HIGH:       { low: 8000,  high: 20000 }
} as const

// Common EQ problem frequencies with descriptions
export const PROBLEM_FREQUENCIES = {
  HANDLING_NOISE: 30,    // Mic handling / vibration noise
  HVAC_RUMBLE:    50,    // HVAC hum (US 60Hz, EU 50Hz)
  PROXIMITY_BOOM: 100,   // Proximity effect on close-mic vocals
  MUDDY_LOW_MID:  250,   // Classic muddiness zone
  BOXY_MID:       400,   // Boxy, nasal quality
  HARSH_UPPER:    3500,  // Harshness center
  PRESENCE_DIP:   5000,  // Presence / intelligibility boost point
  AIR:            12000  // Airy brilliance
} as const

// dBFS thresholds for level monitoring
export const LEVEL_THRESHOLDS = {
  CLIP:       -0.5,   // Clipping risk (red zone)
  WARNING:    -6,     // Approaching clip (orange zone)
  HEALTHY:    -18,    // Good signal level (green zone)
  LOW:        -40,    // Low signal (yellow zone)
  SILENCE:    -60     // Effectively silent — pause analysis
} as const

// Frequency labels for spectrum display
export const SPECTRUM_LABELS: [number, string][] = [
  [20,    '20'],
  [50,    '50'],
  [100,   '100'],
  [200,   '200'],
  [500,   '500'],
  [1000,  '1k'],
  [2000,  '2k'],
  [5000,  '5k'],
  [10000, '10k'],
  [20000, '20k']
]
