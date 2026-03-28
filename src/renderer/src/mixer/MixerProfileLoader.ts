import type { MixerProfile } from '@shared/types'

// ── Bundled mixer profiles ─────────────────────────────────────────────────
// To add a new mixer: create a JSON file in /profiles/ and add it here.
// The JSON must conform to the MixerProfile type in mixer.types.ts.
import yamahamg10xuf        from './profiles/yamaha-mg10xuf.json'
import behringerx32         from './profiles/behringer-x32.json'
import allenheathsq5        from './profiles/allen-heath-sq5.json'
import behringerxr18        from './profiles/behringer-xr18.json'
import soundcraftSignature10 from './profiles/soundcraft-signature-10.json'
import soundcraftUi12        from './profiles/soundcraft-ui12.json'
import soundcraftUi16        from './profiles/soundcraft-ui16.json'
import soundcraftUi24r       from './profiles/soundcraft-ui24r.json'
import mackieProfx10v3      from './profiles/mackie-profx10v3.json'
import genericAnalog        from './profiles/generic-analog.json'
import genericDigital       from './profiles/generic-digital.json'

const BUNDLED_PROFILES: MixerProfile[] = [
  // ── Digital consoles ──────────────────────────────────────────────────────
  behringerx32         as MixerProfile,
  allenheathsq5        as MixerProfile,
  behringerxr18        as MixerProfile,
  // ── Soundcraft UI series ──────────────────────────────────────────────────
  soundcraftUi24r      as unknown as MixerProfile,
  soundcraftUi16       as MixerProfile,
  soundcraftUi12       as MixerProfile,
  // ── Analog consoles ───────────────────────────────────────────────────────
  yamahamg10xuf        as MixerProfile,
  soundcraftSignature10 as MixerProfile,
  mackieProfx10v3      as MixerProfile,
  // ── Generic fallbacks ─────────────────────────────────────────────────────
  genericAnalog        as MixerProfile,
  genericDigital       as MixerProfile
]

/**
 * MixerProfileLoader — provides access to all registered mixer profiles.
 *
 * Profiles are bundled at build time as JSON.
 * Future: IPC-based file picker to load user-supplied profiles from disk.
 */
export class MixerProfileLoader {
  private profiles: Map<string, MixerProfile>

  constructor() {
    this.profiles = new Map()
    for (const p of BUNDLED_PROFILES) {
      this.profiles.set(p.id, p)
    }
  }

  getAll(): MixerProfile[] {
    return Array.from(this.profiles.values())
  }

  getById(id: string): MixerProfile | null {
    return this.profiles.get(id) ?? null
  }

  getGroupedByBrand(): Map<string, MixerProfile[]> {
    const grouped = new Map<string, MixerProfile[]>()
    for (const p of this.profiles.values()) {
      const list = grouped.get(p.brand) ?? []
      list.push(p)
      grouped.set(p.brand, list)
    }
    return grouped
  }
}

export const mixerProfileLoader = new MixerProfileLoader()
