import type { GenericRecommendation, MixerActionSet, MixerInstruction, MixerProfile, EQBandProfile } from '@shared/types'

/**
 * InstructionMapper — translates a GenericRecommendation into mixer-specific,
 * step-by-step instructions.
 *
 * Handles two broad categories:
 *
 *   EQ actions (hpf, lpf, cut, boost, notch):
 *     Uses the mixer profile to find the best band, sets frequency and gain.
 *
 *   Non-EQ actions (gain_reduce, gain_increase, phantom_power, pad,
 *                   mic_position, check_cable, check_gain_structure, compression):
 *     Generates concrete mixer-specific or technique instructions that don't
 *     depend on the EQ section. Uses the mixer's naming conventions where known.
 */
export class InstructionMapper {
  map(
    recommendation: GenericRecommendation,
    profile: MixerProfile,
    channel: number
  ): MixerActionSet {
    const steps: MixerInstruction[] = []
    let step = 1

    const action = recommendation.action

    // ── Non-EQ actions ────────────────────────────────────────────────────────
    if (action === 'gain_reduce' || action === 'gain_increase') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      const direction  = action === 'gain_reduce' ? 'counter-clockwise (reduce)' : 'clockwise (increase)'
      const targetText = action === 'gain_reduce'
        ? 'Reduce the GAIN / TRIM knob until the channel clip indicator no longer lights up and the signal peaks around -18 to -12 dBFS.'
        : 'Increase the GAIN / TRIM knob until the signal averages around -18 to -12 dBFS on the meter.'
      steps.push({ step: step++, text: `Turn the GAIN (or TRIM) knob on CH ${channel} ${direction}.`, detail: targetText })
      if (profile.type === 'digital') {
        steps.push({ step: step++, text: 'Check the channel meter — peaks should stay in the green/yellow zone, never red.', detail: 'A good working level is around -18 to -12 dBFS average' })
      }
    }

