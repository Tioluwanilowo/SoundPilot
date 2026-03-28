import { FREQ_BANDS } from '@shared/constants/frequencies'
import type { FrequencyBands } from '@shared/types'

/**
 * FFTProcessor — converts raw FFT data from the Web Audio AnalyserNode
 * into frequency band energy values (dBFS) used by the IssueDetector.
 *
 * Input: Float32Array from AnalyserNode.getFloatFrequencyData()
 *   - Length = fftSize / 2 (frequencyBinCount)
 *   - Values: dBFS (negative numbers; 0 = full scale; -Infinity = silence)
 *   - Bin i → frequency = i * sampleRate / fftSize
 *
 * Implementation note: We average dB values directly within each band.
 * For rigorous energy averaging you would convert to linear, average, and
 * convert back. Direct dB averaging is a simplification that works well
 * enough for coarse issue detection and is much cheaper computationally.
 */
export class FFTProcessor {
  computeBands(fftData: Float32Array<ArrayBuffer>, sampleRate: number): FrequencyBands {
    // frequencyBinCount = fftSize/2, so fftSize = frequencyBinCount * 2
    const freqPerBin = sampleRate / (fftData.length * 2)

    return {
      subBass:   this.bandAverage(fftData, freqPerBin, FREQ_BANDS.SUB_BASS.low,   FREQ_BANDS.SUB_BASS.high),
      bass:      this.bandAverage(fftData, freqPerBin, FREQ_BANDS.BASS.low,       FREQ_BANDS.BASS.high),
      lowMid:    this.bandAverage(fftData, freqPerBin, FREQ_BANDS.LOW_MID.low,    FREQ_BANDS.LOW_MID.high),
      mid:       this.bandAverage(fftData, freqPerBin, FREQ_BANDS.MID.low,        FREQ_BANDS.MID.high),
      upperMid:  this.bandAverage(fftData, freqPerBin, FREQ_BANDS.UPPER_MID.low,  FREQ_BANDS.UPPER_MID.high),
      presence:  this.bandAverage(fftData, freqPerBin, FREQ_BANDS.PRESENCE.low,   FREQ_BANDS.PRESENCE.high),
      high:      this.bandAverage(fftData, freqPerBin, FREQ_BANDS.HIGH.low,       FREQ_BANDS.HIGH.high)
    }
  }

  /**
   * Returns the average dBFS value for all FFT bins within [lowHz, highHz].
   * Skips -Infinity values (silence bins) to avoid polluting averages.
   */
  bandAverage(
    fftData: Float32Array<ArrayBuffer>,
    freqPerBin: number,
    lowHz: number,
    highHz: number
  ): number {
    const lowBin  = Math.max(0, Math.floor(lowHz / freqPerBin))
    const highBin = Math.min(fftData.length - 1, Math.ceil(highHz / freqPerBin))

    if (lowBin > highBin) return -100

    let sum = 0
    let count = 0
    for (let i = lowBin; i <= highBin; i++) {
      const v = fftData[i]
      if (isFinite(v)) {
        sum += v
        count++
      }
    }

    return count > 0 ? sum / count : -100
  }

  /**
   * Compute RMS level in dBFS from the time-domain buffer.
   * Input: Float32Array from AnalyserNode.getFloatTimeDomainData() — values in [-1, 1].
   */
  computeRmsDb(timeDomainData: Float32Array<ArrayBuffer>): number {
    let sumSq = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      sumSq += timeDomainData[i] * timeDomainData[i]
    }
    const rms = Math.sqrt(sumSq / timeDomainData.length)
    // Avoid log10(0)
    return rms > 0 ? 20 * Math.log10(rms) : -100
  }

  /**
   * Compute peak level in dBFS from the time-domain buffer.
   */
  computePeakDb(timeDomainData: Float32Array<ArrayBuffer>): number {
    let peak = 0
    for (let i = 0; i < timeDomainData.length; i++) {
      const abs = Math.abs(timeDomainData[i])
      if (abs > peak) peak = abs
    }
    return peak > 0 ? 20 * Math.log10(peak) : -100
  }
}
