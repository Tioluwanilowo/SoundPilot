import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { LEVEL_THRESHOLDS } from '@shared/constants/frequencies'

const METER_HEIGHT = 180
const PEAK_HOLD_MS = 2000

export function SignalMeter(): React.ReactElement {
  const snapshot       = useAppStore(s => s.analysisSnapshot)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const peakHoldRef    = useRef<{ db: number; time: number }>({ db: -100, time: 0 })
  const rafRef         = useRef<number | null>(null)
  const snapshotRef    = useRef(snapshot)

  // Keep a ref in sync so the RAF loop doesn't close over stale state
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = 28
    canvas.height = METER_HEIGHT

    const draw = () => {
      const snap = snapshotRef.current
      const levelDb = snap?.levelDb ?? -100
      const peakDb  = snap?.peakDb  ?? -100
      const now = Date.now()

      // Update peak hold
      if (peakDb > peakHoldRef.current.db) {
        peakHoldRef.current = { db: peakDb, time: now }
      } else if (now - peakHoldRef.current.time > PEAK_HOLD_MS) {
        peakHoldRef.current.db = Math.max(peakHoldRef.current.db - 0.5, -100)
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // dBFS → pixel height (map -80 to 0 dBFS → 0 to METER_HEIGHT)
      const dbToY = (db: number): number => {
        const clamped = Math.max(-80, Math.min(0, db))
        return METER_HEIGHT - ((clamped + 80) / 80) * METER_HEIGHT
      }

      // Draw gradient bar
      const rmsY  = dbToY(levelDb)
      const barHeight = METER_HEIGHT - rmsY

      if (barHeight > 0) {
        const grad = ctx.createLinearGradient(0, METER_HEIGHT, 0, 0)
        grad.addColorStop(0,    '#22c55e')  // Green — healthy
        grad.addColorStop(0.65, '#eab308')  // Yellow — moderate
        grad.addColorStop(0.85, '#f97316')  // Orange — warning
        grad.addColorStop(1.0,  '#ef4444')  // Red — clip
        ctx.fillStyle = grad
        ctx.fillRect(4, rmsY, canvas.width - 8, barHeight)
      }

      // Draw tick marks at -6, -12, -18, -24, -40 dBFS
      const ticks = [-6, -12, -18, -24, -40]
      ctx.fillStyle = '#2a2d3a'
      for (const t of ticks) {
        const y = dbToY(t)
        ctx.fillRect(0, y, canvas.width, 1)
      }

      // Peak hold line
      const holdDb = peakHoldRef.current.db
      if (holdDb > -80) {
        const holdY = dbToY(holdDb)
        ctx.fillStyle = holdDb > LEVEL_THRESHOLDS.WARNING ? '#ef4444' : '#ffffff'
        ctx.fillRect(2, holdY, canvas.width - 4, 2)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const levelDb = snapshot?.levelDb ?? -100
  const clipping = snapshot?.clippingRisk ?? false

  return (
    <div className="signal-meter">
      <div className="signal-meter__label">IN</div>
      <canvas ref={canvasRef} className="signal-meter__canvas" />
      <div className={`signal-meter__readout ${clipping ? 'signal-meter__readout--clip' : ''}`}>
        {levelDb > -80 ? `${levelDb.toFixed(1)}` : '—'}
        <span className="signal-meter__unit">dB</span>
      </div>
    </div>
  )
}