    else if (action === 'pad') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      steps.push({ step: step++, text: `Engage the PAD switch on CH ${channel}.`, detail: 'The PAD (usually -20 dB) reduces the input sensitivity — use it when the source is too hot for the preamp at minimum gain.' })
      steps.push({ step: step++, text: `After engaging the PAD, turn the GAIN knob back up to a usable level.`, detail: 'Aim for peaks around -18 to -12 dBFS' })
    }

    else if (action === 'phantom_power') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      const phantomInstruction = profile.type === 'digital'
        ? `On CH ${channel}, navigate to the preamp / channel settings and enable the +48V phantom power option.`
        : `Find the +48V or PHANTOM button on CH ${channel} (or a global phantom switch for the channel bank) and enable it.`
      steps.push({ step: step++, text: phantomInstruction, detail: 'Only required for condenser microphones. Safe to leave on for most sources.' })
      steps.push({ step: step++, text: 'Wait 2–3 seconds, then check the signal level again.', detail: 'Condenser mics need a moment to charge after phantom power is enabled.' })
    }

    else if (action === 'mic_position') {
      steps.push({ step: step++, text: 'No mixer adjustment needed — this is a microphone technique change.', detail: recommendation.reason })
      steps.push({ step: step++, text: 'After repositioning the microphone, start a new analysis to re-check the signal.', detail: 'The effect on the spectrum should be immediate.' })
    }

    else if (action === 'check_cable') {
      steps.push({ step: step++, text: 'Check the XLR or instrument cable between the source and the mixer.', detail: 'Look for bent pins, a loose barrel connector, or damage near the ends of the cable.' })
      steps.push({ step: step++, text: 'Try swapping the cable with a known-good cable and check if the signal stabilises.', detail: 'Intermittent connections are often caused by worn cable strain relief near the plug.' })
      steps.push({ step: step++, text: `Check the channel insert (if in use) on CH ${channel} — a half-plugged insert jack will mute or corrupt the signal.` })
    }

    else if (action === 'compression') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      if (profile.type === 'digital') {
        steps.push({ step: step++, text: `On CH ${channel}, open the Dynamics / Compressor section.`, detail: 'Typically found in the channel processing view on digital desks.' })
        steps.push({ step: step++, text: 'Set the compressor ratio to 3:1 or 4:1.', detail: 'This is a gentle starting point — prevents extreme peaks without over-squashing the signal.' })
        steps.push({ step: step++, text: `Set the threshold to approximately ${recommendation.reason.match(/-?\d+ dBFS/) ? recommendation.reason.match(/-?\d+ dBFS/)![0] : '-18 dBFS'}.`, detail: 'Adjust so the gain reduction meter shows about 3–6 dB of compression on peaks.' })
        steps.push({ step: step++, text: 'Set attack to ~10ms and release to ~100ms as a starting point.', detail: 'Fast attack kills transients; slow release causes pumping. These are safe musical defaults.' })
        steps.push({ step: step++, text: 'Enable the compressor and add 2–3 dB of make-up gain if the overall level dropped.', detail: 'Use your ears — the goal is consistency, not loudness.' })
      } else {
        steps.push({ step: step++, text: `If the mixer has an insert on CH ${channel}, patch an outboard compressor in the insert loop.`, detail: 'Most analog desk compressor usage is via the insert send/return.' })
        steps.push({ step: step++, text: 'Start with ratio 3:1–4:1, threshold around -18 dBFS, attack 10ms, release 100ms.' })
      }
    }

    else if (action === 'check_gain_structure') {
      steps.push({ step: step++, text: 'Review the gain structure across the channel.', detail: recommendation.reason })
      steps.push({ step: step++, text: `On CH ${channel}, set the source gain so that peaks hit around -18 to -12 dBFS.`, detail: 'This leaves 12–18 dB of headroom before clipping.' })
    }

    else if (action === 'gate') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      const gp = recommendation.gateParams
      if (profile.type === 'digital') {
        steps.push({ step: step++, text: `On CH ${channel}, open the Dynamics / Gate section.`, detail: 'Typically found alongside the compressor in the channel processing view.' })
        if (gp) {
          steps.push({ step: step++, text: `Set Threshold to ${gp.threshold} dBFS.`, detail: 'Gate opens when signal exceeds this level, closes during silence.' })
          steps.push({ step: step++, text: `Set Ratio to ${gp.ratio}:1, Knee ${gp.knee} dB, Mix ${gp.mix}%.` })
          steps.push({ step: step++, text: `Set Attack ${gp.attack} ms, Hold ${gp.hold} ms, Release ${gp.release} ms.`, detail: 'Hold prevents chattering during brief pauses; Release controls how fast the gate closes.' })
        }
        steps.push({ step: step++, text: 'Enable the gate and verify it closes cleanly during silences without cutting off notes.' })
      } else {
        steps.push({ step: step++, text: `If CH ${channel} has an insert, patch an outboard gate unit in the insert loop.` })
        if (gp) {
          steps.push({ step: step++, text: `Set threshold to approximately ${gp.threshold} dBFS, attack ${gp.attack} ms, release ${gp.release} ms.` })
        }
      }
    }

    else if (action === 'limit') {
      steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel ?? 'Locate Channel {channel}', { channel }) })
      const lp = recommendation.limiterParams
      if (profile.type === 'digital') {
        steps.push({ step: step++, text: `On CH ${channel}, find the Limiter section (may be inside Dynamics or as a separate processor).` })
        if (lp) {
          steps.push({ step: step++, text: `Set Threshold to ${lp.threshold} dBFS.`, detail: 'This acts as a hard ceiling — no signal will pass above this level.' })
          steps.push({ step: step++, text: `Set Attack to ${lp.attack} ms and Hold to ${lp.hold} ms.`, detail: 'Very fast attack ensures no transient peaks escape the limiter.' })
        }
        steps.push({ step: step++, text: 'Enable the limiter and check that the gain reduction meter catches occasional peaks only — not constant reduction.' })
      } else {
        steps.push({ step: step++, text: `On an analog desk, use the channel insert to patch a limiter (set threshold to ${lp ? lp.threshold : '-3'} dBFS).` })
      }
    }

    // ── EQ actions ────────────────────────────────────────────────────────────
    else {
      // Step 1: Select channel
      if (profile.instructionTemplates.selectChannel) {
        steps.push({ step: step++, text: this.fill(profile.instructionTemplates.selectChannel, { channel }) })
      }
      // Step 2: Open EQ
      if (profile.instructionTemplates.openEQ) {
        steps.push({ step: step++, text: this.fill(profile.instructionTemplates.openEQ, { channel }) })
      }

      if (action === 'hpf') {
        if (profile.hpf.available && profile.instructionTemplates.enableHPF) {
          const hpfFreq = profile.hpf.sweepable
            ? (recommendation.frequency ?? 100)
            : (profile.hpf.frequency ?? profile.hpf.frequencies?.[0] ?? 100)
          steps.push({
            step: step++,
            text: this.fill(profile.instructionTemplates.enableHPF, { channel, frequency: Math.round(hpfFreq) }),
            detail: profile.hpf.sweepable
              ? `Set the HPF cutoff to ${Math.round(hpfFreq)} Hz`
              : `Fixed HPF at ${hpfFreq} Hz — just enable the switch`
          })
        } else {
          steps.push({ step: step++, text: `Enable the high-pass filter (low-cut) on CH ${channel}` })
        }
      } else {
        const bestBand = this.findBestBand(profile, recommendation.frequency ?? 1000)
        if (bestBand) {
          const isFixed = bestBand.frequency !== undefined && !bestBand.frequencyRange
          if (!isFixed && profile.instructionTemplates.setBandFrequency && recommendation.frequency) {
            steps.push({
              step: step++,
              text: this.fill(profile.instructionTemplates.setBandFrequency, {
                band: bestBand.name,
                frequency: Math.round(recommendation.frequency),
                channel
              }),
              detail: bestBand.frequencyRange
                ? `This band sweeps ${bestBand.frequencyRange[0]}–${bestBand.frequencyRange[1]} Hz`
                : undefined
            })
          }
          if (recommendation.amount !== undefined && profile.instructionTemplates.setBandGain) {
            const clamped = bestBand.gainRange
              ? Math.max(bestBand.gainRange[0], Math.min(bestBand.gainRange[1], recommendation.amount))
              : recommendation.amount
            const direction = clamped >= 0 ? 'clockwise (boost)' : 'counter-clockwise (cut)'
            steps.push({
              step: step++,
              text: this.fill(profile.instructionTemplates.setBandGain, {
                band:      bestBand.name,
                amount:    Math.abs(clamped).toFixed(1),
                direction,
                channel
              }),
              detail: `Target: ${clamped > 0 ? '+' : ''}${clamped.toFixed(1)} dB at ${Math.round(recommendation.frequency ?? 0)} Hz`
            })
          }
          if (profile.type === 'digital' && bestBand.qRange && recommendation.bandwidth) {
            const q = this.bandwidthToQ(recommendation.bandwidth)
            steps.push({ step: step++, text: `Set Q on ${bestBand.name} to approximately ${q.toFixed(1)}`, detail: `Q ${q.toFixed(1)} = ${recommendation.bandwidth} bandwidth` })
          }
          if (isFixed) {
            steps.push({ step: step++, text: `Note: ${bestBand.name} is fixed at ${bestBand.frequency} Hz on this mixer`, detail: `Target was ${Math.round(recommendation.frequency ?? 0)} Hz — this is the closest available band` })
          }
        }
      }

      if (profile.type === 'digital' && profile.instructionTemplates.saveSettings) {
        steps.push({ step: step++, text: this.fill(profile.instructionTemplates.saveSettings, { channel }) })
      }
    }

    return {
      recommendationId: recommendation.id,
      mixerProfileId:   profile.id,
      mixerName:        `${profile.brand} ${profile.model}`,
      channel,
      action:           recommendation.action,
      frequency:        recommendation.frequency,
      amount:           recommendation.amount,
      reason:           recommendation.reason,
      instructions:     steps
    }
  }

  private findBestBand(profile: MixerProfile, targetFreq: number): EQBandProfile | null {
    const sweepable = profile.eqBands.filter(b =>
      b.frequencyRange &&
      b.frequencyRange[0] <= targetFreq &&
      b.frequencyRange[1] >= targetFreq
    )
    if (sweepable.length > 0) {
      return sweepable.reduce((best, band) => {
        const bc = ((best.frequencyRange?.[0] ?? 0) + (best.frequencyRange?.[1] ?? 0)) / 2
        const bdc = ((band.frequencyRange?.[0] ?? 0) + (band.frequencyRange?.[1] ?? 0)) / 2
        return Math.abs(bdc - targetFreq) < Math.abs(bc - targetFreq) ? band : best
      })
    }
    const withFreq = profile.eqBands.filter(b => b.frequency !== undefined)
    if (withFreq.length === 0) return profile.eqBands[0] ?? null
    return withFreq.reduce((best, band) => {
      return Math.abs((band.frequency ?? 0) - targetFreq) < Math.abs((best.frequency ?? 0) - targetFreq) ? band : best
    })
  }

  private bandwidthToQ(bandwidth: string): number {
    switch (bandwidth) {
      case 'narrow': return 4.0
      case 'medium': return 2.0
      case 'wide':   return 0.7
      case 'shelf':  return 0.7
      default:       return 2.0
    }
  }

  private fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const val = values[key]
      return val !== undefined ? String(val) : `{${key}}`
    })
  }
}

export const instructionMapper = new InstructionMapper()
