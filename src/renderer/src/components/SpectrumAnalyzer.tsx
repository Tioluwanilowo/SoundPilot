import React, { useEffect, useRef, useCallback } from 'react'
import type { AnalysisResult, IssueType } from '@shared/types'
import { SPECTRUM_LABELS } from '@shared/constants/frequencies'

const MIN_FREQ = 20
const MAX_FREQ = 20000
const MIN_DB   = -90
const MAX_DB   = 0

/**
 * Maps issue types to [lowHz, highHz, fillColor] for spectrum highlighting.
 * When an issue is detected, the relevant frequency region is tinted on the canvas.
 */
const ISSUE_HIGHLIGHTS: Partial<Record<IssueType, [number, number, string]>> = {
  rumble:       [20,   80,    'rgba(239, 68, 68, 0.18)'],
  muddiness:    [100,  400,   'rgba(234, 179, 8, 0.15)'],
  boominess:    [80,   160,   'rgba(249, 115, 22, 0.18)'],
  harshness:    [2000, 5000,  'rgba(249, 115, 22, 0.18)'],
  thinness:     [80,   300,   'rgba(59, 130, 246, 0.15)'],
  low_clarity:  [4000, 8000,  'rgba(59, 130, 246, 0.15)'],
  clipping_risk:[100,  20000, 'rgba(239, 68, 68, 0.08)']
}

interface Props {
  latestResultRef: React.MutableRefObject<AnalysisResult | null>
  width?: number
  height?: number
}

/**
 * SpectrumAnalyzer — draws a real-time frequency spectrum + issue highlights.
 *
 * Renders via Canvas + requestAnimationFrame, completely outside React's
 * render cycle. Reads from `latestResultRef` which is updated by the
 * analysis pipeline hook on every audio frame.
 *
 * X axis: logarithmic frequency (20 Hz – 20 kHz)
 * Y axis: dBFS level (-90 to 0), grid at -12, -24, -36, -48, -60
 */
export function SpectrumAnalyzer({ latestResultRef, width = 600, height = 180 }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)

  // Pure functions — no dependencies on component scope
  const freqToX = useCallback((freq: number, w: number): number => {
    return (Math.log10(freq / MIN_FREQ) / Math.log10(MAX_FREQ / MIN_FREQ)) * w
  }, [])

  const dbToY = useCallback((db: number, h: number): number => {
    const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db))
    return h - ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * h
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // HiDPI (Retina) support
    const dpr = window.devicePixelRatio || 1
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    canvas.style.width  = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const draw = (): void => {
      ctx.clearRect(0, 0, width, height)

      // ── Background ────────────────────────────────────────────────────────
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, width, height)

      const result = latestResultRef.current

      // ── Issue frequency highlights (drawn under the spectrum) ─────────────
      if (result?.issues && result.issues.length > 0) {
        for (const issue of result.issues) {
          const hl = ISSUE_HIGHLIGHTS[issue.type]
          if (!hl) continue
          const [lo, hi, color] = hl
          const x1 = freqToX(lo, width)
          const x2 = freqToX(hi, width)
          ctx.fillStyle = color
          ctx.fillRect(x1, 0, x2 - x1, height)
          // Top accent line for highlighted region
          ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.6)')
          ctx.fillRect(x1, 0, x2 - x1, 2)
        }
      }

      // ── dB grid lines ─────────────────────────────────────────────────────
      ctx.strokeStyle = '#1e2433'
      ctx.lineWidth = 1
      const dbGrid = [0, -12, -24, -36, -48, -60, -72]
      for (const db of dbGrid) {
        const y = dbToY(db, height)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // ── Frequency grid lines ───────────────────────────────────────────────
      for (const [freq] of SPECTRUM_LABELS) {
        const x = freqToX(freq, width)
        ctx.strokeStyle = '#1a1f30'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      // ── Frequency labels ──────────────────────────────────────────────────
      ctx.fillStyle = '#3a4460'
      ctx.font = '9px monospace'
      for (const [freq, label] of SPECTRUM_LABELS) {
        const x = freqToX(freq, width)
        ctx.fillText(label, x + 2, height - 3)
      }

      // ── dB labels ─────────────────────────────────────────────────────────
      ctx.fillStyle = '#2a3050'
      ctx.font = '9px monospace'
      for (const db of [-12, -24, -48]) {
        const y = dbToY(db, height)
        ctx.fillText(`${db}`, 2, y - 2)
      }

      // ── No signal state ───────────────────────────────────────────────────
      if (!result || !result.signalPresent) {
        ctx.fillStyle = '#2a3050'
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(
          result === null ? 'Press Start Analysis to begin' : 'No signal — check input level',
          width / 2,
          height / 2
        )
        ctx.textAlign = 'left'
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const { fftData, sampleRate, fftSize } = result
      const freqPerBin = sampleRate / fftSize

      // ── Spectrum filled area ──────────────────────────────────────────────
      // Build the top-edge path first (reused for both fill and stroke)
      const points: [number, number][] = []
      for (let x = 0; x < width; x++) {
        const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, x / width)
        const bin  = Math.round(freq / freqPerBin)
        if (bin >= fftData.length) continue
        const db = fftData[bin]
        const y  = isFinite(db) ? dbToY(db, height) : height
        points.push([x, y])
      }

      if (points.length > 0) {
        // Filled area
        ctx.beginPath()
        ctx.moveTo(points[0][0], height)
        for (const [x, y] of points) ctx.lineTo(x, y)
        ctx.lineTo(points[points.length - 1][0], height)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, 0, 0, height)
        grad.addColorStop(0,    'rgba(0, 210, 255, 0.85)')
        grad.addColorStop(0.4,  'rgba(0, 160, 200, 0.45)')
        grad.addColorStop(1,    'rgba(0,  80, 150, 0.05)')
        ctx.fillStyle = grad
        ctx.fill()

        // Top edge stroke
        ctx.beginPath()
        ctx.moveTo(points[0][0], points[0][1])
        for (const [x, y] of points) ctx.lineTo(x, y)
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.9)'
        ctx.lineWidth   = 1.5
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [width, height, freqToX, dbToY, latestResultRef])

  return (
    <div className="spectrum-analyzer">
      <canvas ref={canvasRef} className="spectrum-analyzer__canvas" />
    </div>
  )
}
