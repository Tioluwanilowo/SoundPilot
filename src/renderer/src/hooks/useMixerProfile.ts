import { useMemo } from 'react'
import { mixerProfileLoader } from '../mixer/MixerProfileLoader'
import { useAppStore } from '../store/appStore'
import type { MixerProfile } from '@shared/types'

/**
 * useMixerProfile — provides access to the currently selected mixer profile
 * and the full list of available profiles.
 */
export function useMixerProfile() {
  const selectedMixerProfileId = useAppStore(s => s.session.selectedMixerProfileId)

  const allProfiles: MixerProfile[] = useMemo(() => mixerProfileLoader.getAll(), [])

  const selectedProfile: MixerProfile | null = useMemo(() => {
    if (!selectedMixerProfileId) return null
    return mixerProfileLoader.getById(selectedMixerProfileId)
  }, [selectedMixerProfileId])

  const groupedProfiles = useMemo(() => {
    const grouped: Record<string, MixerProfile[]> = {}
    for (const p of allProfiles) {
      if (!grouped[p.brand]) grouped[p.brand] = []
      grouped[p.brand].push(p)
    }
    return grouped
  }, [allProfiles])

  return { allProfiles, selectedProfile, groupedProfiles }
}
