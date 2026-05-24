import React, { useRef, useEffect, useCallback } from 'react'
import type { ChannelSlotConfig, ChannelSlotState, SuggestionItem, CompressorParams, GateParams, LimiterParams } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { SOURCE_TYPE_LABELS } from '@shared/types'

// ── DSP param mini-grids (reused in channel cards) ────────────────────────────

function CompressorGrid({ p }: { p: CompressorParams }): React.ReactElement {
  return (
    <div className="dsp-params dsp-params--compressor">
      <div className="dsp-param"><span className="dsp-param__label">Threshold</span><span className="dsp-param__value">{p.threshold} dBFS</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Ratio</span><span className="dsp-param__value">{p.ratio}:1</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Knee</span><span className="dsp-param__value">{p.knee} dB</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Mix</span><span className="dsp-param__value">{p.mix}%</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Attack</span><span className="dsp-param__value">{p.attack} ms</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Hold</span><span className="dsp-param__value">{p.hold} ms</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Release</span><span className="dsp-param__value">{p.release} ms</span></div>
    </div>
  )
}

function GateGrid({ p }: { p: GateParams }): React.ReactElement {
  return (
    <div className="dsp-params dsp-params--gate">
      <div className="dsp-param"><span className="dsp-param__label">Threshold</span><span className="dsp-param__value">{p.threshold} dBFS</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Ratio</span><span className="dsp-param__value">{p.ratio}:1</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Knee</span><span className="dsp-param__value">{p.knee} dB</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Mix</span><span className="dsp-param__value">{p.mix}%</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Attack</span><span className="dsp-param__value">{p.attack} ms</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Hold</span><span className="dsp-param__value">{p.hold} ms</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Release</span><span className="dsp-param__value">{p.release} ms</span></div>
    </div>
  )
}

function LimiterGrid({ p }: { p: LimiterParams }): React.ReactElement {
  return (
    <div className="dsp-params dsp-params--limiter">
      <div className="dsp-param"><span className="dsp-param__label">Threshold</span><span className="dsp-param__value">{p.threshold} dBFS</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Attack</span><span className="dsp-param__value">{p.attack} ms</span></div>
      <div className="dsp-param"><span className="dsp-param__label">Hold</span><span className="dsp-param__value">{p.hold} ms</span></div>
    </div>
  )
}

interface ChannelCardProps {
  config:    ChannelSlotConfig
  state:     ChannelSlotState
  isActive:  boolean
  onClick:   () => void
  onDone:    (recId: string) => void
  onSkipped: (recId: string) => void
  onReanalyze: () => void
}

// ── Mini level meter (canvas) ─────────────────────────────────────────────────
function MiniMeter({ rmsDb, peakDb }: { rmsDb: number; peakDb: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const MIN_DB = -60
  const MAX_DB = 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const dbToX = (db: number) =>
      Math.max(0, ((db - MIN_DB) / (MAX_DB - MIN_DB)) * W)

    // Background track
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, W, H)

    // Gradient bar
    const rmsX = dbToX(rmsDb)
    if (rmsX > 0) {
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0,    '#22c55e')
      grad.addColorStop(0.65, '#eab308')
      grad.addColorStop(1,    '#ef4444')
      ctx.fillStyle = grad
      ctx.fillRect(0, 1, rmsX, H - 2)
    }

    // Peak tick
    const peakX = dbToX(peakDb)
    if (peakX > 0) {
      ctx.fillStyle = peakDb > -3 ? '#ef4444' : '#ffffff'
      ctx.fillRect(Math.min(peakX, W - 2), 0, 2, H)
    }
  }, [rmsDb, peakDb])

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={8}
      className="channel-card__meter-canvas"
    />
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ state }: { state: ChannelSlotState }) {
  if (state.status === 'idle') {
    return <span className="ch-badge ch-badge--idle">IDLE</span>
  }
  if (state.status === 'no-signal') {
    return <span className="ch-badge ch-badge--nosignal">NO SIGNAL</span>
  }
  if (state.status === 'listening') {
    return <span className="ch-badge ch-badge--listening">● LISTENING</span>
  }
  // ready
  const pending  = state.suggestions.filter(s => s.status === 'pending').length
  const done     = state.suggestions.filter(s => s.status === 'done').length
  const total    = state.suggestions.length
  if (total === 0) {
    return <span className="ch-badge ch-badge--clean">✓ CLEAN</span>
  }
  if (done === total) {
    return <span className="ch-badge ch-badge--done">✓ ALL DONE</span>
  }
  return <span className="ch-badge ch-badge--ready">{pending} suggestion{pending !== 1 ? 's' : ''}</span>
}

// ── Suggestion detail for expanded view ──────────────────────────────────────
function SlotSuggestionPanel({
  suggestions,
  slotId,
  onDone,
  onSkipped,
  onReanalyze
}: {
  suggestions: SuggestionItem[]
  slotId:      string
  onDone:      (recId: string) => void
  onSkipped:   (recId: string) => void
  onReanalyze: () => void
}) {
  if (suggestions.length === 0) {
    return (
      <div className="slot-suggestion-panel slot-suggestion-panel--empty">
        <p>No suggestions for this channel. Signal looks good.</p>
        <button className="btn btn--outline btn--sm" onClick={onReanalyze}>
          Re-analyze
        </button>
      </div>
    )
  }

  const allDone = suggestions.every(s => s.status !== 'pending')

  return (
    <div className="slot-suggestion-panel">
      {suggestions.map((item, idx) => {
        const rec = item.recommendation
        const isDone    = item.status === 'done'
        const isSkipped = item.status === 'skipped'
        const isPending = item.status === 'pending'

        return (
          <div
            key={rec.id}
            className={`slot-sug-card ${isDone ? 'slot-sug-card--done' : ''} ${isSkipped ? 'slot-sug-card--skipped' : ''}`}
          >
            <div className="slot-sug-card__header">
              <span className={`sug-tag sug-tag--${getTagColor(rec.action)}`}>
                {rec.action.replace(/_/g, ' ')}
              </span>
              {rec.frequency && (
                <span className="sug-freq">{formatFreq(rec.frequency)}</span>
              )}
              {rec.eqBand !== undefined && (
                <span className="sug-band" title="EQ Band">B{rec.eqBand}</span>
              )}
              {rec.amount && (
                <span className="sug-amount">
                  {rec.amount > 0 ? '+' : ''}{rec.amount.toFixed(1)} dB
                </span>
              )}
              <span className="sug-index">#{idx + 1}</span>
            </div>

            <p className="slot-sug-card__reason">{rec.reason}</p>

            {rec.compressorParams && <CompressorGrid p={rec.compressorParams} />}
            {rec.gateParams       && <GateGrid      p={rec.gateParams} />}
            {rec.limiterParams    && <LimiterGrid   p={rec.limiterParams} />}

            {item.mixerSteps && item.mixerSteps.length > 0 && (
              <ol className="slot-sug-card__steps">
                {item.mixerSteps.map(step => (
                  <li key={step.step}>{step.text}</li>
                ))}
              </ol>
            )}

            {isPending && (
              <div className="slot-sug-card__actions">
                <button
                  className="btn btn--confirm"
                  onClick={() => onDone(rec.id)}
                >
                  ✓ Done
                </button>
                <button
                  className="btn btn--skip"
                  onClick={() => onSkipped(rec.id)}
                >
                  Skip →
                </button>
              </div>
            )}

            {isDone    && <p className="slot-sug-card__status-label sug-done-label">✓ Marked as done</p>}
            {isSkipped && <p className="slot-sug-card__status-label sug-skip-label">→ Skipped</p>}
          </div>
        )
      })}

      {allDone && (
        <div className="slot-sug-footer">
          <p>All suggestions addressed.</p>
          <button className="btn btn--outline" onClick={onReanalyze}>
            ↺ Re-analyze this channel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ChannelCard ──────────────────────────────────────────────────────────
export function ChannelCard({
  config, state, isActive, onClick, onDone, onSkipped, onReanalyze
}: ChannelCardProps) {
  const { status, rmsDb, peakDb, listeningProgress, secondsRemaining, suggestions } = state
  const pending = suggestions.filter(s => s.status === 'pending').length

  return (
    <div
      className={`channel-card ${isActive ? 'channel-card--active' : ''} channel-card--${status}`}
      onClick={!isActive ? onClick : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' && !isActive) onClick() }}
      aria-label={`Channel ${config.mixerChannelNumber} ${config.label}`}
    >
      {/* Header row */}
      <div className="channel-card__header">
        <div className="channel-card__id">
          <span className="channel-card__number">CH {config.mixerChannelNumber}</span>
          <span className="channel-card__source">
            {SOURCE_TYPE_LABELS[config.sourceType] ?? config.sourceType}
          </span>
        </div>
        <StatusBadge state={state} />
      </div>

      {/* Label */}
      <div className="channel-card__label">{config.label}</div>

      {/* Meter */}
      <div className="channel-card__meter">
        <MiniMeter rmsDb={rmsDb} peakDb={peakDb} />
        <span className="channel-card__db">
          {rmsDb <= -60 ? '–∞' : `${rmsDb.toFixed(1)} dB`}
        </span>
      </div>

      {/* Progress bar when listening */}
      {status === 'listening' && (
        <div className="channel-card__progress">
          <div
            className="channel-card__progress-fill"
            style={{ width: `${listeningProgress}%` }}
          />
          <span className="channel-card__progress-label">
            {secondsRemaining}s remaining
          </span>
        </div>
      )}

      {/* Ready summary */}
      {status === 'ready' && suggestions.length > 0 && (
        <div className="channel-card__summary">
          {pending > 0
            ? `${pending} pending suggestion${pending !== 1 ? 's' : ''}`
            : '✓ All done'}
        </div>
      )}

      {/* Expanded suggestion panel */}
      {isActive && status === 'ready' && (
        <SlotSuggestionPanel
          suggestions={suggestions}
          slotId={config.id}
          onDone={onDone}
          onSkipped={onSkipped}
          onReanalyze={onReanalyze}
        />
      )}

      {/* Click-to-expand hint when ready and not active */}
      {!isActive && status === 'ready' && (
        <div className="channel-card__expand-hint">Tap to view suggestions</div>
      )}
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz}Hz`
}

function getTagColor(action: string): string {
  if (action.includes('hpf') || action.includes('cut') || action.includes('reduce')) return 'red'
  if (action.includes('boost') || action.includes('increase'))                        return 'blue'
  if (action.includes('phantom') || action.includes('pad'))                           return 'purple'
  if (action.includes('compression') || action.includes('gain'))                      return 'orange'
  if (action.includes('cable') || action.includes('mic'))                             return 'amber'
  return 'green'
}
